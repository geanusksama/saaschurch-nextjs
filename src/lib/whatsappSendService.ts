/**
 * whatsappSendService — serviço server-side para envio de WhatsApp via Z-API.
 * Usado por: aniversariantes, recibo de dízimos, e qualquer outro módulo.
 * Nunca expõe credenciais Z-API ao cliente.
 */

import { supabaseAdmin } from '@/lib/supabase-admin'
import type { SendMessagePayload, SendMessageResult, WhatsAppInstance } from '@/types/whatsapp'

const ZAPI_BASE = 'https://api.z-api.io'
const RATE_LIMIT_MS = 5000 // NUNCA reduzir — risco de ban do número

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
  message: string
): Promise<SendMessageResult> {
  await enforceRateLimit(instance.instance_id)

  const url = `${ZAPI_BASE}/instances/${instance.instance_id}/token/${instance.token}/send-text`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Token': instance.client_token,
    },
    body: JSON.stringify({ phone: to, message }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => 'unknown')
    return { messageId: '', status: 'error', error: err }
  }

  const json = await res.json()
  return { messageId: json.messageId ?? json.id ?? '', status: 'sent' }
}

// ── Salva mensagem outbound no banco ──────────────────────────────────────────
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

// ── Função de alto nível: enviar mensagem de qualquer módulo ──────────────────
export interface QuickSendOptions {
  ownerUserId: string
  profileType?: string   // 'master' permite usar qualquer instância do sistema
  phone: string
  message: string
  contactName?: string
}

export async function quickSendWhatsApp(opts: QuickSendOptions): Promise<SendMessageResult> {
  const instance = await getActiveInstance(opts.ownerUserId, opts.profileType)
  if (!instance) {
    return { messageId: '', status: 'error', error: 'no_active_instance' }
  }

  const to = opts.phone.replace(/\D/g, '')
  const result = await sendTextViaZApi(instance, to, opts.message)

  const conversationId = await ensureConversation(instance.id, opts.ownerUserId, to, opts.contactName)
  await persistOutboundMessage(conversationId, opts.message, result.messageId || undefined)

  return result
}
