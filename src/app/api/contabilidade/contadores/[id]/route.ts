import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { resolverCampoId } from '@/lib/contabilidadeService'
import { podeAcessarContabilidadeAgendamento } from '@/lib/contabilidadeAgendamentoRole'

function onlyDigits(v: string) {
  return (v || '').replace(/\D/g, '')
}

// PATCH /api/contabilidade/contadores/[id] — edita nome, campo, telefone, ativo
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    if (!podeAcessarContabilidadeAgendamento(user.profileType, user.roleName)) {
      return NextResponse.json({ error: 'Acesso restrito à função de Tesouraria.' }, { status: 403 })
    }
    const { id } = await params
    const body = await req.json().catch(() => ({}))

    const { data: acesso } = await supabaseAdmin
      .from('contabilidade_acessos')
      .select('id')
      .eq('id', id)
      .maybeSingle()
    if (!acesso) return NextResponse.json({ error: 'Contador não encontrado' }, { status: 404 })

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if ('nome' in body) {
      const nome = String(body.nome ?? '').trim()
      if (!nome) return NextResponse.json({ error: 'Nome não pode ficar vazio.' }, { status: 400 })
      updates.nome = nome
    }

    if ('campo' in body) {
      const campo = String(body.campo ?? '').trim()
      try {
        await resolverCampoId(campo)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Campo inválido.'
        return NextResponse.json({ error: msg }, { status: 400 })
      }
      updates.campo = campo
    }

    if ('telefone' in body) {
      const telefone = onlyDigits(String(body.telefone ?? ''))
      if (telefone.length < 10) return NextResponse.json({ error: 'WhatsApp inválido.' }, { status: 400 })

      // telefone é único
      const { data: outro } = await supabaseAdmin
        .from('contabilidade_acessos')
        .select('id')
        .eq('telefone', telefone)
        .neq('id', id)
        .maybeSingle()
      if (outro) return NextResponse.json({ error: 'Já existe outro contador com esse WhatsApp.' }, { status: 409 })
      updates.telefone = telefone
    }

    // Reativar acesso bloqueado (zera as tentativas).
    if ('ativo' in body) {
      updates.ativo = !!body.ativo
      if (body.ativo) {
        updates.tentativas = 0
        updates.bloqueado_em = null
      }
    }

    const { data, error } = await supabaseAdmin
      .from('contabilidade_acessos')
      .update(updates)
      .eq('id', id)
      .select('id, nome, campo, telefone, hash, ativo, tentativas')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ contador: data })
  })
}

// DELETE /api/contabilidade/contadores/[id] — remove o contador e o agendamento em cascata
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    if (!podeAcessarContabilidadeAgendamento(user.profileType, user.roleName)) {
      return NextResponse.json({ error: 'Acesso restrito à função de Tesouraria.' }, { status: 403 })
    }
    const { id } = await params

    // contabilidade_agendamentos / historico / periodos têm FK ON DELETE CASCADE para acesso_id.
    const { error } = await supabaseAdmin
      .from('contabilidade_acessos')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  })
}
