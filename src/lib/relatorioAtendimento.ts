/**
 * Relatórios do atendimento do agente de IA no WhatsApp (Caixa → aba
 * "Relatórios"). Lê as conversas atendidas pelos agentes do campo no período
 * e a MEMÓRIA que o agente mantém em cada uma (metadata.recepcao_estado:
 * nome, igreja anterior, tempo na sede, interesses, GF, visita...).
 *
 * Sigilo: conversa com assunto reservado entra só nas contagens — nunca com
 * nome, telefone, assunto ou resumo — e nunca vai para a análise da IA.
 */

import { prisma } from '@/lib/prisma'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { conversaReservada } from '@/lib/encaminharLider'
import { AREA_PADRAO_ROTULO, lerRecepcao, normalizarTexto } from '@/lib/recepcaoWhatsapp'
import { generateAiText, loadConversationHistory } from '@/lib/aiReplyService'

export interface FiltroRelatorio {
  /** AAAA-MM-DD (Brasília), inclusive */
  de: string
  ate: string
  departamento?: string | null
  campoId: string | null
  /** null = sem filtro (master); senão só estas instâncias */
  instancias: Set<string> | null
}

export interface ConversaRelatorio {
  id: string
  reservado: boolean
  nome: string
  telefone: string
  inicio: string
  ultima: string | null
  origem: string
  agente: string
  assunto: string
  etapa: string
  interesses: string[]
  encaminhados: string[]
  gfs: string[]
  igrejaAnterior: string
  tempoNaSede: string
  faixaTempo: string
  jaFoiAbordado: boolean | null
  conheceGF: boolean | null
  faixaEtaria: string
  perfil: string
  bairro: string
  querVisita: boolean | null
  dataVisita: string
  queroSerMembro: boolean
  pedidoOracao: boolean
  pediuHumano: boolean
  audios: number
  resumoIa: string
}

export interface Contagem { rotulo: string; total: number }

export interface Relatorio {
  periodo: { de: string; ate: string }
  totais: {
    conversas: number
    viaQr: number
    deOutraIgreja: number
    semIgrejaAnterior: number
    jaAbordados: number
    naoAbordados: number
    conhecemGF: number
    naoConhecemGF: number
    encaminhadosGF: number
    querVisita: number
    queroSerMembro: number
    pedidosOracao: number
    pediuHumano: number
    reservados: number
    comAudio: number
  }
  porDia: Contagem[]
  porDepartamento: Contagem[]
  porTempoNaSede: Contagem[]
  porAssunto: Contagem[]
  porGf: Contagem[]
  porFaixaEtaria: Contagem[]
  departamentos: string[]
  conversas: ConversaRelatorio[]
}

const DIA_MS = 86_400_000
const BRT_MS = 3 * 3_600_000

/** Início do dia em Brasília (AAAA-MM-DD) como instante UTC. */
export function inicioDoDia(dia: string): Date {
  return new Date(new Date(`${dia}T00:00:00Z`).getTime() + BRT_MS)
}

export function diaBrasilia(iso: string): string {
  return new Date(new Date(iso).getTime() - BRT_MS).toISOString().slice(0, 10)
}

const NEGATIVO = /^(nao|nenhuma?|nunca|sem igreja|nao frequentava|-)$/

/** "Veio de outra igreja?" pelo que o agente anotou em igrejaAnterior. */
export function veioDeOutraIgreja(igrejaAnterior: string): boolean | null {
  const t = normalizarTexto(igrejaAnterior)
  if (!t) return null
  if (NEGATIVO.test(t) || t.startsWith('nao ') || t.startsWith('nunca')) return false
  return true
}

/** Faixa do tempo na sede a partir do texto livre que o agente anotou. */
export function faixaTempoNaSede(texto: string): string {
  const t = normalizarTexto(texto)
  if (!t) return 'Não informado'
  if (/primeira|hoje|ontem|primeiro (dia|culto)|1a vez|nunca veio/.test(t)) return 'Primeira vez'
  if (/\bano/.test(t)) return '1 ano ou mais'
  if (/\bmes|\bmeses/.test(t)) {
    const n = Number((t.match(/(\d+)\s*mes/) ?? [])[1])
    return n >= 12 ? '1 ano ou mais' : '1 a 11 meses'
  }
  if (/dia|semana|pouco tempo|recente/.test(t)) return 'Menos de 1 mês'
  return 'Outro'
}

const ORDEM_TEMPO = ['Primeira vez', 'Menos de 1 mês', '1 a 11 meses', '1 ano ou mais', 'Outro', 'Não informado']

function contar(lista: string[], ordem?: string[]): Contagem[] {
  const m = new Map<string, number>()
  for (const r of lista) if (r) m.set(r, (m.get(r) ?? 0) + 1)
  const out = [...m.entries()].map(([rotulo, total]) => ({ rotulo, total }))
  return ordem
    ? out.sort((a, b) => ordem.indexOf(a.rotulo) - ordem.indexOf(b.rotulo))
    : out.sort((a, b) => b.total - a.total || a.rotulo.localeCompare(b.rotulo))
}

const bool = (v: unknown): boolean | null => (v === true ? true : v === false ? false : null)
const txt = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/** Monta o relatório do período. */
export async function montarRelatorio(f: FiltroRelatorio): Promise<Relatorio> {
  const vazio = (): Relatorio => ({
    periodo: { de: f.de, ate: f.ate },
    totais: {
      conversas: 0, viaQr: 0, deOutraIgreja: 0, semIgrejaAnterior: 0, jaAbordados: 0, naoAbordados: 0,
      conhecemGF: 0, naoConhecemGF: 0, encaminhadosGF: 0, querVisita: 0, queroSerMembro: 0,
      pedidosOracao: 0, pediuHumano: 0, reservados: 0, comAudio: 0,
    },
    porDia: [], porDepartamento: [], porTempoNaSede: [], porAssunto: [], porGf: [], porFaixaEtaria: [],
    departamentos: [], conversas: [],
  })
  if (!f.campoId) return vazio()

  const agentes = await prisma.aiAgent.findMany({ where: { campoId: f.campoId }, select: { id: true, name: true }, take: 50 })
  if (!agentes.length) return vazio()
  const nomeAgente = new Map(agentes.map(a => [a.id, a.name]))

  const ini = inicioDoDia(f.de)
  const fim = new Date(inicioDoDia(f.ate).getTime() + DIA_MS)

  let q = supabaseAdmin
    .from('whatsapp_conversations')
    .select('id, instance_id, phone, contact_name, ai_agent_id, metadata, created_at, last_message_at')
    .in('ai_agent_id', agentes.map(a => a.id))
    .gte('last_message_at', ini.toISOString())
    .lt('created_at', fim.toISOString())
    .order('last_message_at', { ascending: false })
    .limit(1000)
  if (f.instancias) q = q.in('instance_id', [...f.instancias].length ? [...f.instancias] : ['00000000-0000-0000-0000-000000000000'])
  const { data: convs } = await q

  // o atendimento conta no dia em que começou (recepcao_inicio), senão na criação
  const doPeriodo = (convs ?? []).filter(c => {
    const meta = (c.metadata ?? {}) as Record<string, unknown>
    const inicio = new Date(txt(meta.recepcao_inicio) || c.created_at).getTime()
    return inicio >= ini.getTime() && inicio < fim.getTime()
  })

  // mensagens de voz recebidas no período, por conversa
  const audios = new Map<string, number>()
  // em lotes: 1000 ids num .in() estouram o tamanho da URL do PostgREST
  const ids = doPeriodo.map(c => c.id)
  for (let i = 0; i < ids.length; i += 150) {
    const { data: msgs, error } = await supabaseAdmin
      .from('whatsapp_messages')
      .select('conversation_id')
      .in('conversation_id', ids.slice(i, i + 150))
      .eq('type', 'audio')
      .eq('direction', 'inbound')
      .gte('created_at', ini.toISOString())
      .lt('created_at', fim.toISOString())
      .limit(5000)
    if (error) throw new Error(`Falha ao contar os áudios: ${error.message}`)
    for (const m of msgs ?? []) audios.set(m.conversation_id, (audios.get(m.conversation_id) ?? 0) + 1)
  }

  // metadata.encaminhados guarda a área normalizada ("jovens"); a memória e a
  // config guardam o nome de exibição ("Jovens"). Unifica pelo de exibição.
  const rotuloArea = new Map<string, string>()
  const instIds = [...new Set(doPeriodo.map(c => c.instance_id).filter(Boolean))]
  if (instIds.length) {
    const { data: insts } = await supabaseAdmin.from('whatsapp_instances').select('metadata').in('id', instIds)
    for (const i of insts ?? []) {
      for (const e of lerRecepcao(i.metadata).encaminhamentos) rotuloArea.set(normalizarTexto(e.interesse), e.interesse)
    }
  }
  rotuloArea.set(normalizarTexto(AREA_PADRAO_ROTULO), AREA_PADRAO_ROTULO)
  for (const c of doPeriodo) {
    const e = ((c.metadata ?? {}) as Record<string, unknown>).recepcao_estado as Record<string, unknown> | undefined
    for (const i of Array.isArray(e?.interesses) ? e!.interesses as unknown[] : []) {
      const r = String(i ?? '').trim()
      if (r && !rotuloArea.has(normalizarTexto(r))) rotuloArea.set(normalizarTexto(r), r)
    }
  }
  const exibir = (area: string) => {
    const k = normalizarTexto(area)
    return rotuloArea.get(k) ?? (area.charAt(0).toUpperCase() + area.slice(1))
  }
  const unicas = (lista: string[]) => [...new Map(lista.map(a => [normalizarTexto(a), exibir(a)])).values()]

  const linhas: ConversaRelatorio[] = doPeriodo.map(c => {
    const meta = (c.metadata ?? {}) as Record<string, unknown>
    const e = (meta.recepcao_estado ?? {}) as Record<string, unknown>
    const reservado = conversaReservada(null, meta)
    const interesses = unicas(Array.isArray(e.interesses) ? e.interesses.map(String).filter(Boolean) : [])
    const encaminhados = unicas(Object.keys((meta.encaminhados ?? {}) as Record<string, string>))
    const gfs = [
      ...Object.values((meta.gf_encaminhados_nomes ?? {}) as Record<string, string>),
      ...(txt(e.gfInteresse) ? [txt(e.gfInteresse)] : []),
    ]
    const tempo = txt(e.tempoNaSede)
    const base: ConversaRelatorio = {
      id: c.id,
      reservado,
      nome: txt(e.nome) || txt(c.contact_name) || '(sem nome)',
      telefone: c.phone,
      inicio: txt(meta.recepcao_inicio) || c.created_at,
      ultima: c.last_message_at,
      origem: meta.origem === 'recepcao_qr' ? 'QR / site' : 'Entregue pela equipe',
      agente: nomeAgente.get(c.ai_agent_id) ?? '',
      assunto: txt(e.assunto),
      etapa: txt(e.etapa),
      interesses,
      encaminhados,
      gfs: [...new Set(gfs)],
      igrejaAnterior: txt(e.igrejaAnterior),
      tempoNaSede: tempo,
      faixaTempo: faixaTempoNaSede(tempo),
      jaFoiAbordado: bool(e.jaFoiAbordado),
      conheceGF: bool(e.conheceGF),
      faixaEtaria: txt(e.faixaEtaria),
      perfil: txt(e.perfil),
      bairro: txt(e.bairro),
      querVisita: bool(e.querVisita),
      dataVisita: txt(e.dataVisita),
      queroSerMembro: !!(meta.quero_ser_membro as Record<string, unknown> | undefined)?.attendanceId,
      pedidoOracao: !!txt(e.pedidoEspecial),
      pediuHumano: e.pediuHumano === true,
      audios: audios.get(c.id) ?? 0,
      resumoIa: txt((meta.relatorio_resumo as Record<string, unknown> | undefined)?.texto),
    }
    // reservado: só a contagem; nada que identifique ou conte o assunto
    return reservado
      ? {
          ...base, nome: 'Assunto reservado', telefone: '', assunto: 'assunto reservado', perfil: '', bairro: '',
          igrejaAnterior: '', pedidoOracao: false, resumoIa: '', interesses: [], encaminhados: [], gfs: [],
        }
      : base
  })

  const departamentos = unicas(linhas.flatMap(l => [...l.interesses, ...l.encaminhados])).sort((a, b) => a.localeCompare(b))
  const alvo = f.departamento ? normalizarTexto(f.departamento) : ''
  const filtradas = alvo
    ? linhas.filter(l => [...l.interesses, ...l.encaminhados, ...l.gfs].some(i => normalizarTexto(i) === alvo))
    : linhas

  const r = vazio()
  r.departamentos = departamentos
  r.conversas = filtradas
  const t = r.totais
  for (const l of filtradas) {
    t.conversas++
    if (l.origem === 'QR / site') t.viaQr++
    if (l.reservado) { t.reservados++; continue }
    const outra = veioDeOutraIgreja(l.igrejaAnterior)
    if (outra === true) t.deOutraIgreja++
    if (outra === false) t.semIgrejaAnterior++
    if (l.jaFoiAbordado === true) t.jaAbordados++
    if (l.jaFoiAbordado === false) t.naoAbordados++
    if (l.conheceGF === true) t.conhecemGF++
    if (l.conheceGF === false) t.naoConhecemGF++
    if (l.gfs.length) t.encaminhadosGF++
    if (l.querVisita === true) t.querVisita++
    if (l.queroSerMembro) t.queroSerMembro++
    if (l.pedidoOracao) t.pedidosOracao++
    if (l.pediuHumano) t.pediuHumano++
    if (l.audios) t.comAudio++
  }
  const visiveis = filtradas.filter(l => !l.reservado)
  r.porDia = contar(filtradas.map(l => diaBrasilia(l.inicio))).sort((a, b) => a.rotulo.localeCompare(b.rotulo))
  r.porDepartamento = contar(visiveis.flatMap(l => unicas([...l.interesses, ...l.encaminhados])))
  r.porTempoNaSede = contar(visiveis.map(l => l.faixaTempo), ORDEM_TEMPO)
  r.porAssunto = contar(visiveis.map(l => l.assunto || 'Não anotado')).slice(0, 12)
  r.porGf = contar(visiveis.flatMap(l => l.gfs))
  r.porFaixaEtaria = contar(visiveis.map(l => l.faixaEtaria || 'Não informado'))
  return r
}

/** Resumo curto de UMA conversa (guardado em metadata.relatorio_resumo). Reservada: recusa. */
export async function resumirConversa(conversationId: string, campoId: string | null): Promise<string> {
  const { data: conv } = await supabaseAdmin
    .from('whatsapp_conversations')
    .select('metadata, last_message_at')
    .eq('id', conversationId)
    .single()
  const meta = (conv?.metadata ?? {}) as Record<string, unknown>
  if (conversaReservada(null, meta)) throw new Error('Assunto reservado: o resumo não é exibido no relatório.')
  const inicio = txt(meta.recepcao_inicio) || null
  const historico = await loadConversationHistory(conversationId, 80, inicio)
  if (!historico.length) return 'Conversa sem mensagens.'
  const transcricao = historico.map(m => `${m.role === 'user' ? 'PESSOA' : 'IGREJA'}: ${m.content}`).join('\n')
  const texto = (await generateAiText(
    campoId,
    'Resuma esta conversa de WhatsApp do atendimento de uma igreja para o relatório da secretaria. Texto simples, sem ' +
      'markdown e sem emoji, até 6 linhas: quem é a pessoa (perfil), como chegou, o que ela queria, departamentos e GF de ' +
      'interesse, o que ficou combinado e o próximo passo. Não invente nada.',
    [{ role: 'user', content: transcricao.slice(-12_000) }],
  )).trim()
  await supabaseAdmin
    .from('whatsapp_conversations')
    .update({ metadata: { ...meta, relatorio_resumo: { texto, em: new Date().toISOString() } } })
    .eq('id', conversationId)
  return texto
}

/** Análise do período pela IA (geral ou de um departamento). Sem dados pessoais. */
export async function analisarPeriodo(rel: Relatorio, departamento: string | null, campoId: string | null): Promise<string> {
  const linhas = rel.conversas.filter(c => !c.reservado).slice(0, 150).map((c, i) => [
    `${i + 1}.`,
    c.assunto && `assunto: ${c.assunto}`,
    c.etapa && `etapa: ${c.etapa}`,
    c.origem && `origem: ${c.origem}`,
    c.igrejaAnterior && `igreja anterior: ${c.igrejaAnterior}`,
    c.tempoNaSede && `tempo na sede: ${c.tempoNaSede}`,
    c.jaFoiAbordado !== null && `já abordado: ${c.jaFoiAbordado ? 'sim' : 'não'}`,
    c.conheceGF !== null && `conhece GF: ${c.conheceGF ? 'sim' : 'não'}`,
    c.gfs.length && `GF: ${c.gfs.join(', ')}`,
    c.interesses.length && `interesses: ${c.interesses.join(', ')}`,
    c.faixaEtaria && `faixa: ${c.faixaEtaria}`,
    c.perfil && `perfil: ${c.perfil}`,
    c.querVisita !== null && `visita: ${c.querVisita ? 'sim' : 'não'}`,
    c.queroSerMembro && 'Quero ser Membro registrado',
    c.pediuHumano && 'pediu atendimento humano',
    c.audios && `${c.audios} áudio(s)`,
    c.resumoIa && `resumo: ${c.resumoIa.replace(/\s+/g, ' ')}`,
  ].filter(Boolean).join(' | '))

  const t = rel.totais
  const dados = [
    `PERÍODO: ${rel.periodo.de} a ${rel.periodo.ate}${departamento ? ` — DEPARTAMENTO: ${departamento}` : ''}`,
    `TOTAIS: ${JSON.stringify(t)}`,
    `POR DEPARTAMENTO: ${rel.porDepartamento.map(c => `${c.rotulo}=${c.total}`).join(', ') || '—'}`,
    `TEMPO NA SEDE: ${rel.porTempoNaSede.map(c => `${c.rotulo}=${c.total}`).join(', ') || '—'}`,
    `GF: ${rel.porGf.map(c => `${c.rotulo}=${c.total}`).join(', ') || '—'}`,
    '',
    'ATENDIMENTOS (sem nomes):',
    ...linhas,
  ].join('\n')

  return (await generateAiText(
    campoId,
    [
      `Você é o analista do atendimento pastoral de uma igreja. Escreva o relatório ${departamento ? `do departamento "${departamento}"` : 'geral'} do período, em português, para a liderança.`,
      'Use só os dados recebidos; não invente números nem fatos. Sem markdown pesado: títulos curtos em MAIÚSCULAS e frases diretas.',
      'Seções: VISÃO GERAL (como foi o atendimento, quantas pessoas, por onde chegaram); QUEM CHEGOU (igreja anterior, tempo na sede, se já tinham sido abordadas, faixa etária);',
      'INTERESSES E DEPARTAMENTOS; GRUPOS FAMILIARES; PONTOS DE ATENÇÃO (quem não foi abordado, quem pediu atendimento humano, conversas paradas); SUGESTÕES PRÁTICAS para a próxima semana.',
      'Nunca cite nomes, telefones ou o conteúdo de pedidos de oração. Assuntos reservados aparecem só como número.',
    ].join('\n'),
    [{ role: 'user', content: dados.slice(0, 60_000) }],
  )).trim()
}
