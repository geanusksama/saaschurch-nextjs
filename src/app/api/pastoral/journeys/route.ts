import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { seedJourneySteps } from '@/lib/pastoralJourneyService'
import { DEFAULT_JOURNEY_NAME } from '@/lib/pastoralJourneyDefault'

/**
 * GET /api/pastoral/journeys — cronogramas da igreja (com contagens).
 * POST /api/pastoral/journeys — cria um cronograma.
 *   body: { name?, description?, churchId?, seed? (default true) }
 *   seed = popula com a matriz do documento (13 etapas × 3 perfis).
 */

function churchIdFor(req: NextRequest, userChurchId: string | null): string | null {
  return new URL(req.url).searchParams.get('churchId') || userChurchId
}

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const churchId = churchIdFor(req, user.churchId)

    let query = supabaseAdmin
      .from('pastoral_journeys')
      .select('*')
      .order('created_at', { ascending: true })

    // master enxerga tudo quando não filtra igreja; os demais ficam na sua
    if (churchId) query = query.eq('church_id', churchId)
    else if (user.profileType !== 'master') return NextResponse.json({ journeys: [] })

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const journeys = data ?? []
    if (!journeys.length) return NextResponse.json({ journeys: [] })

    const ids = journeys.map(j => j.id)

    const [{ data: steps }, { data: enrollments }, { data: sends }] = await Promise.all([
      supabaseAdmin.from('pastoral_journey_steps').select('id, journey_id').in('journey_id', ids),
      supabaseAdmin.from('pastoral_journey_enrollments').select('journey_id, status').in('journey_id', ids),
      supabaseAdmin.from('pastoral_journey_sends').select('journey_id, status').in('journey_id', ids),
    ])

    const countBy = <T extends { journey_id: string }>(rows: T[] | null, filter?: (r: T) => boolean) => {
      const map = new Map<string, number>()
      for (const r of rows ?? []) {
        if (filter && !filter(r)) continue
        map.set(r.journey_id, (map.get(r.journey_id) ?? 0) + 1)
      }
      return map
    }

    const stepCounts = countBy(steps)
    const activeEnrollments = countBy(enrollments as { journey_id: string; status: string }[], r => r.status === 'active')
    const pendingSends = countBy(sends as { journey_id: string; status: string }[], r => r.status === 'pending')
    const sentSends = countBy(sends as { journey_id: string; status: string }[], r => r.status === 'sent')

    return NextResponse.json({
      journeys: journeys.map(j => ({
        ...j,
        stepCount: stepCounts.get(j.id) ?? 0,
        activeEnrollments: activeEnrollments.get(j.id) ?? 0,
        pendingSends: pendingSends.get(j.id) ?? 0,
        sentSends: sentSends.get(j.id) ?? 0,
      })),
    })
  })
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}))
    const churchId = body.churchId || user.churchId
    if (!churchId) return NextResponse.json({ error: 'Igreja não identificada' }, { status: 400 })

    const { data: journey, error } = await supabaseAdmin
      .from('pastoral_journeys')
      .insert({
        church_id: churchId,
        name: body.name || DEFAULT_JOURNEY_NAME,
        description: body.description ?? 'Fluxo de mensagens do acolhimento até 1 mês depois.',
        interval_seconds: Math.max(5, Number(body.intervalSeconds) || 15),
        window_start: body.windowStart || '08:00',
        window_end: body.windowEnd || '20:00',
        daily_limit_per_instance: Math.max(0, Number(body.dailyLimitPerInstance) || 0),
        owner_user_id: user.id ? String(user.id) : null,
      })
      .select('*')
      .single()

    if (error || !journey) {
      return NextResponse.json({ error: error?.message ?? 'Falha ao criar cronograma' }, { status: 500 })
    }

    if (body.seed !== false) {
      try {
        await seedJourneySteps(journey.id)
      } catch (err) {
        return NextResponse.json(
          { journey, warning: err instanceof Error ? err.message : 'Falha ao popular a matriz padrão' },
          { status: 207 }
        )
      }
    }

    return NextResponse.json({ journey })
  })
}
