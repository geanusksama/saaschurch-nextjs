import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * GET /api/whatsapp/sends — Lista de envios (histórico de mensagens em massa).
 *
 * Cada linha = destinatário que recebeu envio, com estado da conversa:
 *  - replied: houve mensagem inbound DEPOIS do envio (verde) ou não (amarelo)
 *  - aiEnabled/aiAgentId: conversa sob atendimento de agente de IA
 *
 * Query: dateFrom, dateTo (sent_at), q (nome/telefone), category (variables.tipo),
 *        source (member|pipeline), limit (default 300)
 */
export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const sp = new URL(req.url).searchParams
    const dateFrom = sp.get('dateFrom')
    const dateTo = sp.get('dateTo')
    const q = (sp.get('q') ?? '').trim().toLowerCase()
    const category = sp.get('category') ?? ''
    const source = sp.get('source') ?? ''
    const limit = Math.min(Math.max(1, Number(sp.get('limit')) || 300), 1000)

    const origin = sp.get('origin') ?? '' // '' | portal | csv

    // campanhas visíveis
    let campQuery = supabaseAdmin.from('whatsapp_campaigns').select('id, name, origin')
    if (user.profileType !== 'master') campQuery = campQuery.eq('owner_user_id', String(user.id))
    if (origin === 'csv' || origin === 'portal') campQuery = campQuery.eq('origin', origin)
    const { data: campaigns } = await campQuery
    if (!campaigns?.length) return NextResponse.json({ sends: [] })
    const campaignNames = new Map(campaigns.map(c => [c.id, c.name]))
    const campaignOrigins = new Map(campaigns.map(c => [c.id, c.origin ?? 'portal']))

    // destinatários enviados
    let recQuery = supabaseAdmin
      .from('whatsapp_campaign_recipients')
      .select('id, campaign_id, name, phone, variables, instance_id, sent_at, source, status, match_status, matched_stage, matched_member_id, attendance_id')
      .in('campaign_id', campaigns.map(c => c.id))
      .eq('status', 'sent')
      .order('sent_at', { ascending: false })
      .limit(limit)

    if (dateFrom) recQuery = recQuery.gte('sent_at', `${dateFrom}T00:00:00`)
    if (dateTo) recQuery = recQuery.lte('sent_at', `${dateTo}T23:59:59`)
    if (category) recQuery = recQuery.eq('variables->>tipo', category)
    if (source) recQuery = recQuery.eq('source', source)

    const { data: recipients, error } = await recQuery
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    let rows = recipients ?? []
    if (q) {
      const qDigits = q.replace(/\D/g, '')
      rows = rows.filter(r =>
        (r.name ?? '').toLowerCase().includes(q) ||
        (qDigits && String(r.phone).includes(qDigits))
      )
    }
    if (!rows.length) return NextResponse.json({ sends: [] })

    // conversas correspondentes (instância + telefone)
    const phones = Array.from(new Set(rows.map(r => String(r.phone))))
    const { data: convs } = await supabaseAdmin
      .from('whatsapp_conversations')
      .select('id, phone, instance_id, ai_enabled, ai_agent_id, last_message, last_message_at, contact_name')
      .in('phone', phones)

    const convByKey = new Map(
      (convs ?? []).map(c => [`${c.instance_id}:${c.phone}`, c])
    )

    // última mensagem inbound por conversa (para saber se respondeu)
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
      const conv = r.instance_id ? convByKey.get(`${r.instance_id}:${r.phone}`) : undefined
      const lastIn = conv ? lastInbound.get(conv.id) ?? null : null
      const replied = !!(lastIn && r.sent_at && new Date(lastIn) > new Date(r.sent_at))
      const vars = (r.variables ?? {}) as Record<string, string>
      return {
        recipientId: r.id,
        campaignId: r.campaign_id,
        campaignName: campaignNames.get(r.campaign_id) ?? '',
        source: r.source,
        // origem do envio: 'csv' (arquivo importado) ou 'portal' (busca na tela)
        origin: campaignOrigins.get(r.campaign_id) ?? 'portal',
        // situação do número no momento do envio (só preenchido em envios de CSV)
        matchStatus: r.match_status ?? null,
        matchedStage: r.matched_stage ?? null,
        matchedMemberId: r.matched_member_id ?? null,
        // card criado no pipeline por este envio (coluna FAZENDO)
        attendanceId: r.attendance_id ?? null,
        name: r.name ?? conv?.contact_name ?? null,
        phone: String(r.phone),
        category: vars.tipo ?? null,
        church: vars.igreja ?? null,
        sentAt: r.sent_at,
        conversationId: conv?.id ?? null,
        replied,
        lastInboundAt: lastIn,
        lastMessage: conv?.last_message ?? null,
        lastMessageAt: conv?.last_message_at ?? null,
        aiEnabled: conv?.ai_enabled ?? false,
        aiAgentId: conv?.ai_agent_id ?? null,
      }
    })

    return NextResponse.json({ sends })
  })
}

/**
 * DELETE /api/whatsapp/sends — exclui envios permanentemente.
 *
 * Body: { recipientIds: string[] } para excluir selecionados, ou
 *       { clearAll: true, ...mesmos filtros do GET } para excluir tudo que
 *       bate com o filtro atual da tela.
 *
 * Envios cujas campanhas estejam com status "running" são ignorados (não é
 * seguro apagar um destinatário que pode estar sendo processado agora).
 * Campanhas que ficam sem nenhum destinatário após a exclusão são removidas
 * junto, para não deixar registro vazio no banco.
 */
export async function DELETE(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}))
    const { recipientIds, clearAll } = body as { recipientIds?: string[]; clearAll?: boolean }

    // campanhas visíveis ao usuário
    let campQuery = supabaseAdmin.from('whatsapp_campaigns').select('id, status')
    if (user.profileType !== 'master') campQuery = campQuery.eq('owner_user_id', String(user.id))
    const { data: campaigns } = await campQuery
    if (!campaigns?.length) return NextResponse.json({ deleted: 0, skippedRunning: 0 })

    const runningIds = new Set(campaigns.filter(c => c.status === 'running').map(c => c.id))
    const campaignIds = campaigns.map(c => c.id)

    let targetIds: string[] = []
    let affectedCampaignIds: string[] = []

    if (Array.isArray(recipientIds) && recipientIds.length) {
      const { data: rows } = await supabaseAdmin
        .from('whatsapp_campaign_recipients')
        .select('id, campaign_id')
        .in('id', recipientIds)
        .in('campaign_id', campaignIds)
      const eligible = (rows ?? []).filter(r => !runningIds.has(r.campaign_id))
      targetIds = eligible.map(r => r.id)
      affectedCampaignIds = Array.from(new Set(eligible.map(r => r.campaign_id)))
    } else if (clearAll) {
      const sp = new URL(req.url).searchParams
      const dateFrom = sp.get('dateFrom')
      const dateTo = sp.get('dateTo')
      const q = (sp.get('q') ?? '').trim().toLowerCase()
      const category = sp.get('category') ?? ''
      const source = sp.get('source') ?? ''

      const eligibleCampaignIds = campaignIds.filter(id => !runningIds.has(id))
      if (!eligibleCampaignIds.length) return NextResponse.json({ deleted: 0, skippedRunning: runningIds.size })

      let recQuery = supabaseAdmin
        .from('whatsapp_campaign_recipients')
        .select('id, campaign_id, name, phone')
        .in('campaign_id', eligibleCampaignIds)
        .eq('status', 'sent')

      if (dateFrom) recQuery = recQuery.gte('sent_at', `${dateFrom}T00:00:00`)
      if (dateTo) recQuery = recQuery.lte('sent_at', `${dateTo}T23:59:59`)
      if (category) recQuery = recQuery.eq('variables->>tipo', category)
      if (source) recQuery = recQuery.eq('source', source)

      const { data: rows } = await recQuery
      let filtered = rows ?? []
      if (q) {
        const qDigits = q.replace(/\D/g, '')
        filtered = filtered.filter(r =>
          (r.name ?? '').toLowerCase().includes(q) ||
          (qDigits && String(r.phone).includes(qDigits))
        )
      }
      targetIds = filtered.map(r => r.id)
      affectedCampaignIds = Array.from(new Set(filtered.map(r => r.campaign_id)))
    } else {
      return NextResponse.json({ error: 'Informe recipientIds ou clearAll' }, { status: 400 })
    }

    if (!targetIds.length) return NextResponse.json({ deleted: 0, skippedRunning: runningIds.size })

    const { error: delErr } = await supabaseAdmin
      .from('whatsapp_campaign_recipients')
      .delete()
      .in('id', targetIds)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

    // remove campanhas afetadas que ficaram sem nenhum destinatário
    if (affectedCampaignIds.length) {
      const { data: remaining } = await supabaseAdmin
        .from('whatsapp_campaign_recipients')
        .select('campaign_id')
        .in('campaign_id', affectedCampaignIds)
      const stillHasRecipients = new Set((remaining ?? []).map(r => r.campaign_id))
      const emptyCampaignIds = affectedCampaignIds.filter(id => !stillHasRecipients.has(id))
      if (emptyCampaignIds.length) {
        await supabaseAdmin.from('whatsapp_campaigns').delete().in('id', emptyCampaignIds)
      }
    }

    return NextResponse.json({ deleted: targetIds.length, skippedRunning: runningIds.size })
  })
}
