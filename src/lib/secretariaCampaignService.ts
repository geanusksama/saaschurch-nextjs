import { randomBytes, randomUUID } from 'crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  getMemberFieldSpec,
  type CampaignFieldOption,
  type SecretariaCampaignField,
} from '@/lib/secretariaCampaignFields'

/**
 * Campanhas da Secretaria — regras de servidor.
 *
 * Aqui ficam as três coisas que não podem morar na UI: gerar os tokens dos
 * links, validar a resposta contra o formulário publicado, e aplicar a
 * aprovação no cadastro do membro.
 *
 * A aprovação grava SOMENTE nas colunas listadas em MEMBER_FIELD_MAP e
 * SOMENTE nas perguntas que o secretário mapeou. Nada de ROL, igreja, título
 * ou situação — essas mudanças têm processo próprio.
 */

// ── Tokens ───────────────────────────────────────────────────────────────────
// base32 sem vogais: link curto, digitável, e sem formar palavra por acidente.
const ALFABETO = '0123456789bcdfghjkmnpqrstvwxyz'

export function generateToken(size = 12): string {
  const bytes = randomBytes(size)
  let out = ''
  for (let i = 0; i < size; i++) out += ALFABETO[bytes[i] % ALFABETO.length]
  return out
}

/** URL pública da campanha. `targetToken` identifica a pessoa e pula a etapa de login. */
export function campaignPublicUrl(shareToken: string, targetToken?: string | null): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.adcampinas.com.br').replace(/\/+$/, '')
  return targetToken ? `${base}/campanha/${shareToken}/${targetToken}` : `${base}/campanha/${shareToken}`
}

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface CampaignRow {
  id: string
  church_id: string | null
  owner_user_id: string
  name: string
  reason: string | null
  description: string | null
  kind: 'form' | 'broadcast'
  status: 'draft' | 'active' | 'closed'
  form_schema: SecretariaCampaignField[]
  message_template: string | null
  image_url: string | null
  video_url: string | null
  link_url: string | null
  instance_id: string | null
  share_token: string
  require_identification: boolean
  opens_at: string | null
  closes_at: string | null
  target_count: number
  sent_count: number
  response_count: number
  created_at: string
  updated_at: string
}

export interface CampaignAnswerFile {
  fieldId: string
  url: string
  fileName: string
  mimeType: string
  size: number
}

export type AnswerValue = string | number | boolean | string[]

// ── Janela de resposta ───────────────────────────────────────────────────────

/** Motivo pelo qual o formulário não aceita resposta agora, ou null se aceita. */
export function campaignClosedReason(c: Pick<CampaignRow, 'status' | 'opens_at' | 'closes_at' | 'kind'>): string | null {
  if (c.kind !== 'form') return 'Esta campanha é um comunicado e não recebe respostas.'
  if (c.status === 'draft') return 'Esta campanha ainda não foi publicada.'
  if (c.status === 'closed') return 'Esta campanha foi encerrada.'
  const now = Date.now()
  if (c.opens_at && new Date(c.opens_at).getTime() > now) {
    return `Esta campanha abre em ${new Date(c.opens_at).toLocaleDateString('pt-BR')}.`
  }
  if (c.closes_at && new Date(c.closes_at).getTime() < now) {
    return `O prazo desta campanha terminou em ${new Date(c.closes_at).toLocaleDateString('pt-BR')}.`
  }
  return null
}

// ── Validação da resposta ────────────────────────────────────────────────────

export interface AnswerValidation {
  ok: boolean
  errors: string[]
  answers: Record<string, AnswerValue>
  files: CampaignAnswerFile[]
}

function optionValues(options: CampaignFieldOption[] | undefined): Set<string> {
  return new Set((options ?? []).map(o => o.value))
}

function isBlank(v: unknown): boolean {
  if (v === null || v === undefined) return true
  if (Array.isArray(v)) return v.length === 0
  return String(v).trim() === ''
}

/** CPF com dígito verificador — o mesmo critério da ficha de adesão. */
export function isValidCpf(raw: string): boolean {
  const cpf = raw.replace(/\D/g, '')
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  for (const len of [9, 10]) {
    let sum = 0
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i)
    const dv = ((sum * 10) % 11) % 10
    if (dv !== Number(cpf[len])) return false
  }
  return true
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Confere a resposta contra o formulário publicado. O que não está no schema é
 * descartado: quem preenche não escolhe as perguntas.
 */
export function validateAnswers(
  schema: SecretariaCampaignField[],
  rawAnswers: unknown,
  rawFiles: unknown
): AnswerValidation {
  const errors: string[] = []
  const answers: Record<string, AnswerValue> = {}
  const files: CampaignAnswerFile[] = []

  const input = (rawAnswers ?? {}) as Record<string, unknown>
  const inputFiles = Array.isArray(rawFiles) ? (rawFiles as Partial<CampaignAnswerFile>[]) : []

  for (const field of schema) {
    if (field.type === 'image' || field.type === 'file') {
      const file = inputFiles.find(f => f?.fieldId === field.id)
      const url = String(file?.url ?? '').trim()
      if (!url) {
        if (field.required) errors.push(`"${field.label}" é obrigatório.`)
        continue
      }
      if (!/^https?:\/\//i.test(url)) {
        errors.push(`"${field.label}": arquivo inválido.`)
        continue
      }
      files.push({
        fieldId: field.id,
        url,
        fileName: String(file?.fileName ?? '').slice(0, 200) || 'arquivo',
        mimeType: String(file?.mimeType ?? '').slice(0, 100),
        size: Number(file?.size) || 0,
      })
      answers[field.id] = url
      continue
    }

    const raw = input[field.id]
    if (isBlank(raw)) {
      if (field.required) errors.push(`"${field.label}" é obrigatório.`)
      continue
    }

    switch (field.type) {
      case 'checkbox': {
        const list = (Array.isArray(raw) ? raw : [raw]).map(v => String(v).trim()).filter(Boolean)
        const valid = optionValues(field.options)
        const fora = list.filter(v => !valid.has(v))
        if (fora.length) {
          errors.push(`"${field.label}": opção inválida (${fora.join(', ')}).`)
          break
        }
        answers[field.id] = list
        break
      }
      case 'select':
      case 'radio': {
        const v = String(raw).trim()
        if (!optionValues(field.options).has(v)) {
          errors.push(`"${field.label}": opção inválida.`)
          break
        }
        answers[field.id] = v
        break
      }
      case 'number': {
        const n = Number(String(raw).replace(',', '.'))
        if (!Number.isFinite(n)) {
          errors.push(`"${field.label}" precisa ser um número.`)
          break
        }
        answers[field.id] = n
        break
      }
      case 'date': {
        const v = String(raw).trim().slice(0, 10)
        if (!DATE_RE.test(v) || Number.isNaN(new Date(`${v}T12:00:00Z`).getTime())) {
          errors.push(`"${field.label}": data inválida.`)
          break
        }
        answers[field.id] = v
        break
      }
      case 'email': {
        const v = String(raw).trim().toLowerCase()
        if (!EMAIL_RE.test(v)) {
          errors.push(`"${field.label}": e-mail inválido.`)
          break
        }
        answers[field.id] = v
        break
      }
      case 'phone': {
        const digits = String(raw).replace(/\D/g, '')
        if (digits.length < 10 || digits.length > 13) {
          errors.push(`"${field.label}": telefone inválido (informe DDD + número).`)
          break
        }
        answers[field.id] = digits
        break
      }
      case 'cpf': {
        const digits = String(raw).replace(/\D/g, '')
        if (!isValidCpf(digits)) {
          errors.push(`"${field.label}": CPF inválido.`)
          break
        }
        answers[field.id] = digits
        break
      }
      default: {
        const max = field.type === 'textarea' ? 4000 : 500
        answers[field.id] = String(raw).trim().slice(0, max)
      }
    }
  }

  return { ok: errors.length === 0, errors, answers, files }
}

// ── Aplicação da aprovação no cadastro ───────────────────────────────────────

export interface AppliedField {
  /** coluna de `members` */
  field: string
  label: string
  from: string | null
  to: string | null
}

/** Converte o valor da resposta para o formato da coluna. `null` = não grava. */
function toColumnValue(
  kind: string,
  value: AnswerValue | undefined,
  maxLength?: number
): string | number | null {
  if (value === undefined || value === null) return null
  const asText = Array.isArray(value) ? value.join(', ') : String(value)
  if (!asText.trim()) return null

  switch (kind) {
    case 'date':
      return DATE_RE.test(asText.slice(0, 10)) ? asText.slice(0, 10) : null
    case 'digits': {
      const d = asText.replace(/\D/g, '')
      return d || null
    }
    case 'number': {
      const n = Number(asText.replace(',', '.'))
      return Number.isFinite(n) ? n : null
    }
    case 'url':
      return /^https?:\/\//i.test(asText) ? asText.slice(0, maxLength ?? 500) : null
    default:
      return maxLength ? asText.slice(0, maxLength) : asText
  }
}

/**
 * Monta a lista "valor atual → valor novo" das perguntas mapeadas.
 * Só entra o que realmente muda — repetir o mesmo valor não vira ocorrência.
 */
export function diffMemberFields(
  schema: SecretariaCampaignField[],
  answers: Record<string, AnswerValue>,
  member: Record<string, unknown>,
  onlyFields?: string[] | null
): { updates: Record<string, string | number | null>; applied: AppliedField[]; skipped: string[] } {
  const updates: Record<string, string | number | null> = {}
  const applied: AppliedField[] = []
  const skipped: string[] = []
  const filtro = onlyFields && onlyFields.length ? new Set(onlyFields) : null

  for (const field of schema) {
    if (!field.memberField) continue
    if (filtro && !filtro.has(field.memberField)) continue

    const spec = getMemberFieldSpec(field.memberField)
    if (!spec) continue

    const novo = toColumnValue(spec.kind, answers[field.id], spec.maxLength)
    if (novo === null) {
      skipped.push(field.memberField)
      continue
    }

    const atualRaw = member[field.memberField]
    const atual =
      atualRaw instanceof Date
        ? atualRaw.toISOString().slice(0, 10)
        : atualRaw === null || atualRaw === undefined
          ? null
          : String(atualRaw)

    // data vem do banco como 'YYYY-MM-DDT00:00:00...' — compara só a data
    const atualNorm = spec.kind === 'date' && atual ? atual.slice(0, 10) : atual
    if (atualNorm === String(novo)) {
      skipped.push(field.memberField)
      continue
    }

    updates[field.memberField] = novo
    applied.push({ field: field.memberField, label: spec.label, from: atualNorm, to: String(novo) })
  }

  return { updates, applied, skipped }
}

/**
 * Grava os campos aprovados no membro e registra a ocorrência no histórico.
 * Devolve o que foi efetivamente gravado.
 */
export async function applyApprovalToMember(params: {
  memberId: string
  campaign: Pick<CampaignRow, 'id' | 'name'>
  schema: SecretariaCampaignField[]
  answers: Record<string, AnswerValue>
  onlyFields?: string[] | null
  userId?: string | null
}): Promise<{ applied: AppliedField[]; error?: string }> {
  const { data: member, error: readErr } = await supabaseAdmin
    .from('members')
    .select('*')
    .eq('id', params.memberId)
    .is('deleted_at', null)
    .maybeSingle()

  if (readErr) return { applied: [], error: readErr.message }
  if (!member) return { applied: [], error: 'Membro não encontrado (pode ter sido excluído).' }

  const { updates, applied } = diffMemberFields(
    params.schema,
    params.answers,
    member as Record<string, unknown>,
    params.onlyFields
  )

  if (!applied.length) return { applied: [] }

  // CPF é único: trocar para um que já existe derrubaria o update inteiro
  if (typeof updates.cpf === 'string') {
    const { data: dono } = await supabaseAdmin
      .from('members')
      .select('id, full_name, rol')
      .eq('cpf', updates.cpf)
      .is('deleted_at', null)
      .maybeSingle()
    if (dono && dono.id !== params.memberId) {
      return {
        applied: [],
        error: `O CPF informado já pertence a ${dono.full_name} (ROL ${dono.rol ?? '—'}). Confira antes de aprovar.`,
      }
    }
  }

  const { error: updErr } = await supabaseAdmin
    .from('members')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
      updated_by: params.userId ?? null,
    })
    .eq('id', params.memberId)

  if (updErr) return { applied: [], error: updErr.message }

  // ocorrência no perfil — a aba "Histórico" lê member_event_history
  try {
    await prisma.memberEventHistory.create({
      data: {
        memberId: params.memberId,
        churchId: String(member.church_id),
        serviceGroup: 'CAMPANHA',
        serviceName: 'Campanha da Secretaria',
        action: 'DADOS ATUALIZADOS',
        notes:
          `${params.campaign.name} · ` +
          applied.map(a => `${a.label}: ${a.from ?? '—'} → ${a.to}`).join(' · '),
        metadata: {
          source: 'SECRETARIA_CAMPANHA',
          campaignId: params.campaign.id,
          campaignName: params.campaign.name,
          // AppliedField é uma interface; o Prisma só aceita o tipo JSON dele
          fields: applied as unknown as Prisma.InputJsonValue,
        },
        createdBy: params.userId || null,
      },
    })
  } catch (e) {
    // a ocorrência é rastro, não pode derrubar a aprovação já gravada
    console.error('[applyApprovalToMember] ocorrência não registrada', e)
  }

  return { applied }
}

// ── Mensagem enviada por WhatsApp ────────────────────────────────────────────

/** Troca as variáveis do texto da campanha. `{{link}}` é a mais importante. */
export function renderCampaignMessage(
  template: string,
  vars: Record<string, string | null | undefined>
): string {
  return template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (full, key: string) => {
    const v = vars[key.toLowerCase()]
    return v === undefined || v === null ? full : String(v)
  })
}

export function firstName(full: string | null | undefined): string {
  return (full ?? '').trim().split(/\s+/)[0] ?? ''
}

/** Mensagem padrão de reprovação — a pessoa precisa saber o que corrigir. */
export function rejectionMessage(campaignName: string, motivo: string, link: string): string {
  return (
    `Olá! Recebemos seu envio da campanha *${campaignName}*, mas precisamos de um ajuste:\n\n` +
    `_${motivo}_\n\n` +
    `Abra o link abaixo, corrija e envie de novo:\n${link}\n\n` +
    `Qualquer dúvida é só responder por aqui. Deus abençoe!`
  )
}

// ── Alvos ────────────────────────────────────────────────────────────────────

export interface TargetInput {
  memberId: string
  name: string | null
  phone: string | null
  rol: number | null
  churchId: string | null
  churchName: string | null
  regionalId: string | null
  regionalName: string | null
  zone: string | null
  titleName: string | null
}

/** Linha pronta para insert em secretaria_campaign_targets. */
export function buildTargetRow(campaignId: string, t: TargetInput) {
  return {
    id: randomUUID(),
    campaign_id: campaignId,
    member_id: t.memberId,
    name: t.name,
    phone: (t.phone ?? '').replace(/\D/g, '') || null,
    rol: t.rol,
    church_id: t.churchId,
    church_name: t.churchName,
    regional_id: t.regionalId,
    regional_name: t.regionalName,
    zone: t.zone,
    title_name: t.titleName,
    status: 'pending',
    token: generateToken(),
  }
}

/** Recontagem dos totais a partir das tabelas filhas (a fonte da verdade). */
export async function refreshCampaignCounters(campaignId: string): Promise<void> {
  const [targets, sent, responses] = await Promise.all([
    supabaseAdmin.from('secretaria_campaign_targets').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId),
    supabaseAdmin.from('secretaria_campaign_targets').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId).not('sent_at', 'is', null),
    supabaseAdmin.from('secretaria_campaign_responses').select('id', { count: 'exact', head: true }).eq('campaign_id', campaignId),
  ])

  await supabaseAdmin
    .from('secretaria_campaigns')
    .update({
      target_count: targets.count ?? 0,
      sent_count: sent.count ?? 0,
      response_count: responses.count ?? 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId)
}
