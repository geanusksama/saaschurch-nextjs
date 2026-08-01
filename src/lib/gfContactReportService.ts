/**
 * Parecer por contato: junta o que aconteceu na conversa de WhatsApp com a
 * situação da pessoa no GF.
 *
 * Serve tanto o link público que o líder recebe quanto o relatório em PDF da
 * tela de Envio em Massa — por isso o cálculo mora aqui e não na rota.
 *
 * Server-side apenas.
 */

import { prisma } from '@/lib/prisma'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateAiText, loadConversationHistory } from '@/lib/aiReplyService'

const URL_REGEX = /https?:\/\/[^\s]+/gi

export interface ConversationFacts {
  totalMessages: number
  outbound: number
  inbound: number
  /** Mensagens nossas seguidas sem nenhuma resposta no fim da conversa. */
  tentativasSemResposta: number
  respondeu: boolean
  linksEnviados: string[]
  primeiraMensagemEm: string | null
  ultimaMensagemEm: string | null
}

export interface GfSituation {
  cellGroupName: string | null
  leaderName: string | null
  ehMembro: boolean
}

export interface GfContactReport {
  nome: string
  telefone: string
  fatos: ConversationFacts
  situacao: GfSituation
  sintese: string
  pontosPositivos: string[]
  pontosNegativos: string[]
  enviouEndereco: boolean
  sugestaoMelhoria: string
  motivoSemGf: string
}

function normalizePhone(phone: string): string {
  return String(phone ?? '').replace(/\D/g, '')
}

/**
 * Conversa da pessoa, procurada pelo telefone (com e sem o 9 do celular).
 *
 * `instanceIds` limita a busca às instâncias que o usuário enxerga — sem isso
 * bastaria mandar um telefone qualquer para ler a conversa de outra igreja.
 * `null` significa master, que vê tudo.
 */
export async function findConversationByPhone(phone: string, instanceIds: Set<string> | null) {
  const digits = normalizePhone(phone)
  if (!digits) return null
  if (instanceIds && instanceIds.size === 0) return null

  const candidates = new Set([digits])
  if (digits.length >= 10) candidates.add(digits.slice(-11))
  if (digits.length >= 10) candidates.add(digits.slice(-10))

  let query = supabaseAdmin
    .from('whatsapp_conversations')
    .select('id, phone, contact_name, last_message_at')
    .in('phone', [...candidates])
  if (instanceIds) query = query.in('instance_id', [...instanceIds])

  const { data } = await query.order('last_message_at', { ascending: false }).limit(1)

  return data?.[0] ?? null
}

export async function loadConversationFacts(conversationId: string): Promise<ConversationFacts> {
  const { data: messages } = await supabaseAdmin
    .from('whatsapp_messages')
    .select('content, direction, media_url, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  const rows = messages ?? []
  const outbound = rows.filter(m => m.direction === 'outbound')
  const inbound = rows.filter(m => m.direction === 'inbound')

  // Tentativas em vão: a sequência de mensagens nossas no fim da conversa,
  // depois da última resposta da pessoa (ou desde o começo, se nunca houve).
  let tentativasSemResposta = 0
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].direction === 'inbound') break
    tentativasSemResposta++
  }

  const linksEnviados = outbound
    .flatMap(m => String(m.content ?? '').match(URL_REGEX) ?? [])
    .filter((url, i, all) => all.indexOf(url) === i)

  return {
    totalMessages: rows.length,
    outbound: outbound.length,
    inbound: inbound.length,
    tentativasSemResposta,
    respondeu: inbound.length > 0,
    linksEnviados,
    primeiraMensagemEm: rows[0]?.created_at ?? null,
    ultimaMensagemEm: rows[rows.length - 1]?.created_at ?? null,
  }
}

/** Onde a pessoa está: GF do cadastro, GF marcado na lista importada, ou nenhum. */
export async function loadGfSituation(opts: {
  memberId?: string | null
  importRowId?: string | null
  phone?: string | null
}): Promise<GfSituation> {
  if (opts.memberId) {
    const link = await prisma.cellGroupMember.findFirst({
      where: { memberId: opts.memberId, isActive: true },
      include: { cellGroup: { select: { name: true, leader: { select: { fullName: true } } } } },
    })
    return {
      cellGroupName: link?.cellGroup.name ?? null,
      leaderName: link?.cellGroup.leader?.fullName ?? null,
      ehMembro: true,
    }
  }

  if (opts.importRowId) {
    const { data: row } = await supabaseAdmin
      .from('whatsapp_import_rows')
      .select('cell_group_id, match_status')
      .eq('id', opts.importRowId)
      .maybeSingle()

    if (row?.cell_group_id) {
      const cell = await prisma.cellGroup.findUnique({
        where: { id: row.cell_group_id },
        select: { name: true, leader: { select: { fullName: true } } },
      })
      return {
        cellGroupName: cell?.name ?? null,
        leaderName: cell?.leader?.fullName ?? null,
        ehMembro: row.match_status === 'member' || row.match_status === 'both',
      }
    }
    return { cellGroupName: null, leaderName: null, ehMembro: row?.match_status === 'member' }
  }

  return { cellGroupName: null, leaderName: null, ehMembro: false }
}

const SYSTEM_PROMPT =
  'Você é um analista de consolidação de uma igreja. Analise a conversa de WhatsApp entre a IGREJA e o ' +
  'CONTATO e responda APENAS um JSON válido (sem markdown, sem cercas de código) com as chaves: ' +
  '"sintese" (o que aconteceu na conversa, em até 3 frases), ' +
  '"pontos_positivos" (array de strings curtas — sinais de abertura, interesse, pedidos de oração), ' +
  '"pontos_negativos" (array de strings curtas — resistência, silêncio, objeções), ' +
  '"enviou_endereco" (true se a IGREJA mandou endereço ou localização para o contato, senão false), ' +
  '"sugestao_melhoria" (o que a equipe poderia ter feito melhor, em 1 ou 2 frases), ' +
  '"motivo_sem_gf" (por que essa pessoa provavelmente ainda não está num grupo familiar: mora longe, ' +
  'é apenas visitante, não respondeu, já frequenta outra igreja, ou "não identificado". 1 frase). ' +
  'Se a conversa não tiver informação suficiente para alguma chave, use texto curto dizendo isso — não invente.'

interface AiAnalysis {
  sintese: string
  pontosPositivos: string[]
  pontosNegativos: string[]
  enviouEndereco: boolean
  sugestaoMelhoria: string
  motivoSemGf: string
}

function emptyAnalysis(motivo: string): AiAnalysis {
  return {
    sintese: 'Nenhuma conversa registrada com este contato.',
    pontosPositivos: [],
    pontosNegativos: [],
    enviouEndereco: false,
    sugestaoMelhoria: 'Iniciar o primeiro contato.',
    motivoSemGf: motivo,
  }
}

async function analyzeConversation(conversationId: string, campoId: string | null): Promise<AiAnalysis> {
  const history = await loadConversationHistory(conversationId, 60)
  if (!history.length) return emptyAnalysis('Sem conversa registrada.')

  const transcript = history
    .map(m => `${m.role === 'user' ? 'CONTATO' : 'IGREJA'}: ${m.content}`)
    .join('\n')

  const raw = await generateAiText(campoId, SYSTEM_PROMPT, [{ role: 'user', content: transcript }])
  const cleaned = raw.replace(/^```(json)?/m, '').replace(/```\s*$/m, '').trim()

  try {
    const parsed = JSON.parse(cleaned)
    const toList = (value: unknown) =>
      Array.isArray(value) ? value.map(String).filter(Boolean) : value ? [String(value)] : []

    return {
      sintese: String(parsed.sintese ?? ''),
      pontosPositivos: toList(parsed.pontos_positivos),
      pontosNegativos: toList(parsed.pontos_negativos),
      enviouEndereco: parsed.enviou_endereco === true,
      sugestaoMelhoria: String(parsed.sugestao_melhoria ?? ''),
      motivoSemGf: String(parsed.motivo_sem_gf ?? 'Não identificado'),
    }
  } catch {
    // A IA às vezes devolve texto solto; melhor mostrar o texto que perder o parecer.
    return { ...emptyAnalysis('Não identificado'), sintese: cleaned.slice(0, 800) }
  }
}

export async function buildGfContactReport(opts: {
  name: string
  phone: string
  campoId: string | null
  memberId?: string | null
  importRowId?: string | null
  /** Instâncias visíveis ao usuário; `null` = master (vê todas). */
  instanceIds: Set<string> | null
}): Promise<GfContactReport> {
  const conversation = await findConversationByPhone(opts.phone, opts.instanceIds)

  const [fatos, situacao, analise] = await Promise.all([
    conversation
      ? loadConversationFacts(conversation.id)
      : Promise.resolve<ConversationFacts>({
          totalMessages: 0,
          outbound: 0,
          inbound: 0,
          tentativasSemResposta: 0,
          respondeu: false,
          linksEnviados: [],
          primeiraMensagemEm: null,
          ultimaMensagemEm: null,
        }),
    loadGfSituation({ memberId: opts.memberId, importRowId: opts.importRowId, phone: opts.phone }),
    conversation
      ? analyzeConversation(conversation.id, opts.campoId)
      : Promise.resolve(emptyAnalysis('Sem conversa registrada.')),
  ])

  return {
    nome: opts.name || conversation?.contact_name || 'Sem nome',
    telefone: opts.phone,
    fatos,
    situacao,
    sintese: analise.sintese,
    pontosPositivos: analise.pontosPositivos,
    pontosNegativos: analise.pontosNegativos,
    // O regex sobre o que foi enviado é prova; a IA só reforça quando o link
    // veio escrito em texto ("nosso endereço é...").
    enviouEndereco: analise.enviouEndereco || fatos.linksEnviados.some(l => /maps\.|maps\?/i.test(l)),
    sugestaoMelhoria: analise.sugestaoMelhoria,
    motivoSemGf: situacao.cellGroupName ? `Já está no GF ${situacao.cellGroupName}.` : analise.motivoSemGf,
  }
}
