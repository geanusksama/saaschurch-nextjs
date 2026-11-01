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
 *
 * Interrupção: enquanto a resposta está sendo preparada (status
 * "processing"), mensagem nova ou "digitando..." só EMPURRAM o due_at para o
 * futuro. O worker confere isso antes de enviar (foiInterrompida): se mudou,
 * descarta o que gerou, devolve a linha para "pending" e a próxima passada
 * responde lendo tudo — inclusive o que chegou no meio.
 */

import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateAgentTurn } from '@/lib/aiReplyService'
import { registrarQueroSerMembro } from '@/lib/agenteQueroSerMembro'
import { publicBaseUrl } from '@/lib/publicUrl'
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
/** "lendo" depois de marcar como visto, antes de gerar a resposta */
const READING_PAUSE_MS = 2_500
/** conferência final antes de enviar */
const PRE_SEND_PAUSE_MS = 1_500

/**
 * "Digitando..." visível do agente: proporcional ao texto, mas curto (2..6 s).
 * É a única janela em que a pessoa pode voltar a escrever e a mensagem sai
 * mesmo assim — a Z-API não cancela um envio com delayTyping.
 */
function typingSecondsForAgent(text: string): number {
  return Math.max(2, Math.min(6, typingSecondsFor(text)))
}

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
    .select('conversation_id, deadline_at, pending_count, status')
    .eq('conversation_id', input.conversationId)
    .maybeSingle()

  // Resposta em preparo: só empurra o due_at (o worker vê, descarta e devolve
  // para "pending"). Trocar o status aqui deixaria outro worker pegar a mesma
  // conversa, e o delete do fim apagaria esta mensagem sem resposta.
  if (existing?.status === 'processing') {
    await supabaseAdmin
      .from(TABLE)
      .update({
        due_at: dueAt.toISOString(),
        deadline_at: new Date(now + MAX_WAIT_MS).toISOString(),
        last_message_id: input.messageId ?? null,
        pending_count: (existing.pending_count ?? 1) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('conversation_id', input.conversationId)
    return
  }

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

  if (!row) return

  // Em preparo: a pessoa voltou a digitar — o worker vê o due_at no futuro e
  // não envia. Fora de preparo: adia respeitando o teto da primeira mensagem.
  const deadline = new Date(row.deadline_at).getTime()
  const next = row.status === 'processing'
    ? Date.now() + TYPING_POSTPONE_MS
    : Math.min(Date.now() + TYPING_POSTPONE_MS, deadline)

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
  locked_at: string
}

/** Pausa que acorda a cada segundo para ver se a pessoa voltou a escrever. */
async function esperarSemInterrupcao(conversationId: string, lockedAt: string, ms: number): Promise<boolean> {
  const fim = Date.now() + ms
  while (Date.now() < fim) {
    await new Promise(r => setTimeout(r, Math.min(1_000, fim - Date.now())))
    if (await foiInterrompida(conversationId, lockedAt)) return false
  }
  return true
}

/**
 * A pessoa mandou mensagem ou digitou depois que pegamos a conversa?
 * (enqueueReply/postponeForTyping empurram o due_at para depois do locked_at)
 */
async function foiInterrompida(conversationId: string, lockedAt: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from(TABLE)
    .select('due_at')
    .eq('conversation_id', conversationId)
    .maybeSingle()
  if (!data) return false
  return new Date(data.due_at).getTime() > new Date(lockedAt).getTime()
}

/** Desiste desta resposta: a linha volta para a fila com o due_at já empurrado. */
async function devolverParaFila(conversationId: string): Promise<void> {
  await supabaseAdmin.from(TABLE).update({ status: 'pending' }).eq('conversation_id', conversationId)
}

/** Fecha o item — só se nada novo chegou no meio (senão devolve para a fila). */
async function encerrarItem(conversationId: string, lockedAt: string): Promise<void> {
  if (await foiInterrompida(conversationId, lockedAt)) {
    await devolverParaFila(conversationId)
    return
  }
  await supabaseAdmin
    .from(TABLE)
    .delete()
    .eq('conversation_id', conversationId)
    .lte('due_at', lockedAt)
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
      .select('conversation_id, instance_id, phone, last_message_id, attempts, locked_at')

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

  const lockedAt = row.locked_at

  // 1. marca como visto, como um atendente que abre a conversa
  if (row.last_message_id && !row.last_message_id.startsWith('synthetic_')) {
    await markMessageAsRead(instance, row.phone, row.last_message_id)
  }

  // 2. "lendo": pausa curta; se a pessoa voltar a escrever, para aqui
  if (!(await esperarSemInterrupcao(row.conversation_id, lockedAt, READING_PAUSE_MS))) {
    await devolverParaFila(row.conversation_id)
    return
  }

  // 3. gera a resposta com TODO o histórico (as mensagens acumuladas viram uma só)
  const turn = await generateAgentTurn(row.conversation_id)
  const reply = turn?.texto ?? null

  // sem resposta (IA desligada na conversa, agente removido) — encerra o item
  if (!turn || !reply) {
    await encerrarItem(row.conversation_id, lockedAt)
    return
  }

  // 4. chegou algo enquanto a IA pensava? descarta e responde depois, a tudo
  if (await foiInterrompida(row.conversation_id, lockedAt)) {
    await devolverParaFila(row.conversation_id)
    return
  }

  // 5. última conferência logo antes de enviar. A Z-API não tem como mostrar
  //    "digitando..." sem enviar (o delayTyping vai junto da mensagem e não
  //    dá para cancelar), então daqui em diante a mensagem sai — por isso o
  //    "digitando" visível é curto (typingSecondsForAgent).
  if (!(await esperarSemInterrupcao(row.conversation_id, lockedAt, PRE_SEND_PAUSE_MS))) {
    await devolverParaFila(row.conversation_id)
    return
  }

  const result = await sendTextViaZApi(instance, row.phone, reply, {
    delayTyping: typingSecondsForAgent(reply),
  })

  if (result.status === 'sent') {
    await persistOutboundMessage(row.conversation_id, reply, result.messageId || undefined)
    await supabaseAdmin
      .from('whatsapp_conversations')
      .update({ unread_count: 0 })
      .eq('id', row.conversation_id)

    // 4. memória do atendimento (recepção): volta para o agente na próxima resposta
    if (turn.estado) {
      const { data: c } = await supabaseAdmin
        .from('whatsapp_conversations')
        .select('metadata')
        .eq('id', row.conversation_id)
        .single()
      await supabaseAdmin
        .from('whatsapp_conversations')
        .update({ metadata: { ...((c?.metadata ?? {}) as Record<string, unknown>), recepcao_estado: turn.estado } })
        .eq('id', row.conversation_id)
    }

    // 5. agente de recepção pediu o registro "Quero ser Membro" — DEPOIS da
    //    resposta, para a confirmação (enviada pela rota) chegar em seguida
    if (turn.queroSerMembro) {
      await registrarPedidoDaConversa(instance, row, turn)
    }
  }

  await encerrarItem(row.conversation_id, lockedAt)
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

// ── "Quero ser Membro" pelo agente ────────────────────────────────────────────

async function registrarPedidoDaConversa(
  instance: { id: string; instance_id: string; token: string; client_token: string; status: string },
  row: QueueRow,
  turn: NonNullable<Awaited<ReturnType<typeof generateAgentTurn>>>,
): Promise<void> {
  let aviso: string | null = null
  try {
    const r = await registrarQueroSerMembro({
      dados: turn.queroSerMembro!,
      telefone: turn.telefone,
      campoId: turn.agentCampoId,
      conversationId: row.conversation_id,
    })

    // marca a conversa: o agente não gera o bloco de novo (ver contextoRecepcao)
    const { data: conv } = await supabaseAdmin
      .from('whatsapp_conversations')
      .select('metadata')
      .eq('id', row.conversation_id)
      .single()
    const meta = (conv?.metadata ?? {}) as Record<string, unknown>
    if (r.ok || r.duplicado) {
      await supabaseAdmin
        .from('whatsapp_conversations')
        .update({
          metadata: {
            ...meta,
            quero_ser_membro: r.ok
              ? { attendanceId: r.attendanceId, modo: r.modo, em: new Date().toISOString() }
              : { attendanceId: 'existente', duplicado: true, em: new Date().toISOString() },
          },
        })
        .eq('id', row.conversation_id)
    }

    // como na home: além da confirmação (que a rota manda, com a ficha), a
    // pessoa recebe o link para acompanhar o histórico do pedido
    if (r.ok) {
      aviso = `Para acompanhar o andamento do seu pedido, é por aqui:\n${publicBaseUrl()}/pastoral/timeline/${r.attendanceId}`
    }

    if (!r.ok) {
      console.error('[aiReplyQueue] Quero ser Membro não registrado', r.erro)
      aviso = r.duplicado
        ? r.erro + (r.attendanceId ? `\n\nPara acompanhar o andamento, é por aqui:\n${publicBaseUrl()}/pastoral/timeline/${r.attendanceId}` : '')
        : 'Não consegui concluir o seu registro automaticamente agora, mas já avisei a equipe pastoral, ' +
          'que vai finalizar com você por aqui. Deus abençoe.'
    }
  } catch (err) {
    console.error('[aiReplyQueue] Quero ser Membro falhou', err)
    aviso = 'Não consegui concluir o seu registro automaticamente agora, mas já avisei a equipe pastoral, ' +
      'que vai finalizar com você por aqui. Deus abençoe.'
  }

  if (aviso) {
    const res = await sendTextViaZApi(instance, row.phone, aviso, {
      delayTyping: typingSecondsFor(aviso),
      delayMessage: preTypingSeconds(),
    })
    if (res.status === 'sent') await persistOutboundMessage(row.conversation_id, aviso, res.messageId || undefined)
  }
}

