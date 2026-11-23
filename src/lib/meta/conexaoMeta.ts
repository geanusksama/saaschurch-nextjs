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
  return String(r.access_token)
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

const QUALIDADES = ['GREEN', 'YELLOW', 'RED']

export async function lerStatusNumero(graph: Graph, token: string, phoneNumberId: string): Promise<StatusNumero> {
  // Não confirmado na doc (sem acesso web): pedimos o limite como campo extra do número; ausente => null.
  const r = await graph.get(
    phoneNumberId,
    { fields: 'display_phone_number,verified_name,quality_rating,status,whatsapp_business_manager_messaging_limit' },
    token,
  )
  const limite = r.whatsapp_business_manager_messaging_limit
  return {
    numero: String(r.display_phone_number ?? ''),
    nomeExibicao: String(r.verified_name ?? ''),
    qualidade: QUALIDADES.includes(r.quality_rating) ? r.quality_rating : 'UNKNOWN',
    status: String(r.status ?? ''),
    limiteDiario: limite == null ? null : String(limite),
  }
}

export function gerarPin(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
}
