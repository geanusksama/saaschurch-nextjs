/**
 * Operações de conexão do WhatsApp Oficial (Meta Cloud API).
 * Recebem o cliente Graph por parâmetro (import type apenas) para rodar sem o projeto.
 */
import crypto from 'node:crypto'
import type { Graph } from './graph.ts'

export type StatusNumero = {
  numero: string
  nomeExibicao: string
  qualidade: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN'
  status: string
  limiteDiario: string | null
}

export async function trocarCodigo(
  graph: Graph,
  dados: { appId: string; appSecret: string; code: string },
): Promise<string> {
  const r = await graph.get('oauth/access_token', {
    client_id: dados.appId,
    client_secret: dados.appSecret,
    code: dados.code,
  })
  if (typeof r?.access_token !== 'string' || !r.access_token) {
    throw new Error('Resposta da Meta sem access_token')
  }
  return r.access_token
}

export async function registrarNumero(graph: Graph, token: string, phoneNumberId: string, pin: string): Promise<void> {
  await graph.post(`${phoneNumberId}/register`, { messaging_product: 'whatsapp', pin }, token)
}

export async function assinarWebhookDaConta(
  graph: Graph,
  token: string,
  wabaId: string,
  dados: { callbackUrl: string; verifyToken: string },
): Promise<void> {
  await graph.post(
    `${wabaId}/subscribed_apps`,
    { override_callback_uri: dados.callbackUrl, verify_token: dados.verifyToken },
    token,
  )
}

export async function cancelarAssinaturaWebhook(graph: Graph, token: string, wabaId: string): Promise<void> {
  await graph.delete(`${wabaId}/subscribed_apps`, token)
}

const QUALIDADES = ['GREEN', 'YELLOW', 'RED']

export async function lerStatusNumero(graph: Graph, token: string, phoneNumberId: string): Promise<StatusNumero> {
  const r = await graph.get(
    phoneNumberId,
    { fields: 'display_phone_number,verified_name,quality_rating,status' },
    token,
  )
  // Doc da Meta (messaging limits): GET /<PHONE_NUMBER_ID>?fields=whatsapp_business_manager_messaging_limit
  // (ex.: "TIER_250"). Chamada separada: se a Graph rejeitar o campo, o status continua válido.
  let limiteDiario: string | null = null
  try {
    const l = await graph.get(phoneNumberId, { fields: 'whatsapp_business_manager_messaging_limit' }, token)
    const v = l?.whatsapp_business_manager_messaging_limit
    limiteDiario = v == null ? null : String(v)
  } catch (e) {
    if ((e as { tokenInvalido?: boolean })?.tokenInvalido) throw e
  }
  return {
    numero: String(r.display_phone_number ?? ''),
    nomeExibicao: String(r.verified_name ?? ''),
    qualidade: QUALIDADES.includes(r.quality_rating) ? r.quality_rating : 'UNKNOWN',
    status: String(r.status ?? ''),
    limiteDiario,
  }
}

export function gerarPin(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
}
