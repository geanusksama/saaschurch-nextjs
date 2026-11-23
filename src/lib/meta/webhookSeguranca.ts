/**
 * Segurança do webhook da Meta (WhatsApp Cloud API).
 * - assinaturaValida: confere o cabeçalho X-Hub-Signature-256 (HMAC-SHA256 do corpo bruto com o App Secret).
 * - respostaDesafio: responde ao GET de verificação do webhook (hub.mode / hub.verify_token / hub.challenge).
 */
import crypto from 'node:crypto'

export function assinaturaValida(corpoBruto: string, cabecalho: string | null, appSecret: string): boolean {
  if (!cabecalho) return false
  const esperada = 'sha256=' + crypto.createHmac('sha256', appSecret).update(corpoBruto).digest('hex')
  const a = Buffer.from(esperada, 'utf8')
  const b = Buffer.from(cabecalho, 'utf8')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export function respostaDesafio(params: URLSearchParams, verifyToken: string): string | null {
  if (params.get('hub.mode') !== 'subscribe') return null
  if (params.get('hub.verify_token') !== verifyToken) return null
  return params.get('hub.challenge')
}
