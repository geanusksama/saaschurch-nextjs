import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * GET   /api/pastoral/journeys/enrollments — pessoas acompanhadas, com o
 *       andamento (quantas etapas já saíram, qual é a próxima e quando).
 * PATCH /api/pastoral/journeys/enrollments — pausa / retoma / encerra.
 *       body: { enrollmentIds: string[], status: 'active'|'paused'|'cancelled' }
 *
 * Encerrar cancela também a fila pendente da pessoa; retomar devolve à fila o
 * que havia sido cancelado por esse mesmo motivo e ainda não venceu de vez.
 */

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const sp = new URL(req.url).searchParams
    const churchId = sp.get('churchId') || user.churchId
    const journeyId = sp.get('journeyId') ?? ''
    const status = sp.get('status') ?? ''
    const q = (sp.get('q') ?? '').trim().toLowerCase()

    let query = supabaseAdmin
      .from('pastoral_journey_enrollments')
      .select('*')
      .order('enrolled_at', { ascending: false })
      .limit(1000)

    if (churchId) query = query.eq('church_id', churchId)
    else if (user.profileType !== 'master') return NextResponse.json({ enrollments: [] })
    if (journeyId) query = query.eq('journey_id', journeyId)
    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    let rows = data ?? []
    if (q) {
      const digits = q.replace(/\D/g, '')
      rows = rows.filter(
        r => (r.name ?? '').toLowerCase().includes(q) || (digits && String(r.phone).includes(digits))
      )
    }
    if (!rows.length) return NextResponse.json({ enrollments: [] })

    const { data: sends } = await supabaseAdmin
      .from('pastoral_journey_sends')
      .select('enrollment_id, status, scheduled_at, sent_at')
      .in('enrollment_id', rows.map(r => r.id))

    const progress = new Map<string, { sent: number; pending: number; errors: number; nextAt: string | null }>()
    for (const s of sends ?? []) {
      const acc = progress.get(s.enrollment_id) ?? { sent: 0, pending: 0, errors: 0, nextAt: null }
      if (s.status === 'sent') acc.sent++
      else if (s.status === 'error') acc.errors++
      else if (s.status === 'pending' || s.status === 'sending') {
        acc.pending++
        if (!acc.nextAt || s.scheduled_at < acc.nextAt) acc.nextAt = s.scheduled_at
      }
      progress.set(s.enrollment_id, acc)
    }

    return NextResponse.json({
      enrollments: rows.map(r => ({
        ...r,
        ...(progress.get(r.id) ?? { sent: 0, pending: 0, errors: 0, nextAt: null }),
      })),
    })
  })
}

export async function PATCH(req: NextRequest) {
  return withAuth(req, async () => {
    const body = await req.json().catch(() => ({}))
    const ids: string[] = Array.isArray(body.enrollmentIds) ? body.enrollmentIds : []
    const status = body.status

    if (!ids.length) return NextResponse.json({ error: 'enrollmentIds obrigatório' }, { status: 400 })
    if (!['active', 'paused', 'cancelled'].includes(status)) {
      return NextResponse.json({ error: 'status inválido' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const { error } = await supabaseAdmin
      .from('pastoral_journey_enrollments')
      .update({ status, updated_at: now })
      .in('id', ids)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (status === 'cancelled') {
      await supabaseAdmin
        .from('pastoral_journey_sends')
        .update({ status: 'cancelled', error_message: 'Acompanhamento encerrado', updated_at: now })
        .in('enrollment_id', ids)
        .eq('status', 'pending')
    } else if (status === 'active') {
      await supabaseAdmin
        .from('pastoral_journey_sends')
        .update({ status: 'pending', error_message: null, updated_at: now })
        .in('enrollment_id', ids)
        .eq('status', 'cancelled')
        .eq('error_message', 'Acompanhamento encerrado')
    }

    return NextResponse.json({ ok: true, updated: ids.length })
  })
}
