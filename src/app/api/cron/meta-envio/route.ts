import { NextRequest, NextResponse } from 'next/server'
import { lerComOrcamento } from '@/lib/meta/monitorMeta'
import { processarFila } from '@/lib/meta/servicoEnvio'
import { ErroConfigMeta } from '@/lib/meta/configMeta'
import { camposComDisparoAtivo, montarDependenciasEnvio } from '@/lib/meta/depsEnvio'

/**
 * GET /api/cron/meta-envio
 *
 * Fila do envio em massa do WhatsApp Oficial, a cada minuto. Uma rodada por campo (até 60
 * mensagens, nunca acima do limite restante do número), 3 campos por vez, prazo total 45 s.
 * Erro de um campo não para os outros. Sem disparo ativo ⇒ responde na hora, sem ler a config.
 * Proteção: CRON_SECRET (`Authorization: Bearer` ou `x-cron-secret`).
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const PRAZO_MS = 45_000

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  const cronHeader = req.headers.get('x-cron-secret')
  const autorizado = !!secret && (authHeader === `Bearer ${secret}` || cronHeader === secret)
  if (!autorizado) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const inicio = Date.now()
  try {
    const agora = new Date()
    const campos = await camposComDisparoAtivo(agora)
    if (!campos.length) return NextResponse.json({ ok: true, campos: 0 })
    let deps: Awaited<ReturnType<typeof montarDependenciasEnvio>>
    try {
      deps = await montarDependenciasEnvio()
    } catch (e) {
      if (e instanceof ErroConfigMeta) return NextResponse.json({ ok: false, motivo: 'configuração ausente' })
      throw e
    }
    const r = await lerComOrcamento(campos, async (campoId) => {
      try {
        // Último POST começa até ~37 s: com o timeout de 15 s da Graph e as gravações, cabe em maxDuration.
        const restante = Math.max(0, PRAZO_MS - (Date.now() - inicio) - 8_000)
        const s = await processarFila(deps, campoId, agora, { prazoMs: restante })
        return { ok: true as const, enviados: s.enviados, falhas: s.falhas, pausado: !!s.pausado }
      } catch (e) {
        console.warn('[cron/meta-envio] campo falhou:', (e as Error)?.name)
        return { ok: false as const, enviados: 0, falhas: 0, pausado: false }
      }
    }, { concorrencia: 3, prazoMs: PRAZO_MS })
    return NextResponse.json({
      ok: true, campos: campos.length, processados: r.length,
      enviados: r.reduce((n, x) => n + x.enviados, 0), falhas: r.reduce((n, x) => n + x.falhas, 0),
      pausados: r.filter((x) => x.pausado).length, erros: r.filter((x) => !x.ok).length,
    })
  } catch (e) {
    if ((e as { code?: string })?.code === 'P2021') {
      console.warn('[cron/meta-envio] tabela ausente')
      return NextResponse.json({ ok: false, motivo: 'tabela ausente' })
    }
    console.error('[cron/meta-envio] falhou:', (e as Error)?.name)
    return NextResponse.json({ ok: false, error: 'falha ao processar a fila' }, { status: 500 })
  }
}
