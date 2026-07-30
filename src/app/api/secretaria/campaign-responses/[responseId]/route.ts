import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getMemberFieldSpec, type SecretariaCampaignField } from '@/lib/secretariaCampaignFields'
import {
  applyApprovalToMember,
  campaignPublicUrl,
  diffMemberFields,
  refreshCampaignCounters,
  rejectionMessage,
  type AnswerValue,
} from '@/lib/secretariaCampaignService'
import { canAccessCampaign } from '@/lib/secretariaCampaignScope'
import { quickSendWhatsApp } from '@/lib/whatsappSendService'

/**
 * GET   /api/secretaria/campaign-responses/[responseId]
 *   Abre a resposta para conferência: as perguntas, o que a pessoa respondeu e,
 *   para cada campo mapeado, o "valor atual → valor novo" do cadastro.
 *
 * PATCH /api/secretaria/campaign-responses/[responseId]
 *   { decision: 'approved' | 'rejected', notes?, fields?: string[] }
 *   - aprovar grava no cadastro os campos mapeados (ou só os de `fields`);
 *   - reprovar exige o motivo e devolve por WhatsApp o link para corrigir.
 *
 * Fica fora de /campaigns/[id]/ de propósito: a tela de revisão abre a resposta
 * direto, sem precisar saber a campanha.
 */

async function loadContext(responseId: string) {
  const { data: response } = await supabaseAdmin
    .from('secretaria_campaign_responses')
    .select('*')
    .eq('id', responseId)
    .maybeSingle()
  if (!response) return null

  const { data: campaign } = await supabaseAdmin
    .from('secretaria_campaigns')
    .select('*')
    .eq('id', response.campaign_id)
    .maybeSingle()
  if (!campaign) return null

  const { data: target } = response.target_id
    ? await supabaseAdmin.from('secretaria_campaign_targets').select('*').eq('id', response.target_id).maybeSingle()
    : { data: null }

  return { response, campaign, target }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ responseId: string }> }) {
  const { responseId } = await ctx.params
  return withAuth(req, async (user) => {
    const found = await loadContext(responseId)
    if (!found) return NextResponse.json({ error: 'Resposta não encontrada.' }, { status: 404 })
    const { response, campaign, target } = found

    if (!(await canAccessCampaign(user, campaign))) {
      return NextResponse.json({ error: 'Sem acesso a esta campanha.' }, { status: 403 })
    }

    const schema = (campaign.form_schema ?? []) as SecretariaCampaignField[]
    const answers = (response.answers ?? {}) as Record<string, AnswerValue>

    // cadastro atual, para a comparação lado a lado
    let member: Record<string, unknown> | null = null
    if (response.member_id) {
      const { data } = await supabaseAdmin
        .from('members')
        .select('*')
        .eq('id', response.member_id)
        .is('deleted_at', null)
        .maybeSingle()
      member = data as Record<string, unknown> | null
    }

    const { applied: changes, skipped } = member
      ? diffMemberFields(schema, answers, member)
      : { applied: [], skipped: [] }

    return NextResponse.json({
      response,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        reason: campaign.reason,
        kind: campaign.kind,
        formSchema: schema,
      },
      target: target
        ? { ...target, link: campaignPublicUrl(campaign.share_token, target.token) }
        : null,
      member: member
        ? {
            id: member.id,
            fullName: member.full_name,
            rol: member.rol,
            photoUrl: member.photo_url,
            churchId: member.church_id,
          }
        : null,
      /** [{ field, label, from, to }] — só o que muda de verdade */
      changes,
      /** campos mapeados que não mudariam nada (vazios ou iguais ao cadastro) */
      unchanged: skipped.map(f => ({ field: f, label: getMemberFieldSpec(f)?.label ?? f })),
    })
  })
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ responseId: string }> }) {
  const { responseId } = await ctx.params
  return withAuth(req, async (user) => {
    const found = await loadContext(responseId)
    if (!found) return NextResponse.json({ error: 'Resposta não encontrada.' }, { status: 404 })
    const { response, campaign, target } = found

    if (!(await canAccessCampaign(user, campaign))) {
      return NextResponse.json({ error: 'Sem acesso a esta campanha.' }, { status: 403 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      decision?: string
      notes?: string
      fields?: string[]
    }

    const decision = body.decision === 'approved' ? 'approved' : body.decision === 'rejected' ? 'rejected' : null
    if (!decision) return NextResponse.json({ error: 'Decisão inválida.' }, { status: 400 })

    const notes = String(body.notes ?? '').trim()
    if (decision === 'rejected' && !notes) {
      return NextResponse.json(
        { error: 'Escreva o motivo da reprovação — é ele que a pessoa recebe no WhatsApp.' },
        { status: 400 }
      )
    }
    if (response.status === 'approved') {
      return NextResponse.json(
        { error: 'Esta resposta já foi aprovada e os dados já foram gravados no cadastro.' },
        { status: 409 }
      )
    }

    const now = new Date().toISOString()
    const schema = (campaign.form_schema ?? []) as SecretariaCampaignField[]
    const answers = (response.answers ?? {}) as Record<string, AnswerValue>
    let applied: { field: string; label: string; from: string | null; to: string | null }[] = []

    // ── APROVAR: grava no cadastro ────────────────────────────────────────────
    if (decision === 'approved') {
      if (!response.member_id) {
        return NextResponse.json(
          {
            error:
              'Esta resposta não está ligada a nenhum membro, então não há cadastro para atualizar. ' +
              'Vincule a pessoa à campanha antes de aprovar.',
          },
          { status: 400 }
        )
      }

      const result = await applyApprovalToMember({
        memberId: String(response.member_id),
        campaign: { id: campaign.id, name: campaign.name },
        schema,
        answers,
        onlyFields: body.fields ?? null,
        userId: user.id ? String(user.id) : null,
      })

      // erro aqui é erro de verdade (CPF duplicado, membro apagado): não marca
      // como aprovada, senão o dado ficaria "aprovado" e não gravado
      if (result.error) return NextResponse.json({ error: result.error }, { status: 409 })
      applied = result.applied
    }

    const { error: upErr } = await supabaseAdmin
      .from('secretaria_campaign_responses')
      .update({
        status: decision,
        review_notes: notes || null,
        reviewed_by: user.id ? String(user.id) : null,
        reviewed_at: now,
        applied_fields: applied,
        updated_at: now,
      })
      .eq('id', responseId)

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

    if (target) {
      await supabaseAdmin
        .from('secretaria_campaign_targets')
        .update({ status: decision, updated_at: now })
        .eq('id', target.id)
    }

    // ── REPROVAR: devolve o link para a pessoa corrigir ───────────────────────
    let whatsapp: { ok: boolean; error?: string } | null = null
    if (decision === 'rejected') {
      const phone = String(response.phone ?? target?.phone ?? '').replace(/\D/g, '')
      if (phone) {
        const link = target
          ? campaignPublicUrl(campaign.share_token, target.token)
          : campaignPublicUrl(campaign.share_token)
        const result = await quickSendWhatsApp({
          ownerUserId: String(user.id),
          profileType: user.profileType,
          phone,
          contactName: response.name ?? undefined,
          instanceId: campaign.instance_id ?? undefined,
          message: rejectionMessage(campaign.name, notes, link),
        })
        whatsapp =
          result.status === 'error'
            ? { ok: false, error: result.error ?? 'falha ao enviar' }
            : { ok: true }
      } else {
        whatsapp = { ok: false, error: 'sem telefone cadastrado' }
      }
    }

    await refreshCampaignCounters(campaign.id)

    return NextResponse.json({ ok: true, decision, applied, whatsapp })
  })
}
