import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * GET /api/pastoral/dashboard — números do Pipeline + do Cronograma juntos.
 *
 * Uma consulta só para a aba Dashboard: funil por coluna, distribuição por
 * grupo de chegada, entrada por dia, andamento do acompanhamento por semana e
 * o desempenho de envio/resposta.
 *
 * Query: churchId, dateFrom, dateTo
 */
export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const sp = new URL(req.url).searchParams
    const churchId = sp.get('churchId') || user.churchId
    const dateFrom = sp.get('dateFrom')
    const dateTo = sp.get('dateTo')

    if (!churchId && user.profileType !== 'master') {
      return NextResponse.json({ error: 'Igreja não identificada' }, { status: 400 })
    }

    // ── pipeline ──
    let cardsQuery = supabaseAdmin
      .from('pastoral_attendances')
      .select('id, column_id, status, attendance_type, person_profile, created_at, completed_at, sla_date, priority')
      .is('deleted_at', null)
      .limit(10000)
    if (churchId) cardsQuery = cardsQuery.eq('church_id', churchId)
    if (dateFrom) cardsQuery = cardsQuery.gte('created_at', `${dateFrom}T00:00:00`)
    if (dateTo) cardsQuery = cardsQuery.lte('created_at', `${dateTo}T23:59:59`)

    const { data: cards } = await cardsQuery

    const { data: columns } = await supabaseAdmin
      .from('pastoral_pipeline_columns')
      .select('id, name, column_key, color, position')
      .eq('church_id', churchId ?? '')
      .order('position')

    // ── cronograma ──
    let sendsQuery = supabaseAdmin
      .from('pastoral_journey_sends')
      .select('id, enrollment_id, profile, status, sent_at, scheduled_at, conversation_id, step_id')
      .limit(20000)
    if (churchId) sendsQuery = sendsQuery.eq('church_id', churchId)
    if (dateFrom) sendsQuery = sendsQuery.gte('scheduled_at', `${dateFrom}T00:00:00`)
    if (dateTo) sendsQuery = sendsQuery.lte('scheduled_at', `${dateTo}T23:59:59`)

    const { data: sends } = await sendsQuery

    let enrollQuery = supabaseAdmin
      .from('pastoral_journey_enrollments')
      .select('id, profile, status, enrolled_at, certificate_issued_at')
      .limit(10000)
    if (churchId) enrollQuery = enrollQuery.eq('church_id', churchId)
    const { data: enrollments } = await enrollQuery

    // respostas reais
    const convIds = Array.from(
      new Set((sends ?? []).map(s => s.conversation_id).filter(Boolean))
    ) as string[]
    const lastInbound = new Map<string, string>()
    if (convIds.length) {
      const { data: inbound } = await supabaseAdmin
        .from('whatsapp_messages')
        .select('conversation_id, created_at')
        .in('conversation_id', convIds)
        .eq('direction', 'inbound')
        .order('created_at', { ascending: false })
        .limit(10000)
      for (const m of inbound ?? []) {
        if (!lastInbound.has(m.conversation_id)) lastInbound.set(m.conversation_id, m.created_at)
      }
    }
    const responderam = (sends ?? []).filter(s => {
      if (s.status !== 'sent' || !s.conversation_id || !s.sent_at) return false
      const last = lastInbound.get(s.conversation_id)
      return !!last && new Date(last) > new Date(s.sent_at)
    }).length

    // semana atual de cada pessoa em acompanhamento
    const stepIds = Array.from(new Set((sends ?? []).map(s => s.step_id)))
    const { data: steps } = stepIds.length
      ? await supabaseAdmin
          .from('pastoral_journey_steps')
          .select('id, week_number')
          .in('id', stepIds)
      : { data: [] }
    const weekByStep = new Map((steps ?? []).map(s => [s.id, s.week_number]))

    const porSemana: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0 }
    for (const e of (enrollments ?? []).filter(x => x.status === 'active')) {
      const meus = (sends ?? [])
        .filter(s => s.enrollment_id === e.id && s.status === 'sent')
        .sort((a, b) => (b.sent_at ?? '').localeCompare(a.sent_at ?? ''))
      const week = weekByStep.get(meus[0]?.step_id ?? '') ?? 1
      porSemana[String(week)] = (porSemana[String(week)] ?? 0) + 1
    }

    // entrada por dia (últimos 30 pontos)
    const porDia = new Map<string, number>()
    for (const c of cards ?? []) {
      const dia = String(c.created_at).slice(0, 10)
      porDia.set(dia, (porDia.get(dia) ?? 0) + 1)
    }

    const count = <T,>(rows: T[], fn: (r: T) => boolean) => rows.filter(fn).length
    const cardsArr = cards ?? []
    const agora = new Date()

    return NextResponse.json({
      pipeline: {
        total: cardsArr.length,
        porColuna: (columns ?? []).map(col => ({
          key: col.column_key,
          name: col.name,
          color: col.color,
          total: count(cardsArr, c => c.column_id === col.id),
        })),
        porGrupo: ['novo_convertido', 'reconciliado', 'outra_igreja', 'sem'].map(p => ({
          profile: p,
          total: count(cardsArr, c => (p === 'sem' ? !c.person_profile : c.person_profile === p)),
        })),
        porTipo: Object.entries(
          cardsArr.reduce<Record<string, number>>((acc, c) => {
            acc[c.attendance_type] = (acc[c.attendance_type] ?? 0) + 1
            return acc
          }, {})
        )
          .map(([tipo, total]) => ({ tipo, total }))
          .sort((a, b) => b.total - a.total),
        atrasados: count(
          cardsArr,
          c => !!c.sla_date && new Date(c.sla_date) < agora && c.status !== 'done' && c.status !== 'cancelled'
        ),
        urgentes: count(cardsArr, c => c.priority === 'urgent' && c.status !== 'done' && c.status !== 'cancelled'),
        porDia: Array.from(porDia.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(-30)
          .map(([dia, total]) => ({ dia, total })),
      },
      cronograma: {
        pessoasAtivas: count(enrollments ?? [], e => e.status === 'active'),
        concluidas: count(enrollments ?? [], e => e.status === 'completed'),
        certificados: count(enrollments ?? [], e => !!e.certificate_issued_at),
        enviadas: count(sends ?? [], s => s.status === 'sent'),
        naFila: count(sends ?? [], s => s.status === 'pending'),
        erros: count(sends ?? [], s => s.status === 'error'),
        responderam,
        taxaResposta: (() => {
          const enviadas = count(sends ?? [], s => s.status === 'sent')
          return enviadas ? Math.round((responderam / enviadas) * 100) : 0
        })(),
        porSemana: Object.entries(porSemana).map(([semana, total]) => ({ semana, total })),
        porGrupo: ['novo_convertido', 'reconciliado', 'outra_igreja'].map(p => ({
          profile: p,
          ativas: count(enrollments ?? [], e => e.profile === p && e.status === 'active'),
          concluidas: count(enrollments ?? [], e => e.profile === p && e.status === 'completed'),
        })),
      },
    })
  })
}
