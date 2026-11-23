import { NextRequest, NextResponse } from 'next/server'
import { lerConfigMeta } from '@/lib/meta/configMeta'
import { assinaturaValida, respostaDesafio } from '@/lib/meta/webhookSeguranca'
import { json, respostaDeErro, SEM_CACHE } from '@/lib/meta/depsConexao'

export const dynamic = 'force-dynamic'

// Verificação do webhook pela Meta (sem autenticação de usuário).
export async function GET(req: NextRequest) {
  try {
    const c = await lerConfigMeta()
    const desafio = respostaDesafio(req.nextUrl.searchParams, c.verifyToken)
    if (desafio === null) return json({ error: 'Verificação recusada.' }, 403)
    return new NextResponse(desafio, { status: 200, headers: { ...SEM_CACHE, 'Content-Type': 'text/plain' } })
  } catch (e) {
    return respostaDeErro(e)
  }
}

// Eventos da Meta: valida a assinatura sobre o corpo bruto. Nesta etapa não processa.
export async function POST(req: NextRequest) {
  try {
    const c = await lerConfigMeta()
    const bruto = await req.text()
    if (!assinaturaValida(bruto, req.headers.get('x-hub-signature-256'), c.appSecret)) {
      return json({ error: 'Assinatura inválida.' }, 401)
    }
    return json({ ok: true })
  } catch (e) {
    return respostaDeErro(e)
  }
}
