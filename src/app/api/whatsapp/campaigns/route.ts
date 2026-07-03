import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { assignAgentsRoundRobin, type CampaignRecipientInput } from '@/lib/whatsappCampaignService'

// GET /api/whatsapp/campaigns — lista campanhas do usuário (master vê todas)
export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    let query = supabaseAdmin
      .from('whatsapp_campaigns')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    if (user.profileType !== 'master') {
      query = query.eq('owner_user_id', String(user.id))
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ campaigns: data ?? [] })
  })
}

// POST /api/whatsapp/campaigns — cria campanha + destinatários
// Body: { name?, messageTemplate, intervalSeconds?, instanceIds[], agentUserIds?[], recipients[], autoStart? }
export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}))
    const {
      name,
      messageTemplate,
      intervalSeconds = 5,
      instanceIds = [],
      agentUserIds = [],
      recipients = [],
      autoStart = true,
      imageUrl,
      linkUrl,
    } = body as {
      name?: string
      messageTemplate?: string
      intervalSeconds?: number
      instanceIds?: string[]
      agentUserIds?: string[]
      recipients?: CampaignRecipientInput[]
      autoStart?: boolean
      imageUrl?: string
      linkUrl?: string
    }

    if (!messageTemplate?.trim()) {
      return NextResponse.json({ error: 'Mensagem é obrigatória' }, { status: 400 })
    }
    if (!Array.isArray(instanceIds) || !instanceIds.length) {
      return NextResponse.json({ error: 'Selecione ao menos uma instância' }, { status: 400 })
    }
    const validRecipients = (recipients ?? []).filter(r => r?.phone?.replace(/\D/g, ''))
    if (!validRecipients.length) {
      return NextResponse.json({ error: 'Selecione ao menos um destinatário com telefone' }, { status: 400 })
    }

    // valida instâncias: precisam existir, estar ativas e pertencer ao usuário (master: qualquer)
    let instQuery = supabaseAdmin
      .from('whatsapp_instances')
      .select('id, name, status')
      .in('id', instanceIds)
      .eq('is_active', true)
    if (user.profileType !== 'master') {
      instQuery = instQuery.eq('owner_user_id', String(user.id))
    }
    const { data: instances } = await instQuery
    const connected = (instances ?? []).filter(i => i.status === 'connected')
    if (!connected.length) {
      return NextResponse.json(
        { error: 'Nenhuma das instâncias selecionadas está conectada' },
        { status: 400 }
      )
    }

    const now = new Date()
    const { data: campaign, error: campErr } = await supabaseAdmin
      .from('whatsapp_campaigns')
      .insert({
        church_id: user.churchId ?? null,
        owner_user_id: String(user.id),
        name: name?.trim() || `Campanha ${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
        message_template: messageTemplate,
        status: autoStart ? 'running' : 'draft',
        // 5 s é o mínimo por instância (risco de ban) — configurável para mais
        interval_seconds: Math.max(5, Number(intervalSeconds) || 5),
        total_recipients: validRecipients.length,
        agent_user_ids: agentUserIds,
        image_url: imageUrl?.trim() || null,
        link_url: linkUrl?.trim() || null,
        started_at: autoStart ? now.toISOString() : null,
      })
      .select('*')
      .single()

    if (campErr || !campaign) {
      return NextResponse.json({ error: campErr?.message ?? 'Erro ao criar campanha' }, { status: 500 })
    }

    await supabaseAdmin.from('whatsapp_campaign_instances').insert(
      connected.map(i => ({ campaign_id: campaign.id, instance_id: i.id }))
    )

    // agentes distribuídos round-robin já na criação
    const rows = assignAgentsRoundRobin(
      validRecipients.map(r => ({
        campaign_id: campaign.id,
        source: r.source === 'pipeline' ? 'pipeline' : 'member',
        source_id: String(r.sourceId),
        name: r.name ?? null,
        phone: r.phone.replace(/\D/g, ''),
        variables: r.variables ?? {},
        agent_user_id: null as string | null,
      })),
      (agentUserIds ?? []).map(String)
    )

    // insere em lotes para não estourar payload
    for (let i = 0; i < rows.length; i += 500) {
      const { error: recErr } = await supabaseAdmin
        .from('whatsapp_campaign_recipients')
        .insert(rows.slice(i, i + 500))
      if (recErr) {
        await supabaseAdmin.from('whatsapp_campaigns').delete().eq('id', campaign.id)
        return NextResponse.json({ error: recErr.message }, { status: 500 })
      }
    }

    return NextResponse.json({ campaign }, { status: 201 })
  })
}
