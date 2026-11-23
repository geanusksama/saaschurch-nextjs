import { NextRequest, NextResponse } from 'next/server'
import { executarMonitor } from '@/lib/meta/monitorMeta'
import { depsExecucaoReais } from '@/lib/meta/depsMonitor'

/**
 * GET /api/cron/meta-monitor
 *
 * Monitor diário da Meta (WhatsApp Oficial): verifica versão da Graph API, conexões
 * em erro, qualidade do número e webhook; grava alertas novos e avisa o dono por
 * WhatsApp (META_ALERTA_WHATSAPP) só quando há alerta novo. NÃO altera configuração.
 *
 * Mesma proteção dos outros crons (CRON_SECRET): `Authorization: Bearer <secret>`
 * ou `x-cron-secret: <secret>`.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  const cronHeader = req.headers.get('x-cron-secret')
  const autorizado = !!secret && (authHeader === `Bearer ${secret}` || cronHeader === secret)
  if (!autorizado) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  try {
    const r = await executarMonitor(depsExecucaoReais())
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    console.error('[cron/meta-monitor] falhou:', (e as Error)?.name)
    return NextResponse.json({ ok: false, error: 'falha ao executar o monitor' }, { status: 500 })
  }
}
