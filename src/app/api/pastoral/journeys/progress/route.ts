import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * GET /api/pastoral/journeys/progress?churchId=&attendanceIds=a,b,c
 *
 * Progresso do cronograma por card do kanban: em que semana a pessoa está,
 * quantas mensagens já saíram e qual é a próxima. É o que o card mostra —
 * sem isso o kanban diz a coluna, mas não diz o andamento do acompanhamento.
 */
export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const sp = new URL(req.url).searchParams
    const churchId = sp.get('churchId') || user.churchId
    const idsParam = (sp.get('attendanceIds') ?? '').trim()
    const ids = idsParam ? idsParam.split(',').filter(Boolean) : []

    let query = supabaseAdmin
      .from('pastoral_journey_enrollments')
      .select('id, attendance_id, profile, status, enrolled_at, certificate_issued_at')
      .not('attendance_id', 'is', null)
      .limit(2000)

    if (ids.length) query = query.in('attendance_id', ids)
    else if (churchId) query = query.eq('church_id', churchId)
    else return NextResponse.json({ progress: {} })

    const { data: enrollments } = await query
    if (!enrollments?.length) return NextResponse.json({ progress: {} })

    const { data: sends } = await supabaseAdmin
      .from('pastoral_journey_sends')
      .select('enrollment_id, sequence, total_steps, status, scheduled_at, sent_at, step_id')
      .in('enrollment_id', enrollments.map(e => e.id))
      .limit(20000)

    const stepIds = Array.from(new Set((sends ?? []).map(s => s.step_id)))
    const { data: steps } = stepIds.length
      ? await supabaseAdmin
          .from('pastoral_journey_steps')
          .select('id, week_number, moment_label')
          .in('id', stepIds)
      : { data: [] }
    const stepById = new Map((steps ?? []).map(s => [s.id, s]))

    const progress: Record<string, unknown> = {}

    for (const enrollment of enrollments) {
      const rows = (sends ?? []).filter(s => s.enrollment_id === enrollment.id)
      if (!rows.length) continue

      const sent = rows.filter(r => r.status === 'sent' || r.status === 'merged')
      const total = rows[0]?.total_steps ?? rows.length
      const errors = rows.filter(r => r.status === 'error').length

      // a semana corrente é a da última mensagem que saiu; sem nenhuma ainda,
      // é a da próxima a sair
      const lastSent = sent.sort((a, b) => (b.sequence ?? 0) - (a.sequence ?? 0))[0]
      const next = rows
        .filter(r => r.status === 'pending')
        .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))[0]

      const refStep = stepById.get(lastSent?.step_id ?? next?.step_id ?? '')

      progress[enrollment.attendance_id!] = {
        enrollmentId: enrollment.id,
        profile: enrollment.profile,
        status: enrollment.status,
        sent: sent.length,
        total,
        errors,
        pending: rows.filter(r => r.status === 'pending').length,
        week: refStep?.week_number ?? null,
        currentStep: lastSent?.sequence ?? null,
        currentLabel: refStep?.moment_label ?? null,
        nextAt: next?.scheduled_at ?? null,
        certificateIssued: !!enrollment.certificate_issued_at,
        enrolledAt: enrollment.enrolled_at,
      }
    }

    return NextResponse.json({ progress })
  })
}
