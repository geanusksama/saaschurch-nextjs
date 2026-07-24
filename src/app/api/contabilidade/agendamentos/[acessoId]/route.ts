import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { calcularProximoEnvio, type ContabilidadeAgendamento } from '@/lib/contabilidadeAgendamentoService'
import { podeAcessarContabilidadeAgendamento } from '@/lib/contabilidadeAgendamentoRole'

// GET /api/contabilidade/agendamentos/[acessoId] — le a config de envio de um contador (RF002)
export async function GET(req: NextRequest, { params }: { params: Promise<{ acessoId: string }> }) {
  return withAuth(req, async (user) => {
    if (!podeAcessarContabilidadeAgendamento(user.profileType, user.roleName)) {
      return NextResponse.json({ error: 'Acesso restrito à função de Tesouraria.' }, { status: 403 })
    }
    const { acessoId } = await params

    const { data: acesso } = await supabaseAdmin
      .from('contabilidade_acessos')
      .select('id, nome, campo, telefone, ativo')
      .eq('id', acessoId)
      .maybeSingle()

    if (!acesso) return NextResponse.json({ error: 'Contador não encontrado' }, { status: 404 })

    const { data: agendamento } = await supabaseAdmin
      .from('contabilidade_agendamentos')
      .select('*')
      .eq('acesso_id', acessoId)
      .maybeSingle()

    return NextResponse.json({ acesso, agendamento })
  })
}

const CAMPOS_PERMITIDOS = [
  'ativo', 'frequencia', 'dia_envio', 'hora_envio', 'timezone',
  'tipo_periodo', 'gap_meses', 'qtd_meses',
] as const

// PUT /api/contabilidade/agendamentos/[acessoId] — cria/atualiza a config (RF002/RF003/RF004)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ acessoId: string }> }) {
  return withAuth(req, async (user) => {
    if (!podeAcessarContabilidadeAgendamento(user.profileType, user.roleName)) {
      return NextResponse.json({ error: 'Acesso restrito à função de Tesouraria.' }, { status: 403 })
    }
    const { acessoId } = await params
    const body = await req.json().catch(() => ({}))

    const { data: acesso } = await supabaseAdmin
      .from('contabilidade_acessos')
      .select('id')
      .eq('id', acessoId)
      .maybeSingle()
    if (!acesso) return NextResponse.json({ error: 'Contador não encontrado' }, { status: 404 })

    const updates: Record<string, unknown> = { updated_by: user.email ?? user.id, updated_at: new Date().toISOString() }
    for (const k of CAMPOS_PERMITIDOS) {
      if (k in body) updates[k] = body[k]
    }

    const { data: existente } = await supabaseAdmin
      .from('contabilidade_agendamentos')
      .select('*')
      .eq('acesso_id', acessoId)
      .maybeSingle()

    const DEFAULTS = {
      frequencia: 'mensal', dia_envio: 1, hora_envio: '08:00:00', timezone: 'America/Sao_Paulo',
      tipo_periodo: 'mes_anterior', gap_meses: 1, qtd_meses: 1,
    }
    const merged = { ...DEFAULTS, ...(existente ?? {}), ...updates } as ContabilidadeAgendamento
    const proximoEnvio = merged.ativo ? calcularProximoEnvio(merged) : null

    let saved
    if (existente) {
      const { data, error } = await supabaseAdmin
        .from('contabilidade_agendamentos')
        .update({ ...updates, proximo_envio: proximoEnvio?.toISOString() ?? null })
        .eq('acesso_id', acessoId)
        .select('*')
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      saved = data
    } else {
      const { data, error } = await supabaseAdmin
        .from('contabilidade_agendamentos')
        .insert({
          acesso_id: acessoId,
          ...updates,
          created_by: user.email ?? user.id,
          proximo_envio: proximoEnvio?.toISOString() ?? null,
        })
        .select('*')
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      saved = data
    }

    return NextResponse.json({ agendamento: saved })
  })
}
