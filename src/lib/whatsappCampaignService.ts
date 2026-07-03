/**
 * whatsappCampaignService — envio de WhatsApp em massa (campanhas).
 *
 * Orquestração por escalonador de cooldown: a cada tick é enviada NO MÁXIMO
 * 1 mensagem, pela instância marcada que está livre há mais tempo (cooldown
 * de 5 s por instância — NUNCA reduzir, risco de ban do número). Enquanto uma
 * instância esfria, as outras são usadas.
 *
 * Spec: docs/modules/whatsapp-mass-send/SPEC.md
 */

import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  sendTextViaZApi,
  sendImageViaZApi,
  ensureConversation,
  persistOutboundMessage,
} from '@/lib/whatsappSendService'
import type { WhatsAppInstance } from '@/types/whatsapp'

const RATE_LIMIT_MS = 5000 // mínimo absoluto — NUNCA reduzir, risco de ban do número

/** Cooldown efetivo por instância: interval_seconds da campanha, nunca abaixo de 5 s. */
function campaignCooldownMs(intervalSeconds: number | null | undefined): number {
  return Math.max(RATE_LIMIT_MS, (Number(intervalSeconds) || 5) * 1000)
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type CampaignStatus = 'draft' | 'running' | 'paused' | 'completed' | 'cancelled'
export type RecipientStatus = 'pending' | 'sending' | 'sent' | 'error' | 'cancelled'

export interface CampaignRecipientInput {
  source: 'member' | 'pipeline'
  sourceId: string
  name: string | null
  phone: string
  variables: Record<string, string>
}

export interface CampaignProgress {
  campaignId: string
  status: CampaignStatus
  total: number
  sent: number
  errors: number
  pending: number
  /** cooldown configurado (s) — mínimo 5 */
  intervalSeconds: number
  startedAt: string | null
  finishedAt: string | null
  /** estimativa de segundos restantes: pendentes × cooldown ÷ instâncias conectadas */
  etaSeconds: number | null
  perInstance: Array<{
    instanceId: string
    name: string
    sent: number
    errors: number
    connected: boolean
    cooldownMs: number
  }>
}

export interface TickResult {
  progress: CampaignProgress
  /** evento deste tick (null se nenhuma instância estava livre) */
  event: {
    recipientId: string
    name: string | null
    phone: string
    status: 'sent' | 'error'
    error?: string
    instanceName: string
    at: string
  } | null
  /** sugestão de espera até o próximo tick */
  waitMs: number
  done: boolean
}

// ── Template ──────────────────────────────────────────────────────────────────

/** Substitui {{variavel}} pelos valores do destinatário; desconhecida → ''. */
export function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => variables[key] ?? '')
}

// ── Progresso ─────────────────────────────────────────────────────────────────

async function countRecipients(campaignId: string, status?: RecipientStatus): Promise<number> {
  let q = supabaseAdmin
    .from('whatsapp_campaign_recipients')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
  if (status) q = q.eq('status', status)
  const { count } = await q
  return count ?? 0
}

async function loadCampaignInstances(campaignId: string) {
  const { data } = await supabaseAdmin
    .from('whatsapp_campaign_instances')
    .select('instance_id, whatsapp_instances(*)')
    .eq('campaign_id', campaignId)
  return (data ?? [])
    .map(row => row.whatsapp_instances as unknown as WhatsAppInstance | null)
    .filter((i): i is WhatsAppInstance => !!i)
}

export async function getCampaignProgress(campaignId: string): Promise<CampaignProgress> {
  const { data: campaign } = await supabaseAdmin
    .from('whatsapp_campaigns')
    .select('id, status, total_recipients, interval_seconds, started_at, finished_at')
    .eq('id', campaignId)
    .single()

  const [sent, errors, pending, instances] = await Promise.all([
    countRecipients(campaignId, 'sent'),
    countRecipients(campaignId, 'error'),
    countRecipients(campaignId, 'pending'),
    loadCampaignInstances(campaignId),
  ])

  const cooldownMs = campaignCooldownMs(campaign?.interval_seconds)

  // contagem por instância (a partir dos recipients — fonte da verdade)
  const { data: perInstanceRows } = await supabaseAdmin
    .from('whatsapp_campaign_recipients')
    .select('instance_id, status')
    .eq('campaign_id', campaignId)
    .in('status', ['sent', 'error'])
    .not('instance_id', 'is', null)

  const rateLimits = await loadRateLimits(instances)

  const perInstance = instances.map(inst => {
    const rows = (perInstanceRows ?? []).filter(r => r.instance_id === inst.id)
    return {
      instanceId: inst.id,
      name: inst.name,
      sent: rows.filter(r => r.status === 'sent').length,
      errors: rows.filter(r => r.status === 'error').length,
      connected: inst.status === 'connected',
      cooldownMs: cooldownRemaining(inst, rateLimits, cooldownMs),
    }
  })

  const activeCount = perInstance.filter(pi => pi.connected).length

  return {
    campaignId,
    status: (campaign?.status ?? 'draft') as CampaignStatus,
    total: campaign?.total_recipients ?? 0,
    sent,
    errors,
    pending,
    intervalSeconds: Math.round(cooldownMs / 1000),
    startedAt: campaign?.started_at ?? null,
    finishedAt: campaign?.finished_at ?? null,
    etaSeconds: activeCount > 0 ? Math.ceil((pending * cooldownMs) / 1000 / activeCount) : null,
    perInstance,
  }
}

// ── Escalonador de instâncias (cooldown de 5 s) ──────────────────────────────

async function loadRateLimits(instances: WhatsAppInstance[]): Promise<Map<string, number>> {
  // whatsapp_instance_rate_limit é indexado pelo instance_id da Z-API (texto)
  const ids = instances.map(i => i.instance_id)
  const map = new Map<string, number>()
  if (!ids.length) return map
  const { data } = await supabaseAdmin
    .from('whatsapp_instance_rate_limit')
    .select('instance_id, last_sent_at')
    .in('instance_id', ids)
  for (const row of data ?? []) {
    map.set(row.instance_id, new Date(row.last_sent_at).getTime())
  }
  return map
}

function cooldownRemaining(
  instance: WhatsAppInstance,
  rateLimits: Map<string, number>,
  cooldownMs: number
): number {
  const lastSent = rateLimits.get(instance.instance_id)
  if (!lastSent) return 0
  return Math.max(0, cooldownMs - (Date.now() - lastSent))
}

/**
 * Escolhe a instância conectada cujo cooldown já expirou, priorizando a que
 * está livre há mais tempo. Retorna também quanto falta caso nenhuma esteja livre.
 */
function pickInstance(
  instances: WhatsAppInstance[],
  rateLimits: Map<string, number>,
  cooldownMs: number
): { instance: WhatsAppInstance | null; waitMs: number } {
  const connected = instances.filter(i => i.status === 'connected' && i.is_active)
  if (!connected.length) return { instance: null, waitMs: cooldownMs }

  let best: WhatsAppInstance | null = null
  let bestLastSent = Infinity
  let minWait = cooldownMs

  for (const inst of connected) {
    const remaining = cooldownRemaining(inst, rateLimits, cooldownMs)
    if (remaining <= 0) {
      const lastSent = rateLimits.get(inst.instance_id) ?? 0
      if (lastSent < bestLastSent) {
        bestLastSent = lastSent
        best = inst
      }
    } else if (remaining < minWait) {
      minWait = remaining
    }
  }

  return best ? { instance: best, waitMs: 0 } : { instance: null, waitMs: minWait }
}

// ── Tick de envio ─────────────────────────────────────────────────────────────

export async function processCampaignTick(campaignId: string): Promise<TickResult> {
  const { data: campaign } = await supabaseAdmin
    .from('whatsapp_campaigns')
    .select('*')
    .eq('id', campaignId)
    .single()

  if (!campaign || campaign.status !== 'running') {
    const progress = await getCampaignProgress(campaignId)
    return { progress, event: null, waitMs: 0, done: true }
  }

  const cooldownMs = campaignCooldownMs(campaign.interval_seconds)
  const instances = await loadCampaignInstances(campaignId)
  const rateLimits = await loadRateLimits(instances)
  const { instance, waitMs } = pickInstance(instances, rateLimits, cooldownMs)

  if (!instance) {
    const progress = await getCampaignProgress(campaignId)
    return { progress, event: null, waitMs: Math.max(waitMs, 300), done: false }
  }

  // Próximo pendente (mais antigo). Guard de status evita envio duplicado se
  // dois ticks concorrerem: só processa se conseguiu marcar pending → sending.
  const { data: next } = await supabaseAdmin
    .from('whatsapp_campaign_recipients')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!next) {
    await supabaseAdmin
      .from('whatsapp_campaigns')
      .update({ status: 'completed', finished_at: new Date().toISOString() })
      .eq('id', campaignId)
      .eq('status', 'running')
    const progress = await getCampaignProgress(campaignId)
    return { progress, event: null, waitMs: 0, done: true }
  }

  const { data: claimed } = await supabaseAdmin
    .from('whatsapp_campaign_recipients')
    .update({ status: 'sending', instance_id: instance.id })
    .eq('id', next.id)
    .eq('status', 'pending')
    .select('id')

  if (!claimed?.length) {
    // outro tick pegou este destinatário — tenta de novo em seguida
    const progress = await getCampaignProgress(campaignId)
    return { progress, event: null, waitMs: 300, done: false }
  }

  const phone = String(next.phone).replace(/\D/g, '')
  let message = renderTemplate(campaign.message_template, next.variables ?? {})
  // link (ex.: vídeo) anexado ao final da mensagem
  if (campaign.link_url) message = `${message}\n\n${campaign.link_url}`

  let sendStatus: 'sent' | 'error' = 'sent'
  let sendError: string | undefined

  try {
    // imagem em anexo: mensagem vira a legenda
    const result = campaign.image_url
      ? await sendImageViaZApi(instance, phone, campaign.image_url, message)
      : await sendTextViaZApi(instance, phone, message)
    if (result.status === 'error') {
      sendStatus = 'error'
      sendError = result.error || 'erro desconhecido'
    } else {
      // histórico na Caixa de Entrada + atribuição do agente responsável
      const conversationId = await ensureConversation(
        instance.id,
        campaign.owner_user_id,
        phone,
        next.name ?? undefined
      )
      await persistOutboundMessage(conversationId, message, result.messageId || undefined)
      if (next.agent_user_id) {
        await supabaseAdmin
          .from('whatsapp_conversations')
          .update({ assigned_to: next.agent_user_id })
          .eq('id', conversationId)
      }
    }
  } catch (err) {
    sendStatus = 'error'
    sendError = err instanceof Error ? err.message : 'falha no envio'
  }

  const now = new Date().toISOString()
  await supabaseAdmin
    .from('whatsapp_campaign_recipients')
    .update({
      status: sendStatus,
      error_message: sendError ?? null,
      sent_at: sendStatus === 'sent' ? now : null,
    })
    .eq('id', next.id)

  const progress = await getCampaignProgress(campaignId)

  // mantém contadores da campanha atualizados (conveniência para listagem)
  const updates: Record<string, unknown> = {
    sent_count: progress.sent,
    error_count: progress.errors,
  }
  if (progress.pending === 0) {
    updates.status = 'completed'
    updates.finished_at = now
    progress.status = 'completed'
  }
  await supabaseAdmin.from('whatsapp_campaigns').update(updates).eq('id', campaignId)

  return {
    progress,
    event: {
      recipientId: next.id,
      name: next.name,
      phone,
      status: sendStatus,
      error: sendError,
      instanceName: instance.name,
      at: now,
    },
    // após um envio, a instância usada entra em cooldown; se houver outras
    // livres o próximo tick pode ser imediato — o cliente decide pelo waitMs
    waitMs: progress.pending > 0 ? nextWaitMs(instances, rateLimits, instance, cooldownMs) : 0,
    done: progress.pending === 0,
  }
}

function nextWaitMs(
  instances: WhatsAppInstance[],
  rateLimits: Map<string, number>,
  justUsed: WhatsAppInstance,
  cooldownMs: number
): number {
  // a instância recém-usada acabou de zerar o cooldown dela
  rateLimits.set(justUsed.instance_id, Date.now())
  const { instance, waitMs } = pickInstance(instances, rateLimits, cooldownMs)
  return instance ? 300 : Math.max(waitMs, 300)
}

// ── Distribuição de agentes (round-robin na criação) ─────────────────────────

export function assignAgentsRoundRobin<T extends { agent_user_id?: string | null }>(
  recipients: T[],
  agentUserIds: string[]
): T[] {
  if (!agentUserIds.length) return recipients
  return recipients.map((r, i) => ({
    ...r,
    agent_user_id: agentUserIds[i % agentUserIds.length],
  }))
}
