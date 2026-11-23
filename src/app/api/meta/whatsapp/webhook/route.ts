import { NextRequest, NextResponse, after } from 'next/server'
import { lerConfigMeta } from '@/lib/meta/configMeta'
import { assinaturaValida, respostaDesafio } from '@/lib/meta/webhookSeguranca'
import { json, respostaDeErro, SEM_CACHE } from '@/lib/meta/depsConexao'
import { processarWebhook } from '@/lib/meta/servicoEnvio'
import { montarDependenciasEnvio } from '@/lib/meta/depsEnvio'

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

function logFalha(e: unknown, n: number) {
  const code = (e as { code?: string })?.code
  console.warn(`[meta/webhook] ${n} evento(s) não processado(s):`, code === 'P2021' ? 'tabela ausente' : (e as Error)?.name)
}

// Eventos da Meta: valida a assinatura sobre o corpo bruto; responde 200 na hora e processa
// depois da resposta (status dos envios e pedidos de SAIR). Sem configuração ou erro interno:
// log curto e 200 (a Meta não deve receber 4xx/5xx por problema nosso). Assinatura inválida: 401.
export async function POST(req: NextRequest) {
  let c: Awaited<ReturnType<typeof lerConfigMeta>>
  let bruto: string
  try {
    c = await lerConfigMeta()
    bruto = await req.text()
  } catch (e) {
    logFalha(e, 1)
    return json({ ok: true })
  }
  if (!assinaturaValida(bruto, req.headers.get('x-hub-signature-256'), c.appSecret)) {
    return json({ error: 'Assinatura inválida.' }, 401)
  }
  after(async () => {
    try {
      const r = await processarWebhook(await montarDependenciasEnvio(), JSON.parse(bruto))
      if (r.erros) logFalha(r.primeiroErro, r.erros)
    } catch (e) {
      logFalha(e, 1)
    }
  })
  return json({ ok: true })
}
