import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { podeAcessarContabilidadeAgendamento } from '@/lib/contabilidadeAgendamentoRole'

// GET /api/contabilidade/agendamentos
// Lista todos os contadores (contabilidade_acessos) com a config de envio, se existir. (RF001)
export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (!podeAcessarContabilidadeAgendamento(user.profileType, user.roleName)) {
      return NextResponse.json({ error: 'Acesso restrito à função de Tesouraria.' }, { status: 403 })
    }

    const [{ data: acessos, error: accErr }, { data: agendamentos, error: agErr }, { data: historicos, error: histErr }] = await Promise.all([
      supabaseAdmin
        .from('contabilidade_acessos')
        .select('id, nome, campo, telefone, ativo, ultimo_acesso')
        .order('nome', { ascending: true }),
      supabaseAdmin.from('contabilidade_agendamentos').select('*'),
      // Só o necessário para saber o resultado do último disparo de cada contador.
      supabaseAdmin
        .from('contabilidade_envios_historico')
        .select('acesso_id, status, disparado_em')
        .order('disparado_em', { ascending: false }),
    ])

    if (accErr) return NextResponse.json({ error: accErr.message }, { status: 500 })
    if (agErr) return NextResponse.json({ error: agErr.message }, { status: 500 })
    if (histErr) return NextResponse.json({ error: histErr.message }, { status: 500 })

    const byAcesso = new Map((agendamentos ?? []).map((a) => [a.acesso_id, a]))

    // Já vem ordenado por disparado_em desc — o primeiro encontrado por acesso é o mais recente.
    const ultimoStatusPorAcesso = new Map<string, string>()
    for (const h of historicos ?? []) {
      if (!ultimoStatusPorAcesso.has(h.acesso_id)) ultimoStatusPorAcesso.set(h.acesso_id, h.status)
    }

    const items = (acessos ?? []).map((acc) => ({
      ...acc,
      agendamento: byAcesso.get(acc.id) ?? null,
      ultimo_status_envio: ultimoStatusPorAcesso.get(acc.id) ?? null,
    }))

    return NextResponse.json({ items })
  })
}
