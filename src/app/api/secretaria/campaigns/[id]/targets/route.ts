import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  buildTargetRow,
  campaignPublicUrl,
  refreshCampaignCounters,
} from '@/lib/secretariaCampaignService'
import {
  canAccessCampaign,
  resolveAudienceMembers,
  ScopeError,
  type AudienceFilters,
} from '@/lib/secretariaCampaignScope'

/**
 * GET    /api/secretaria/campaigns/[id]/targets — pessoas anexadas
 * POST   /api/secretaria/campaigns/[id]/targets — anexa por filtro e/ou por lista de ids
 * DELETE /api/secretaria/campaigns/[id]/targets?targetIds=a,b — desanexa
 *
 * Anexar é sempre incremental: quem já está na campanha é ignorado, nunca
 * duplicado nem sobrescrito (o UNIQUE (campaign_id, member_id) garante isso
 * mesmo se dois secretários anexarem ao mesmo tempo).
 */

async function loadCampaign(id: string) {
  const { data } = await supabaseAdmin.from('secretaria_campaigns').select('*').eq('id', id).maybeSingle()
  return data
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return withAuth(req, async (user) => {
    const campaign = await loadCampaign(id)
    if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada.' }, { status: 404 })
    if (!(await canAccessCampaign(user, campaign))) {
      return NextResponse.json({ error: 'Sem acesso a esta campanha.' }, { status: 403 })
    }

    const sp = new URL(req.url).searchParams
    const status = sp.get('status')

    let query = supabaseAdmin
      .from('secretaria_campaign_targets')
      .select('*')
      .eq('campaign_id', id)
      .order('name', { ascending: true })
      .limit(5000)

    if (status && status !== 'all') query = query.eq('status', status)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      targets: (data ?? []).map(t => ({ ...t, link: campaignPublicUrl(campaign.share_token, t.token) })),
    })
  })
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return withAuth(req, async (user) => {
    const campaign = await loadCampaign(id)
    if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada.' }, { status: 404 })
    if (!(await canAccessCampaign(user, campaign))) {
      return NextResponse.json({ error: 'Sem acesso a esta campanha.' }, { status: 403 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      filters?: AudienceFilters
      memberIds?: string[]
    }

    const memberIds = (body.memberIds ?? []).map(String).filter(Boolean)
    if (!body.filters && !memberIds.length) {
      return NextResponse.json({ error: 'Escolha ao menos uma pessoa.' }, { status: 400 })
    }

    let candidatos
    try {
      /**
       * Mesmo quando a tela manda a lista pronta de ids, os membros são
       * relidos pelo `resolveAudienceMembers`: é ele que aplica o escopo. Sem
       * isso, bastaria forjar o memberId no corpo para anexar gente de outra
       * regional.
       */
      const { members } = await resolveAudienceMembers(user, body.filters ?? { requirePhone: false })
      candidatos = memberIds.length ? members.filter(m => memberIds.includes(m.memberId)) : members
    } catch (e) {
      if (e instanceof ScopeError) return NextResponse.json({ error: e.message }, { status: e.status })
      throw e
    }

    if (!candidatos.length) {
      return NextResponse.json({ error: 'Nenhuma pessoa encontrada com esses filtros.' }, { status: 400 })
    }

    const { data: jaExistem } = await supabaseAdmin
      .from('secretaria_campaign_targets')
      .select('member_id')
      .eq('campaign_id', id)
    const anexados = new Set((jaExistem ?? []).map(t => t.member_id))

    const novos = candidatos.filter(m => !anexados.has(m.memberId))
    if (!novos.length) {
      return NextResponse.json({ added: 0, skipped: candidatos.length, message: 'Todos já estavam anexados.' })
    }

    const rows = novos.map(m =>
      buildTargetRow(id, {
        memberId: m.memberId,
        name: m.name,
        phone: m.phone,
        rol: m.rol,
        churchId: m.churchId,
        churchName: m.churchName,
        regionalId: m.regionalId,
        regionalName: m.regionalName,
        zone: m.zone,
        titleName: m.titleName,
      })
    )

    // em lotes: o Supabase corta payload muito grande, e regional inteira passa fácil de 2 mil
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabaseAdmin
        .from('secretaria_campaign_targets')
        .upsert(rows.slice(i, i + 500), { onConflict: 'campaign_id,member_id', ignoreDuplicates: true })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await refreshCampaignCounters(id)

    return NextResponse.json({
      added: rows.length,
      skipped: candidatos.length - rows.length,
      semTelefone: novos.filter(m => !m.phone).length,
    })
  })
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return withAuth(req, async (user) => {
    const campaign = await loadCampaign(id)
    if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada.' }, { status: 404 })
    if (!(await canAccessCampaign(user, campaign))) {
      return NextResponse.json({ error: 'Sem acesso a esta campanha.' }, { status: 403 })
    }

    const sp = new URL(req.url).searchParams
    const targetIds = (sp.get('targetIds') ?? '').split(',').map(s => s.trim()).filter(Boolean)
    if (!targetIds.length) return NextResponse.json({ error: 'Nada para remover.' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('secretaria_campaign_targets')
      .delete()
      .eq('campaign_id', id)
      .in('id', targetIds)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await refreshCampaignCounters(id)
    return NextResponse.json({ removed: targetIds.length })
  })
}
