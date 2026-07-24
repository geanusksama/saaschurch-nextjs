import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { resolverCampoId } from '@/lib/contabilidadeService'
import { podeAcessarContabilidadeAgendamento } from '@/lib/contabilidadeAgendamentoRole'

function onlyDigits(v: string) {
  return (v || '').replace(/\D/g, '')
}

/** Gera a "senha" do contador no formato XXXXX-XXXXX (A-Z 2-9, sem caracteres ambíguos). */
function gerarHash(): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bloco = () =>
    Array.from(randomBytes(5))
      .map((b) => alfabeto[b % alfabeto.length])
      .join('')
  return `${bloco()}-${bloco()}`
}

// POST /api/contabilidade/contadores — cadastra um novo contador (contabilidade_acessos)
export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (!podeAcessarContabilidadeAgendamento(user.profileType, user.roleName)) {
      return NextResponse.json({ error: 'Acesso restrito à função de Tesouraria.' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const nome = String(body.nome ?? '').trim()
    const campo = String(body.campo ?? '').trim()
    const telefone = onlyDigits(String(body.telefone ?? ''))

    if (!nome || !campo || !telefone) {
      return NextResponse.json({ error: 'Nome, campo e WhatsApp são obrigatórios.' }, { status: 400 })
    }
    if (telefone.length < 10) {
      return NextResponse.json({ error: 'WhatsApp inválido (informe DDD + número).' }, { status: 400 })
    }

    // Valida que o campo existe no cadastro — mesma resolução usada pelo relatório.
    // Se não existir, resolverCampoId lança e o contador não é criado com campo inválido.
    try {
      await resolverCampoId(campo)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Campo inválido.'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    // Telefone é único: não deixa duplicar acesso.
    const { data: existente } = await supabaseAdmin
      .from('contabilidade_acessos')
      .select('id')
      .eq('telefone', telefone)
      .maybeSingle()
    if (existente) {
      return NextResponse.json({ error: 'Já existe um contador com esse WhatsApp.' }, { status: 409 })
    }

    const hash = gerarHash()

    const { data, error } = await supabaseAdmin
      .from('contabilidade_acessos')
      .insert({ nome, campo, telefone, hash, ativo: true })
      .select('id, nome, campo, telefone, hash, ativo')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Retorna o hash uma vez para o admin repassar ao contador (é a senha do portal).
    return NextResponse.json({ contador: data })
  })
}
