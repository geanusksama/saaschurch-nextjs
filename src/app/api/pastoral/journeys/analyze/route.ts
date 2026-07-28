import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateAiText } from '@/lib/aiReplyService'
import { JOURNEY_PROFILE_LABELS, type JourneyProfile } from '@/lib/pastoralJourneyDefault'

/**
 * POST /api/pastoral/journeys/analyze — parecer do cronograma inteiro.
 *
 * Primeiro apura os números de verdade (enviadas, respondidas, sem resposta,
 * erro — por grupo e por etapa), depois pede à IA um parecer em cima desses
 * números. A IA nunca inventa estatística: ela recebe os totais prontos.
 *
 * Body: { journeyId?, dateFrom?, dateTo?, churchId? }
 */
export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}))
    const churchId = body.churchId || user.churchId

    let query = supabaseAdmin
      .from('pastoral_journey_sends')
      .select('id, enrollment_id, step_id, profile, status, sent_at, conversation_id, phone, name')
      .limit(20000)

    if (churchId) query = query.eq('church_id', churchId)
    if (body.journeyId) query = query.eq('journey_id', body.journeyId)
    if (body.dateFrom) query = query.gte('sent_at', `${body.dateFrom}T00:00:00`)
    if (body.dateTo) query = query.lte('sent_at', `${body.dateTo}T23:59:59`)

    const { data: sends, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!sends?.length) {
      return NextResponse.json({ stats: null, parecer: 'Nenhum envio no período selecionado.' })
    }

    // ── quem respondeu de verdade (inbound depois do envio) ──
    const convIds = Array.from(new Set(sends.map(s => s.conversation_id).filter(Boolean))) as string[]
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

    const replied = (s: { conversation_id: string | null; sent_at: string | null }) => {
      if (!s.conversation_id || !s.sent_at) return false
      const last = lastInbound.get(s.conversation_id)
      return !!last && new Date(last) > new Date(s.sent_at)
    }

    // ── etapas, para o recorte por momento do cronograma ──
    const stepIds = Array.from(new Set(sends.map(s => s.step_id)))
    const { data: steps } = await supabaseAdmin
      .from('pastoral_journey_steps')
      .select('id, position, moment_label, program_label, week_number')
      .in('id', stepIds)
    const stepById = new Map((steps ?? []).map(s => [s.id, s]))

    const enviadas = sends.filter(s => s.status === 'sent')
    const responderam = enviadas.filter(replied)

    const bucket = () => ({ enviadas: 0, responderam: 0, erros: 0, fila: 0 })

    const porGrupo: Record<string, ReturnType<typeof bucket>> = {}
    const porEtapa: Record<string, ReturnType<typeof bucket> & { label: string; semana: number }> = {}

    for (const s of sends) {
      const g = (porGrupo[s.profile] ??= bucket())
      const step = stepById.get(s.step_id)
      const key = s.step_id
      const e = (porEtapa[key] ??= {
        ...bucket(),
        label: step?.program_label || step?.moment_label || 'Etapa',
        semana: step?.week_number ?? 0,
      })

      if (s.status === 'sent') {
        g.enviadas++; e.enviadas++
        if (replied(s)) { g.responderam++; e.responderam++ }
      } else if (s.status === 'error') { g.erros++; e.erros++ }
      else if (s.status === 'pending') { g.fila++; e.fila++ }
    }

    const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)

    const stats = {
      totalEnviadas: enviadas.length,
      totalResponderam: responderam.length,
      taxaResposta: pct(responderam.length, enviadas.length),
      totalErros: sends.filter(s => s.status === 'error').length,
      totalFila: sends.filter(s => s.status === 'pending').length,
      pessoas: new Set(sends.map(s => s.enrollment_id)).size,
      porGrupo: Object.entries(porGrupo).map(([profile, v]) => ({
        profile,
        label: JOURNEY_PROFILE_LABELS[profile as JourneyProfile] ?? profile,
        ...v,
        taxaResposta: pct(v.responderam, v.enviadas),
      })),
      porEtapa: Object.entries(porEtapa)
        .map(([stepId, v]) => ({
          stepId,
          ...v,
          taxaResposta: pct(v.responderam, v.enviadas),
          position: stepById.get(stepId)?.position ?? 0,
        }))
        .sort((a, b) => a.position - b.position),
      // quem recebeu e nunca respondeu nada — a lista de resgate
      semResposta: Array.from(
        new Map(
          enviadas
            .filter(s => !replied(s))
            .map(s => [s.phone, { name: s.name, phone: s.phone, profile: s.profile }])
        ).values()
      ).slice(0, 50),
    }

    // ── parecer da IA em cima dos números apurados ──
    let parecer = ''
    try {
      const resumo = [
        `Mensagens enviadas: ${stats.totalEnviadas}`,
        `Pessoas acompanhadas: ${stats.pessoas}`,
        `Responderam: ${stats.totalResponderam} (${stats.taxaResposta}%)`,
        `Erros de envio: ${stats.totalErros} · Ainda na fila: ${stats.totalFila}`,
        '',
        'Por grupo:',
        ...stats.porGrupo.map(g =>
          `- ${g.label}: ${g.enviadas} enviadas, ${g.responderam} responderam (${g.taxaResposta}%)`
        ),
        '',
        'Por etapa do cronograma:',
        ...stats.porEtapa.map(e =>
          `- [S${e.semana}] ${e.label}: ${e.enviadas} enviadas, ${e.responderam} responderam (${e.taxaResposta}%)`
        ),
      ].join('\n')

      parecer = await generateAiText(
        user.campoId ?? null,
        'Você é um analista de engajamento pastoral. Receberá os números reais de uma ' +
          'campanha de acompanhamento de novos convertidos, reconciliados e pessoas vindas de ' +
          'outras igrejas, enviada por WhatsApp. Escreva um parecer curto e direto em ' +
          'português do Brasil, com estes blocos e nada mais:\n' +
          '1) LEITURA — 2 a 3 frases sobre como a campanha está indo.\n' +
          '2) PONTOS DE ATENÇÃO — até 3 itens, citando a etapa ou o grupo com pior desempenho ' +
          'e o número que sustenta a afirmação.\n' +
          '3) O QUE FAZER — até 4 ações práticas e específicas (mudar horário, encurtar texto, ' +
          'trocar a abordagem de uma etapa, ligar para quem não respondeu).\n' +
          'Nunca invente números além dos fornecidos. Se a amostra for pequena (menos de 20 ' +
          'envios), diga isso antes de concluir qualquer coisa.',
        [{ role: 'user', content: resumo }]
      )
    } catch (err) {
      parecer = ''
      console.error('[journeys/analyze] IA indisponível', err)
    }

    return NextResponse.json({ stats, parecer })
  })
}
