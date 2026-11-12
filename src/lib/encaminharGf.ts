/**
 * Grupos Familiares (GF) no atendimento do agente de recepção.
 *
 *  - textoGfsParaAgente: a lista dos GFs ativos da sede (mesma consulta da
 *    página pública /gf — gfPublicListService) entra no contexto do agente,
 *    para ele sugerir o GF pelo perfil da pessoa (tipo do GF, bairro, cidade)
 *    e mandar o link da página /gf.
 *  - Quando a pessoa aceita ou se interessa, o agente termina com
 *      [[GF]]{"gf":"Nome do GF","resumo":"..."}[[/GF]]
 *    e o sistema avisa NA HORA os líderes daquele GF (todos os do cadastro),
 *    identificado como "Secretária Virtual da Sede". Uma vez por GF por
 *    conversa (metadata.gf_encaminhados).
 *  - Conversa com assunto reservado: a mensagem ao GF vai SEM resumo (o
 *    resumo poderia carregar o assunto).
 */

import { supabaseAdmin } from '@/lib/supabase-admin'
import { prisma } from '@/lib/prisma'
import { DEFAULT_SEDE_ID, listPublicGfs, type PublicGfItem } from '@/lib/gfPublicListService'
import { ensureConversation, normalizarNumeroBrasil, persistOutboundMessage, sendTextViaZApi } from '@/lib/whatsappSendService'
import { ASSINATURA_SECRETARIA, conversaReservada } from '@/lib/encaminharLider'
import { normalizarTexto } from '@/lib/recepcaoWhatsapp'

export const MARCA_GF_INICIO = '[[GF]]'
export const MARCA_GF_FIM = '[[/GF]]'

export interface DadosGf {
  gf: string
  resumo: string
}

/** Tira TODOS os blocos [[GF]] do texto (um por GF aceito). Bloco quebrado some. */
export function extrairGfs(texto: string): { texto: string; dados: DadosGf[] } {
  let resto = texto
  const dados: DadosGf[] = []
  for (let i = 0; i < 10 && resto.includes(MARCA_GF_INICIO); i++) {
    const r = extrairGf(resto)
    resto = r.texto
    if (r.dados && !dados.some(d => normalizarTexto(d.gf) === normalizarTexto(r.dados!.gf))) dados.push(r.dados)
  }
  return { texto: resto, dados }
}

/** Tira o primeiro bloco [[GF]] do texto. Bloco quebrado some e volta null. */
export function extrairGf(texto: string): { texto: string; dados: DadosGf | null } {
  const i = texto.indexOf(MARCA_GF_INICIO)
  if (i < 0) return { texto, dados: null }
  const f = texto.indexOf(MARCA_GF_FIM, i)
  const bruto = texto.slice(i + MARCA_GF_INICIO.length, f < 0 ? undefined : f)
  const limpo = (texto.slice(0, i) + (f < 0 ? '' : texto.slice(f + MARCA_GF_FIM.length))).trim()
  try {
    const j = JSON.parse(bruto.replace(/^[\s`]*(json)?/i, '').replace(/[\s`]*$/, ''))
    const gf = String(j?.gf ?? '').trim()
    if (!gf) return { texto: limpo, dados: null }
    return { texto: limpo, dados: { gf, resumo: String(j?.resumo ?? '').trim() } }
  } catch {
    console.error('[encaminharGf] bloco inválido', bruto.slice(0, 300))
    return { texto: limpo, dados: null }
  }
}

const CACHE_MS = 5 * 60_000
const cacheGfs = new Map<string, { quando: number; lista: Promise<PublicGfItem[]> }>()

/**
 * GFs do campo do agente. A lista pública (/gf) é a da sede DEFAULT_SEDE_ID;
 * agente de OUTRO campo não recebe GF nenhum (campo ativo filtra tudo — nunca
 * sugerir nem avisar líder de GF de outro campo). Cache de 5 min: roda a cada
 * resposta do agente.
 */
export async function gfsDoCampo(campoId: string | null): Promise<PublicGfItem[]> {
  if (!campoId) return []
  const agora = Date.now()
  const c = cacheGfs.get(campoId)
  if (c && agora - c.quando < CACHE_MS) return c.lista
  const lista = (async () => {
    const sede = await prisma.church.findUnique({ where: { id: DEFAULT_SEDE_ID }, select: { regional: { select: { campoId: true } } } })
    return sede?.regional?.campoId === campoId ? listPublicGfs(DEFAULT_SEDE_ID) : []
  })()
  cacheGfs.set(campoId, { quando: agora, lista })
  lista.catch(() => cacheGfs.delete(campoId))
  return lista
}

/** GF pelo nome que o agente escreveu (sem acento/caixa; aceita "GF Hineni"). */
export function acharGf(lista: PublicGfItem[], nome: string): PublicGfItem | null {
  const alvo = normalizarTexto(nome).replace(/^gf\s+/, '')
  return lista.find(g => normalizarTexto(g.name) === alvo)
    ?? lista.find(g => alvo.includes(normalizarTexto(g.name)) || normalizarTexto(g.name).includes(alvo))
    ?? null
}

/** Bloco do contexto do agente com os GFs. Nunca lança. */
export async function textoGfsParaAgente(campoId: string | null, siteBase: string, jaEncaminhados: string[]): Promise<string> {
  try {
    const gfs = await gfsDoCampo(campoId)
    if (!gfs.length) return ''
    return [
      '',
      `=== GRUPOS FAMILIARES (GF) — página com a lista e o mapa: ${siteBase}/gf ===`,
      ...gfs.map(g => {
        const onde = [g.addressNeighborhood, g.addressCity].filter(Boolean).join(', ')
        const quando = [g.meetingDay, g.meetingTime].filter(Boolean).join(' ')
        const lideres = (g.leaders.length ? g.leaders.map(l => l.name) : [g.leaderName]).filter(Boolean).join(' e ')
        return `- ${g.name}${g.cellType ? ` (${g.cellType})` : ''}${quando ? ` — ${quando}` : ''}${onde ? ` — ${onde}` : ''}${lideres ? ` — líderes: ${lideres}` : ''}`
      }),
      'Nunca passe telefone de líder: quem faz o contato é o líder, avisado pelo sistema.',
      jaEncaminhados.length ? `GFs já avisados nesta conversa (não repita o bloco): ${jaEncaminhados.join(', ')}.` : '',
    ].filter(Boolean).join('\n')
  } catch (err) {
    console.error('[encaminharGf] lista de GFs', err)
    return ''
  }
}

function formatarTelefone(t: string): string {
  const d = t.replace(/\D/g, '')
  const local = d.startsWith('55') ? d.slice(2) : d
  return local.length >= 10 ? `(${local.slice(0, 2)}) ${local.slice(2, -4)}-${local.slice(-4)}` : t
}

export function montarMensagemGf(p: { lider: string; gf: string; nome: string; telefone: string; resumo: string | null }): string {
  return [
    `*${ASSINATURA_SECRETARIA}*`,
    '',
    `A paz do Senhor${p.lider ? `, ${p.lider}` : ''}. Uma pessoa atendida pelo WhatsApp da igreja se interessou pelo GF *${p.gf}* e aceitou que você entre em contato.`,
    '',
    `Nome: ${p.nome || 'não informado'}`,
    `WhatsApp: ${formatarTelefone(p.telefone)} — https://wa.me/${p.telefone.replace(/\D/g, '')}`,
    ...(p.resumo ? ['', 'Resumo:', p.resumo] : []),
    '',
    'Quando puder, mande uma mensagem de boas-vindas e o convite para o próximo encontro. Deus abençoe.',
  ].join('\n')
}

type Instancia = { id: string; instance_id: string; token: string; client_token: string; owner_user_id?: string | null }

/** Avisa os líderes do GF escolhido. Uma vez por GF por conversa. Nunca lança. */
export async function encaminharParaGf(params: {
  instanceId: string
  conversationId: string
  telefoneContato: string
  /** campo do agente: só GFs desse campo (gfsDoCampo) */
  campoId: string | null
  dados: DadosGf
}): Promise<{ enviados: number; gf: string | null }> {
  try {
    const [{ data: inst }, { data: conv }, gfs] = await Promise.all([
      supabaseAdmin.from('whatsapp_instances').select('id, instance_id, token, client_token, owner_user_id').eq('id', params.instanceId).single(),
      supabaseAdmin.from('whatsapp_conversations').select('contact_name, metadata').eq('id', params.conversationId).single(),
      gfsDoCampo(params.campoId),
    ])
    if (!inst) return { enviados: 0, gf: null }
    const gf = acharGf(gfs, params.dados.gf)
    if (!gf) {
      console.warn('[encaminharGf] GF não encontrado', params.dados.gf)
      return { enviados: 0, gf: null }
    }
    const meta = (conv?.metadata ?? {}) as Record<string, unknown>
    const ja = { ...((meta.gf_encaminhados ?? {}) as Record<string, string>) }
    if (ja[gf.id]) return { enviados: 0, gf: gf.name }

    const estado = (meta.recepcao_estado ?? {}) as Record<string, unknown>
    const nome = String(estado.nome || conv?.contact_name || '').trim()
    // conversa reservada: nada de resumo (pode carregar o assunto)
    const resumo = conversaReservada(null, meta) ? null : (params.dados.resumo || null)

    const lideres = (gf.leaders.length ? gf.leaders : [{ name: gf.leaderName ?? '', phone: gf.leaderPhone }])
      .map(l => ({ nome: l.name ?? '', telefone: normalizarNumeroBrasil(l.phone ?? '') }))
      .filter(l => l.telefone.replace(/\D/g, '').length >= 12)

    let enviados = 0
    for (const l of lideres) {
      const texto = montarMensagemGf({ lider: l.nome.split(' ')[0] ?? '', gf: gf.name, nome, telefone: params.telefoneContato, resumo })
      try {
        const r = await sendTextViaZApi(inst as Instancia, l.telefone, texto)
        if (r.status === 'sent') {
          enviados++
          if (inst.owner_user_id) {
            const cid = await ensureConversation(inst.id, inst.owner_user_id, l.telefone, l.nome)
            await persistOutboundMessage(cid, texto, r.messageId || undefined)
          }
        }
      } catch (err) {
        console.error('[encaminharGf] envio falhou', l.telefone, err)
      }
    }
    if (!lideres.length) console.warn('[encaminharGf] GF sem telefone de líder', gf.name)

    ja[gf.id] = new Date().toISOString()
    const nomes = { ...((meta.gf_encaminhados_nomes ?? {}) as Record<string, string>), [gf.id]: gf.name }
    await supabaseAdmin
      .from('whatsapp_conversations')
      .update({ metadata: { ...meta, gf_encaminhados: ja, gf_encaminhados_nomes: nomes } })
      .eq('id', params.conversationId)
    return { enviados, gf: gf.name }
  } catch (err) {
    console.error('[encaminharGf] falhou', err)
    return { enviados: 0, gf: null }
  }
}
