import { NextRequest, NextResponse } from 'next/server'
import { lerComOrcamento } from '@/lib/meta/monitorMeta'
import { sincronizarModelos } from '@/lib/meta/servicoModelos'
import { ErroConfigMeta } from '@/lib/meta/configMeta'
import { camposConectados, montarDependenciasModelos } from '@/lib/meta/depsModelos'

/**
 * GET /api/cron/meta-modelos
 *
 * Sincroniza de hora em hora os modelos de mensagem (status de aprovação) de cada campo
 * com conexão ativa. Prazo total 45 s, 3 campos por vez; erro de um campo não para os outros.
 * Proteção: CRON_SECRET (`Authorization: Bearer` ou `x-cron-secret`).
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  const cronHeader = req.headers.get('x-cron-secret')
  const autorizado = !!secret && (authHeader === `Bearer ${secret}` || cronHeader === secret)
  if (!autorizado) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  try {
    const campos = await camposConectados()
    if (!campos.length) return NextResponse.json({ ok: true, total: 0 })
    let deps: Awaited<ReturnType<typeof montarDependenciasModelos>>
    try {
      deps = await montarDependenciasModelos()
    } catch (e) {
      if (e instanceof ErroConfigMeta) return NextResponse.json({ ok: false, motivo: 'configuração ausente' })
      throw e
    }
    const r = await lerComOrcamento(campos, async (campoId) => {
      try {
        const s = await sincronizarModelos(deps, campoId)
        return { ok: true as const, total: s.total, ausente: false }
      } catch (e) {
        const ausente = (e as { code?: string })?.code === 'P2021'
        if (!ausente) console.warn('[cron/meta-modelos] campo falhou:', (e as Error)?.name)
        return { ok: false as const, ausente }
      }
    }, { concorrencia: 3, prazoMs: 45_000 })
    if (r.some((x) => x.ausente)) return NextResponse.json({ ok: false, motivo: 'tabela ausente' })
    return NextResponse.json({
      ok: true, campos: campos.length, sincronizados: r.filter((x) => x.ok).length,
      falhas: r.filter((x) => !x.ok).length, naoProcessados: campos.length - r.length,
    })
  } catch (e) {
    if ((e as { code?: string })?.code === 'P2021') {
      console.warn('[cron/meta-modelos] tabela ausente')
      return NextResponse.json({ ok: false, motivo: 'tabela ausente' })
    }
    console.error('[cron/meta-modelos] falhou:', (e as Error)?.name)
    return NextResponse.json({ ok: false, error: 'falha ao sincronizar os modelos' }, { status: 500 })
  }
}
