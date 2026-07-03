import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCampaignProgress } from '@/lib/whatsappCampaignService'

async function loadCampaign(id: string, user: { id: string | null; profileType: string }) {
  let query = supabaseAdmin.from('whatsapp_campaigns').select('*').eq('id', id)
  if (user.profileType !== 'master') query = query.eq('owner_user_id', String(user.id))
  const { data } = await query.single()
  return data
}

// GET /api/whatsapp/campaigns/[id] — detalhe + progresso + destinatários
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await ctx.params
    const campaign = await loadCampaign(id, user)
    if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })

    const [progress, recipientsRes] = await Promise.all([
      getCampaignProgress(id),
      supabaseAdmin
        .from('whatsapp_campaign_recipients')
        .select('id, name, phone, status, error_message, sent_at, agent_user_id, source')
        .eq('campaign_id', id)
        .order('created_at', { ascending: true })
        .limit(2000),
    ])

    return NextResponse.json({ campaign, progress, recipients: recipientsRes.data ?? [] })
  })
}

// PATCH /api/whatsapp/campaigns/[id] — { action: 'pause' | 'resume' | 'cancel' }
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await ctx.params
    const campaign = await loadCampaign(id, user)
    if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })

    const { action } = await req.json().catch(() => ({}))

    if (action === 'pause') {
      if (campaign.status !== 'running') {
        return NextResponse.json({ error: 'Campanha não está em execução' }, { status: 400 })
      }
      await supabaseAdmin.from('whatsapp_campaigns').update({ status: 'paused' }).eq('id', id)
    } else if (action === 'resume') {
      if (campaign.status !== 'paused' && campaign.status !== 'draft') {
        return NextResponse.json({ error: 'Campanha não pode ser retomada' }, { status: 400 })
      }
      await supabaseAdmin
        .from('whatsapp_campaigns')
        .update({ status: 'running', started_at: campaign.started_at ?? new Date().toISOString() })
        .eq('id', id)
    } else if (action === 'cancel') {
      await supabaseAdmin.from('whatsapp_campaigns')
        .update({ status: 'cancelled', finished_at: new Date().toISOString() })
        .eq('id', id)
      await supabaseAdmin
        .from('whatsapp_campaign_recipients')
        .update({ status: 'cancelled' })
        .eq('campaign_id', id)
        .in('status', ['pending', 'sending'])
    } else {
      return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
    }

    const progress = await getCampaignProgress(id)
    return NextResponse.json({ ok: true, progress })
  })
}

// DELETE /api/whatsapp/campaigns/[id] — apenas rascunhos/finalizadas
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await ctx.params
    const campaign = await loadCampaign(id, user)
    if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })
    if (campaign.status === 'running') {
      return NextResponse.json({ error: 'Cancele a campanha antes de excluir' }, { status: 400 })
    }
    await supabaseAdmin.from('whatsapp_campaigns').delete().eq('id', id)
    return NextResponse.json({ ok: true })
  })
}
