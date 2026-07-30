import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { validateFormSchema } from '@/lib/secretariaCampaignFields'
import { campaignPublicUrl } from '@/lib/secretariaCampaignService'
import { canAccessCampaign } from '@/lib/secretariaCampaignScope'

/**
 * GET    /api/secretaria/campaigns/[id] — detalhe + resumo dos números
 * PATCH  /api/secretaria/campaigns/[id] — edita a campanha
 * DELETE /api/secretaria/campaigns/[id] — apaga (alvos e respostas vão junto)
 */

async function load(id: string) {
  const { data } = await supabaseAdmin.from('secretaria_campaigns').select('*').eq('id', id).maybeSingle()
  return data
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return withAuth(req, async (user) => {
    const campaign = await load(id)
    if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada.' }, { status: 404 })
    if (!(await canAccessCampaign(user, campaign))) {
      return NextResponse.json({ error: 'Sem acesso a esta campanha.' }, { status: 403 })
    }

    const [pendentes, aprovadas, reprovadas, enviados] = await Promise.all([
      supabaseAdmin.from('secretaria_campaign_responses').select('id', { count: 'exact', head: true }).eq('campaign_id', id).eq('status', 'pending'),
      supabaseAdmin.from('secretaria_campaign_responses').select('id', { count: 'exact', head: true }).eq('campaign_id', id).eq('status', 'approved'),
      supabaseAdmin.from('secretaria_campaign_responses').select('id', { count: 'exact', head: true }).eq('campaign_id', id).eq('status', 'rejected'),
      supabaseAdmin.from('secretaria_campaign_targets').select('id', { count: 'exact', head: true }).eq('campaign_id', id).not('sent_at', 'is', null),
    ])

    return NextResponse.json({
      campaign: { ...campaign, shareUrl: campaignPublicUrl(campaign.share_token) },
      stats: {
        pending: pendentes.count ?? 0,
        approved: aprovadas.count ?? 0,
        rejected: reprovadas.count ?? 0,
        sent: enviados.count ?? 0,
      },
    })
  })
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return withAuth(req, async (user) => {
    const campaign = await load(id)
    if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada.' }, { status: 404 })
    if (!(await canAccessCampaign(user, campaign))) {
      return NextResponse.json({ error: 'Sem acesso a esta campanha.' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if ('name' in body) {
      const nome = String(body.name ?? '').trim()
      if (!nome) return NextResponse.json({ error: 'O nome não pode ficar vazio.' }, { status: 400 })
      patch.name = nome
    }
    if ('reason' in body) patch.reason = String(body.reason ?? '').trim() || null
    if ('description' in body) patch.description = String(body.description ?? '').trim() || null
    if ('messageTemplate' in body) patch.message_template = String(body.messageTemplate ?? '').trim() || null
    if ('imageUrl' in body) patch.image_url = String(body.imageUrl ?? '').trim() || null
    if ('videoUrl' in body) patch.video_url = String(body.videoUrl ?? '').trim() || null
    if ('linkUrl' in body) patch.link_url = String(body.linkUrl ?? '').trim() || null
    if ('instanceId' in body) patch.instance_id = body.instanceId ? String(body.instanceId) : null
    if ('requireIdentification' in body) patch.require_identification = !!body.requireIdentification
    if ('opensAt' in body) patch.opens_at = body.opensAt ? new Date(String(body.opensAt)).toISOString() : null
    if ('closesAt' in body) patch.closes_at = body.closesAt ? new Date(String(body.closesAt)).toISOString() : null

    if ('status' in body) {
      const s = String(body.status)
      if (!['draft', 'active', 'closed'].includes(s)) {
        return NextResponse.json({ error: 'Situação inválida.' }, { status: 400 })
      }
      patch.status = s
    }

    if ('formSchema' in body) {
      /**
       * Mudar as perguntas depois que alguém já respondeu bagunça a leitura das
       * respostas antigas (o id da pergunta some e o valor vira órfão). Bloqueio
       * a edição do formulário a partir da primeira resposta — para mudar, a
       * secretaria duplica a campanha.
       */
      const { count } = await supabaseAdmin
        .from('secretaria_campaign_responses')
        .select('id', { count: 'exact', head: true })
        .eq('campaign_id', id)
      if ((count ?? 0) > 0) {
        return NextResponse.json(
          { error: 'Esta campanha já tem respostas — as perguntas não podem mais ser alteradas. Crie uma nova campanha.' },
          { status: 409 }
        )
      }
      const parsed = validateFormSchema(body.formSchema)
      if (!parsed.ok) return NextResponse.json({ error: parsed.errors.join(' ') }, { status: 400 })
      if (campaign.kind === 'form' && !parsed.fields.length) {
        return NextResponse.json({ error: 'O formulário precisa de pelo menos uma pergunta.' }, { status: 400 })
      }
      patch.form_schema = parsed.fields
    }

    const { data, error } = await supabaseAdmin
      .from('secretaria_campaigns')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ campaign: { ...data, shareUrl: campaignPublicUrl(data.share_token) } })
  })
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return withAuth(req, async (user) => {
    const campaign = await load(id)
    if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada.' }, { status: 404 })

    // apagar é só do dono ou do master: perde as respostas junto
    if (user.profileType !== 'master' && String(user.id) !== campaign.owner_user_id) {
      return NextResponse.json({ error: 'Só quem criou a campanha (ou o master) pode excluí-la.' }, { status: 403 })
    }

    const { error } = await supabaseAdmin.from('secretaria_campaigns').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  })
}
