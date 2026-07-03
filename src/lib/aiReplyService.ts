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
      model: config.aiModel.includes('claude') ? config.aiModel : 'claude-3-5-sonnet-20241022',
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
  limit = 30
): Promise<ChatTurn[]> {
  const { data: messages } = await supabaseAdmin
    .from('whatsapp_messages')
    .select('content, type, direction, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return (messages ?? [])
    .reverse()
    .map(m => ({
      role: (m.direction === 'inbound' ? 'user' : 'assistant') as ChatTurn['role'],
      content: m.content || `[${m.type}]`,
    }))
    // Anthropic exige alternância iniciando em user; provider tolera repetição
    .filter(m => m.content.trim().length > 0)
}

// ── Resposta automática do agente designado ──────────────────────────────────

/**
 * Gera a resposta do agente de IA da conversa (se ai_enabled + ai_agent_id).
 * Retorna null quando a conversa não está sob atendimento de IA.
 */
export async function generateAgentReply(conversationId: string): Promise<string | null> {
  const { data: conv } = await supabaseAdmin
    .from('whatsapp_conversations')
    .select('id, ai_enabled, ai_agent_id, contact_name')
    .eq('id', conversationId)
    .single()

  if (!conv?.ai_enabled || !conv.ai_agent_id) return null

  const agent = await prisma.aiAgent.findFirst({
    where: { id: conv.ai_agent_id, isActive: true },
  })
  if (!agent) return null

  const history = await loadConversationHistory(conversationId)
  if (!history.length || history[history.length - 1].role !== 'user') return null

  const systemPrompt = [
    agent.systemPrompt,
    '',
    'Você está respondendo uma conversa de WhatsApp em nome da igreja.',
    conv.contact_name ? `Nome do contato: ${conv.contact_name}.` : '',
    'Responda de forma curta, acolhedora e objetiva, como uma mensagem de WhatsApp.',
    'Sempre traga uma palavra de ânimo para a pessoa, referenciando uma passagem',
    'bíblica pertinente (livro, capítulo e versículo), em tom encorajador — mas sem',
    'transformar a resposta em um texto longo; mantenha o tamanho de uma mensagem normal de WhatsApp.',
    'Não use markdown. Não se identifique como IA a menos que perguntem.',
  ].filter(Boolean).join('\n')

  const reply = await generateAiText(agent.campoId, systemPrompt, history)
  return reply.trim() || null
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
