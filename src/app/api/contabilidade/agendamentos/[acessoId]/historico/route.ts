import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { podeAcessarContabilidadeAgendamento } from '@/lib/contabilidadeAgendamentoRole'

// GET /api/contabilidade/agendamentos/[acessoId]/historico — RF011
export async function GET(req: NextRequest, { params }: { params: Promise<{ acessoId: string }> }) {
  return withAuth(req, async (user) => {
    if (!podeAcessarContabilidadeAgendamento(user.profileType, user.roleName)) {
      return NextResponse.json({ error: 'Acesso restrito à função de Tesouraria.' }, { status: 403 })
    }
    const { acessoId } = await params

    const { data, error } = await supabaseAdmin
      .from('contabilidade_envios_historico')
      .select('*')
      .eq('acesso_id', acessoId)
      .order('disparado_em', { ascending: false })
      .limit(100)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ items: data ?? [] })
  })
}
