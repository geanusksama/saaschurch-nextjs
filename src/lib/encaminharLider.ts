/**
 * Encaminhamento da conversa para o líder da área de interesse.
 *
 * O agente de recepção, quando a pessoa demonstra interesse numa área (EBD,
 * GF, Jovens, Casais, ajuda pastoral...), termina a mensagem com
 *   [[ENCAMINHAR]]{"interesses":["EBD"],"sexo":"M","resumo":"..."}[[/ENCAMINHAR]]
 * O sistema remove o bloco e, DEPOIS de responder a pessoa, manda para cada
 * líder configurado (recepcao.encaminhamentos da instância) uma mensagem
 * identificada como da "Secretária Virtual da Sede", com o contato, os links
 * dos pedidos dela e o resumo — pedindo o retorno para o relatório.
 *
 * Cada área é encaminhada uma vez por conversa (metadata.encaminhados).
 */

import { supabaseAdmin } from '@/lib/supabase-admin'
import { ensureConversation, persistOutboundMessage, sendTextViaZApi } from '@/lib/whatsappSendService'
import { AREA_PADRAO_ROTULO, lerRecepcao, lideresPadrao, normalizarTexto, type Encaminhamento } from '@/lib/recepcaoWhatsapp'
import { pedidosDoContato } from '@/lib/pedidosDoContato'

export const MARCA_ENCAMINHAR_INICIO = '[[ENCAMINHAR]]'
export const MARCA_ENCAMINHAR_FIM = '[[/ENCAMINHAR]]'

export const ASSINATURA_SECRETARIA = 'Secretária Virtual da Sede'

export interface DadosEncaminhar {
  interesses: string[]
  sexo?: string
  resumo?: string
}

/** Tira o bloco de encaminhamento do texto. Bloco quebrado some e volta null. */
export function extrairEncaminhar(texto: string): { texto: string; dados: DadosEncaminhar | null } {
  const i = texto.indexOf(MARCA_ENCAMINHAR_INICIO)
  if (i < 0) return { texto, dados: null }
  const f = texto.indexOf(MARCA_ENCAMINHAR_FIM, i)
  const bruto = texto.slice(i + MARCA_ENCAMINHAR_INICIO.length, f < 0 ? undefined : f)
  const limpo = (texto.slice(0, i) + (f < 0 ? '' : texto.slice(f + MARCA_ENCAMINHAR_FIM.length))).trim()
  try {
    const j = JSON.parse(bruto.replace(/^[\s`]*(json)?/i, '').replace(/[\s`]*$/, ''))
    const interesses = Array.isArray(j?.interesses) ? j.interesses.map((x: unknown) => String(x).trim()).filter(Boolean) : []
    if (!interesses.length) return { texto: limpo, dados: null }
    return { texto: limpo, dados: { interesses, sexo: String(j.sexo ?? ''), resumo: String(j.resumo ?? '').trim() } }
  } catch {
    console.error('[encaminharLider] bloco inválido', bruto.slice(0, 300))
    return { texto: limpo, dados: null }
  }
}

/** Líderes da área, respeitando o filtro de sexo (sem sexo conhecido: todos da área). */
export function lideresDaArea(lista: Encaminhamento[], interesse: string, sexo: string): Encaminhamento[] {
  const alvo = normalizarTexto(interesse)
  const s = sexo === 'M' || sexo === 'F' ? sexo : ''
  const daArea = lista.filter(e => normalizarTexto(e.interesse) === alvo)
  const filtrados = daArea.filter(e => !e.sexo || !s || e.sexo === s)
  return filtrados.length ? filtrados : daArea.filter(e => !e.sexo)
}

function formatarTelefone(t: string): string {
  const d = t.replace(/\D/g, '')
  const local = d.startsWith('55') ? d.slice(2) : d
  return local.length >= 10 ? `(${local.slice(0, 2)}) ${local.slice(2, -4)}-${local.slice(-4)}` : t
}

export function montarMensagemLider(p: {
  lider: string
  interesse: string
  nome: string
  telefone: string
  resumo: string
  links: string[]
}): string {
  return [
    `*${ASSINATURA_SECRETARIA}*`,
    '',
    `A paz do Senhor${p.lider ? `, ${p.lider}` : ''}. Quem envia esta mensagem é a ${ASSINATURA_SECRETARIA}.`,
    `Encaminho um contato que demonstrou interesse em *${p.interesse}* no atendimento pelo WhatsApp, para você conversar com essa pessoa.`,
    '',
    `Nome: ${p.nome || 'não informado'}`,
    `WhatsApp: ${formatarTelefone(p.telefone)} — https://wa.me/${p.telefone.replace(/\D/g, '')}`,
    ...(p.links.length ? ['', ...p.links] : []),
    '',
    'Resumo da conversa:',
    p.resumo || '(sem resumo)',
    '',
    'Quando puder, envie o resultado dessa conversa para ser apresentado em relatório. Deus abençoe.',
  ].join('\n')
}

type Instancia = { id: string; instance_id: string; token: string; client_token: string; owner_user_id?: string | null }

export async function encaminharParaLideres(params: {
  instanceId: string
  conversationId: string
  telefoneContato: string
  dados: DadosEncaminhar
}): Promise<{ enviados: number; semLider: string[] }> {
  const { data: inst } = await supabaseAdmin
    .from('whatsapp_instances')
    .select('id, instance_id, token, client_token, owner_user_id, metadata')
    .eq('id', params.instanceId)
    .single()
  if (!inst) return { enviados: 0, semLider: params.dados.interesses }
  const cfg = lerRecepcao(inst.metadata)
  const temPadrao = cfg.encaminhamentos.some(e => e.padrao)

  const { data: conv } = await supabaseAdmin
    .from('whatsapp_conversations')
    .select('contact_name, metadata')
    .eq('id', params.conversationId)
    .single()
  const meta = (conv?.metadata ?? {}) as Record<string, unknown>
  const estado = (meta.recepcao_estado ?? {}) as Record<string, unknown>
  const ja = { ...((meta.encaminhados ?? {}) as Record<string, string>) }
  const nome = String(estado.nome || conv?.contact_name || '').trim()

  const pedidos = await pedidosDoContato(params.telefoneContato)
  const links = pedidos
    .filter(p => p.aberto)
    .map(p => `${p.tipoRotulo} (fase: ${p.fase}) — histórico: ${p.linkAcompanhamento}`)

  let enviados = 0
  const semLider: string[] = []
  for (const interesse of params.dados.interesses) {
    const chave = normalizarTexto(interesse)
    if (ja[chave]) continue
    const sexo = params.dados.sexo ?? ''
    const ehPadrao = chave === normalizarTexto(AREA_PADRAO_ROTULO)
    let lideres = ehPadrao ? lideresPadrao(cfg.encaminhamentos, sexo) : lideresDaArea(cfg.encaminhamentos, interesse, sexo)
    let rotuloArea = ehPadrao ? 'Atendimento geral (sem área definida ou pedido de falar com alguém)' : (lideres[0]?.interesse ?? interesse)
    if (!lideres.length) {
      // área sem líder configurado (ex.: Adolescentes): vai para os líderes
      // padrão do sexo da pessoa — nunca some sem avisar ninguém
      semLider.push(interesse)
      if (!temPadrao) continue
      lideres = lideresPadrao(cfg.encaminhamentos, sexo)
      if (!lideres.length) continue
      rotuloArea = `${interesse} (área sem líder cadastrado — encaminhado ao atendimento padrão)`
    }

    for (const l of lideres) {
      const texto = montarMensagemLider({
        lider: l.nome, interesse: rotuloArea, nome,
        telefone: params.telefoneContato, resumo: params.dados.resumo ?? '', links,
      })
      try {
        const r = await sendTextViaZApi(inst as Instancia, l.telefone, texto)
        if (r.status === 'sent') {
          enviados++
          // aparece na Caixa de Entrada como conversa com o líder
          if (inst.owner_user_id) {
            const cid = await ensureConversation(inst.id, inst.owner_user_id, l.telefone, l.nome)
            await persistOutboundMessage(cid, texto, r.messageId || undefined)
          }
        }
      } catch (err) {
        console.error('[encaminharLider] envio falhou', l.telefone, err)
      }
    }
    ja[chave] = new Date().toISOString()
  }

  await supabaseAdmin
    .from('whatsapp_conversations')
    .update({ metadata: { ...meta, encaminhados: ja } })
    .eq('id', params.conversationId)

  return { enviados, semLider }
}
