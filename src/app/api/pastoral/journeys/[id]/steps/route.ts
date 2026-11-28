import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { computeScheduledAt } from '@/lib/pastoralJourneyService'
import { JOURNEY_PROFILES } from '@/lib/pastoralJourneyDefault'
import { exigirPermissao } from '@/lib/permissoes/servidor'
import { campoEIgreja } from '@/lib/meta/depsJornada'
import { buscar as buscarModelo } from '@/lib/meta/modelosRepo'
import { modeloServeParaJornada } from '@/lib/meta/jornadaOficial'
import type { AuthUser } from '@/lib/auth'

/**
 * Modelo aprovado de uma etapa (número oficial). undefined = campo não veio (não mexe);
 * null = limpa; string = valida (mesmo campo da jornada e do usuário, aprovado, sem variável livre).
 */
async function lerModeloDaEtapa(
  body: Record<string, unknown>, journeyId: string, user: AuthUser,
): Promise<{ valor?: string | null } | NextResponse> {
  if (body.metaModeloId === undefined) return {}
  if (body.metaModeloId === null || body.metaModeloId === '') return { valor: null }
  const negado = await exigirPermissao(user, 'whatsapp_oficial.campanha.enviar')
  if (negado) return negado
  const { data: j } = await supabaseAdmin.from('pastoral_journeys').select('church_id').eq('id', journeyId).maybeSingle()
  const { campoId } = j ? await campoEIgreja(j.church_id) : { campoId: null }
  if (!campoId || !user.campoId || campoId !== user.campoId) return NextResponse.json({ error: 'Modelo não encontrado' }, { status: 404 })
  const modelo = await buscarModelo(campoId, String(body.metaModeloId))
  if (!modelo) return NextResponse.json({ error: 'Modelo não encontrado' }, { status: 404 })
  if (modelo.status !== 'APPROVED') return NextResponse.json({ error: 'Este modelo ainda não foi aprovado pela Meta.' }, { status: 400 })
  if (!modeloServeParaJornada(modelo.variaveis)) {
    return NextResponse.json({ error: 'Este modelo tem variável de texto livre e não serve para o cronograma. Escolha um modelo só com nome, igreja ou data.' }, { status: 400 })
  }
  return { valor: modelo.id }
}

/**
 * Etapas da matriz.
 *
 * POST   — cria uma etapa (já com as 3 mensagens em branco, uma por perfil)
 * PATCH  — edita etapa e/ou mensagens. O que já foi enviado nunca muda; os
 *          envios ainda PENDENTES são reescritos e reagendados, senão a
 *          correção de um texto só valeria para quem entrasse depois.
 * DELETE — remove a etapa (?stepId=...). Envios pendentes dela somem junto.
 */

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id: journeyId } = await ctx.params
    const body = await req.json().catch(() => ({}))
    const modelo = await lerModeloDaEtapa(body, journeyId, user)
    if (modelo instanceof NextResponse) return modelo

    const { count } = await supabaseAdmin
      .from('pastoral_journey_steps')
      .select('id', { count: 'exact', head: true })
      .eq('journey_id', journeyId)

    const { data: step, error } = await supabaseAdmin
      .from('pastoral_journey_steps')
      .insert({
        journey_id: journeyId,
        position: body.position ?? count ?? 0,
        code: body.code ?? null,
        moment_label: body.momentLabel || 'Nova etapa',
        channel: body.channel || 'WhatsApp',
        program_label: body.programLabel ?? null,
        week_number: Math.max(1, Number(body.weekNumber) || 1),
        weekday: body.weekday === null || body.weekday === undefined || body.weekday === '' ? null : Number(body.weekday),
        min_offset_days: Math.max(0, Number(body.minOffsetDays) || 0),
        send_time: body.sendTime || '09:00',
        is_active: body.isActive !== false,
        ...(modelo.valor !== undefined ? { meta_modelo_id: modelo.valor } : {}),
      })
      .select('*')
      .single()

    if (error || !step) {
      return NextResponse.json({ error: error?.message ?? 'Falha ao criar etapa' }, { status: 500 })
    }

    await supabaseAdmin.from('pastoral_journey_messages').insert(
      JOURNEY_PROFILES.map(profile => ({
        step_id: step.id,
        profile,
        message: (body.messages ?? {})[profile] ?? '',
        is_active: true,
      }))
    )

    return NextResponse.json({ step })
  })
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id: journeyId } = await ctx.params
    const body = await req.json().catch(() => ({}))
    const stepId = body.stepId
    if (!stepId) return NextResponse.json({ error: 'stepId obrigatório' }, { status: 400 })
    const modelo = await lerModeloDaEtapa(body, journeyId, user)
    if (modelo instanceof NextResponse) return modelo

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.position !== undefined) patch.position = Number(body.position)
    if (body.code !== undefined) patch.code = body.code
    if (body.momentLabel !== undefined) patch.moment_label = body.momentLabel
    if (body.channel !== undefined) patch.channel = body.channel
    if (body.programLabel !== undefined) patch.program_label = body.programLabel
    if (body.weekNumber !== undefined) patch.week_number = Math.max(1, Number(body.weekNumber) || 1)
    if (body.weekday !== undefined) {
      patch.weekday = body.weekday === null || body.weekday === '' ? null : Number(body.weekday)
    }
    if (body.minOffsetDays !== undefined) patch.min_offset_days = Math.max(0, Number(body.minOffsetDays) || 0)
    if (body.sendTime !== undefined) patch.send_time = body.sendTime
    if (body.isActive !== undefined) patch.is_active = !!body.isActive
    if (modelo.valor !== undefined) patch.meta_modelo_id = modelo.valor

    const { data: step, error } = await supabaseAdmin
      .from('pastoral_journey_steps')
      .update(patch)
      .eq('id', stepId)
      .eq('journey_id', journeyId)
      .select('*')
      .single()

    if (error || !step) {
      return NextResponse.json({ error: error?.message ?? 'Etapa não encontrada' }, { status: 404 })
    }

    // mensagens por perfil
    if (body.messages && typeof body.messages === 'object') {
      for (const profile of JOURNEY_PROFILES) {
        const value = body.messages[profile]
        if (value === undefined) continue
        const payload =
          typeof value === 'string'
            ? { message: value }
            : {
                message: value.message ?? '',
                image_url: value.imageUrl ?? null,
                link_url: value.linkUrl ?? null,
                youtube_url: value.youtubeUrl ?? null,
                instagram_url: value.instagramUrl ?? null,
                is_active: value.isActive !== false,
              }
        await supabaseAdmin
          .from('pastoral_journey_messages')
          .upsert(
            { step_id: stepId, profile, ...payload, updated_at: new Date().toISOString() },
            { onConflict: 'step_id,profile' }
          )
      }
    }

    // ── propaga para o que ainda não saiu ──
    const { data: pending } = await supabaseAdmin
      .from('pastoral_journey_sends')
      .select('id, enrollment_id, profile')
      .eq('step_id', stepId)
      .eq('status', 'pending')

    if (pending?.length) {
      const { data: freshMessages } = await supabaseAdmin
        .from('pastoral_journey_messages')
        .select('profile, message, image_url, link_url, youtube_url, instagram_url')
        .eq('step_id', stepId)

      const msgByProfile = new Map((freshMessages ?? []).map(m => [m.profile, m]))

      const { data: enrollments } = await supabaseAdmin
        .from('pastoral_journey_enrollments')
        .select('id, enrolled_at')
        .in('id', Array.from(new Set(pending.map(p => p.enrollment_id))))

      const enrolledAtById = new Map((enrollments ?? []).map(e => [e.id, e.enrolled_at]))

      for (const row of pending) {
        const msg = msgByProfile.get(row.profile)
        const enrolledAt = enrolledAtById.get(row.enrollment_id)
        const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
        if (msg) {
          update.message = msg.message
          update.image_url = msg.image_url ?? null
          update.link_url = msg.link_url ?? null
          update.youtube_url = msg.youtube_url ?? null
          update.instagram_url = msg.instagram_url ?? null
        }
        if (enrolledAt) {
          update.scheduled_at = computeScheduledAt(enrolledAt, step).toISOString()
        }
        // etapa desligada (ou mensagem vazia) deixa de ser enviada
        if (!step.is_active || (!String(msg?.message ?? '').trim() && !step.meta_modelo_id)) {
          update.status = 'cancelled'
          update.error_message = 'Etapa desativada na matriz'
        }
        await supabaseAdmin.from('pastoral_journey_sends').update(update).eq('id', row.id)
      }
    }

    return NextResponse.json({ ok: true, updatedPending: pending?.length ?? 0 })
  })
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id: journeyId } = await ctx.params
    const stepId = new URL(req.url).searchParams.get('stepId')
    if (!stepId) return NextResponse.json({ error: 'stepId obrigatório' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('pastoral_journey_steps')
      .delete()
      .eq('id', stepId)
      .eq('journey_id', journeyId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  })
}
