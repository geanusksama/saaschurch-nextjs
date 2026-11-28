/**
 * whatsappSendService — serviço server-side para envio de WhatsApp via Z-API.
 * Usado por: aniversariantes, recibo de dízimos, e qualquer outro módulo.
 * Nunca expõe credenciais Z-API ao cliente.
 */

import { supabaseAdmin } from '@/lib/supabase-admin'
import { filtrarPorCampo } from '@/lib/meta/instanciaCampo'
import { ehInstanciaMeta } from '@/lib/meta/envioLivre'
import { normalizarNumeroBrasil } from '@/lib/numeroBrasil'
import type { ConteudoLivre } from '@/lib/meta/envioLivre'
import type { SendMessagePayload, SendMessageResult, WhatsAppInstance } from '@/types/whatsapp'

const ZAPI_BASE = 'https://api.z-api.io'
const RATE_LIMIT_MS = 5000 // NUNCA reduzir — risco de ban do número

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  csv: 'text/csv',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

/** Instância aceita pelos envios: Z-API (token) ou espelho do número oficial (provider 'meta', sem token). */
type InstanciaEnvio = Pick<WhatsAppInstance, 'instance_id' | 'token' | 'client_token'> & Partial<Pick<WhatsAppInstance, 'id' | 'provider'>>

/** Envio livre pelo número oficial da Meta (janela de 24 h). Import tardio: carrega Prisma só quando preciso. */
async function enviarPelaMeta(instance: InstanciaEnvio, to: string, conteudo: ConteudoLivre): Promise<SendMessageResult> {
  const { enviarLivreMetaPadrao } = await import('@/lib/meta/envioLivrePadrao')
  return enviarLivreMetaPadrao(instance, to, conteudo)
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/**
 * Lê a resposta de um endpoint de envio da Z-API.
 *
 * Ela nem sempre usa o status HTTP para reprovar o envio: número fora do
 * WhatsApp, instância desconectada ou payload recusado voltam como 200 com
 * `{ error: "..." }` e SEM messageId. Tratar isso como sucesso é o que produz
 * o "o painel diz enviado e ninguém recebeu" — sem messageId, não houve envio.
 */
async function parseZApiSend(res: Response): Promise<SendMessageResult> {
  if (!res.ok) {
    const err = await res.text().catch(() => 'unknown')
    return { messageId: '', status: 'error', error: err || `HTTP ${res.status}` }
  }

  const json = await res.json().catch(() => null) as
    | { messageId?: string; id?: string; zaapId?: string; error?: string; message?: string }
    | null

  if (!json) return { messageId: '', status: 'error', error: 'resposta inválida da Z-API' }
  if (json.error) return { messageId: '', status: 'error', error: json.error }

  const messageId = json.messageId ?? json.id ?? json.zaapId ?? ''
  if (!messageId) {
    return { messageId: '', status: 'error', error: json.message ?? 'Z-API não devolveu messageId' }
  }
  return { messageId, status: 'sent' }
}

// ── Busca a instância ativa de um owner ───────────────────────────────────────
// profileType 'master' pode usar qualquer instância conectada do sistema
export async function getActiveInstance(
  ownerUserId: string,
  profileType?: string
): Promise<WhatsAppInstance | null> {
  let query = supabaseAdmin
    .from('whatsapp_instances')
    .select('*')
    .eq('is_active', true)
    .eq('status', 'connected')
    // Envio por Z-API: o espelho do número oficial (provider 'meta') não tem token.
    .neq('provider', 'meta')
    .order('created_at', { ascending: true })
    .limit(1)

  // master: acesso global — não filtra por owner
  if (profileType !== 'master') {
    query = query.eq('owner_user_id', ownerUserId)
  }

  const { data } = await query.single()
  return data ?? null
}

// ── Instâncias que um usuário pode usar: dono OU autorizado em whatsapp_instance_users ──
// master: acesso irrestrito às Z-API (retorna null, sentinela de "sem filtro") — a menos que
// exista número oficial (provider 'meta') de OUTRO campo; aí devolve o conjunto sem ele.
// A instância oficial só vale no campo ativo (`campoAtivo`); sem ele, nenhuma oficial.
// Mesma regra de acesso usada por GET /api/whatsapp/instances — mantenha sincronizado.
export async function getAccessibleInstanceIds(
  userId: string,
  profileType?: string,
  campoAtivo?: string | null
): Promise<Set<string> | null> {
  if (profileType === 'master') {
    const { data: oficiais } = await supabaseAdmin
      .from('whatsapp_instances')
      .select('id, provider, campo_id')
      .eq('provider', 'meta')
      .limit(200)
    const estranhas = (oficiais ?? []).filter(i => filtrarPorCampo([i], campoAtivo).length === 0)
    if (!estranhas.length) return null
    const { data: todas } = await supabaseAdmin.from('whatsapp_instances').select('id, provider, campo_id').limit(5000)
    return new Set(filtrarPorCampo(todas ?? [], campoAtivo).map(i => i.id as string))
  }

  const [{ data: owned }, { data: links }] = await Promise.all([
    supabaseAdmin.from('whatsapp_instances').select('id').eq('owner_user_id', userId),
    supabaseAdmin.from('whatsapp_instance_users').select('instance_id').eq('user_id', userId),
  ])

  const ids = new Set<string>()
  for (const row of owned ?? []) ids.add(row.id)
  for (const row of links ?? []) ids.add(row.instance_id)

  if (ids.size) {
    const { data: oficiais } = await supabaseAdmin
      .from('whatsapp_instances')
      .select('id, provider, campo_id')
      .in('id', [...ids])
      .eq('provider', 'meta')
    for (const i of oficiais ?? []) {
      if (filtrarPorCampo([i], campoAtivo).length === 0) ids.delete(i.id as string)
    }
  }
  return ids
}

// ── Respeita rate limit por instância (5 s) ───────────────────────────────────
export async function enforceRateLimit(instanceId: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from('whatsapp_instance_rate_limit')
    .select('last_sent_at')
    .eq('instance_id', instanceId)
    .single()

  if (data?.last_sent_at) {
    const elapsed = Date.now() - new Date(data.last_sent_at).getTime()
    if (elapsed < RATE_LIMIT_MS) {
      await sleep(RATE_LIMIT_MS - elapsed)
    }
  }

  await supabaseAdmin
    .from('whatsapp_instance_rate_limit')
    .upsert({ instance_id: instanceId, last_sent_at: new Date().toISOString() })
}

// ── Chama Z-API para enviar texto ─────────────────────────────────────────────
export async function sendTextViaZApi(
  instance: InstanciaEnvio,
  to: string,
  message: string,
  /**
   * Comportamento humano (Z-API aceita 1..15 s em cada um):
   *  - delayTyping: segundos exibindo "digitando..." ANTES da mensagem sair
   *  - delayMessage: segundos de espera antes do envio
   * Sem isto a resposta sai instantânea, o que denuncia o robô.
   */
  options?: { delayTyping?: number; delayMessage?: number }
): Promise<SendMessageResult> {
  if (ehInstanciaMeta(instance)) return enviarPelaMeta(instance, to, { tipo: 'texto', texto: message })
  await enforceRateLimit(instance.instance_id)

  const clamp = (v?: number) =>
    v === undefined ? undefined : Math.max(1, Math.min(15, Math.round(v)))

  const url = `${ZAPI_BASE}/instances/${instance.instance_id}/token/${instance.token}/send-text`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Token': instance.client_token,
    },
    body: JSON.stringify({
      phone: to,
      message,
      ...(clamp(options?.delayTyping) ? { delayTyping: clamp(options?.delayTyping) } : {}),
      ...(clamp(options?.delayMessage) ? { delayMessage: clamp(options?.delayMessage) } : {}),
    }),
  })

  return parseZApiSend(res)
}

// ── Marca a mensagem do contato como lida (os dois tiques azuis) ─────────────
/**
 * POST /read-message da Z-API. Um atendente humano abre a conversa antes de
 * responder — sem isto o contato vê a resposta chegar com a mensagem dele ainda
 * "não lida". Nunca lança: falhar aqui não pode impedir a resposta.
 */
export async function markMessageAsRead(
  instance: InstanciaEnvio,
  phone: string,
  messageId: string
): Promise<boolean> {
  // Meta: marcar como lido exige o id (wamid) da mensagem recebida; por ora não faz nada (nunca lança).
  if (ehInstanciaMeta(instance)) return false
  try {
    const url = `${ZAPI_BASE}/instances/${instance.instance_id}/token/${instance.token}/read-message`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': instance.client_token,
      },
      body: JSON.stringify({ phone, messageId }),
    })
    return res.ok
  } catch (err) {
    console.error('[whatsapp] read-message falhou', err)
    return false
  }
}

// ── Salva mensagem outbound no banco ──────────────────────────────────────────
// normalizarNumeroBrasil mora em numeroBrasil.ts (pura, testável em Node); reexportada aqui.
export { normalizarNumeroBrasil }

export async function persistOutboundMessage(
  conversationId: string,
  content: string,
  zapiMessageId?: string,
  /** Número oficial (Meta): guarda o wamid em metadata.meta_message_id. Z-API não usa. */
  opts?: { metaMessageId?: string }
): Promise<void> {
  const metaMessageId = opts?.metaMessageId
  await supabaseAdmin.from('whatsapp_messages').insert({
    conversation_id: conversationId,
    content,
    type: 'text',
    direction: 'outbound',
    status: zapiMessageId || metaMessageId ? 'sent' : 'failed',
    metadata: zapiMessageId
      ? { zapi_message_id: zapiMessageId }
      : metaMessageId
        ? { meta_message_id: metaMessageId }
        : {},
  })

  await supabaseAdmin
    .from('whatsapp_conversations')
    .update({ last_message: content, last_message_at: new Date().toISOString() })
    .eq('id', conversationId)
}

/**
 * persistOutboundMessage pelo provedor da instância: na oficial (Meta) o wamid vai em
 * metadata.meta_message_id (é por ele que o webhook da Meta atualiza o status); na Z-API,
 * exatamente a chamada de antes.
 */
export function persistirEnvio(
  instance: { provider?: string | null },
  conversationId: string,
  content: string,
  messageId?: string,
): Promise<void> {
  return ehInstanciaMeta(instance)
    ? persistOutboundMessage(conversationId, content, undefined, { metaMessageId: messageId })
    : persistOutboundMessage(conversationId, content, messageId)
}

// ── Garante que existe conversa para um phone+instância ───────────────────────
export async function ensureConversation(
  instanceDbId: string,
  ownerUserId: string,
  phone: string,
  contactName?: string
): Promise<string> {
  const normalized = phone.replace(/\D/g, '')

  const { data: existing } = await supabaseAdmin
    .from('whatsapp_conversations')
    .select('id')
    .eq('instance_id', instanceDbId)
    .eq('phone', normalized)
    .single()

  if (existing) return existing.id

  const { data: created } = await supabaseAdmin
    .from('whatsapp_conversations')
    .insert({
      instance_id: instanceDbId,
      phone: normalized,
      contact_name: contactName ?? null,
      owner_user_id: ownerUserId,
      status: 'open',
    })
    .select('id')
    .single()

  return created!.id
}

// ── Chama Z-API para enviar documento ──────────────────────────────────────────
export async function sendDocumentViaZApi(
  instance: InstanciaEnvio,
  to: string,
  documentUrl: string,
  caption: string,
  fileName: string
): Promise<SendMessageResult> {
  if (ehInstanciaMeta(instance)) return enviarPelaMeta(instance, to, { tipo: 'documento', url: documentUrl, texto: caption, nomeArquivo: fileName })
  await enforceRateLimit(instance.instance_id)

  const ext = fileName.split('.').pop() || 'pdf'
  // A Z-API acrescenta ".{ext}" sozinha ao nome exibido — manda sem a extensão pra não duplicar (ex: "arquivo.csv.csv").
  const baseName = fileName.replace(new RegExp(`\\.${ext}$`, 'i'), '')
  const mimeType = MIME_BY_EXT[ext.toLowerCase()] || 'application/pdf'
  const url = `${ZAPI_BASE}/instances/${instance.instance_id}/token/${instance.token}/send-document/${ext}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Token': instance.client_token,
    },
    body: JSON.stringify({
      phone: to,
      document: documentUrl,
      fileName: baseName,
      mimeType,
      caption,
    }),
  })

  return parseZApiSend(res)
}

// ── Chama Z-API para enviar imagem ─────────────────────────────────────────────
export async function sendImageViaZApi(
  instance: InstanciaEnvio,
  to: string,
  imageUrl: string,
  caption: string
): Promise<SendMessageResult> {
  if (ehInstanciaMeta(instance)) return enviarPelaMeta(instance, to, { tipo: 'imagem', url: imageUrl, texto: caption })
  await enforceRateLimit(instance.instance_id)

  const url = `${ZAPI_BASE}/instances/${instance.instance_id}/token/${instance.token}/send-image`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Token': instance.client_token,
    },
    body: JSON.stringify({ phone: to, image: imageUrl, caption }),
  })

  return parseZApiSend(res)
}

// ── Chama Z-API para enviar áudio (mensagem de voz) ───────────────────────────
/**
 * POST /send-audio (developer.z-api.io, "Enviar áudio", conferido 12/11/2026):
 * `audio` = link público ou data URI base64; `delayTyping` (1..15 s) mostra
 * "Gravando áudio..." antes de enviar; `waveform` manda com a onda sonora.
 */
export async function sendAudioViaZApi(
  instance: InstanciaEnvio,
  to: string,
  audio: string,
  options?: { gravandoSegundos?: number }
): Promise<SendMessageResult> {
  // Meta: só link público (base64 devolve formato_nao_suportado_meta; sem upload de mídia ainda).
  if (ehInstanciaMeta(instance)) return enviarPelaMeta(instance, to, { tipo: 'audio', url: audio })
  await enforceRateLimit(instance.instance_id)

  const gravando = options?.gravandoSegundos
  const url = `${ZAPI_BASE}/instances/${instance.instance_id}/token/${instance.token}/send-audio`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Token': instance.client_token,
    },
    body: JSON.stringify({
      phone: to,
      audio,
      waveform: true,
      ...(gravando ? { delayTyping: Math.max(1, Math.min(15, Math.round(gravando))) } : {}),
    }),
  })

  return parseZApiSend(res)
}

// ── Função de alto nível: enviar mensagem de qualquer módulo ──────────────────
export interface QuickSendOptions {
  ownerUserId: string
  profileType?: string   // 'master' permite usar qualquer instância do sistema
  phone: string
  message: string
  contactName?: string
  instanceId?: string
  documentUrl?: string
  imageUrl?: string
  fileName?: string
}

export async function quickSendWhatsApp(opts: QuickSendOptions): Promise<SendMessageResult> {
  let instance: WhatsAppInstance | null = null

  if (opts.instanceId) {
    const { data } = await supabaseAdmin
      .from('whatsapp_instances')
      .select('*')
      .eq('id', opts.instanceId)
      .neq('provider', 'meta') // este caminho envia por Z-API; a oficial não tem token
      .eq('is_active', true)
      .eq('status', 'connected')
      .single()
    instance = data as WhatsAppInstance | null
  } else {
    instance = await getActiveInstance(opts.ownerUserId, opts.profileType)
  }

  if (!instance) {
    return { messageId: '', status: 'error', error: 'no_active_instance' }
  }

  // A Z-API exige o número com DDI. Antes daqui só se removiam os símbolos, e
  // um contato salvo como "(19) 98916-6343" saía como 19989166343 — a API
  // devolve um messageId mesmo assim, e a mensagem nunca chega. Era o caso
  // clássico de "o painel diz enviado e o celular não recebe".
  const to = normalizarNumeroBrasil(opts.phone)
  if (!to) {
    return {
      messageId: '',
      status: 'error',
      error: `numero_invalido: ${opts.phone}`,
    }
  }

  let result: SendMessageResult
  if (opts.imageUrl) {
    result = await sendImageViaZApi(instance, to, opts.imageUrl, opts.message)
  } else if (opts.documentUrl) {
    result = await sendDocumentViaZApi(instance, to, opts.documentUrl, opts.message, opts.fileName || 'recibo.pdf')
  } else {
    result = await sendTextViaZApi(instance, to, opts.message)
  }

  const conversationId = await ensureConversation(instance.id, opts.ownerUserId, to, opts.contactName)
  await persistOutboundMessage(conversationId, opts.message, result.messageId || undefined)

  return result
}

