import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  processJourneyTick,
  requeueStaleSends,
  autoEnrollFromColumn,
  stopFinishedEnrollments,
  type JourneyRow,
} from '@/lib/pastoralJourneyService'

/**
 * GET /api/cron/pastoral-cronograma
 *
 * Drena a fila do Cronograma de Acompanhamento: pega os envios vencidos
 * (scheduled_at <= agora) e dispara em ritmo controlado, alternando entre as
 * instâncias escolhidas na matriz. Roda a cada minuto.
 *
 * O orçamento de tempo (maxMs) fica abaixo do limite de execução da função
 * para a resposta sair antes de a Vercel cortar — o que sobrar continua no
 * minuto seguinte, já que a fila vive no banco.
 *
 * Mesma proteção dos outros crons (CRON_SECRET), aceitando
 * `Authorization: Bearer <secret>` ou `x-cron-secret: <secret>`.
 */
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  const cronHeader = req.headers.get('x-cron-secret')
  const autorizado = !!secret && (authHeader === `Bearer ${secret}` || cronHeader === secret)
  if (!autorizado) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // 1. devolve à fila o que ficou preso em "sending" (execução morta no meio)
  const requeued = await requeueStaleSends()

  // 2. encerra quem saiu do fluxo: card concluído, cancelado ou excluído.
  //    Roda ANTES da varredura para não readotar quem acabou de ser encerrado.
  const stopped = await stopFinishedEnrollments()

  // 3. varre a coluna do kanban e adota quem chegou e ainda não tem jornada
  const { data: journeys } = await supabaseAdmin
    .from('pastoral_journeys')
    .select('*')
    .eq('is_active', true)
    .eq('auto_enroll', true)

  const adopted = { enrolled: 0, unclassified: 0, noPhone: 0 }
  for (const journey of (journeys ?? []) as JourneyRow[]) {
    try {
      const r = await autoEnrollFromColumn(journey)
      adopted.enrolled += r.enrolled
      adopted.unclassified += r.unclassified
      adopted.noPhone += r.noPhone
    } catch (err) {
      console.error('[cron/pastoral-cronograma] varredura falhou', journey.id, err)
    }
  }

  // 4. dispara o que venceu, no ritmo das instâncias
  const summary = await processJourneyTick({ maxMs: 40_000 })

  return NextResponse.json({ ok: true, requeued, stopped, adopted, ...summary })
}
