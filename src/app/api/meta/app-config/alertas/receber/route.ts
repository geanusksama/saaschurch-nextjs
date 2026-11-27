import { NextRequest } from 'next/server'
import crypto from 'node:crypto'
import { ehBase } from '@/lib/meta/configCentral'
import { receberAlertas, validarRecebimento } from '@/lib/meta/encaminharAlertas'
import { abertosComOrigem, gravarRecebidos } from '@/lib/meta/alertasRepo'
import { depsExecucaoReais } from '@/lib/meta/depsMonitor'
import { json } from '@/lib/meta/depsConexao'

export const dynamic = 'force-dynamic'

const hash = (v: string) => crypto.createHash('sha256').update(v).digest()

/**
 * POST /api/meta/app-config/alertas/receber
 *
 * Servidor-a-servidor, só no base: as outras igrejas entregam aqui os alertas do
 * monitor delas (mesmo segredo compartilhado do GET /api/meta/app-config). Grava
 * com a origem, sem duplicar o que já está aberto, e avisa o dono por WhatsApp
 * quando entrou alerta novo.
 */
export async function POST(req: NextRequest) {
  const esperado = (process.env.META_CONFIG_SYNC_TOKEN ?? '').trim()
  const recebido = req.headers.get('x-meta-config-token') ?? ''
  if (!esperado || !crypto.timingSafeEqual(hash(esperado), hash(recebido))) {
    return json({ error: 'Não autorizado.' }, 401)
  }
  if (!ehBase(process.env)) return json({ error: 'Este sistema não é o base da configuração.' }, 404)
  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return json({ error: 'Corpo da requisição inválido.' }, 400)
  }
  const v = validarRecebimento(corpo)
  if (!v.ok) return json({ error: v.erro }, 400)
  let novos = 0
  try {
    novos = await receberAlertas(v.dominio, v.alertas, { abertosComOrigem, gravar: gravarRecebidos })
  } catch (e) {
    console.error('[meta/alertas/receber] erro ao gravar:', (e as Error)?.name)
    return json({ error: 'Não foi possível gravar os alertas.' }, 500)
  }
  let avisou = false
  if (novos > 0) {
    const deps = depsExecucaoReais()
    const numero = (deps.numeroAviso ?? '').replace(/\D/g, '')
    if (numero) {
      try {
        avisou = await deps.enviarWhatsapp(numero, `Monitor da Meta: ${novos} novo(s) alerta(s) de ${v.dominio} no WhatsApp oficial. Abra Configurações > Meta Oficial > App para ver e resolver.`)
      } catch { avisou = false }
    }
  }
  return json({ ok: true, recebidos: v.alertas.length, novos, avisou })
}
