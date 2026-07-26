/**
 * aiReplyQueue — fila de respostas do agente de IA no WhatsApp.
 *
 * Uma linha por conversa. Cada mensagem nova (ou "digitando...") empurra o
 * due_at; quando ele vence, o worker responde UMA vez lendo todo o histórico.
 * É isso que dá o comportamento humano: espera, consolida e responde uma vez.
 *
 * Durabilidade: a fila vive no banco, então um restart não perde resposta —
 * o cron (/api/cron/whatsapp-ai) drena o que ficou para trás. O "kick" em
 * memória é só para não depender do cron no caminho feliz.
 */

import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateAgentReply } from '@/lib/aiReplyService'
import { markMessageAsRead, persistOutboundMessage, sendTextViaZApi } from '@/lib/whatsappSendService'
import {
  MAX_WAIT_MS,
  TYPING_POSTPONE_MS,
  preTypingSeconds,
  replyDelayMs,
  typingSecondsFor,
} from '@/lib/whatsappHumanizer'

const TABLE = 'whatsapp_ai_reply_queue'
/** linha travada há mais que isto = worker morreu no meio; volta para a fila */
const STALE_LOCK_MS = 120_000

// ── Entrada na fila ──────────────────────────────────────────────────────────

/**
 * Registra que a conversa tem mensagem a responder. Se já existia, apenas
 * adia (consolidação) — nunca cria uma segunda resposta pendente.
 */
export async function enqueueReply(input: {
  conversationId: string
  instanceId: string
  phone: string
  messageId?: string | null
}): Promise<void> {
  const now = Date.now()
  const dueAt = new Date(now + replyDelayMs())

  const { data: existing } = await supabaseAdmin
    .from(TABLE)
    .select('conversation_id, deadline_at, pending_count')
    .eq('conversation_id', input.conversationId)
    .maybeSingle()

  if (existing) {
    // respeita o teto: o due_at nunca passa do deadline da primeira mensagem
    const deadline = new Date(existing.deadline_at).getTime()
    await supabaseAdmin
      .from(TABLE)
      .update({
        due_at: new Date(Math.min(dueAt.getTime(), deadline)).toISOString(),
        last_message_id: input.messageId ?? null,
        pending_count: (existing.pending_count ?? 1) + 1,
        status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('conversation_id', input.conversationId)
    return
  }

  await supabaseAdmin.from(TABLE).insert({
    conversation_id: input.conversationId,
    instance_id: input.instanceId,
    phone: input.phone,
    due_at: dueAt.toISOString(),
    deadline_at: new Date(now + MAX_WAIT_MS).toISOString(),
    last_message_id: input.messageId ?? null,
    pending_count: 1,
    status: 'pending',
  })
}

/**
 * Contato está digitando: adia a resposta. Não cria linha — se não há nada
 * pendente, não há o que responder.
 */
export async function postponeForTyping(conversationId: string): Promise<void> {
  const { data: row } = await supabaseAdmin
    .from(TABLE)
    .select('deadline_at, status')
    .eq('conversation_id', conversationId)
    .maybeSingle()

  if (!row || row.status === 'processing') return

  const deadline = new Date(row.deadline_at).getTime()
  const next = Math.min(Date.now() + TYPING_POSTPONE_MS, deadline)

  await supabaseAdmin
    .from(TABLE)
    .update({ due_at: new Date(next).toISOString(), updated_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
}

// ── Processamento ────────────────────────────────────────────────────────────

interface QueueRow {
  conversation_id: string
  instance_id: string
  phone: string
  last_message_id: string | null
  attempts: number
}

/** Devolve para a fila o que travou (worker morto no meio do envio). */
async function releaseStale(): Promise<void> {
  await supabaseAdmin
    .from(TABLE)
    .update({ status: 'pending' })
    .eq('status', 'processing')
    .lt('locked_at', new Date(Date.now() - STALE_LOCK_MS).toISOString())
}

/**
 * Processa todas as conversas cujo tempo venceu. Retorna quantas responderam.
 * Nunca lança: é chamada de webhook e de cron, e nenhum dos dois pode quebrar.
 */
export async function processDueReplies(): Promise<number> {
  let handled = 0
  try {
    await releaseStale()

    const { data: due } = await supabaseAdmin
      .from(TABLE)
      .update({ status: 'processing', locked_at: new Date().toISOString() })
      .eq('status', 'pending')
      .lte('due_at', new Date().toISOString())
      .select('conversation_id, instance_id, phone, last_message_id, attempts')

    for (const row of (due ?? []) as QueueRow[]) {
      try {
        await replyToConversation(row)
        handled++
      } catch (err) {
        console.error('[aiReplyQueue] falha ao responder', row.conversation_id, err)
        // três tentativas e desiste — melhor não responder do que responder 10x
        const attempts = (row.attempts ?? 0) + 1
        if (attempts >= 3) {
          await supabaseAdmin.from(TABLE).delete().eq('conversation_id', row.conversation_id)
        } else {
          await supabaseAdmin
            .from(TABLE)
            .update({
              status: 'pending',
              attempts,
              due_at: new Date(Date.now() + 30_000).toISOString(),
            })
            .eq('conversation_id', row.conversation_id)
        }
      }
    }
  } catch (err) {
    console.error('[aiReplyQueue] processDueReplies', err)
  }
  return handled
}

async function replyToConversation(row: QueueRow): Promise<void> {
  const { data: instance } = await supabaseAdmin
    .from('whatsapp_instances')
    .select('id, instance_id, token, client_token, status')
    .eq('id', row.instance_id)
    .single()

  // instância caiu: mantém na fila para a próxima passada do cron
  if (!instance || instance.status !== 'connected') {
    await supabaseAdmin
      .from(TABLE)
      .update({ status: 'pending', due_at: new Date(Date.now() + 60_000).toISOString() })
      .eq('conversation_id', row.conversation_id)
    return
  }

  // 1. lê a conversa antes de responder, como um atendente faria
  if (row.last_message_id && !row.last_message_id.startsWith('synthetic_')) {
    await markMessageAsRead(instance, row.phone, row.last_message_id)
  }

  // 2. gera a resposta com TODO o histórico (as mensagens acumuladas viram uma só)
  const reply = await generateAgentReply(row.conversation_id)

  // sem resposta (IA desligada na conversa, agente removido) — encerra o item
  if (!reply) {
    await supabaseAdmin.from(TABLE).delete().eq('conversation_id', row.conversation_id)
    return
  }

  // 3. envia com "digitando..." proporcional ao tamanho do texto
  const result = await sendTextViaZApi(instance, row.phone, reply, {
    delayTyping: typingSecondsFor(reply),
    delayMessage: preTypingSeconds(),
  })

  if (result.status === 'sent') {
    await persistOutboundMessage(row.conversation_id, reply, result.messageId || undefined)
    await supabaseAdmin
      .from('whatsapp_conversations')
      .update({ unread_count: 0 })
      .eq('id', row.conversation_id)
  }

  await supabaseAdmin.from(TABLE).delete().eq('conversation_id', row.conversation_id)
}

// ── Kick em memória ──────────────────────────────────────────────────────────

let kickTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Agenda uma drenagem daqui a `delayMs`. É só atalho: se o processo morrer, o
 * cron cobre. Um timer por processo basta — processDueReplies varre tudo.
 */
export function kickQueue(delayMs = 5_000): void {
  if (kickTimer) return
  kickTimer = setTimeout(() => {
    kickTimer = null
    void processDueReplies()
  }, Math.max(1_000, delayMs))
  // não segura o processo vivo por causa deste timer
  ;(kickTimer as unknown as { unref?: () => void }).unref?.()
}
