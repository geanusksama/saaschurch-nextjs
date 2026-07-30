import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateAiText, loadConversationHistory } from '@/lib/aiReplyService'
import { loadAgentAccess, canUseAgent } from '@/lib/aiAgentAccess'
import { CONSOLIDATION_GUIDANCE, EMOJI_GUIDANCE } from '@/lib/whatsappHumanizer'
import { getAccessibleInstanceIds } from '@/lib/whatsappSendService'

/**
 * POST /api/whatsapp/conversations/[id]/suggest — auxiliar de resposta.
 *
 * Lê as últimas mensagens da conversa e devolve uma sugestão curta para quem
 * está atendendo revisar, editar e enviar. Nada é enviado aqui: a sugestão é
 * texto de volta para a tela. É o oposto do agente automático — a pessoa
 * continua no comando, só não parte da folha em branco.
 *
 * Body opcional: { agentId?: string, instruction?: string, lastMessages?: number }
 *  - agentId: usa a persona desse agente (padrão: o agente da conversa, se houver)
 *  - instruction: recado de quem atende ("pede o endereço", "convida pro GF")
 *  - lastMessages: quantas trocas considerar (padrão 5, máx. 20)
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id: conversationId } = await ctx.params
    const body = await req.json().catch(() => ({}))
    const lastMessages = Math.min(Math.max(1, Number(body.lastMessages) || 5), 20)
    const instruction = String(body.instruction ?? '').trim().slice(0, 500)

    const { data: conv } = await supabaseAdmin
      .from('whatsapp_conversations')
      .select('id, instance_id, phone, contact_name, ai_agent_id')
      .eq('id', conversationId)
      .maybeSingle()

    if (!conv) return NextResponse.json({ error: 'Conversa não encontrada.' }, { status: 404 })

    // mesma regra de visibilidade do resto do módulo
    const accessible = await getAccessibleInstanceIds(String(user.id), user.profileType)
    if (accessible && !accessible.has(conv.instance_id)) {
      return NextResponse.json({ error: 'Sem acesso a esta conversa.' }, { status: 403 })
    }

    // Persona: o agente pedido, senão o da conversa. Sem agente a sugestão
    // ainda sai — só não tem personalidade configurada.
    const agentId: string | null = body.agentId ?? conv.ai_agent_id ?? null
    let persona = ''
    let campoId: string | null = null

    if (agentId) {
      const access = await loadAgentAccess(String(user.id))
      if (!canUseAgent(agentId, access)) {
        return NextResponse.json(
          { error: 'Você não está autorizado a usar este agente.' },
          { status: 403 }
        )
      }
      const agent = await prisma.aiAgent.findFirst({ where: { id: agentId, isActive: true } })
      if (agent?.systemPrompt) {
        persona = `\n\nPersona do agente:\n${agent.systemPrompt}`
        campoId = agent.campoId
      }
    }

    const history = await loadConversationHistory(conversationId, lastMessages * 2)
    if (!history.length) {
      return NextResponse.json(
        { error: 'Ainda não há mensagens nesta conversa para basear a sugestão.' },
        { status: 400 }
      )
    }

    // A IA não tem noção de data; sem isso erra "hoje/amanhã" e inventa dia de culto.
    const agoraBrt = new Date(Date.now() - 180 * 60_000)
    const dias = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

    const systemPrompt = [
      'Você é o auxiliar de quem atende esta conversa de WhatsApp em nome da igreja.',
      'Escreva UMA sugestão de próxima mensagem, para a pessoa que atende revisar,',
      'editar e enviar. Não é uma resposta automática: é um rascunho.',
      '',
      `Hoje é ${dias[agoraBrt.getUTCDay()]}, ${agoraBrt.toISOString().slice(0, 10)} (horário de`,
      'Brasília). A igreja tem culto no domingo e na quarta — não invente outros dias.',
      conv.contact_name ? `Nome do contato: ${conv.contact_name}.` : '',
      '',
      'Como escrever:',
      '- curta: no máximo 2 frases, tamanho de mensagem de WhatsApp;',
      '- acolhedora e concreta, avançando a conversa em um único passo por vez;',
      '- olhe o que a pessoa disse por último e responda AQUILO, sem mudar de assunto;',
      '- cuide do estado emocional: quem está em luto, dúvida ou desabafo precisa de',
      '  acolhimento antes de qualquer convite ou pedido de dado;',
      '- uma pergunta por mensagem, no máximo — duas perguntas juntas costumam ficar',
      '  sem resposta;',
      '- nunca prometa o que não foi combinado, nem invente datas, horários e nomes;',
      '- não repita o que já foi dito na conversa;',
      '- não se identifique como IA.',
      CONSOLIDATION_GUIDANCE,
      EMOJI_GUIDANCE,
      'Escreva como uma pessoa escreve no WhatsApp: sem markdown, sem títulos, sem',
      'lista numerada, sem assinatura no fim.',
      'Responda APENAS com o texto sugerido, sem aspas e sem comentários.',
      instruction ? `\nQuem atende pediu especificamente: ${instruction}` : '',
      persona,
    ]
      .filter(Boolean)
      .join('\n')

    try {
      const out = await generateAiText(campoId, systemPrompt, history)
      const suggestion = String(out ?? '').trim()
      if (!suggestion) {
        return NextResponse.json({ error: 'A IA não devolveu sugestão.' }, { status: 502 })
      }
      return NextResponse.json({ suggestion, basedOn: history.length })
    } catch (err) {
      console.error('[conversations/suggest]', err)
      return NextResponse.json(
        { error: 'Falha ao gerar a sugestão. Confira a configuração de IA.' },
        { status: 500 }
      )
    }
  })
}
