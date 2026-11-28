import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { seedJourneySteps } from '@/lib/pastoralJourneyService'
import { exigirPermissao } from '@/lib/permissoes/servidor'
import { campoEIgreja } from '@/lib/meta/depsJornada'
import { etapasAtivasSemModelo, MSG_ETAPAS_SEM_MODELO } from '@/lib/meta/jornadaOficial'
import { previsaoMensal } from '@/lib/meta/tetoMensal'

const PERM_OFICIAL = 'whatsapp_oficial.campanha.enviar'

/**
 * GET    /api/pastoral/journeys/[id] — matriz completa (etapas + mensagens por
 *        perfil + instâncias escolhidas).
 * PATCH  /api/pastoral/journeys/[id] — configurações do cronograma e/ou a
 *        lista de instâncias usadas no disparo. `reseed: true` repopula a
 *        matriz padrão quando ela está vazia.
 * DELETE /api/pastoral/journeys/[id] — remove o cronograma (cascade leva
 *        etapas, mensagens, inscrições e a fila de envios).
 */

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await ctx.params

    const { data: journey } = await supabaseAdmin
      .from('pastoral_journeys')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (!journey) return NextResponse.json({ error: 'Cronograma não encontrado' }, { status: 404 })

    const { data: steps } = await supabaseAdmin
      .from('pastoral_journey_steps')
      .select('*')
      .eq('journey_id', id)
      .order('position', { ascending: true })

    const stepIds = (steps ?? []).map(s => s.id)
    const { data: messages } = stepIds.length
      ? await supabaseAdmin.from('pastoral_journey_messages').select('*').in('step_id', stepIds)
      : { data: [] }

    const { data: instanceLinks } = await supabaseAdmin
      .from('pastoral_journey_instances')
      .select('instance_id')
      .eq('journey_id', id)

    // estimativa do mês quando o cronograma usa o número oficial (cobrado pela Meta)
    const idsInst = (instanceLinks ?? []).map(l => l.instance_id)
    let previsao: number | null = null
    if (idsInst.length) {
      const { data: oficiais } = await supabaseAdmin.from('whatsapp_instances').select('id').in('id', idsInst).eq('provider', 'meta')
      if (oficiais?.length) previsao = await previsaoMensal({ id })
    }

    return NextResponse.json({
      previsaoMensal: previsao,
      journey,
      steps: (steps ?? []).map(step => ({
        ...step,
        messages: (messages ?? []).filter(m => m.step_id === step.id),
      })),
      instanceIds: (instanceLinks ?? []).map(l => l.instance_id),
    })
  })
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await ctx.params
    const body = await req.json().catch(() => ({}))

    // ── número oficial (Meta): só do próprio campo, sem misturar com Z-API, e só com a permissão ──
    const { data: jornada } = await supabaseAdmin.from('pastoral_journeys').select('church_id, is_active').eq('id', id).maybeSingle()
    if (!jornada) return NextResponse.json({ error: 'Cronograma não encontrado' }, { status: 404 })
    let idsDaJornada: string[] | null = Array.isArray(body.instanceIds) ? body.instanceIds : null
    if (!idsDaJornada && body.isActive !== undefined) {
      const { data: links } = await supabaseAdmin.from('pastoral_journey_instances').select('instance_id').eq('journey_id', id)
      idsDaJornada = (links ?? []).map(l => l.instance_id)
    }
    if (idsDaJornada?.length) {
      const { data: insts } = await supabaseAdmin.from('whatsapp_instances').select('id, provider, campo_id').in('id', idsDaJornada)
      const oficiais = (insts ?? []).filter(i => i.provider === 'meta')
      if (oficiais.length) {
        const { campoId } = await campoEIgreja(jornada.church_id)
        if (!campoId || !user.campoId || campoId !== user.campoId || oficiais.some(i => i.campo_id !== campoId)) {
          return NextResponse.json({ error: 'Instância não encontrada' }, { status: 404 })
        }
        if (oficiais.length !== (insts ?? []).length) {
          return NextResponse.json({ error: 'Não misture o número oficial com instâncias Z-API no mesmo cronograma. Escolha só o número oficial.' }, { status: 400 })
        }
        const negado = await exigirPermissao(user, PERM_OFICIAL)
        if (negado) return negado
        // estado RESULTANTE: ligado (no pedido ou já estava) + número oficial ⇒ toda etapa ativa tem modelo
        if (body.isActive !== undefined ? !!body.isActive : !!jornada.is_active) {
          const { data: etapas } = await supabaseAdmin
            .from('pastoral_journey_steps').select('is_active, meta_modelo_id').eq('journey_id', id)
          const semModelo = etapasAtivasSemModelo(etapas ?? [])
          if (semModelo > 0) return NextResponse.json({ error: MSG_ETAPAS_SEM_MODELO(semModelo) }, { status: 400 })
        }
      }
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.name !== undefined) patch.name = body.name
    if (body.description !== undefined) patch.description = body.description
    if (body.isActive !== undefined) patch.is_active = !!body.isActive
    // o piso de 5 s por instância é o que protege o número — não é negociável
    if (body.intervalSeconds !== undefined) patch.interval_seconds = Math.max(5, Number(body.intervalSeconds) || 5)
    if (body.windowStart !== undefined) patch.window_start = body.windowStart
    if (body.windowEnd !== undefined) patch.window_end = body.windowEnd
    if (body.dailyLimitPerInstance !== undefined) {
      patch.daily_limit_per_instance = Math.max(0, Number(body.dailyLimitPerInstance) || 0)
    }
    if (body.autoEnroll !== undefined) patch.auto_enroll = !!body.autoEnroll
    if (body.autoEnrollColumnKey !== undefined) patch.auto_enroll_column_key = body.autoEnrollColumnKey
    if (body.stopOnDone !== undefined) patch.stop_on_done = !!body.stopOnDone
    if (body.maxPerPersonPerDay !== undefined) {
      patch.max_per_person_per_day = Math.max(0, Number(body.maxPerPersonPerDay) || 0)
    }
    if (body.aiPolish !== undefined) patch.ai_polish = !!body.aiPolish
    if (body.aiAgentId !== undefined) patch.ai_agent_id = body.aiAgentId || null

    const { error } = await supabaseAdmin.from('pastoral_journeys').update(patch).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (Array.isArray(body.instanceIds)) {
      await supabaseAdmin.from('pastoral_journey_instances').delete().eq('journey_id', id)
      if (body.instanceIds.length) {
        await supabaseAdmin.from('pastoral_journey_instances').insert(
          body.instanceIds.map((instanceId: string) => ({ journey_id: id, instance_id: instanceId }))
        )
      }
    }

    if (body.reseed) {
      const { count } = await supabaseAdmin
        .from('pastoral_journey_steps')
        .select('id', { count: 'exact', head: true })
        .eq('journey_id', id)
      if ((count ?? 0) === 0) await seedJourneySteps(id)
    }

    return NextResponse.json({ ok: true })
  })
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await ctx.params
    const { error } = await supabaseAdmin.from('pastoral_journeys').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  })
}
