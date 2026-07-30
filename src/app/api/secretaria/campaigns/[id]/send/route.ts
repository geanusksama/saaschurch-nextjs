import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAccessibleInstanceIds } from '@/lib/whatsappSendService'
import {
  campaignPublicUrl,
  firstName,
  refreshCampaignCounters,
} from '@/lib/secretariaCampaignService'
import { canAccessCampaign } from '@/lib/secretariaCampaignScope'

/**
 * POST /api/secretaria/campaigns/[id]/send — dispara a campanha por WhatsApp
 * GET  /api/secretaria/campaigns/[id]/send — reconcilia o resultado do disparo
 *
 * O envio NÃO é reimplementado aqui: a rota monta uma campanha de envio em
 * massa (`whatsapp_campaigns`) com um destinatário por pessoa anexada, e quem
 * envia de fato é o orquestrador que já existe —
 * `POST /api/whatsapp/campaigns/[id]/process`, chamado em laço pela tela.
 * É ele que respeita o cooldown de 5 s por instância (risco de ban do número),
 * grava na Caixa de Entrada e distribui entre as instâncias marcadas.
 *
 * Cada pessoa recebe o SEU link: a variável {{link}} do texto vira
 * /campanha/<share_token>/<token da pessoa>, que já abre o formulário
 * identificado, sem pedir ROL nem CPF.
 */

const VARIAVEIS_DOC = ['nome', 'primeiro_nome', 'igreja', 'regional', 'rol', 'cargo', 'link']

async function loadCampaign(id: string) {
  const { data } = await supabaseAdmin.from('secretaria_campaigns').select('*').eq('id', id).maybeSingle()
  return data
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return withAuth(req, async (user) => {
    const campaign = await loadCampaign(id)
    if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada.' }, { status: 404 })
    if (!(await canAccessCampaign(user, campaign))) {
      return NextResponse.json({ error: 'Sem acesso a esta campanha.' }, { status: 403 })
    }
    if (campaign.status === 'draft') {
      return NextResponse.json({ error: 'Publique a campanha antes de enviar.' }, { status: 400 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      targetIds?: string[]
      instanceIds?: string[]
      intervalSeconds?: number
      /** reenviar para quem já recebeu (padrão: só quem está pendente) */
      resend?: boolean
    }

    const messageTemplate = String(campaign.message_template ?? '').trim()
    if (!messageTemplate && !campaign.image_url) {
      return NextResponse.json(
        { error: 'Escreva a mensagem da campanha antes de enviar (use {{link}} para inserir o link).' },
        { status: 400 }
      )
    }

    // ── instâncias ────────────────────────────────────────────────────────────
    const pedidas = (body.instanceIds ?? []).map(String).filter(Boolean)
    const escolhidas = pedidas.length ? pedidas : campaign.instance_id ? [String(campaign.instance_id)] : []
    if (!escolhidas.length) {
      return NextResponse.json({ error: 'Escolha a instância do WhatsApp que fará o envio.' }, { status: 400 })
    }

    const acessiveis = await getAccessibleInstanceIds(String(user.id), user.profileType)
    const permitidas = acessiveis ? escolhidas.filter(i => acessiveis.has(i)) : escolhidas
    const { data: instances } = permitidas.length
      ? await supabaseAdmin.from('whatsapp_instances').select('id, name, status').in('id', permitidas).eq('is_active', true)
      : { data: [] }
    const conectadas = (instances ?? []).filter(i => i.status === 'connected')
    if (!conectadas.length) {
      return NextResponse.json(
        { error: 'Nenhuma das instâncias escolhidas está conectada. Verifique em WhatsApp Instâncias.' },
        { status: 400 }
      )
    }

    // ── quem recebe ───────────────────────────────────────────────────────────
    let query = supabaseAdmin
      .from('secretaria_campaign_targets')
      .select('*')
      .eq('campaign_id', id)
      .not('phone', 'is', null)
      .neq('phone', '')

    const targetIds = (body.targetIds ?? []).map(String).filter(Boolean)
    if (targetIds.length) query = query.in('id', targetIds)
    // sem lista explícita, só quem ainda não recebeu — reenviar é uma escolha
    else if (!body.resend) query = query.eq('status', 'pending')

    const { data: targets, error: tErr } = await query.limit(5000)
    if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 })
    if (!targets?.length) {
      return NextResponse.json({ error: 'Nenhuma pessoa com telefone pendente de envio.' }, { status: 400 })
    }

    // ── campanha de envio em massa ────────────────────────────────────────────
    const now = new Date()
    const { data: dispatch, error: dErr } = await supabaseAdmin
      .from('whatsapp_campaigns')
      .insert({
        church_id: campaign.church_id,
        owner_user_id: String(user.id),
        name: `[Campanha Secretaria] ${campaign.name}`,
        message_template: messageTemplate || '{{link}}',
        status: 'running',
        interval_seconds: Math.max(5, Number(body.intervalSeconds) || 5),
        total_recipients: targets.length,
        agent_user_ids: [],
        image_url: campaign.image_url || null,
        // vídeo entra como link no fim da mensagem — a Z-API não manda vídeo por URL
        link_url: campaign.video_url || campaign.link_url || null,
        started_at: now.toISOString(),
      })
      .select('*')
      .single()

    if (dErr || !dispatch) {
      return NextResponse.json({ error: dErr?.message ?? 'Erro ao preparar o envio.' }, { status: 500 })
    }

    await supabaseAdmin
      .from('whatsapp_campaign_instances')
      .insert(conectadas.map(i => ({ campaign_id: dispatch.id, instance_id: i.id })))

    const recipients = targets.map(t => {
      const link = campaignPublicUrl(campaign.share_token, t.token)
      return {
        id: randomUUID(),
        campaign_id: dispatch.id,
        source: 'member',
        source_id: String(t.member_id ?? t.id),
        name: t.name,
        phone: String(t.phone).replace(/\D/g, ''),
        variables: {
          nome: t.name ?? '',
          primeiro_nome: firstName(t.name),
          telefone: String(t.phone).replace(/\D/g, ''),
          igreja: t.church_name ?? '',
          regional: t.regional_name ?? '',
          rol: t.rol != null ? String(t.rol) : '',
          cargo: t.title_name ?? '',
          campanha: campaign.name,
          link,
        },
        agent_user_id: null,
      }
    })

    for (let i = 0; i < recipients.length; i += 500) {
      const { error } = await supabaseAdmin.from('whatsapp_campaign_recipients').insert(recipients.slice(i, i + 500))
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // liga cada alvo ao seu destinatário para a reconciliação do GET
    for (const r of recipients) {
      const alvo = targets.find(t => campaignPublicUrl(campaign.share_token, t.token) === r.variables.link)
      if (!alvo) continue
      await supabaseAdmin
        .from('secretaria_campaign_targets')
        .update({
          status: 'sending',
          dispatch_campaign_id: dispatch.id,
          dispatch_recipient_id: r.id,
          error: null,
          updated_at: now.toISOString(),
        })
        .eq('id', alvo.id)
    }

    return NextResponse.json({
      dispatchCampaignId: dispatch.id,
      total: recipients.length,
      instances: conectadas.map(i => ({ id: i.id, name: i.name })),
      /** a tela chama /api/whatsapp/campaigns/<id>/process em laço, usando o waitMs da resposta */
      processUrl: `/api/whatsapp/campaigns/${dispatch.id}/process`,
      variaveis: VARIAVEIS_DOC,
    })
  })
}

/** Copia o resultado do envio em massa de volta para os alvos da campanha. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return withAuth(req, async (user) => {
    const campaign = await loadCampaign(id)
    if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada.' }, { status: 404 })
    if (!(await canAccessCampaign(user, campaign))) {
      return NextResponse.json({ error: 'Sem acesso a esta campanha.' }, { status: 403 })
    }

    const { data: emAndamento } = await supabaseAdmin
      .from('secretaria_campaign_targets')
      .select('id, dispatch_recipient_id')
      .eq('campaign_id', id)
      .eq('status', 'sending')
      .not('dispatch_recipient_id', 'is', null)
      .limit(5000)

    if (!emAndamento?.length) {
      await refreshCampaignCounters(id)
      return NextResponse.json({ updated: 0 })
    }

    const { data: recipients } = await supabaseAdmin
      .from('whatsapp_campaign_recipients')
      .select('id, status, error_message')
      .in('id', emAndamento.map(t => t.dispatch_recipient_id))

    const byId = new Map((recipients ?? []).map(r => [r.id, r]))
    const now = new Date().toISOString()
    let updated = 0

    for (const alvo of emAndamento) {
      const r = byId.get(alvo.dispatch_recipient_id)
      if (!r || r.status === 'pending' || r.status === 'sending') continue
      const ok = r.status === 'sent'
      await supabaseAdmin
        .from('secretaria_campaign_targets')
        .update({
          status: ok ? 'sent' : 'failed',
          sent_at: ok ? now : null,
          error: ok ? null : r.error_message ?? 'falha no envio',
          updated_at: now,
        })
        .eq('id', alvo.id)
      updated++
    }

    await refreshCampaignCounters(id)
    return NextResponse.json({ updated, pending: emAndamento.length - updated })
  })
}
