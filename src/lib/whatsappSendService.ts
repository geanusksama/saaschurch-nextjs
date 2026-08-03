/**
 * whatsappSendService — serviço server-side para envio de WhatsApp via Z-API.
 * Usado por: aniversariantes, recibo de dízimos, e qualquer outro módulo.
 * Nunca expõe credenciais Z-API ao cliente.
 */

import { supabaseAdmin } from '@/lib/supabase-admin'
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

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

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
// master: acesso irrestrito (retorna null, sentinela de "sem filtro").
// Mesma regra de acesso usada por GET /api/whatsapp/instances — mantenha sincronizado.
export async function getAccessibleInstanceIds(
  userId: string,
  profileType?: string
): Promise<Set<string> | null> {
  if (profileType === 'master') return null

  const [{ data: owned }, { data: links }] = await Promise.all([
    supabaseAdmin.from('whatsapp_instances').select('id').eq('owner_user_id', userId),
    supabaseAdmin.from('whatsapp_instance_users').select('instance_id').eq('user_id', userId),
  ])

  const ids = new Set<string>()
  for (const row of owned ?? []) ids.add(row.id)
  for (const row of links ?? []) ids.add(row.instance_id)
  return ids
}

// ── Respeita rate limit por instância (5 s) ───────────────────────────────────
async function enforceRateLimit(instanceId: string): Promise<void> {
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
  instance: Pick<WhatsAppInstance, 'instance_id' | 'token' | 'client_token'>,
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

  if (!res.ok) {
    const err = await res.text().catch(() => 'unknown')
    return { messageId: '', status: 'error', error: err }
  }

  const json = await res.json()
  return { messageId: json.messageId ?? json.id ?? '', status: 'sent' }
}

// ── Marca a mensagem do contato como lida (os dois tiques azuis) ─────────────
/**
 * POST /read-message da Z-API. Um atendente humano abre a conversa antes de
 * responder — sem isto o contato vê a resposta chegar com a mensagem dele ainda
 * "não lida". Nunca lança: falhar aqui não pode impedir a resposta.
 */
export async function markMessageAsRead(
  instance: Pick<WhatsAppInstance, 'instance_id' | 'token' | 'client_token'>,
  phone: string,
  messageId: string
): Promise<boolean> {
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
/**
 * Põe um telefone brasileiro no formato que a Z-API espera: 55 + DDD + número.
 *
 * Devolve string vazia quando o número não tem como estar certo — melhor
 * recusar e mostrar o erro do que disparar para um destino inexistente e
 * marcar como enviado.
 *
 * PREMISSA: todo contato é brasileiro. Um número estrangeiro digitado sem o
 * DDI é indistinguível de um nacional (+1 415 555 2671 vira 11 dígitos, e "14"
 * é um DDD válido). Números de fora precisam ser cadastrados com o DDI.
 *
 * Regras:
 *   13 dígitos (55 + DDD + 9)     → mantém
 *   12 dígitos (55 + DDD + 8)     → fixo mantém; celular antigo ganha o 9
 *   11 dígitos (DDD + 9)          → 55 + número
 *   10 dígitos (DDD + 8)          → 55 + número, mesma regra do 9º dígito
 *   qualquer outro tamanho        → recusa
 */
export function normalizarNumeroBrasil(bruto: string): string {
  let d = (bruto || '').replace(/\D/g, '')

  if (d.length === 10 || d.length === 11) d = '55' + d
  if (!d.startsWith('55') || (d.length !== 12 && d.length !== 13)) return ''

  if (d.length === 12) {
    const assinante = d.slice(4)          // depois de 55 + DDD
    // No Brasil, fixo começa com 2–5 e celular com 6–9. Um número de 8 dígitos
    // começando por 6–9 é celular no formato antigo, anterior ao nono dígito:
    // "(19) 82568-356" na verdade é (19) 9 8256-8356.
    if (/^[6-9]/.test(assinante)) {
      d = d.slice(0, 4) + '9' + assinante
    }
  }

  return d
}

export async function persistOutboundMessage(
  conversationId: string,
  content: string,
  zapiMessageId?: string
): Promise<void> {
  await supabaseAdmin.from('whatsapp_messages').insert({
    conversation_id: conversationId,
    content,
    type: 'text',
    direction: 'outbound',
    status: zapiMessageId ? 'sent' : 'failed',
    metadata: zapiMessageId ? { zapi_message_id: zapiMessageId } : {},
  })

  await supabaseAdmin
    .from('whatsapp_conversations')
    .update({ last_message: content, last_message_at: new Date().toISOString() })
    .eq('id', conversationId)
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
  instance: Pick<WhatsAppInstance, 'instance_id' | 'token' | 'client_token'>,
  to: string,
  documentUrl: string,
  caption: string,
  fileName: string
): Promise<SendMessageResult> {
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

  if (!res.ok) {
    const err = await res.text().catch(() => 'unknown')
    return { messageId: '', status: 'error', error: err }
  }

  const json = await res.json()
  return { messageId: json.messageId ?? json.id ?? '', status: 'sent' }
}

// ── Chama Z-API para enviar imagem ─────────────────────────────────────────────
export async function sendImageViaZApi(
  instance: Pick<WhatsAppInstance, 'instance_id' | 'token' | 'client_token'>,
  to: string,
  imageUrl: string,
  caption: string
): Promise<SendMessageResult> {
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

  if (!res.ok) {
    const err = await res.text().catch(() => 'unknown')
    return { messageId: '', status: 'error', error: err }
  }

  const json = await res.json()
  return { messageId: json.messageId ?? json.id ?? '', status: 'sent' }
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

