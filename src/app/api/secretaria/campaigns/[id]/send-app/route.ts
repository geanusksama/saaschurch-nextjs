import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { appDosAlvos, campaignPublicUrl, firstName, renderCampaignMessage } from '@/lib/secretariaCampaignService'
import { canAccessCampaign } from '@/lib/secretariaCampaignScope'

/**
 * POST /api/secretaria/campaigns/[id]/send-app — entrega a campanha no App Igreja v3
 *
 * Para cada pessoa anexada que tem conta no app, grava um alerta pessoal
 * (appv3_notificacoes, tipo SEC) com o link individual do formulário. No app
 * o alerta aparece no sino e abre o formulário já identificado. Quem já foi
 * avisado com esse link não recebe de novo. Não mexe no status do alvo: o
 * WhatsApp continua disponível para quem não abre o app.
 *
 * Body: { targetIds?: string[] } — sem lista, todos os anexados com app.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return withAuth(req, async (user) => {
    const { data: campaign } = await supabaseAdmin.from('secretaria_campaigns').select('*').eq('id', id).maybeSingle()
    if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada.' }, { status: 404 })
    if (!(await canAccessCampaign(user, campaign))) {
      return NextResponse.json({ error: 'Sem acesso a esta campanha.' }, { status: 403 })
    }
    if (campaign.status !== 'active') {
      return NextResponse.json({ error: 'Só campanha ativa pode ser enviada.' }, { status: 400 })
    }

    const body = (await req.json().catch(() => ({}))) as { targetIds?: string[] }
    let query = supabaseAdmin
      .from('secretaria_campaign_targets')
      .select('id, member_id, token, name, church_name, regional_name, rol, title_name, status')
      .eq('campaign_id', id)
      .limit(5000)
    const targetIds = (body.targetIds ?? []).map(String).filter(Boolean)
    if (targetIds.length) query = query.in('id', targetIds)
    const { data: targets, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const app = await appDosAlvos(campaign.share_token, targets ?? [])
    // quem já respondeu ou foi conferido não precisa do lembrete
    const alvos = (targets ?? []).filter(t => {
      const a = app.get(t.id)
      return a && !a.avisadoEm && !['responded', 'approved'].includes(t.status)
    })
    if (!alvos.length) {
      return NextResponse.json(
        { error: app.size ? 'Todos com conta no app já foram avisados.' : 'Nenhuma pessoa anexada tem conta no app.' },
        { status: 400 }
      )
    }

    const formulario = campaign.kind === 'form'
    const titulo = (formulario ? `Formulário da secretaria: ${campaign.name}` : `Comunicado: ${campaign.name}`).slice(0, 255)
    const linhas = alvos.map(t => {
      const a = app.get(t.id)!
      const link = campaignPublicUrl(campaign.share_token, t.token)
      const texto = renderCampaignMessage(String(campaign.message_template ?? ''), {
        nome: t.name ?? '',
        primeiro_nome: firstName(t.name),
        igreja: t.church_name ?? '',
        regional: t.regional_name ?? '',
        rol: t.rol != null ? String(t.rol) : '',
        cargo: t.title_name ?? '',
        campanha: campaign.name,
        link: '',
      }).trim()
      return {
        campoId: a.campoId,
        perfilId: a.perfilId,
        tipo: 'SEC',
        titulo,
        corpo: (campaign.reason || texto || (formulario ? 'Toque para responder.' : null))?.slice(0, 1000) ?? null,
        // a página pública mostra o formulário ou o comunicado (texto, imagem, vídeo)
        link,
      }
    })
    await prisma.appV3Notificacao.createMany({ data: linhas })

    return NextResponse.json({ enviados: linhas.length, semApp: (targets ?? []).length - app.size })
  })
}
