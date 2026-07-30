import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { enrollInJourney } from '@/lib/pastoralJourneyService'
import { JOURNEY_PROFILES, type JourneyProfile } from '@/lib/pastoralJourneyDefault'

/**
 * POST /api/pastoral/journeys/enroll — anexa o cronograma a atendimentos.
 *
 * body: {
 *   journeyId, sendFirstNow?, profile?,
 *   items: [{ attendanceId, profile?, enrolledAt? }]   ← em lote (coluna)
 * }
 *
 * `profile` no topo vale para os itens que não trouxerem o seu; se o card já
 * tem person_profile gravado, ele tem prioridade sobre o padrão do lote.
 * Card sem telefone é devolvido em `skipped` — não dá para acompanhar por
 * WhatsApp quem não tem número.
 */
export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}))
    const journeyId = body.journeyId
    if (!journeyId) return NextResponse.json({ error: 'journeyId obrigatório' }, { status: 400 })

    const { data: journey } = await supabaseAdmin
      .from('pastoral_journeys')
      .select('id, church_id, is_active')
      .eq('id', journeyId)
      .maybeSingle()

    if (!journey) return NextResponse.json({ error: 'Cronograma não encontrado' }, { status: 404 })

    const items: Array<{ attendanceId: string; profile?: string; enrolledAt?: string }> =
      Array.isArray(body.items) ? body.items : []
    if (!items.length) return NextResponse.json({ error: 'Nenhum atendimento informado' }, { status: 400 })

    const fallbackProfile: JourneyProfile = JOURNEY_PROFILES.includes(body.profile)
      ? body.profile
      : 'novo_convertido'

    const { data: attendances } = await supabaseAdmin
      .from('pastoral_attendances')
      .select('id, church_id, phone, visitor_name, title, member_id, person_profile, created_at, members(full_name)')
      .in('id', items.map(i => i.attendanceId))

    const byId = new Map((attendances ?? []).map(a => [a.id, a]))

    const enrolled: Array<{ attendanceId: string; enrollmentId: string; scheduled: number }> = []
    const skipped: Array<{ attendanceId: string; reason: string }> = []

    for (const item of items) {
      const card = byId.get(item.attendanceId)
      if (!card) {
        skipped.push({ attendanceId: item.attendanceId, reason: 'Atendimento não encontrado' })
        continue
      }

      const phone = String(card.phone ?? '').replace(/\D/g, '')
      if (phone.length < 10) {
        skipped.push({ attendanceId: item.attendanceId, reason: 'Sem telefone válido' })
        continue
      }

      const profile = (
        JOURNEY_PROFILES.includes(item.profile as JourneyProfile)
          ? item.profile
          : JOURNEY_PROFILES.includes(card.person_profile as JourneyProfile)
            ? card.person_profile
            : fallbackProfile
      ) as JourneyProfile

      const member = card.members as unknown as { full_name: string | null } | null
      const name = member?.full_name ?? card.visitor_name ?? card.title ?? null

      try {
        const result = await enrollInJourney({
          journeyId,
          churchId: card.church_id ?? journey.church_id,
          attendanceId: card.id,
          profile,
          name,
          phone,
          // por padrão a jornada conta do dia em que a pessoa foi acolhida
          enrolledAt: item.enrolledAt ?? card.created_at,
          sendFirstNow: body.sendFirstNow !== false,
          ownerUserId: user.id ? String(user.id) : null,
          createdBy: user.id ? String(user.id) : null,
        })
        enrolled.push({ attendanceId: card.id, enrollmentId: result.enrollmentId, scheduled: result.scheduled })
      } catch (err) {
        skipped.push({
          attendanceId: item.attendanceId,
          reason: err instanceof Error ? err.message : 'Falha ao anexar',
        })
      }
    }

    return NextResponse.json({ enrolled, skipped })
  })
}

/**
 * DELETE /api/pastoral/journeys/enroll — remove o cronograma anexado a
 * atendimentos (um card ou a coluna inteira).
 *
 * body: { attendanceIds: string[] }
 *
 * Duas situações, porque apagar tudo destruiria o registro de mensagens que já
 * chegaram na mão da pessoa:
 *
 *  - nada saiu ainda   → apaga a inscrição de vez (o CASCADE leva a fila
 *                        pendente com ela). Fica como se nunca tivesse sido
 *                        anexado, e o card pode receber outro cronograma.
 *  - já saiu alguma    → cancela só a fila pendente e desliga a inscrição do
 *                        card (attendance_id = null, status cancelled). O card
 *                        limpa o andamento e volta a poder receber cronograma,
 *                        mas o histórico continua na aba Envios.
 */
export async function DELETE(req: NextRequest) {
  return withAuth(req, async () => {
    const body = await req.json().catch(() => ({}))
    const ids: string[] = Array.isArray(body.attendanceIds)
      ? body.attendanceIds.filter((v: unknown) => typeof v === 'string' && v)
      : []
    if (!ids.length) {
      return NextResponse.json({ error: 'attendanceIds obrigatório' }, { status: 400 })
    }

    const { data: enrollments, error } = await supabaseAdmin
      .from('pastoral_journey_enrollments')
      .select('id, attendance_id')
      .in('attendance_id', ids)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!enrollments?.length) {
      return NextResponse.json({ removed: 0, detached: 0, cancelledPending: 0 })
    }

    const enrollmentIds = enrollments.map(e => e.id)

    // quem já recebeu mensagem tem histórico a preservar
    const { data: sends } = await supabaseAdmin
      .from('pastoral_journey_sends')
      .select('enrollment_id, status')
      .in('enrollment_id', enrollmentIds)

    const jaEnviou = new Set(
      (sends ?? [])
        .filter(s => s.status === 'sent' || s.status === 'merged')
        .map(s => s.enrollment_id)
    )

    const paraApagar = enrollmentIds.filter(id => !jaEnviou.has(id))
    const paraDesligar = enrollmentIds.filter(id => jaEnviou.has(id))
    const now = new Date().toISOString()
    let cancelledPending = 0

    if (paraDesligar.length) {
      const { data: canceladas } = await supabaseAdmin
        .from('pastoral_journey_sends')
        .update({
          status: 'cancelled',
          error_message: 'Cronograma removido do atendimento',
          updated_at: now,
        })
        .in('enrollment_id', paraDesligar)
        .in('status', ['pending', 'sending'])
        .select('id')
      cancelledPending = canceladas?.length ?? 0

      const { error: offErr } = await supabaseAdmin
        .from('pastoral_journey_enrollments')
        .update({ status: 'cancelled', attendance_id: null, updated_at: now })
        .in('id', paraDesligar)
      if (offErr) return NextResponse.json({ error: offErr.message }, { status: 500 })
    }

    if (paraApagar.length) {
      const { error: delErr } = await supabaseAdmin
        .from('pastoral_journey_enrollments')
        .delete()
        .in('id', paraApagar)
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
    }

    return NextResponse.json({
      removed: paraApagar.length,
      detached: paraDesligar.length,
      cancelledPending,
    })
  })
}
