import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { SecretariaCampaignField } from '@/lib/secretariaCampaignFields'
import {
  campaignClosedReason,
  generateToken,
  isValidCpf,
  refreshCampaignCounters,
  validateAnswers,
  type AnswerValue,
} from '@/lib/secretariaCampaignService'

/**
 * Formulário público de campanha — rota SEM autenticação.
 *
 * `token` é o token da campanha (`share_token`). O `t` da query é o token da
 * pessoa, quando ela chegou pelo link individual do WhatsApp: nesse caso o
 * formulário já sabe quem é e não pede identificação.
 *
 * O que esta rota NUNCA faz:
 *  - devolver dados de cadastro de quem não é o portador do token individual;
 *  - aceitar campo que não está no `form_schema` publicado;
 *  - deixar a pessoa mudar o status da própria resposta.
 *
 * GET  → formulário + rascunho anterior (para corrigir uma reprovação)
 * POST → grava a resposta e devolve para avaliação
 */

async function loadCampaign(shareToken: string) {
  const { data } = await supabaseAdmin
    .from('secretaria_campaigns')
    .select('*')
    .eq('share_token', shareToken)
    .maybeSingle()
  return data
}

async function loadTarget(campaignId: string, targetToken: string | null) {
  if (!targetToken) return null
  const { data } = await supabaseAdmin
    .from('secretaria_campaign_targets')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('token', targetToken)
    .maybeSingle()
  return data
}

/** Última resposta da pessoa nesta campanha (é ela que a correção reabre). */
async function loadLastResponse(campaignId: string, targetId: string | null, memberId: string | null) {
  if (!targetId && !memberId) return null
  let query = supabaseAdmin
    .from('secretaria_campaign_responses')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('submitted_at', { ascending: false })
    .limit(1)

  query = targetId ? query.eq('target_id', targetId) : query.eq('member_id', memberId as string)
  const { data } = await query.maybeSingle()
  return data
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const targetToken = new URL(req.url).searchParams.get('t')

  const campaign = await loadCampaign(token)
  if (!campaign) {
    return NextResponse.json({ error: 'Campanha não encontrada ou link expirado.' }, { status: 404 })
  }

  const target = await loadTarget(campaign.id, targetToken)
  const last = target ? await loadLastResponse(campaign.id, target.id, null) : null

  const bloqueio = campaignClosedReason(campaign)

  return NextResponse.json({
    campaign: {
      name: campaign.name,
      description: campaign.description,
      kind: campaign.kind,
      formSchema: campaign.kind === 'form' ? ((campaign.form_schema ?? []) as SecretariaCampaignField[]) : [],
      messageTemplate: campaign.kind === 'broadcast' ? campaign.message_template : null,
      imageUrl: campaign.image_url,
      videoUrl: campaign.video_url,
      linkUrl: campaign.link_url,
      requireIdentification: campaign.require_identification,
      closesAt: campaign.closes_at,
    },
    /** null quando a pessoa chegou pelo link avulso e precisa se identificar */
    person: target ? { name: target.name, rol: target.rol, churchName: target.church_name } : null,
    /** rascunho: preenchimento anterior, para a pessoa corrigir sem digitar tudo de novo */
    previous: last
      ? {
          status: last.status,
          answers: last.answers,
          files: last.files,
          reviewNotes: last.status === 'rejected' ? last.review_notes : null,
          submittedAt: last.submitted_at,
        }
      : null,
    /** já aprovado não reabre: o dado foi para o cadastro */
    locked: last?.status === 'approved',
    closedReason: bloqueio,
  })
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params

  const campaign = await loadCampaign(token)
  if (!campaign) {
    return NextResponse.json({ error: 'Campanha não encontrada ou link expirado.' }, { status: 404 })
  }

  const bloqueio = campaignClosedReason(campaign)
  if (bloqueio) return NextResponse.json({ error: bloqueio }, { status: 409 })

  const body = (await req.json().catch(() => ({}))) as {
    targetToken?: string
    identifier?: { rol?: string; cpf?: string }
    name?: string
    phone?: string
    answers?: Record<string, AnswerValue>
    files?: unknown
  }

  let target = await loadTarget(campaign.id, body.targetToken ?? null)
  let memberId: string | null = target?.member_id ?? null
  let nome = target?.name ?? String(body.name ?? '').trim()
  let telefone = String(target?.phone ?? body.phone ?? '').replace(/\D/g, '')

  // ── link avulso: a pessoa se identifica por ROL + CPF ─────────────────────
  if (!target && campaign.require_identification) {
    const rol = String(body.identifier?.rol ?? '').replace(/\D/g, '')
    const cpf = String(body.identifier?.cpf ?? '').replace(/\D/g, '')

    if (!rol || !cpf) {
      return NextResponse.json({ error: 'Informe seu número de ROL e seu CPF.' }, { status: 400 })
    }
    if (!isValidCpf(cpf)) {
      return NextResponse.json({ error: 'CPF inválido. Confira os números.' }, { status: 400 })
    }

    /**
     * ROL **e** CPF precisam bater no mesmo cadastro. Só o ROL seria um número
     * sequencial adivinhável; o par é o que impede alguém de abrir a ficha de
     * outra pessoa. A mensagem de erro é genérica de propósito, para o link não
     * virar um verificador de "este CPF é membro?".
     */
    const { data: member } = await supabaseAdmin
      .from('members')
      .select('id, full_name, phone, mobile, church_id, rol')
      .eq('rol', Number(rol))
      .eq('cpf', cpf)
      .is('deleted_at', null)
      .maybeSingle()

    if (!member) {
      return NextResponse.json(
        { error: 'Não encontramos esse ROL com esse CPF. Confira os dados ou procure a secretaria.' },
        { status: 404 }
      )
    }

    memberId = member.id
    nome = member.full_name
    telefone = String(member.mobile || member.phone || '').replace(/\D/g, '')

    // quem chega pelo link avulso vira alvo da campanha, para aparecer na lista
    const { data: existente } = await supabaseAdmin
      .from('secretaria_campaign_targets')
      .select('*')
      .eq('campaign_id', campaign.id)
      .eq('member_id', member.id)
      .maybeSingle()

    if (existente) {
      target = existente
    } else {
      const { data: novo } = await supabaseAdmin
        .from('secretaria_campaign_targets')
        .insert({
          campaign_id: campaign.id,
          member_id: member.id,
          name: member.full_name,
          phone: telefone || null,
          rol: member.rol,
          church_id: member.church_id,
          status: 'pending',
          token: generateToken(),
        })
        .select('*')
        .single()
      target = novo
    }
  }

  if (!nome) {
    return NextResponse.json({ error: 'Informe seu nome.' }, { status: 400 })
  }

  // resposta aprovada não é reaberta — o dado já está no cadastro
  const anterior = await loadLastResponse(campaign.id, target?.id ?? null, memberId)
  if (anterior?.status === 'approved') {
    return NextResponse.json(
      { error: 'Seu envio já foi aprovado. Se precisar corrigir algo, procure a secretaria.' },
      { status: 409 }
    )
  }

  const schema = (campaign.form_schema ?? []) as SecretariaCampaignField[]
  const check = validateAnswers(schema, body.answers, body.files)
  if (!check.ok) {
    return NextResponse.json({ error: check.errors.join(' ') }, { status: 400 })
  }

  const now = new Date().toISOString()
  const payload = {
    campaign_id: campaign.id,
    target_id: target?.id ?? null,
    member_id: memberId,
    name: nome,
    phone: telefone || null,
    answers: check.answers,
    files: check.files,
    status: 'pending',
    // reenvio depois de reprovado limpa a decisão anterior
    review_notes: null,
    reviewed_by: null,
    reviewed_at: null,
    applied_fields: [],
    submitted_at: now,
    updated_at: now,
  }

  const { data: saved, error } = anterior
    ? await supabaseAdmin.from('secretaria_campaign_responses').update(payload).eq('id', anterior.id).select('id').single()
    : await supabaseAdmin.from('secretaria_campaign_responses').insert(payload).select('id').single()

  if (error) {
    console.error('[POST /api/public/campanha/[token]]', error)
    return NextResponse.json({ error: 'Não conseguimos salvar seu envio. Tente de novo.' }, { status: 500 })
  }

  if (target) {
    await supabaseAdmin
      .from('secretaria_campaign_targets')
      .update({ status: 'responded', updated_at: now })
      .eq('id', target.id)
  }

  await refreshCampaignCounters(campaign.id)

  return NextResponse.json({ ok: true, responseId: saved.id, name: nome })
}
