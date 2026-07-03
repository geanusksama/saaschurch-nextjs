import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { processCampaignTick } from '@/lib/whatsappCampaignService'

// POST /api/whatsapp/campaigns/[id]/process — tick de envio.
// Envia NO MÁXIMO 1 mensagem, pela instância livre há mais tempo (cooldown 5 s).
// O cliente orquestra: chama de novo após `waitMs`.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await ctx.params

    let query = supabaseAdmin.from('whatsapp_campaigns').select('id').eq('id', id)
    if (user.profileType !== 'master') query = query.eq('owner_user_id', String(user.id))
    const { data: campaign } = await query.single()
    if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })

    const result = await processCampaignTick(id)
    return NextResponse.json(result)
  })
}
