import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { campaignPublicUrl } from '@/lib/secretariaCampaignService'
import { canAccessCampaign } from '@/lib/secretariaCampaignScope'

/**
 * GET /api/secretaria/campaigns/[id]/responses — o que as pessoas enviaram.
 *
 * Devolve a lista já cruzada com o alvo (para mostrar igreja/ROL de quem
 * respondeu) e com o link individual, que é o que a secretaria manda de volta
 * quando reprova.
 */

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return withAuth(req, async (user) => {
    const { data: campaign } = await supabaseAdmin
      .from('secretaria_campaigns')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada.' }, { status: 404 })
    if (!(await canAccessCampaign(user, campaign))) {
      return NextResponse.json({ error: 'Sem acesso a esta campanha.' }, { status: 403 })
    }

    const sp = new URL(req.url).searchParams
    const status = sp.get('status')
    const q = (sp.get('q') ?? '').trim()

    let query = supabaseAdmin
      .from('secretaria_campaign_responses')
      .select('*')
      .eq('campaign_id', id)
      .order('submitted_at', { ascending: false })
      .limit(2000)

    if (status && status !== 'all') query = query.eq('status', status)
    if (q) query = query.ilike('name', `%${q}%`)

    const { data: responses, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const targetIds = Array.from(new Set((responses ?? []).map(r => r.target_id).filter(Boolean)))
    const { data: targets } = targetIds.length
      ? await supabaseAdmin
          .from('secretaria_campaign_targets')
          .select('id, token, rol, church_name, regional_name, title_name, status')
          .in('id', targetIds)
      : { data: [] }
    const targetById = new Map((targets ?? []).map(t => [t.id, t]))

    return NextResponse.json({
      campaign: { id: campaign.id, name: campaign.name, kind: campaign.kind, formSchema: campaign.form_schema },
      responses: (responses ?? []).map(r => {
        const t = r.target_id ? targetById.get(r.target_id) : null
        return {
          ...r,
          rol: t?.rol ?? null,
          churchName: t?.church_name ?? null,
          regionalName: t?.regional_name ?? null,
          titleName: t?.title_name ?? null,
          link: t?.token ? campaignPublicUrl(campaign.share_token, t.token) : campaignPublicUrl(campaign.share_token),
        }
      }),
    })
  })
}
