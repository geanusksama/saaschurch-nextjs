/**
 * aiReplyService — geração de texto por IA para o módulo WhatsApp:
 *  - resposta automática de um agente de IA (ai_agents) em conversas marcadas
 *  - resumo "smart" de conversa com sugestão de mensagem
 *
 * Usa a configuração de IA do sistema (getAiConfig — openai ou anthropic),
 * sem tools. Server-side apenas.
 */

import { prisma } from '@/lib/prisma'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAiConfig } from '@/lib/aiConfig'
import { CONSOLIDATION_GUIDANCE, EMOJI_GUIDANCE } from '@/lib/whatsappHumanizer'
import { montarContextoRecepcao } from '@/lib/contextoRecepcao'
import { extrairAcao, extrairEstado, type DadosQueroSerMembro } from '@/lib/agenteQueroSerMembro'
import { pedidosDoContato, temQueroSerMembroAberto } from '@/lib/pedidosDoContato'
import { extrairEncaminhar, type DadosEncaminhar } from '@/lib/encaminharLider'
import { extrairGfs, type DadosGf } from '@/lib/encaminharGf'
import { lerRecepcao } from '@/lib/recepcaoWhatsapp'
import { extrairReacao, semEmoji } from '@/lib/reacaoAgente'
import { extrairOpcoes, type OpcoesMensagem } from '@/lib/opcoesAgente'
import { elevenLabsPronta, getElevenLabsConfig, transcreverAudio } from '@/lib/elevenlabs'
import { lerAprendizado } from '@/lib/aprendizadoAgente'

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

// ── Chamada crua ao provider configurado ──────────────────────────────────────

export async function generateAiText(
  campoId: string | null,
  systemPrompt: string,
  history: ChatTurn[]
): Promise<string> {
  const config = await getAiConfig(campoId)
  if (!config.aiEnabled) throw new Error('IA desabilitada nas configurações')

  if (config.aiProvider === 'openai') {
    if (!config.openaiApiKey) throw new Error('Chave OpenAI não cadastrada')
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: config.aiModel.includes('gpt') ? config.aiModel : 'gpt-4o-mini',
        max_tokens: config.aiMaxTokens,
        messages: [{ role: 'system', content: systemPrompt }, ...history],
      }),
    })
    if (!res.ok) {
      console.error('[aiReplyService] OpenAI error', await res.text().catch(() => ''))
      throw new Error('Erro na API da OpenAI')
    }
    const data = await res.json()
    return data.choices?.[0]?.message?.content ?? ''
  }

  // anthropic
  if (!config.anthropicApiKey) throw new Error('Chave Anthropic não cadastrada')
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.anthropicApiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.aiModel.includes('claude') ? config.aiModel : 'claude-opus-5',
      max_tokens: config.aiMaxTokens,
      system: systemPrompt,
      messages: history.map(m => ({ role: m.role, content: [{ type: 'text', text: m.content }] })),
    }),
  })
  if (!res.ok) {
    console.error('[aiReplyService] Anthropic error', await res.text().catch(() => ''))
    throw new Error('Erro na API da Anthropic')
  }
  const data = await res.json()
  return (data.content ?? []).filter((b: { type: string }) => b.type === 'text')
    .map((b: { text: string }) => b.text).join('\n')
}

// ── Histórico da conversa no formato de chat ──────────────────────────────────

export async function loadConversationHistory(
  conversationId: string,
  limit = 30,
  /** só mensagens a partir deste instante (início do atendimento da recepção) */
  desde?: string | null,
  /** campo cuja ElevenLabs transcreve os áudios ainda não transcritos */
  campoId?: string | null
): Promise<ChatTurn[]> {
  return (await carregarTurnos(conversationId, limit, desde, campoId)).map(({ role, content }) => ({ role, content }))
}

/** Turno com a marca de áudio (o ChatTurn vai cru para o provider; este não). */
interface TurnoConversa extends ChatTurn {
  audio: boolean
}

/**
 * Histórico com os áudios entendidos. Áudio recebido sem transcrição é
 * transcrito agora (ElevenLabs do campo) e o texto fica SÓ em
 * metadata.transcricao — a conversa continua mostrando o áudio, não o texto.
 * Áudio que o agente mandou entra pelo metadata.texto_falado.
 */
async function carregarTurnos(
  conversationId: string,
  limit: number,
  desde?: string | null,
  campoId?: string | null,
): Promise<TurnoConversa[]> {
  let q = supabaseAdmin
    .from('whatsapp_messages')
    .select('id, content, type, direction, created_at, media_url, media_mime_type, metadata')
    .eq('conversation_id', conversationId)
  if (desde) q = q.gte('created_at', desde)
  const { data } = await q
    .order('created_at', { ascending: false })
    .limit(limit)
  const messages = (data ?? []).reverse()

  // transcreve só o que falta, e só quando há quem transcreva
  // áudio que já falhou 2 vezes (link vencido, formato recusado) não é tentado de novo
  const pendentes = messages.filter(m => {
    const mm = (m.metadata ?? {}) as Record<string, unknown>
    return m.type === 'audio' && m.direction === 'inbound' && m.media_url &&
      !mm.transcricao && Number(mm.transcricao_falhas ?? 0) < 2
  })
  if (pendentes.length && campoId !== undefined) {
    const voz = await getElevenLabsConfig(campoId ?? null)
    if (elevenLabsPronta(voz)) {
      // no máximo os 2 mais recentes por resposta: cabe no tempo da fila
      await Promise.all(pendentes.slice(-2).map(async m => {
        const texto = await transcreverAudio(voz.apiKey, m.media_url as string, m.media_mime_type)
        const anterior = (m.metadata ?? {}) as Record<string, unknown>
        const metadata = texto
          ? { ...anterior, transcricao: texto }
          : { ...anterior, transcricao_falhas: Number(anterior.transcricao_falhas ?? 0) + 1 }
        m.metadata = metadata
        await supabaseAdmin.from('whatsapp_messages').update({ metadata }).eq('id', m.id)
      }))
    }
  }

  return messages
    .map(m => {
      const meta = (m.metadata ?? {}) as Record<string, unknown>
      const audio = m.type === 'audio'
      let content = m.content || `[${m.type}]`
      if (audio && m.direction === 'inbound') {
        content = typeof meta.transcricao === 'string' && meta.transcricao
          ? `[mensagem de voz] ${meta.transcricao}`
          : '[mensagem de voz que não foi possível ouvir]'
      } else if (audio && typeof meta.texto_falado === 'string' && meta.texto_falado) {
        content = meta.texto_falado
      }
      return {
        role: (m.direction === 'inbound' ? 'user' : 'assistant') as ChatTurn['role'],
        content,
        audio: audio && m.direction === 'inbound',
      }
    })
    // Anthropic exige alternância iniciando em user; provider tolera repetição
    .filter(m => m.content.trim().length > 0)
}

/** As mensagens da pessoa desde a última resposta têm algum áudio? */
function pessoaFalouPorAudio(turnos: TurnoConversa[]): boolean {
  for (let i = turnos.length - 1; i >= 0 && turnos[i].role === 'user'; i--) {
    if (turnos[i].audio) return true
  }
  return false
}

// ── Resposta automática do agente designado ──────────────────────────────────

export interface AgentTurn {
  /** texto que vai para a pessoa (sem o bloco de ação) */
  texto: string
  /** pedido "Quero ser Membro" que o agente de recepção decidiu registrar */
  queroSerMembro: DadosQueroSerMembro | null
  /** memória do atendimento devolvida pelo agente (vai para metadata.recepcao_estado) */
  estado: Record<string, unknown> | null
  /** áreas de interesse para avisar os líderes (encaminharLider) */
  encaminhar: DadosEncaminhar | null
  /** GFs que a pessoa aceitou: o sistema avisa os líderes de cada um (encaminharGf) */
  gfs: DadosGf[]
  /** emoji de reação à última mensagem da pessoa (reacaoAgente) */
  reacao: string | null
  /** opções clicáveis (botões/lista) da pergunta — opcoesAgente */
  opcoes: OpcoesMensagem | null
  /**
   * A pessoa falou por áudio e a ElevenLabs está ligada: responder com voz.
   * sexo 'M' = voz masculina; qualquer outro = feminina.
   */
  audio: { sexo: string } | null
  /** conversa com assunto reservado (marca gravada ou memória deste turno) */
  reservado: boolean
  agentCampoId: string | null
  telefone: string
}

/**
 * Gera a resposta do agente de IA da conversa (se ai_enabled + ai_agent_id).
 * Retorna null quando a conversa não está sob atendimento de IA.
 */
export async function generateAgentReply(conversationId: string): Promise<string | null> {
  return (await generateAgentTurn(conversationId))?.texto ?? null
}

export async function generateAgentTurn(conversationId: string): Promise<AgentTurn | null> {
  const { data: conv } = await supabaseAdmin
    .from('whatsapp_conversations')
    .select('id, ai_enabled, ai_agent_id, contact_name, phone, metadata, instance_id')
    .eq('id', conversationId)
    .single()

  if (!conv?.ai_enabled || !conv.ai_agent_id) return null

  const agent = await prisma.aiAgent.findFirst({
    where: { id: conv.ai_agent_id, isActive: true },
  })
  if (!agent) return null

  // recepção conduz um cadastro longo: 30 mensagens não cobrem a conversa toda
  const inicioRecepcao = (conv.metadata as Record<string, unknown> | null)?.recepcao_inicio
  // áudios entram transcritos (ElevenLabs do campo do agente)
  const turnos = agent.role === 'recepcao'
    ? await carregarTurnos(conversationId, 80, typeof inicioRecepcao === 'string' ? inicioRecepcao : null, agent.campoId)
    : await carregarTurnos(conversationId, 30, null, agent.campoId)
  if (!turnos.length || turnos[turnos.length - 1].role !== 'user') return null
  const history: ChatTurn[] = turnos.map(({ role, content }) => ({ role, content }))
  const falouPorAudio = pessoaFalouPorAudio(turnos)
  const voz = falouPorAudio ? await getElevenLabsConfig(agent.campoId) : null
  const responderEmAudio = !!voz && elevenLabsPronta(voz) && voz.responderComAudio

  // A IA não tem noção de data: sem dizer que dia é hoje ela erra "hoje/amanhã"
  // e convida para culto no dia errado. Cultos da igreja: domingo e quarta.
  const agoraBrt = new Date(Date.now() - 180 * 60_000)
  const diasDaSemana = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

  const ehRecepcao = agent.role === 'recepcao'
  const meta = (conv.metadata ?? {}) as Record<string, unknown>
  // pedidos que o número já fez (home, agente, secretaria): o agente manda os
  // links de acompanhamento e não abre um Quero ser Membro repetido
  const pedidos = ehRecepcao ? await pedidosDoContato(conv.phone) : []
  const recepcaoCfg = ehRecepcao ? await recepcaoDaInstancia(conv.instance_id) : null
  const pedidoJaRegistrado =
    !!(meta.quero_ser_membro as { attendanceId?: string } | undefined)?.attendanceId ||
    temQueroSerMembroAberto(pedidos)
  const contextoRecepcao = ehRecepcao
    ? await montarContextoRecepcao({
        campoId: agent.campoId,
        telefone: conv.phone,
        pedidoJaRegistrado,
        estado: (meta.recepcao_estado as Record<string, unknown> | undefined) ?? null,
        origem: typeof meta.origem === 'string' ? meta.origem : null,
        pedidos,
        encaminhamentos: recepcaoCfg?.encaminhamentos ?? [],
        jaEncaminhados: Object.keys((meta.encaminhados ?? {}) as Record<string, string>),
        temContatoReservado: !!recepcaoCfg?.contatoReservado,
        jaReservado: meta.assunto_reservado === true,
        gfsJaAvisados: Object.values((meta.gf_encaminhados_nomes ?? {}) as Record<string, string>),
      })
    : ''

  const systemPrompt = [
    agent.systemPrompt,
    '',
    'Você está respondendo uma conversa de WhatsApp em nome da igreja.',
    `Hoje é ${diasDaSemana[agoraBrt.getUTCDay()]}, ${agoraBrt.toISOString().slice(0, 10)} ` +
      '(horário de Brasília). ' +
      // recepção recebe a programação real da sede no contexto, logo abaixo
      (ehRecepcao ? '' : 'A igreja tem culto no domingo e na quarta — ') +
      'ao falar de "hoje", "amanhã" ou de um dia da semana, use essa data como referência ' +
      'e não invente outros dias de culto.',
    conv.contact_name
      ? `Nome do contato: ${conv.contact_name}.`
      : (ehRecepcao ? 'Nome do contato: (não informado no WhatsApp — pergunte o nome).' : ''),
    'Responda de forma curta, acolhedora e objetiva, como uma mensagem de WhatsApp.',
    CONSOLIDATION_GUIDANCE,
    // Agente de Recepção (QR code) conduz um cadastro pergunta a pergunta: o
    // versículo em toda mensagem atrapalha. O prompt dele já diz quando usar.
    ...(ehRecepcao ? [] : [
      'Sempre traga uma palavra de ânimo para a pessoa, referenciando uma passagem',
      'bíblica pertinente (livro, capítulo e versículo), em tom encorajador — mas sem',
      'transformar a resposta em um texto longo; mantenha o tamanho de uma mensagem normal de WhatsApp.',
    ]),
    // recepção/equipe pastoral: sem emoji nenhum (regra do prompt do dono)
    ehRecepcao ? 'Não use emojis em nenhuma mensagem.' : EMOJI_GUIDANCE,
    'Escreva como uma pessoa escreve no WhatsApp: sem markdown, sem títulos, sem',
    ehRecepcao
      ? 'listas numeradas (exceto as perguntas do cadastro, quando a pessoa pedir todas de uma vez) e sem assinatura no fim. Não se identifique como IA a menos que perguntem.'
      : 'listas numeradas e sem assinatura no fim. Não se identifique como IA a menos que perguntem.',
    falouPorAudio
      ? (responderEmAudio
          ? AUDIO_RESPOSTA_GUIDANCE
          : 'A pessoa mandou mensagem de voz (o texto dela aparece depois de "[mensagem de voz]"). Responda por escrito ' +
            'normalmente. Se aparecer "[mensagem de voz que não foi possível ouvir]", peça com gentileza que ela escreva ou mande o áudio de novo.')
      : '',
    contextoRecepcao,
    await lerAprendizado(agent.id),
  ].filter(Boolean).join('\n')

  const reply = (await generateAiText(agent.campoId, systemPrompt, history)).trim()
  // só o agente de recepção pode registrar; de qualquer outro o bloco é só removido
  const semEstado = extrairEstado(reply)
  const semEncaminhar = extrairEncaminhar(semEstado.texto)
  const semGf = extrairGfs(semEncaminhar.texto)
  const semReacao = extrairReacao(semGf.texto)
  const semOpcoes = extrairOpcoes(semReacao.texto)
  const extraido = extrairAcao(semOpcoes.texto)
  const dados = extraido.dados
  // recepção: mensagem longa demais (3+ parágrafos) é reescrita curta antes de
  // sair. O questionário numerado do cadastro é longo de propósito e passa.
  // e nunca leva emoji no texto (só na reação)
  const texto = ehRecepcao ? semEmoji(await encurtarSeLongo(agent.campoId, extraido.texto)) : extraido.texto
  if (!texto && !dados) return null
  return {
    texto: texto || 'Vou registrar o seu pedido agora. A confirmação chega em seguida.',
    queroSerMembro: ehRecepcao && !pedidoJaRegistrado ? dados : null,
    estado: ehRecepcao ? semEstado.estado : null,
    encaminhar: ehRecepcao ? semEncaminhar.dados : null,
    gfs: ehRecepcao ? semGf.dados : [],
    reacao: ehRecepcao ? semReacao.reacao : null,
    opcoes: ehRecepcao ? semOpcoes.opcoes : null,
    audio: responderEmAudio
      ? { sexo: sexoDaPessoa(semEstado.estado, meta.recepcao_estado) }
      : null,
    reservado: meta.assunto_reservado === true ||
      (meta.recepcao_estado as Record<string, unknown> | undefined)?.assuntoReservado === true ||
      semEstado.estado?.assuntoReservado === true ||
      semEncaminhar.dados?.reservado === true,
    agentCampoId: agent.campoId,
    telefone: conv.phone,
  }
}

// ── Resumo "smart" da conversa ────────────────────────────────────────────────

export interface SmartSummary {
  resumo: string
  quem_mais_falou: string
  analise: string
  mensagem_sugerida: string
}

export async function generateSmartSummary(
  conversationId: string,
  campoId: string | null
): Promise<SmartSummary> {
  const history = await loadConversationHistory(conversationId, 60)
  if (!history.length) {
    return {
      resumo: 'A conversa ainda não tem mensagens.',
      quem_mais_falou: '—',
      analise: '—',
      mensagem_sugerida: '',
    }
  }

  const transcript = history
    .map(m => `${m.role === 'user' ? 'CONTATO' : 'IGREJA'}: ${m.content}`)
    .join('\n')

  const systemPrompt =
    'Você é um analista de atendimento pastoral de uma igreja. Analise a conversa de ' +
    'WhatsApp e responda APENAS um JSON válido (sem markdown, sem cercas de código) com as chaves: ' +
    '"resumo" (resumo objetivo da conversa em até 3 frases), ' +
    '"quem_mais_falou" ("contato", "igreja" ou "equilibrado", com a contagem de mensagens de cada), ' +
    '"analise" (o que pode ser feito/melhorado neste atendimento, em até 3 frases), ' +
    '"mensagem_sugerida" (uma próxima mensagem pronta para enviar ao contato, tom acolhedor de ' +
    'WhatsApp, sem markdown. Traga sempre uma palavra de ânimo referenciando uma passagem bíblica ' +
    'pertinente — livro, capítulo e versículo — de forma encorajadora, mas mantendo o tamanho de uma ' +
    'mensagem normal de WhatsApp, sem virar um texto longo).'

  const raw = await generateAiText(campoId, systemPrompt, [
    { role: 'user', content: transcript },
  ])

  try {
    const cleaned = raw.replace(/^```(json)?/m, '').replace(/```\s*$/m, '').trim()
    const parsed = JSON.parse(cleaned)
    return {
      resumo: String(parsed.resumo ?? ''),
      quem_mais_falou: String(parsed.quem_mais_falou ?? ''),
      analise: String(parsed.analise ?? ''),
      mensagem_sugerida: String(parsed.mensagem_sugerida ?? ''),
    }
  } catch {
    // IA não devolveu JSON — entrega o texto cru como resumo
    return { resumo: raw.trim(), quem_mais_falou: '', analise: '', mensagem_sugerida: '' }
  }
}

/** Config da recepção da instância da conversa (encaminhamentos, contato reservado). */
async function recepcaoDaInstancia(instanceId: string | null) {
  if (!instanceId) return null
  const { data } = await supabaseAdmin.from('whatsapp_instances').select('metadata').eq('id', instanceId).maybeSingle()
  return lerRecepcao(data?.metadata)
}

/** Sexo da pessoa: o da memória que o agente acabou de devolver, senão o já gravado. */
function sexoDaPessoa(novo: Record<string, unknown> | null, anterior: unknown): string {
  const de = (e: unknown) => {
    const v = String((e as Record<string, unknown> | null | undefined)?.sexo ?? '').trim().toUpperCase()
    return v.startsWith('M') ? 'M' : v.startsWith('F') ? 'F' : ''
  }
  return de(novo) || de(anterior)
}

/** Regras para a resposta que vai virar áudio (ElevenLabs). */
const AUDIO_RESPOSTA_GUIDANCE = [
  'A pessoa falou com você por MENSAGEM DE VOZ (o que ela disse aparece depois de "[mensagem de voz]"; ela não vê esse texto).',
  'Sua resposta será convertida em ÁUDIO com voz do mesmo sexo do seu nome de atendente. Escreva como quem FALA:',
  '- frases curtas e naturais, sem listas, sem símbolos e sem abreviações (escreva "Pastor", não "Pr.");',
  '- no máximo uns 40 segundos de fala;',
  '- não diga "segue o link" nem leia endereços de site: se precisar mandar link, coloque-o normalmente no texto e diga',
  '  apenas "vou te mandar o link por escrito" — o sistema envia o link por escrito logo depois do áudio;',
  '- nunca mencione que é um áudio gerado, nem a palavra "transcrição".',
  'Se a pessoa disser só pelo áudio se é homem ou mulher (ou pelo nome), preencha "sexo" na MEMÓRIA: é ele que escolhe a voz.',
  'Se aparecer "[mensagem de voz que não foi possível ouvir]", peça com gentileza que ela repita.',
].join('\n')

const LIMITE_RECEPCAO = 550

/** Reescreve em no máximo 2 parágrafos curtos quando passa do limite. Nunca lança. */
async function encurtarSeLongo(campoId: string | null, texto: string): Promise<string> {
  const paragrafos = texto.split(/\n\s*\n/).filter(p => p.trim()).length
  const questionario = (texto.match(/^\s*\d+[.)]\s/gm) ?? []).length >= 3
  if (questionario || (texto.length <= LIMITE_RECEPCAO && paragrafos <= 2)) return texto
  try {
    const curto = (await generateAiText(
      campoId,
      'Reescreva a mensagem de WhatsApp abaixo, de um pastor da igreja para um visitante, em NO MÁXIMO 2 parágrafos ' +
        `curtos e até ${LIMITE_RECEPCAO} caracteres. Mantenha o calor humano, o nome da pessoa, a pergunta final (se houver) ` +
        'e todos os links exatamente como estão. Sem emoji, sem markdown, sem acrescentar nada. Responda só a mensagem.',
      [{ role: 'user', content: texto }],
    )).trim()
    return curto && curto.length < texto.length ? curto : texto
  } catch (err) {
    console.error('[aiReplyService] encurtar falhou', err)
    return texto
  }
}

