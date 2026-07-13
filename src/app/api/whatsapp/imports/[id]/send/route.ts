import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAccessibleInstanceIds } from '@/lib/whatsappSendService'
import { assignAgentsRoundRobin } from '@/lib/whatsappCampaignService'

/**
 * POST /api/whatsapp/imports/[id]/send — fase 3 do modal.
 *
 * Cria uma campanha (origin = 'csv') a partir das linhas do lote marcadas como
 * "send" e devolve o id. O envio propriamente dito é feito pelo orquestrador
 * existente (POST /api/whatsapp/campaigns/[id]/process), que respeita o
 * cooldown por instância — este endpoint não envia nada sozinho.
 *
 * Body: { messageTemplate, intervalSeconds, instanceIds[], churchId,
 *         attendanceType?, imageUrl?, linkUrl?, agentUserIds?[] }
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await ctx.params
    const body = await req.json().catch(() => ({}))
    const {
      messageTemplate,
      intervalSeconds = 5,
      instanceIds = [],
      churchId,
      attendanceType = 'followup',
      imageUrl,
      linkUrl,
      agentUserIds = [],
    } = body as {
      messageTemplate?: string
      intervalSeconds?: number
      instanceIds?: string[]
      churchId?: string
      attendanceType?: string
      imageUrl?: string
      linkUrl?: string
      agentUserIds?: string[]
    }

    const { data: batch } = await supabaseAdmin
      .from('whatsapp_import_batches')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (!batch) return NextResponse.json({ error: 'Lote não encontrado' }, { status: 404 })
    if (user.profileType !== 'master' && batch.owner_user_id !== String(user.id)) {
      return NextResponse.json({ error: 'Sem acesso a este lote' }, { status: 403 })
    }
    if (batch.campaign_id) {
      return NextResponse.json({ error: 'Este lote já foi enviado' }, { status: 409 })
    }
    if (!messageTemplate?.trim()) {
      return NextResponse.json({ error: 'Mensagem é obrigatória' }, { status: 400 })
    }
    if (!Array.isArray(instanceIds) || !instanceIds.length) {
      return NextResponse.json({ error: 'Selecione ao menos uma instância' }, { status: 400 })
    }

    // igreja onde os cards de acompanhamento serão criados
    const cardChurchId = churchId || user.churchId
    if (!cardChurchId) {
      return NextResponse.json(
        { error: 'Selecione a igreja onde os atendimentos serão criados' },
        { status: 400 }
      )
    }

    // instâncias: precisam ser acessíveis ao usuário, ativas e conectadas
    const accessible = await getAccessibleInstanceIds(String(user.id), user.profileType)
    const allowedIds = accessible ? instanceIds.filter(i => accessible.has(i)) : instanceIds
    const { data: instances } = allowedIds.length
      ? await supabaseAdmin
          .from('whatsapp_instances')
          .select('id, name, status')
          .in('id', allowedIds)
          .eq('is_active', true)
      : { data: [] }
    const connected = (instances ?? []).filter(i => i.status === 'connected')
    if (!connected.length) {
      return NextResponse.json(
        { error: 'Nenhuma das instâncias selecionadas está conectada' },
        { status: 400 }
      )
    }

    const { data: rows } = await supabaseAdmin
      .from('whatsapp_import_rows')
      .select('*')
      .eq('batch_id', id)
      .eq('decision', 'send')
      .order('row_number', { ascending: true })

    const sendable = (rows ?? []).filter(r => r.phone)
    if (!sendable.length) {
      return NextResponse.json({ error: 'Nenhuma linha elegível para envio neste lote' }, { status: 400 })
    }

    const now = new Date()
    const { data: campaign, error: campErr } = await supabaseAdmin
      .from('whatsapp_campaigns')
      .insert({
        church_id: user.churchId ?? null,
        owner_user_id: String(user.id),
        name: batch.filename
          ? `Importação · ${batch.filename}`
          : `Importação ${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
        message_template: messageTemplate,
        status: 'running',
        interval_seconds: Math.max(5, Number(intervalSeconds) || 5),
        total_recipients: sendable.length,
        agent_user_ids: agentUserIds,
        image_url: imageUrl?.trim() || null,
        link_url: linkUrl?.trim() || null,
        started_at: now.toISOString(),
        origin: 'csv',
        import_batch_id: batch.id,
        create_pipeline_cards: true,
        attendance_type: attendanceType,
        pipeline_church_id: cardChurchId,
      })
      .select('*')
      .single()

    if (campErr || !campaign) {
      return NextResponse.json({ error: campErr?.message ?? 'Erro ao criar campanha' }, { status: 500 })
    }

    await supabaseAdmin
      .from('whatsapp_campaign_instances')
      .insert(connected.map(i => ({ campaign_id: campaign.id, instance_id: i.id })))

    const recipientRows = assignAgentsRoundRobin(
      sendable.map(r => ({
        campaign_id: campaign.id,
        source: 'import',
        source_id: String(r.id),
        name: r.name,
        phone: String(r.phone).replace(/\D/g, ''),
        variables: r.variables ?? {},
        match_status: r.match_status,
        matched_member_id: r.matched_member_id,
        matched_attendance_id: r.matched_attendance_id,
        matched_stage: r.matched_stage,
        import_row_id: r.id,
        agent_user_id: null as string | null,
      })),
      (agentUserIds ?? []).map(String)
    )

    const created: Array<{ id: string; import_row_id: string }> = []
    for (let i = 0; i < recipientRows.length; i += 500) {
      const { data: inserted, error } = await supabaseAdmin
        .from('whatsapp_campaign_recipients')
        .insert(recipientRows.slice(i, i + 500))
        .select('id, import_row_id')
      if (error) {
        await supabaseAdmin.from('whatsapp_campaigns').delete().eq('id', campaign.id)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      created.push(...((inserted ?? []) as Array<{ id: string; import_row_id: string }>))
    }

    // liga cada linha do arquivo ao destinatário (fecha o de-para)
    for (const rec of created) {
      await supabaseAdmin
        .from('whatsapp_import_rows')
        .update({ recipient_id: rec.id })
        .eq('id', rec.import_row_id)
    }

    await supabaseAdmin
      .from('whatsapp_import_batches')
      .update({ campaign_id: campaign.id, status: 'sending' })
      .eq('id', batch.id)

    return NextResponse.json({ campaign }, { status: 201 })
  })
}
