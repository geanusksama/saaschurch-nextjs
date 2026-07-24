import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { buscarDivergenciasDetalhe } from '@/lib/contabilidadeAgendamentoService'
import { podeAcessarContabilidadeAgendamento } from '@/lib/contabilidadeAgendamentoRole'

// GET /api/contabilidade/agendamentos/[acessoId]/historico/[historicoId]
// Detalhe de um disparo: resumo +, por periodo, os lancamentos que sumiram (RF009/RF010)
export async function GET(req: NextRequest, { params }: { params: Promise<{ acessoId: string; historicoId: string }> }) {
  return withAuth(req, async (user) => {
    if (!podeAcessarContabilidadeAgendamento(user.profileType, user.roleName)) {
      return NextResponse.json({ error: 'Acesso restrito à função de Tesouraria.' }, { status: 403 })
    }
    const { acessoId, historicoId } = await params

    const { data: historico, error } = await supabaseAdmin
      .from('contabilidade_envios_historico')
      .select('*')
      .eq('id', historicoId)
      .eq('acesso_id', acessoId)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!historico) return NextResponse.json({ error: 'Envio não encontrado' }, { status: 404 })

    const periodos: Array<{ ano: number; mes: number; qtd_registros: number; qtd_divergencias: number }> = historico.periodos ?? []

    const divergencias = await Promise.all(
      periodos
        .filter((p) => p.qtd_divergencias > 0)
        .map(async (p) => ({
          ano: p.ano,
          mes: p.mes,
          ...(await buscarDivergenciasDetalhe(acessoId, p.ano, p.mes)),
        }))
    )

    return NextResponse.json({ historico, divergencias })
  })
}
