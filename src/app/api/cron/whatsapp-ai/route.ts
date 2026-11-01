import { NextRequest, NextResponse } from 'next/server'
import { processDueReplies } from '@/lib/aiReplyQueue'
import { processarAvisosQueroSerMembro } from '@/lib/avisoQueroSerMembro'
import { processarConversasParadas } from '@/lib/resumoConversaParada'

/**
 * GET /api/cron/whatsapp-ai
 *
 * Drena a fila de respostas do agente de IA (whatsapp_ai_reply_queue). O
 * caminho feliz nem depende disto — o próprio webhook agenda a drenagem em
 * memória. Este cron é a rede de segurança: se o processo reiniciar entre a
 * mensagem e a resposta, ninguém fica sem resposta.
 *
 * Rode a cada minuto. Mesma proteção do cron da contabilidade (CRON_SECRET),
 * aceitando `Authorization: Bearer <secret>` ou `x-cron-secret: <secret>`.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  const cronHeader = req.headers.get('x-cron-secret')
  const autorizado = !!secret && (authHeader === `Bearer ${secret}` || cronHeader === secret)
  if (!autorizado) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const respondidas = await processDueReplies()
  // avisos de novos "Quero ser Membro" (site e agente) para quem a recepção configurou
  const avisosQsm = await processarAvisosQueroSerMembro()
  // conversa da recepção parada há 2 h sem despedida: resumo vai para o líder
  const resumosParados = await processarConversasParadas()
  return NextResponse.json({ ok: true, respondidas, avisosQsm, resumosParados })
}
