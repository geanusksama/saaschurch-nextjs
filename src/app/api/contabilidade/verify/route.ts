import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, signToken, hashCode } from '@/lib/membroJwt'
import {
  findAcessoById,
  registrarAcessoOk,
  registrarTentativaErrada,
} from '@/lib/contabilidadeService'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { otp_token, code } = body as { otp_token?: string; code?: string }

  if (!otp_token || !code) {
    return NextResponse.json({ error: 'Dados invalidos.' }, { status: 400 })
  }

  const payload = verifyToken<{ acesso_id: string; code_hash: string }>(otp_token)
  if (!payload) {
    return NextResponse.json({ error: 'Codigo expirado. Reinicie o processo.', expired: true }, { status: 401 })
  }

  const acesso = await findAcessoById(payload.acesso_id)
  if (!acesso) {
    return NextResponse.json({ error: 'Acesso nao encontrado.' }, { status: 404 })
  }

  if (!acesso.ativo) {
    return NextResponse.json(
      { error: 'Acesso bloqueado por tentativas invalidas. Procure a secretaria da igreja.', blocked: true },
      { status: 403 }
    )
  }

  if (hashCode(code.trim()) !== payload.code_hash) {
    const restantes = await registrarTentativaErrada(acesso)
    return NextResponse.json(
      {
        error:
          restantes > 0
            ? `Codigo incorreto. Voce tem mais ${restantes} tentativa(s).`
            : 'Acesso bloqueado apos 3 tentativas invalidas. Procure a secretaria da igreja.',
        remaining: restantes,
        blocked: restantes === 0,
      },
      { status: restantes === 0 ? 403 : 401 }
    )
  }

  await registrarAcessoOk(acesso.id)

  // Sessao curta so para gerar o relatorio
  const sessionToken = signToken(
    { acesso_id: acesso.id, campo: acesso.campo, nome: acesso.nome, scope: 'contabilidade' },
    60 * 60
  )

  return NextResponse.json({
    session_token: sessionToken,
    nome: acesso.nome,
    campo: acesso.campo,
  })
}
