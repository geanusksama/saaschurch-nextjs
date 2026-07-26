import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateAiText } from '@/lib/aiReplyService'
import { ACTIVITY_TYPE_LABELS, resolveTimelineUrl } from '@/lib/pastoralActivityMessage'
import { filterAgentsForUser } from '@/lib/aiAgentAccess'

/**
 * POST /api/pastoral/activities/suggest-message
 *
 * Botão "Smart" do formulário de atividade: a IA escreve a mensagem que vai
 * para a pessoa atendida, olhando o histórico do card (notas, atividades,
 * timeline) e o que o atendente digitou como instrução.
 *
 * Usa o agente de IA ativo do campo — o mesmo cadastro de "Auxiliar Pastoral" —
 * para herdar o tom e as regras que a igreja configurou.
 */
export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}))
    const { attendanceId, activityType, title, description, scheduledDate, instructions, origin } = body as {
      attendanceId?: string
      activityType?: string
      title?: string
      description?: string
      scheduledDate?: string
      /** o que o atendente escreveu no campo (rascunho atual ou um pedido) */
      instructions?: string
      origin?: string
    }

    if (!attendanceId) {
      return NextResponse.json({ error: 'attendanceId é obrigatório' }, { status: 400 })
    }

    const { data: attendance } = await supabaseAdmin
      .from('pastoral_attendances')
      .select('id, visitor_name, attendance_type, notes, title, church_id, churches(name)')
      .eq('id', attendanceId)
      .maybeSingle()

    if (!attendance) {
      return NextResponse.json({ error: 'Atendimento não encontrado' }, { status: 404 })
    }

    // Contexto do caso: o que já foi anotado e feito neste atendimento
    const [{ data: notes }, { data: activities }, { data: timeline }] = await Promise.all([
      supabaseAdmin
        .from('pastoral_attendance_notes')
        .select('content, created_at')
        .eq('attendance_id', attendanceId)
        .order('created_at', { ascending: false })
        .limit(10),
      supabaseAdmin
        .from('pastoral_attendance_activities')
        .select('activity_type, title, description, scheduled_date, completed')
        .eq('attendance_id', attendanceId)
        .order('created_at', { ascending: false })
        .limit(10),
      supabaseAdmin
        .from('pastoral_attendance_timeline')
        .select('event_type, description, created_at')
        .eq('attendance_id', attendanceId)
        .order('created_at', { ascending: false })
        .limit(15),
    ])

    // Agente da igreja: prioriza um de nome/descrição pastoral, depois o geral
    const agents = await prisma.aiAgent.findMany({
      where: {
        isActive: true,
        // agentes do campo do usuário + os globais (campo nulo). Sem campo
        // definido, só os globais — nunca o agente de outro campo.
        ...(user.campoId
          ? { OR: [{ campoId: user.campoId }, { campoId: null }] }
          : { campoId: null }),
      },
      select: { id: true, name: true, description: true, role: true, systemPrompt: true, campoId: true },
    })
    // respeita a lista de autorizados de cada agente
    const allowed = await filterAgentsForUser(agents, user.id ? String(user.id) : null)
    const agent =
      allowed.find(a => /pastoral/i.test(`${a.name} ${a.description ?? ''}`)) ??
      allowed.find(a => a.role === 'geral') ??
      allowed[0]

    const churchName = (attendance as { churches?: { name?: string } | null }).churches?.name ?? 'nossa igreja'
    const typeLabel = ACTIVITY_TYPE_LABELS[String(activityType || '').toLowerCase()] || activityType || 'Atividade'
    const when = scheduledDate
      ? new Date(scheduledDate).toLocaleString('pt-BR', {
          day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
        })
      : ''
    const timelineUrl = resolveTimelineUrl(attendanceId, origin || req.headers.get('origin'))

    const contexto = [
      `Igreja: ${churchName}`,
      `Pessoa atendida: ${attendance.visitor_name || 'não informado'}`,
      `Tipo do atendimento: ${attendance.attendance_type || 'não informado'}`,
      attendance.title ? `Título do card: ${attendance.title}` : '',
      attendance.notes ? `Observações do card: ${attendance.notes}` : '',
      '',
      'ATIVIDADE QUE ESTÁ SENDO REGISTRADA AGORA:',
      `- Tipo: ${typeLabel}`,
      title ? `- Assunto: ${title}` : '',
      when ? `- Quando: ${when}` : '',
      description ? `- Descrição interna (o que a equipe vai fazer): ${description}` : '',
      '',
      (notes ?? []).length ? `ANOTAÇÕES DO CASO:\n${(notes ?? []).map(n => `- ${n.content}`).join('\n')}` : '',
      (activities ?? []).length
        ? `ATIVIDADES JÁ REGISTRADAS:\n${(activities ?? []).map(a =>
            `- ${ACTIVITY_TYPE_LABELS[a.activity_type] || a.activity_type}: ${a.title}${a.completed ? ' (concluída)' : ''}`
          ).join('\n')}`
        : '',
      (timeline ?? []).length
        ? `HISTÓRICO:\n${(timeline ?? []).map(t => `- ${t.description}`).join('\n')}`
        : '',
      '',
      instructions?.trim()
        ? `PEDIDO DO ATENDENTE (o que ele quer comunicar / o que está sendo resolvido):\n${instructions.trim()}`
        : '',
    ].filter(Boolean).join('\n')

    const systemPrompt = [
      agent?.systemPrompt ?? '',
      '',
      'Sua tarefa agora: escrever a MENSAGEM DE WHATSAPP que a igreja vai enviar para a',
      'pessoa atendida, avisando sobre a atividade registrada no atendimento pastoral dela.',
      '',
      'Regras:',
      '- Escreva APENAS o texto da mensagem, pronto para enviar. Sem comentários, sem aspas, sem título.',
      '- Tom acolhedor e pastoral, tratando a pessoa pelo nome.',
      '- Tamanho de mensagem de WhatsApp: curta, em parágrafos separados por linha em branco.',
      '- Formatação do WhatsApp: *negrito* com asterisco simples. Nunca use markdown.',
      '- Traga uma palavra de ânimo com uma passagem bíblica pertinente (livro, capítulo e versículo).',
      '- Não invente datas, horários, endereços ou compromissos que não estejam no contexto.',
      '- Nunca revele anotações internas da equipe; fale com a pessoa, não sobre ela.',
      `- Termine convidando a acompanhar o atendimento e coloque o link SOZINHO na última linha: ${timelineUrl}`,
    ].filter(Boolean).join('\n')

    try {
      const text = await generateAiText(agent?.campoId ?? user.campoId, systemPrompt, [
        { role: 'user', content: contexto },
      ])
      const message = text.trim()
      if (!message) {
        return NextResponse.json({ error: 'A IA não retornou uma mensagem.' }, { status: 502 })
      }
      return NextResponse.json({ message, agent: agent?.name ?? null })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar a sugestão'
      return NextResponse.json({ error: msg }, { status: 502 })
    }
  })
}
