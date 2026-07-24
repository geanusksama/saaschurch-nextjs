import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  calcularProximoEnvio,
  processarAgendamento,
  type ContabilidadeAgendamento,
} from '@/lib/contabilidadeAgendamentoService'
import { podeAcessarContabilidadeAgendamento } from '@/lib/contabilidadeAgendamentoRole'

// POST /api/contabilidade/agendamentos/[acessoId]/enviar-agora
// Dispara o envio na hora (frequencia manual, ou reenvio avulso). RF002.
export async function POST(req: NextRequest, { params }: { params: Promise<{ acessoId: string }> }) {
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

    const ag: ContabilidadeAgendamento = agendamento ?? {
      id: '', acesso_id: acessoId, ativo: false,
      frequencia: 'manual', dia_envio: 1, hora_envio: '08:00:00', timezone: 'America/Sao_Paulo',
      tipo_periodo: 'mes_anterior', gap_meses: 1, qtd_meses: 1,
      proximo_envio: null, ultimo_envio: null,
    }

    const resultado = await processarAgendamento(ag, acesso, 'manual')

    if (agendamento) {
      const proximo = agendamento.ativo && agendamento.frequencia !== 'manual'
        ? calcularProximoEnvio(agendamento)
        : null
      await supabaseAdmin
        .from('contabilidade_agendamentos')
        .update({ ultimo_envio: new Date().toISOString(), proximo_envio: proximo?.toISOString() ?? null })
        .eq('id', agendamento.id)
    }

    return NextResponse.json({ resultado })
  })
}
