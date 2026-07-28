import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * GET /api/pastoral/journeys/sends — histórico do Cronograma.
 *
 * A tela fundamental do módulo: o que foi enviado, para quem, quando, por qual
 * etapa da matriz e se a pessoa respondeu. Cada linha carrega o conversationId
 * para abrir a conversa e continuar o atendimento por ali.
 *
 * Query: journeyId, dateFrom, dateTo, status, profile, stepId, q,
 *        dateField (scheduled|sent, default sent), limit (default 500)
 */
export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const sp = new URL(req.url).searchParams
    const churchId = sp.get('churchId') || user.churchId
    const journeyId = sp.get('journeyId') ?? ''
    const dateFrom = sp.get('dateFrom')
    const dateTo = sp.get('dateTo')
    const status = sp.get('status') ?? ''
    const profile = sp.get('profile') ?? ''
    const stepId = sp.get('stepId') ?? ''
    const q = (sp.get('q') ?? '').trim().toLowerCase()
    const dateField = sp.get('dateField') === 'scheduled' ? 'scheduled_at' : 'sent_at'
    const limit = Math.min(Math.max(1, Number(sp.get('limit')) || 500), 2000)

    let query = supabaseAdmin
      .from('pastoral_journey_sends')
      .select('*')
      .order('scheduled_at', { ascending: false })
      .limit(limit)

    if (churchId) query = query.eq('church_id', churchId)
    else if (user.profileType !== 'master') return NextResponse.json({ sends: [], steps: [] })

    if (journeyId) query = query.eq('journey_id', journeyId)
    if (status) query = query.eq('status', status)
    if (profile) query = query.eq('profile', profile)
    if (stepId) query = query.eq('step_id', stepId)

    // pendentes ainda não têm sent_at: ao filtrar por data de envio elas ficam
    // de fora, que é o comportamento esperado de um relatório de "enviados"
    if (dateFrom) query = query.gte(dateField, `${dateFrom}T00:00:00`)
    if (dateTo) query = query.lte(dateField, `${dateTo}T23:59:59`)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    let rows = data ?? []
    if (q) {
      const digits = q.replace(/\D/g, '')
      rows = rows.filter(
        r =>
          (r.name ?? '').toLowerCase().includes(q) ||
          (digits && String(r.phone).includes(digits)) ||
          (r.message ?? '').toLowerCase().includes(q)
      )
    }

    if (!rows.length) return NextResponse.json({ sends: [], steps: [] })

    // etapas (para rotular a linha e alimentar o filtro da tela)
    const stepIds = Array.from(new Set(rows.map(r => r.step_id)))
    const { data: steps } = await supabaseAdmin
      .from('pastoral_journey_steps')
      .select('id, position, moment_label, channel, program_label')
      .in('id', stepIds)
    const stepById = new Map((steps ?? []).map(s => [s.id, s]))

    // conversa: a gravada no envio, ou a que existe para o telefone
    const phones = Array.from(new Set(rows.map(r => String(r.phone))))
    const { data: convs } = await supabaseAdmin
      .from('whatsapp_conversations')
      .select('id, phone, instance_id, last_message, last_message_at, ai_enabled, ai_agent_id')
      .in('phone', phones)

    type ConvRow = NonNullable<typeof convs>[number]
    const convById = new Map<string, ConvRow>((convs ?? []).map(c => [c.id, c]))
    const convByPhone = new Map<string, ConvRow>()
    for (const c of convs ?? []) if (!convByPhone.has(c.phone)) convByPhone.set(c.phone, c)

    // última entrada da pessoa em cada conversa → "respondeu?"
    const convIds = (convs ?? []).map(c => c.id)
    const lastInbound = new Map<string, string>()
    if (convIds.length) {
      const { data: inbound } = await supabaseAdmin
        .from('whatsapp_messages')
        .select('conversation_id, created_at')
        .in('conversation_id', convIds)
        .eq('direction', 'inbound')
        .order('created_at', { ascending: false })
        .limit(5000)
      for (const m of inbound ?? []) {
        if (!lastInbound.has(m.conversation_id)) lastInbound.set(m.conversation_id, m.created_at)
      }
    }

    const sends = rows.map(r => {
      const conv = r.conversation_id
        ? convById.get(r.conversation_id) ?? convByPhone.get(String(r.phone))
        : convByPhone.get(String(r.phone))
      const lastIn = conv ? lastInbound.get(conv.id) ?? null : null
      const step = stepById.get(r.step_id)
      return {
        id: r.id,
        enrollmentId: r.enrollment_id,
        journeyId: r.journey_id,
        stepId: r.step_id,
        // "mensagem 2 de 13" — confirma de olho que a jornada está andando
        sequence: r.sequence ?? null,
        totalSteps: r.total_steps ?? null,
        aiPolished: r.ai_polished ?? false,
        originalMessage: r.original_message ?? null,
        stepPosition: step?.position ?? 0,
        stepLabel: step?.moment_label ?? '',
        stepProgram: step?.program_label ?? '',
        channel: step?.channel ?? 'WhatsApp',
        attendanceId: r.attendance_id,
        profile: r.profile,
        name: r.name,
        phone: String(r.phone),
        message: r.message,
        status: r.status,
        scheduledAt: r.scheduled_at,
        sentAt: r.sent_at,
        errorMessage: r.error_message,
        conversationId: conv?.id ?? null,
        replied: !!(lastIn && r.sent_at && new Date(lastIn) > new Date(r.sent_at)),
        lastInboundAt: lastIn,
        lastMessage: conv?.last_message ?? null,
        aiEnabled: conv?.ai_enabled ?? false,
        aiAgentId: conv?.ai_agent_id ?? null,
      }
    })

    return NextResponse.json({
      sends,
      steps: (steps ?? []).sort((a, b) => a.position - b.position),
    })
  })
}
