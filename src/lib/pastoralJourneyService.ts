/**
 * pastoralJourneyService — Cronograma de Acompanhamento (server-side).
 *
 * Três responsabilidades:
 *  1. calcular a data de cada etapa a partir do dia do acolhimento
 *     (sempre relativo, nunca no calendário do mês — regra do documento);
 *  2. materializar a agenda inteira da pessoa em pastoral_journey_sends
 *     quando ela é anexada ao cronograma;
 *  3. drenar essa fila com ritmo controlado, distribuindo entre as instâncias
 *     escolhidas — é o que o cron /api/cron/pastoral-cronograma chama.
 *
 * O cooldown de 5 s por instância é o mesmo do envio em massa e NUNCA pode ser
 * reduzido: é o que evita o banimento do número.
 *
 * Matriz padrão: src/lib/pastoralJourneyDefault.ts
 */

import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  sendTextViaZApi,
  sendImageViaZApi,
  ensureConversation,
  persistOutboundMessage,
} from '@/lib/whatsappSendService'
import {
  DEFAULT_JOURNEY_STEPS,
  JOURNEY_PROFILES,
  JOURNEY_PROFILE_LABELS,
  WEEKDAY_LABELS,
  type JourneyProfile,
} from '@/lib/pastoralJourneyDefault'
import { adjustDayReference } from '@/lib/pastoralJourneyDayRef'
import { generateAiText } from '@/lib/aiReplyService'
import { prisma } from '@/lib/prisma'
import type { WhatsAppInstance } from '@/types/whatsapp'

const RATE_LIMIT_MS = 5000 // mínimo absoluto por instância — NUNCA reduzir

/**
 * Simulação: monta e grava tudo, mas NÃO chama a Z-API. Existe para o teste
 * ponta a ponta rodar sem mandar mensagem para número de verdade.
 * Desligado por padrão — só liga com PASTORAL_JOURNEY_DRY_RUN=1 no ambiente.
 */
const DRY_RUN = process.env.PASTORAL_JOURNEY_DRY_RUN === '1'
/** Fuso de Brasília. Sem horário de verão desde 2019, offset fixo. */
const BRT_OFFSET_MIN = -180

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface JourneyStepRow {
  id: string
  journey_id: string
  position: number
  code: string | null
  moment_label: string
  channel: string
  program_label: string | null
  week_number: number
  weekday: number | null
  min_offset_days: number
  send_time: string
  is_active: boolean
}

export interface JourneyRow {
  id: string
  church_id: string
  name: string
  description: string | null
  is_active: boolean
  interval_seconds: number
  window_start: string
  window_end: string
  daily_limit_per_instance: number
  owner_user_id: string | null
  /** varredura automática da coluna do kanban */
  auto_enroll: boolean
  auto_enroll_column_key: string
  /** card concluído/cancelado encerra o acompanhamento */
  stop_on_done: boolean
  /** teto de mensagens por PESSOA por dia (0 = sem teto) */
  max_per_person_per_day: number
  /** reescrita por IA antes do envio */
  ai_polish: boolean
  ai_agent_id: string | null
  /** fechamento do ciclo ao sair a última mensagem do mês */
  issue_certificate: boolean
  complete_card_on_finish: boolean
  certificate_message: string | null
}

export interface TickSummary {
  sent: number
  errors: number
  skipped: number
  /** adiados pelo teto de mensagens por pessoa no dia */
  deferred: number
  /** jornadas encerradas com certificado emitido neste tick */
  certificates: number
  pending: number
  durationMs: number
  events: Array<{ phone: string; name: string | null; status: 'sent' | 'error'; instance: string; error?: string }>
}

// ── Datas (tudo em horário de Brasília) ──────────────────────────────────────

function toBrtParts(value: string | Date): { y: number; m: number; d: number } {
  const date = value instanceof Date ? value : new Date(value)
  const shifted = new Date(date.getTime() + BRT_OFFSET_MIN * 60_000)
  return { y: shifted.getUTCFullYear(), m: shifted.getUTCMonth(), d: shifted.getUTCDate() }
}

/** Instante UTC correspondente a uma data/hora de parede em Brasília. */
function brtWallClockToUtc(y: number, m: number, d: number, time: string): Date {
  const [hh = '9', mm = '0'] = String(time || '09:00').split(':')
  return new Date(Date.UTC(y, m, d, Number(hh), Number(mm)) - BRT_OFFSET_MIN * 60_000)
}

/** Minutos desde a meia-noite, em Brasília, de um instante qualquer. */
function brtMinutesOfDay(date: Date): number {
  const shifted = new Date(date.getTime() + BRT_OFFSET_MIN * 60_000)
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes()
}

function timeToMinutes(time: string): number {
  const [hh = '0', mm = '0'] = String(time || '00:00').split(':')
  return Number(hh) * 60 + Number(mm)
}

/**
 * Data/hora de envio de uma etapa para quem foi acolhido em `enrolledAt`.
 *
 * base = acolhimento + (semana − 1) × 7 + dias mínimos
 * sem dia da semana → a própria base;
 * com dia da semana → a primeira ocorrência desse dia a partir da base.
 */
export function computeScheduledAt(
  enrolledAt: string | Date,
  step: Pick<JourneyStepRow, 'week_number' | 'weekday' | 'min_offset_days' | 'send_time'>
): Date {
  const { y, m, d } = toBrtParts(enrolledAt)
  const offset = (Math.max(1, step.week_number || 1) - 1) * 7 + (step.min_offset_days || 0)

  // aritmética de calendário via UTC puro (sem fuso) para não pular dias
  const base = new Date(Date.UTC(y, m, d + offset))

  if (step.weekday !== null && step.weekday !== undefined) {
    const target = ((step.weekday % 7) + 7) % 7
    const diff = (target - base.getUTCDay() + 7) % 7
    base.setUTCDate(base.getUTCDate() + diff)
  }

  return brtWallClockToUtc(
    base.getUTCFullYear(),
    base.getUTCMonth(),
    base.getUTCDate(),
    step.send_time
  )
}

// ── Criação da matriz padrão ─────────────────────────────────────────────────

/** Popula um cronograma recém-criado com as 13 etapas × 3 perfis do documento. */
export async function seedJourneySteps(journeyId: string): Promise<void> {
  for (const [index, step] of DEFAULT_JOURNEY_STEPS.entries()) {
    const { data: created, error } = await supabaseAdmin
      .from('pastoral_journey_steps')
      .insert({
        journey_id: journeyId,
        position: index,
        code: step.code,
        moment_label: step.momentLabel,
        channel: step.channel,
        program_label: step.programLabel,
        week_number: step.weekNumber,
        weekday: step.weekday,
        min_offset_days: step.minOffsetDays,
        send_time: step.sendTime,
        is_active: true,
      })
      .select('id')
      .single()

    if (error || !created) throw error ?? new Error('Falha ao criar etapa do cronograma')

    await supabaseAdmin.from('pastoral_journey_messages').insert(
      JOURNEY_PROFILES.map(profile => ({
        step_id: created.id,
        profile,
        message: step.messages[profile],
        is_active: true,
      }))
    )
  }
}

// ── Materialização da agenda de uma pessoa ───────────────────────────────────

interface MaterializeInput {
  enrollmentId: string
  journeyId: string
  churchId: string
  attendanceId: string | null
  profile: JourneyProfile
  name: string | null
  phone: string
  enrolledAt: string
  /** dispara a primeira etapa agora, em vez de esperar a data calculada */
  sendFirstNow: boolean
}

/**
 * Cria as linhas pendentes de pastoral_journey_sends. Já existentes (mesmo
 * enrollment + etapa) são ignoradas — a função é segura para reexecutar.
 */
export async function materializeEnrollmentSends(input: MaterializeInput): Promise<number> {
  const { data: steps } = await supabaseAdmin
    .from('pastoral_journey_steps')
    .select('*')
    .eq('journey_id', input.journeyId)
    .eq('is_active', true)
    .order('position', { ascending: true })

  if (!steps?.length) return 0

  const { data: messages } = await supabaseAdmin
    .from('pastoral_journey_messages')
    .select('step_id, profile, message, image_url, link_url, youtube_url, instagram_url, is_active')
    .in('step_id', steps.map(s => s.id))
    .eq('profile', input.profile)

  const msgByStep = new Map((messages ?? []).map(m => [m.step_id, m]))

  const { data: existing } = await supabaseAdmin
    .from('pastoral_journey_sends')
    .select('step_id')
    .eq('enrollment_id', input.enrollmentId)
  const alreadyThere = new Set((existing ?? []).map(r => r.step_id))

  // etapas que de fato geram mensagem para este perfil — é sobre elas que a
  // numeração do histórico ("mensagem 2 de 13") é calculada
  const applicable = (steps as JourneyStepRow[]).filter(step => {
    const msg = msgByStep.get(step.id)
    return !!msg && msg.is_active !== false && !!String(msg.message ?? '').trim()
  })
  const totalSteps = applicable.length

  const rows: Record<string, unknown>[] = []
  let firstPending = true
  // A jornada precisa tocar NA ORDEM. Sem isto, quem é acolhido numa terça
  // recebe "amanhã tem culto de ensino" (semana 1, terça = hoje) ANTES do
  // "seja bem-vindo" (D+1 = amanhã). Cada etapa é ancorada em, no mínimo, a
  // data da anterior; se as duas caem no mesmo dia, o teto por pessoa segura a
  // segunda (ou a IA funde as duas numa mensagem só).
  let floor = 0

  for (const [index, step] of applicable.entries()) {
    const msg = msgByStep.get(step.id)!

    const computed = computeScheduledAt(input.enrolledAt, step)
    const scheduled = new Date(Math.max(computed.getTime(), floor))
    floor = scheduled.getTime()

    if (alreadyThere.has(step.id)) continue

    const useNow = input.sendFirstNow && firstPending
    firstPending = false

    rows.push({
      sequence: index + 1,
      total_steps: totalSteps,
      enrollment_id: input.enrollmentId,
      step_id: step.id,
      journey_id: input.journeyId,
      church_id: input.churchId,
      attendance_id: input.attendanceId,
      profile: input.profile,
      name: input.name,
      phone: input.phone,
      message: msg.message,
      link_url: msg.link_url ?? null,
      image_url: msg.image_url ?? null,
      youtube_url: msg.youtube_url ?? null,
      instagram_url: msg.instagram_url ?? null,
      scheduled_at: (useNow ? new Date() : scheduled).toISOString(),
      status: 'pending',
    })
  }

  if (!rows.length) return 0
  const { error } = await supabaseAdmin.from('pastoral_journey_sends').insert(rows)
  if (error) throw error
  return rows.length
}

export interface EnrollInput {
  journeyId: string
  churchId: string
  attendanceId: string | null
  profile: JourneyProfile
  name: string | null
  phone: string
  enrolledAt?: string
  sendFirstNow?: boolean
  ownerUserId?: string | null
  createdBy?: string | null
}

export interface EnrollResult {
  enrollmentId: string
  scheduled: number
  reused: boolean
}

/** Anexa uma pessoa ao cronograma e agenda toda a jornada dela. */
export async function enrollInJourney(input: EnrollInput): Promise<EnrollResult> {
  const phone = String(input.phone ?? '').replace(/\D/g, '')
  if (phone.length < 10) throw new Error('Telefone inválido para o cronograma')

  const enrolledAt = input.enrolledAt ?? new Date().toISOString()

  // já anexado a este cronograma? reaproveita e só completa o que faltar
  let enrollmentId: string | null = null
  let reused = false
  if (input.attendanceId) {
    const { data: found } = await supabaseAdmin
      .from('pastoral_journey_enrollments')
      .select('id')
      .eq('journey_id', input.journeyId)
      .eq('attendance_id', input.attendanceId)
      .maybeSingle()
    if (found) {
      enrollmentId = found.id
      reused = true
      await supabaseAdmin
        .from('pastoral_journey_enrollments')
        .update({ status: 'active', profile: input.profile, phone, updated_at: new Date().toISOString() })
        .eq('id', found.id)
    }
  }

  if (!enrollmentId) {
    const { data: created, error } = await supabaseAdmin
      .from('pastoral_journey_enrollments')
      .insert({
        journey_id: input.journeyId,
        church_id: input.churchId,
        attendance_id: input.attendanceId,
        profile: input.profile,
        name: input.name,
        phone,
        enrolled_at: enrolledAt,
        status: 'active',
        owner_user_id: input.ownerUserId ?? null,
        created_by: input.createdBy ?? null,
      })
      .select('id')
      .single()
    if (error || !created) throw error ?? new Error('Falha ao anexar o cronograma')
    enrollmentId = created.id
  }

  const scheduled = await materializeEnrollmentSends({
    enrollmentId: enrollmentId!,
    journeyId: input.journeyId,
    churchId: input.churchId,
    attendanceId: input.attendanceId,
    profile: input.profile,
    name: input.name,
    phone,
    enrolledAt,
    sendFirstNow: input.sendFirstNow !== false,
  })

  // marca o perfil no card do pipeline (a classificação passa a aparecer lá)
  if (input.attendanceId) {
    await supabaseAdmin
      .from('pastoral_attendances')
      .update({ person_profile: input.profile })
      .eq('id', input.attendanceId)

    await supabaseAdmin.from('pastoral_attendance_timeline').insert({
      attendance_id: input.attendanceId,
      church_id: input.churchId,
      event_type: 'journey',
      description: reused
        ? `Cronograma atualizado — ${scheduled} envio(s) agendado(s)`
        : `Cronograma anexado — ${scheduled} envio(s) agendado(s)`,
      metadata: { journey_id: input.journeyId, profile: input.profile },
      created_by: input.createdBy ?? null,
    })
  }

  return { enrollmentId: enrollmentId!, scheduled, reused }
}

// ── Varredura da coluna do kanban ────────────────────────────────────────────

/**
 * Adota automaticamente quem entrou na coluna configurada e ainda não tem
 * jornada. É o que responde "chegaram 10 no domingo, o sistema pega sozinho?".
 *
 * Só entra quem tem os dois requisitos do cronograma: **grupo classificado**
 * (novo convertido / reconciliado / outra igreja) e telefone válido. Card sem
 * classificação é contado e devolvido em `unclassified` para a tela cobrar —
 * adivinhar o grupo mandaria a mensagem errada para a pessoa errada.
 *
 * A data de acolhimento usada é a de criação do card, não a de hoje: quem foi
 * acolhido domingo e só foi movido na terça continua na semana certa.
 */
export async function autoEnrollFromColumn(journey: JourneyRow): Promise<{
  enrolled: number
  unclassified: number
  noPhone: number
}> {
  const result = { enrolled: 0, unclassified: 0, noPhone: 0 }
  if (!journey.auto_enroll) return result

  const { data: columns } = await supabaseAdmin
    .from('pastoral_pipeline_columns')
    .select('id')
    .eq('church_id', journey.church_id)
    .eq('column_key', journey.auto_enroll_column_key)

  const columnIds = (columns ?? []).map(c => c.id)
  if (!columnIds.length) return result

  const { data: cards } = await supabaseAdmin
    .from('pastoral_attendances')
    .select('id, church_id, phone, visitor_name, title, person_profile, created_at, member_id')
    .eq('church_id', journey.church_id)
    .in('column_id', columnIds)
    .is('deleted_at', null)
    .not('status', 'in', '("done","cancelled")')
    .order('created_at', { ascending: true })
    .limit(500)

  if (!cards?.length) return result

  // quem já tem jornada nesta igreja (qualquer status: pausado/encerrado não
  // pode ser readotado pela varredura, senão a pausa não valeria de nada)
  const { data: existing } = await supabaseAdmin
    .from('pastoral_journey_enrollments')
    .select('attendance_id')
    .eq('journey_id', journey.id)
    .in('attendance_id', cards.map(c => c.id))

  const already = new Set((existing ?? []).map(e => e.attendance_id))

  for (const card of cards) {
    if (already.has(card.id)) continue

    if (!JOURNEY_PROFILES.includes(card.person_profile as JourneyProfile)) {
      result.unclassified++
      continue
    }
    if (String(card.phone ?? '').replace(/\D/g, '').length < 10) {
      result.noPhone++
      continue
    }

    try {
      await enrollInJourney({
        journeyId: journey.id,
        churchId: card.church_id ?? journey.church_id,
        attendanceId: card.id,
        profile: card.person_profile as JourneyProfile,
        name: card.visitor_name ?? card.title ?? null,
        phone: String(card.phone),
        enrolledAt: card.created_at,
        // a etapa D+1 já vence sozinha; não atropela quem entrou hoje
        sendFirstNow: false,
        ownerUserId: journey.owner_user_id,
        createdBy: null,
      })
      result.enrolled++
    } catch (err) {
      console.error('[journey] auto-enroll falhou', card.id, err)
    }
  }

  return result
}

/**
 * Encerra o acompanhamento de quem saiu do fluxo: card concluído, cancelado ou
 * excluído. Sem isto uma pessoa já atendida continuaria recebendo o mês inteiro
 * de mensagens.
 */
export async function stopFinishedEnrollments(): Promise<number> {
  const { data: actives } = await supabaseAdmin
    .from('pastoral_journey_enrollments')
    .select('id, attendance_id, journey_id')
    .eq('status', 'active')
    .not('attendance_id', 'is', null)
    .limit(2000)

  if (!actives?.length) return 0

  const { data: journeys } = await supabaseAdmin
    .from('pastoral_journeys')
    .select('id, stop_on_done')
    .in('id', Array.from(new Set(actives.map(a => a.journey_id))))
  const stopOn = new Map((journeys ?? []).map(j => [j.id, j.stop_on_done !== false]))

  const { data: cards } = await supabaseAdmin
    .from('pastoral_attendances')
    .select('id, status, deleted_at')
    .in('id', actives.map(a => a.attendance_id))

  const cardById = new Map((cards ?? []).map(c => [c.id, c]))

  const toStop: string[] = []
  for (const enrollment of actives) {
    if (!stopOn.get(enrollment.journey_id)) continue
    const card = cardById.get(enrollment.attendance_id!)
    // card sumiu do banco, foi excluído ou chegou ao fim do pipeline
    const finished =
      !card || !!card.deleted_at || card.status === 'done' || card.status === 'cancelled'
    if (finished) toStop.push(enrollment.id)
  }

  if (!toStop.length) return 0

  const now = new Date().toISOString()
  await supabaseAdmin
    .from('pastoral_journey_enrollments')
    .update({ status: 'cancelled', updated_at: now })
    .in('id', toStop)

  await supabaseAdmin
    .from('pastoral_journey_sends')
    .update({ status: 'cancelled', error_message: 'Atendimento encerrado no pipeline', updated_at: now })
    .in('enrollment_id', toStop)
    .eq('status', 'pending')

  return toStop.length
}

/**
 * A pessoa já recebeu mensagem hoje? Duas etapas podem vencer no mesmo dia
 * (quem entra numa terça pega boas-vindas e véspera do culto juntas) e receber
 * duas mensagens seguidas soa robótico.
 */
async function sentTodayForEnrollment(enrollmentId: string): Promise<number> {
  const startOfDayBrt = (() => {
    const { y, m, d } = toBrtParts(new Date())
    return brtWallClockToUtc(y, m, d, '00:00').toISOString()
  })()

  const { count } = await supabaseAdmin
    .from('pastoral_journey_sends')
    .select('id', { count: 'exact', head: true })
    .eq('enrollment_id', enrollmentId)
    .eq('status', 'sent')
    .gte('sent_at', startOfDayBrt)

  return count ?? 0
}

// ── Fechamento do ciclo ──────────────────────────────────────────────────────

const DEFAULT_CERTIFICATE_MESSAGE =
  'Que alegria enorme, *{{nome}}*! 🎉\n\n' +
  'Você completou seu primeiro mês de caminhada conosco. Foi uma alegria acompanhar ' +
  'cada passo seu nesse tempo — e isso é só o começo!\n\n' +
  'Preparamos o seu *Certificado de Acolhimento*. Baixe e guarde com carinho:\n{{link}}\n\n' +
  '"Aquele que começou boa obra em vós há de completá-la." (Filipenses 1:6)\n\n' +
  'Seguimos juntos. Deus abençoe sua vida! 🙏'

/**
 * Encerra a jornada de quem recebeu a última mensagem do mês:
 *  1. carimba a inscrição como concluída;
 *  2. move o card do pipeline para a coluna CONCLUÍDO;
 *  3. emite o Certificado de Acolhimento e envia o link por WhatsApp.
 *
 * O carimbo `certificate_issued_at` garante emissão única — se o cron
 * reprocessar a inscrição, o certificado não sai duas vezes.
 */
export async function finishEnrollment(params: {
  enrollmentId: string
  journey: JourneyRow
  instance: WhatsAppInstance
  baseUrl: string
}): Promise<{ certificateUrl: string | null; cardMoved: boolean }> {
  const { data: enrollment } = await supabaseAdmin
    .from('pastoral_journey_enrollments')
    .select('*')
    .eq('id', params.enrollmentId)
    .single()

  if (!enrollment) return { certificateUrl: null, cardMoved: false }

  const now = new Date().toISOString()
  await supabaseAdmin
    .from('pastoral_journey_enrollments')
    .update({ status: 'completed', completed_at: enrollment.completed_at ?? now, updated_at: now })
    .eq('id', params.enrollmentId)

  // ── card para CONCLUÍDO ──
  let cardMoved = false
  if (params.journey.complete_card_on_finish && enrollment.attendance_id) {
    const { data: doneColumn } = await supabaseAdmin
      .from('pastoral_pipeline_columns')
      .select('id, name')
      .eq('church_id', enrollment.church_id)
      .eq('column_key', 'done')
      .limit(1)
      .maybeSingle()

    if (doneColumn) {
      await supabaseAdmin
        .from('pastoral_attendances')
        .update({ column_id: doneColumn.id, status: 'done', completed_at: now })
        .eq('id', enrollment.attendance_id)

      await supabaseAdmin.from('pastoral_attendance_timeline').insert({
        attendance_id: enrollment.attendance_id,
        church_id: enrollment.church_id,
        event_type: 'journey_completed',
        description: 'Cronograma concluído — card movido para CONCLUÍDO',
        metadata: { journey_id: params.journey.id },
      })
      cardMoved = true
    }
  }

  // ── certificado (uma vez só) ──
  if (!params.journey.issue_certificate || enrollment.certificate_issued_at) {
    return { certificateUrl: null, cardMoved }
  }

  const certificateUrl = `${params.baseUrl.replace(/\/$/, '')}/api/public/pastoral/certificate/${enrollment.id}?download=1`
  const firstName = String(enrollment.name ?? '').trim().split(/\s+/)[0] || 'irmão(ã)'

  const template = params.journey.certificate_message || DEFAULT_CERTIFICATE_MESSAGE
  const message = template
    .replace(/\{\{\s*nome\s*\}\}/g, firstName)
    .replace(/\{\{\s*link\s*\}\}/g, certificateUrl)

  // marca ANTES de enviar: se o envio falhar, o certificado não é reenviado em
  // loop a cada minuto — fica registrado e o link continua válido na tela
  await supabaseAdmin
    .from('pastoral_journey_enrollments')
    .update({ certificate_issued_at: now })
    .eq('id', params.enrollmentId)

  try {
    const phone = String(enrollment.phone).replace(/\D/g, '')
    const result = DRY_RUN
      ? { status: 'sent' as const, messageId: `dryrun_cert_${params.enrollmentId}` }
      : await sendTextViaZApi(params.instance, phone, message, { delayTyping: 3 })
    if (result.status === 'sent') {
      const conversationId = await ensureConversation(
        params.instance.id,
        params.journey.owner_user_id ?? params.instance.owner_user_id,
        phone,
        enrollment.name ?? undefined
      )
      await persistOutboundMessage(conversationId, message, result.messageId || undefined)
    }

    if (enrollment.attendance_id) {
      await supabaseAdmin.from('pastoral_attendance_timeline').insert({
        attendance_id: enrollment.attendance_id,
        church_id: enrollment.church_id,
        event_type: 'certificate',
        description: 'Certificado de Acolhimento emitido e enviado',
        metadata: { url: certificateUrl },
      })
    }
  } catch (err) {
    console.error('[journey] envio do certificado falhou', params.enrollmentId, err)
  }

  return { certificateUrl, cardMoved }
}

// ── Escalonador de instâncias ────────────────────────────────────────────────

async function loadJourneyInstances(journeyId: string): Promise<WhatsAppInstance[]> {
  const { data: links } = await supabaseAdmin
    .from('pastoral_journey_instances')
    .select('instance_id')
    .eq('journey_id', journeyId)

  const ids = (links ?? []).map(l => l.instance_id)

  // sem instância escolhida na matriz, usa todas as conectadas
  const query = supabaseAdmin.from('whatsapp_instances').select('*').eq('is_active', true)
  const { data } = ids.length ? await query.in('id', ids) : await query

  return ((data ?? []) as WhatsAppInstance[]).filter(i => i.status === 'connected')
}

async function loadRateLimits(instances: WhatsAppInstance[]): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  const ids = instances.map(i => i.instance_id)
  if (!ids.length) return map
  const { data } = await supabaseAdmin
    .from('whatsapp_instance_rate_limit')
    .select('instance_id, last_sent_at')
    .in('instance_id', ids)
  for (const row of data ?? []) map.set(row.instance_id, new Date(row.last_sent_at).getTime())
  return map
}

/** Instância livre há mais tempo, respeitando cooldown e teto diário. */
function pickInstance(
  instances: WhatsAppInstance[],
  rateLimits: Map<string, number>,
  cooldownMs: number,
  sentToday: Map<string, number>,
  dailyLimit: number
): WhatsAppInstance | null {
  let best: WhatsAppInstance | null = null
  let bestLastSent = Infinity

  for (const inst of instances) {
    if (dailyLimit > 0 && (sentToday.get(inst.id) ?? 0) >= dailyLimit) continue
    const lastSent = rateLimits.get(inst.instance_id) ?? 0
    if (Date.now() - lastSent < cooldownMs) continue
    if (lastSent < bestLastSent) {
      bestLastSent = lastSent
      best = inst
    }
  }

  return best
}

async function loadSentTodayByInstance(journeyId: string): Promise<Map<string, number>> {
  const start = new Date()
  start.setUTCHours(0, 0, 0, 0)
  const { data } = await supabaseAdmin
    .from('pastoral_journey_sends')
    .select('instance_id')
    .eq('journey_id', journeyId)
    .eq('status', 'sent')
    .gte('sent_at', start.toISOString())

  const map = new Map<string, number>()
  for (const row of data ?? []) {
    if (!row.instance_id) continue
    map.set(row.instance_id, (map.get(row.instance_id) ?? 0) + 1)
  }
  return map
}

function withinWindow(journey: JourneyRow, now: Date): boolean {
  const minutes = brtMinutesOfDay(now)
  const start = timeToMinutes(journey.window_start)
  const end = timeToMinutes(journey.window_end)
  if (start === end) return true // janela aberta 24h
  if (start < end) return minutes >= start && minutes <= end
  return minutes >= start || minutes <= end // janela cruzando a meia-noite
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// ── Polimento por IA ─────────────────────────────────────────────────────────

/**
 * Reescreve a mensagem da matriz deixando-a mais curta e natural para o momento
 * da pessoa, mantendo o sentido e o versículo. NUNCA lança: se a IA falhar ou
 * devolver algo estranho, vai o texto original — perder a mensagem é pior do
 * que mandá-la sem polimento.
 */
async function polishWithAi(params: {
  message: string
  /** outras etapas vencidas hoje, a fundir nesta mesma mensagem */
  extras?: string[]
  name: string | null
  profile: string
  momentLabel: string
  agentId: string | null
  /** instante real do envio — a IA precisa saber que dia é hoje */
  sentAt?: Date
}): Promise<string | null> {
  try {
    let persona = ''
    if (params.agentId) {
      const agent = await prisma.aiAgent.findUnique({ where: { id: params.agentId } })
      if (agent?.systemPrompt) persona = `\n\nPersona do agente:\n${agent.systemPrompt}`
    }

    const extras = (params.extras ?? []).filter(e => String(e ?? '').trim())

    const systemPrompt =
      'Você reescreve mensagens de acompanhamento pastoral enviadas por WhatsApp. ' +
      (extras.length
        ? 'Você receberá DUAS OU MAIS mensagens que venceram no mesmo dia: funda todas em ' +
          'UMA ÚNICA mensagem fluida, sem repetir a saudação, preservando TODOS os convites ' +
          'e avisos de cada uma. Escolha o versículo mais adequado ao conjunto e use só ele. '
        : '') +
      'Regras: mantenha o sentido e os convites originais; mantenha o versículo bíblico ' +
      'exatamente como está, com a referência; deixe o texto mais curto e natural, no ' +
      'máximo 2 parágrafos curtos; tom acolhedor, sem formalidade excessiva e sem ' +
      'inventar informação (datas, horários e eventos só se já estiverem no original); ' +
      'trate a pessoa pelo primeiro nome quando houver. ' +
      // sem isto a IA reescreve "Hoje tem culto" como "Amanhã tem culto" e a
      // pessoa recebe convite para o dia errado — os cultos são domingo e quarta
      'NUNCA altere a referência de dia da mensagem: se o original diz "Hoje", ' +
      'mantenha "Hoje"; se diz "Amanhã", mantenha "Amanhã"; se nomeia um dia da ' +
      'semana, mantenha aquele dia. Use a data de hoje informada no contexto para ' +
      'não escrever nada que contradiga o dia do envio. ' +
      'Responda APENAS com a mensagem final, sem aspas e sem comentários.' +
      persona

    const agora = params.sentAt ?? new Date()
    const hojeBrt = new Date(agora.getTime() - 180 * 60_000)
    const contexto = [
      `Pessoa: ${params.name ?? 'sem nome'}`,
      `Grupo: ${params.profile}`,
      `Momento do acompanhamento: ${params.momentLabel}`,
      `Hoje é ${WEEKDAY_LABELS[hojeBrt.getUTCDay()]}, ${hojeBrt.toISOString().slice(0, 10)} ` +
        '(horário de Brasília). A igreja tem culto domingo e quarta.',
      '',
      `Mensagem 1:\n${params.message}`,
      ...extras.map((e, i) => `Mensagem ${i + 2}:\n${e}`),
    ].join('\n\n')

    const out = await generateAiText(null, systemPrompt, [{ role: 'user', content: contexto }])
    const cleaned = String(out ?? '').trim()

    // guarda-corpo: resposta vazia ou absurdamente longa não substitui o original
    const baseLen = params.message.length + extras.reduce((acc, e) => acc + e.length, 0)
    if (cleaned.length < 20 || cleaned.length > baseLen * 2.5) return null
    return cleaned
  } catch (err) {
    console.error('[journey] polimento por IA falhou, mantendo texto da matriz', err)
    return null
  }
}

// ── Tick de envio (chamado pelo cron) ────────────────────────────────────────

/**
 * Drena a fila de envios vencidos até esgotar o orçamento de tempo.
 *
 * Envia no máximo 1 mensagem por instância por cooldown, alternando entre as
 * instâncias da jornada. Com 3 instâncias conectadas e cooldown de 5 s isso dá
 * ~36 mensagens por minuto de execução — 2 mil pessoas saem em algumas horas
 * sem concentrar disparo em um número só.
 */
export async function processJourneyTick(options?: { maxMs?: number; maxMessages?: number }): Promise<TickSummary> {
  const startedAt = Date.now()
  const maxMs = options?.maxMs ?? 45_000
  const maxMessages = options?.maxMessages ?? 500

  const summary: TickSummary = {
    sent: 0, errors: 0, skipped: 0, deferred: 0, certificates: 0,
    pending: 0, durationMs: 0, events: [],
  }

  const journeys = new Map<string, JourneyRow>()
  const instancesByJourney = new Map<string, WhatsAppInstance[]>()
  const sentTodayByJourney = new Map<string, Map<string, number>>()
  const rateLimits = new Map<string, number>()
  let rateLimitsLoaded = false

  // jornadas cujo horário atual está fora da janela — pulam este tick inteiro
  const blockedJourneys = new Set<string>()
  // inscrições pausadas: continuam pendentes no banco, mas saem da fila do tick
  // (sem isto elas voltariam em toda releitura da fila e travariam o loop)
  const blockedEnrollments = new Set<string>()

  while (Date.now() - startedAt < maxMs && summary.sent + summary.errors < maxMessages) {
    const { data: due } = await supabaseAdmin
      .from('pastoral_journey_sends')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(50)

    const queue = (due ?? []).filter(
      s => !blockedJourneys.has(s.journey_id) && !blockedEnrollments.has(s.enrollment_id)
    )
    if (!queue.length) break

    let progressed = false

    for (const send of queue) {
      if (Date.now() - startedAt >= maxMs) break
      if (summary.sent + summary.errors >= maxMessages) break

      // ── configuração da jornada (com cache no tick) ──
      let journey = journeys.get(send.journey_id)
      if (!journey) {
        const { data } = await supabaseAdmin
          .from('pastoral_journeys')
          .select('*')
          .eq('id', send.journey_id)
          .single()
        if (!data) {
          blockedJourneys.add(send.journey_id)
          continue
        }
        journey = data as JourneyRow
        journeys.set(journey.id, journey)
      }

      if (!journey.is_active || !withinWindow(journey, new Date())) {
        blockedJourneys.add(journey.id)
        continue
      }

      // ── a pessoa ainda está ativa no cronograma? ──
      const { data: enrollment } = await supabaseAdmin
        .from('pastoral_journey_enrollments')
        .select('status')
        .eq('id', send.enrollment_id)
        .single()

      if (!enrollment || enrollment.status !== 'active') {
        if (enrollment?.status === 'paused') {
          // pausado: continua pendente para retomar depois, mas sai deste tick
          blockedEnrollments.add(send.enrollment_id)
        } else {
          await supabaseAdmin
            .from('pastoral_journey_sends')
            .update({
              status: 'cancelled',
              error_message: 'Acompanhamento encerrado',
              updated_at: new Date().toISOString(),
            })
            .eq('id', send.id)
          progressed = true
        }
        summary.skipped++
        continue
      }

      // Duas etapas vencendo no mesmo dia (quem entra numa terça pega
      // boas-vindas e véspera do culto de quarta juntas). Com a IA ligada elas
      // viram UMA mensagem só — é o "manda boas-vindas e já avisa do culto".
      // Sem IA, o teto por pessoa segura a segunda para o dia seguinte.
      const { data: sameDay } = await supabaseAdmin
        .from('pastoral_journey_sends')
        .select('id, message, step_id')
        .eq('enrollment_id', send.enrollment_id)
        .eq('status', 'pending')
        .neq('id', send.id)
        .lte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })

      const mergeable = journey.ai_polish ? (sameDay ?? []) : []

      if (!mergeable.length && journey.max_per_person_per_day > 0) {
        const already = await sentTodayForEnrollment(send.enrollment_id)
        if (already >= journey.max_per_person_per_day) {
          blockedEnrollments.add(send.enrollment_id)
          summary.deferred++
          continue
        }
      }

      // ── instância livre ──
      let instances = instancesByJourney.get(journey.id)
      if (!instances) {
        instances = await loadJourneyInstances(journey.id)
        instancesByJourney.set(journey.id, instances)
      }
      if (!instances.length) {
        blockedJourneys.add(journey.id)
        continue
      }

      if (!rateLimitsLoaded) {
        const loaded = await loadRateLimits(instances)
        for (const [k, v] of loaded) rateLimits.set(k, v)
        rateLimitsLoaded = true
      }

      let sentToday = sentTodayByJourney.get(journey.id)
      if (!sentToday) {
        sentToday = await loadSentTodayByInstance(journey.id)
        sentTodayByJourney.set(journey.id, sentToday)
      }

      const cooldownMs = Math.max(RATE_LIMIT_MS, (journey.interval_seconds || 5) * 1000)
      const instance = pickInstance(instances, rateLimits, cooldownMs, sentToday, journey.daily_limit_per_instance)
      if (!instance) continue // nenhuma livre agora — tenta o próximo da fila

      // ── claim: só processa quem conseguir virar pending → sending ──
      const { data: claimed } = await supabaseAdmin
        .from('pastoral_journey_sends')
        .update({ status: 'sending', instance_id: instance.id, updated_at: new Date().toISOString() })
        .eq('id', send.id)
        .eq('status', 'pending')
        .select('id')

      if (!claimed?.length) continue

      progressed = true
      rateLimits.set(instance.instance_id, Date.now())
      sentToday.set(instance.id, (sentToday.get(instance.id) ?? 0) + 1)

      const phone = String(send.phone).replace(/\D/g, '')
      const agoraEnvio = new Date()

      // ── o dia citado tem que ser verdade no dia do envio ──
      // A etapa de véspera é agendada para o dia anterior ao culto, mas a fila
      // pode andar só no dia seguinte (inscrição de noite, janela de horário,
      // fila cheia). Sem esta correção a pessoa recebe "amanhã tem culto" no
      // próprio dia do culto. Ver pastoralJourneyDayRef.ts.
      const dayRef = adjustDayReference(send.message, {
        scheduledAt: send.scheduled_at,
        sentAt: agoraEnvio,
      })

      if (dayRef.stale) {
        // o dia citado já passou — avisar de um culto que aconteceu é pior que calar
        await supabaseAdmin
          .from('pastoral_journey_sends')
          .update({
            status: 'cancelled',
            error_message: 'Vencida: o dia citado na mensagem já passou',
            updated_at: agoraEnvio.toISOString(),
          })
          .eq('id', send.id)
        summary.skipped++
        continue
      }

      // polimento (e fusão) opcional pela IA — o texto da matriz é o plano B
      let body: string = dayRef.message
      let aiPolished = false
      const mergedIds: string[] = []

      if (journey.ai_polish && !send.ai_polished) {
        const { data: stepRow } = await supabaseAdmin
          .from('pastoral_journey_steps')
          .select('moment_label')
          .eq('id', send.step_id)
          .maybeSingle()

        const polished = await polishWithAi({
          // o texto já corrigido, e as fundidas também — a IA não pode receber
          // "amanhã" de uma etapa que está saindo no próprio dia do culto
          message: dayRef.message,
          extras: mergeable.map(
            m =>
              adjustDayReference(m.message, {
                scheduledAt: send.scheduled_at,
                sentAt: agoraEnvio,
              }).message
          ),
          name: send.name,
          profile: JOURNEY_PROFILE_LABELS[send.profile as JourneyProfile] ?? send.profile,
          momentLabel: stepRow?.moment_label ?? '',
          agentId: journey.ai_agent_id,
          sentAt: agoraEnvio,
        })
        if (polished) {
          body = polished
          aiPolished = true
          // só considera fundido se a IA de fato produziu o texto combinado
          if (mergeable.length) mergedIds.push(...mergeable.map(m => m.id))
        }
      }

      const message = send.link_url ? `${body}\n\n${send.link_url}` : body

      let status: 'sent' | 'error' = 'sent'
      let errorMessage: string | null = null
      let conversationId: string | null = null
      let waMessageId: string | null = null

      try {
        const result = DRY_RUN
          ? { status: 'sent' as const, messageId: `dryrun_${send.id}` }
          : send.image_url
            ? await sendImageViaZApi(instance, phone, send.image_url, message)
            : await sendTextViaZApi(instance, phone, message, {
                // ritmo humano: "digitando..." antes de a mensagem sair
                delayTyping: 3 + Math.floor(Math.random() * 3),
              })

        if (result.status === 'error') {
          status = 'error'
          errorMessage = result.error || 'erro desconhecido'
        } else {
          waMessageId = result.messageId || null
          conversationId = await ensureConversation(
            instance.id,
            journey.owner_user_id ?? instance.owner_user_id,
            phone,
            send.name ?? undefined
          )
          await persistOutboundMessage(conversationId, message, result.messageId || undefined)
        }
      } catch (err) {
        status = 'error'
        errorMessage = err instanceof Error ? err.message : 'falha no envio'
      }

      const now = new Date().toISOString()
      await supabaseAdmin
        .from('pastoral_journey_sends')
        .update({
          status,
          sent_at: status === 'sent' ? now : null,
          error_message: errorMessage,
          conversation_id: conversationId,
          wa_message_id: waMessageId,
          // guarda o que realmente foi enviado; o texto da matriz fica em
          // original_message para auditoria de "o que a IA mudou" e de qual dia
          // foi corrigido no envio
          ...(aiPolished
            ? { message: body, original_message: send.message, ai_polished: true }
            : dayRef.changed
              ? { message: body, original_message: send.message }
              : {}),
          updated_at: now,
        })
        .eq('id', send.id)

      // etapas fundidas nesta mensagem saem da fila apontando para ela
      if (status === 'sent' && mergedIds.length) {
        await supabaseAdmin
          .from('pastoral_journey_sends')
          .update({
            status: 'merged',
            merged_into_send_id: send.id,
            sent_at: now,
            error_message: null,
            updated_at: now,
          })
          .in('id', mergedIds)
          .eq('status', 'pending')
      }

      if (status === 'sent') {
        summary.sent++
        if (send.attendance_id) {
          await supabaseAdmin.from('pastoral_attendance_timeline').insert({
            attendance_id: send.attendance_id,
            church_id: send.church_id,
            event_type: 'journey_message',
            description: 'Mensagem do cronograma enviada',
            metadata: { step_id: send.step_id, instance: instance.name },
          }).then(() => {}, () => {})
        }
      } else {
        summary.errors++
      }

      summary.events.push({
        phone,
        name: send.name,
        status,
        instance: instance.name,
        ...(errorMessage ? { error: errorMessage } : {}),
      })

      // Última mensagem do mês? Então encerra o ciclo: card para CONCLUÍDO e
      // Certificado de Acolhimento enviado. Só depois de um envio BEM-SUCEDIDO
      // — não se comemora uma jornada que terminou em erro.
      const { count: remaining } = await supabaseAdmin
        .from('pastoral_journey_sends')
        .select('id', { count: 'exact', head: true })
        .eq('enrollment_id', send.enrollment_id)
        .eq('status', 'pending')

      if ((remaining ?? 0) === 0 && status === 'sent') {
        try {
          const finished = await finishEnrollment({
            enrollmentId: send.enrollment_id,
            journey,
            instance,
            baseUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://www.adcampinas.com.br',
          })
          if (finished.certificateUrl) summary.certificates++
        } catch (err) {
          console.error('[journey] fechamento do ciclo falhou', send.enrollment_id, err)
        }
      } else if ((remaining ?? 0) === 0) {
        await supabaseAdmin
          .from('pastoral_journey_enrollments')
          .update({ status: 'completed', completed_at: now, updated_at: now })
          .eq('id', send.enrollment_id)
          .eq('status', 'active')
      }
    }

    // nenhuma instância ficou livre nesta passada: espera o cooldown mínimo
    if (!progressed) {
      if (Date.now() - startedAt + RATE_LIMIT_MS >= maxMs) break
      await sleep(1000)
    }
  }

  const { count } = await supabaseAdmin
    .from('pastoral_journey_sends')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
  summary.pending = count ?? 0
  summary.durationMs = Date.now() - startedAt

  return summary
}

/**
 * Devolve envios travados em "sending" há mais de 5 min para a fila. Uma
 * execução serverless morta no meio do envio deixaria a linha presa para sempre.
 */
export async function requeueStaleSends(): Promise<number> {
  const cutoff = new Date(Date.now() - 5 * 60_000).toISOString()
  const { data } = await supabaseAdmin
    .from('pastoral_journey_sends')
    .update({ status: 'pending', updated_at: new Date().toISOString() })
    .eq('status', 'sending')
    .lt('updated_at', cutoff)
    .select('id')
  return data?.length ?? 0
}
