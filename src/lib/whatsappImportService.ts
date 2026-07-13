/**
 * whatsappImportService — importação de contatos por CSV/Excel para envio em massa.
 *
 * Três responsabilidades:
 *  1. Normalizar e validar as linhas do arquivo (telefone é o que manda).
 *  2. De-para contra a base: o contato já é MEMBRO? já está em algum PIPELINE
 *     (qualquer fase)? — por padrão esses NÃO recebem mensagem, e o motivo fica
 *     registrado para consulta na aba Importações.
 *  3. Criar o card no pipeline (coluna FAZENDO) para cada envio realizado, do
 *     mesmo jeito que o portal público cria — para acompanhamento do contato.
 *
 * O ENVIO em si não vive aqui: reaproveita o orquestrador de campanhas
 * (whatsappCampaignService), que já respeita o cooldown por instância.
 */

import { prisma } from '@/lib/prisma'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isRestrictedToOwnChurch } from '@/lib/helpers'
import type { AuthUser } from '@/lib/auth'

// ── Escopo ───────────────────────────────────────────────────────────────────

/**
 * Igrejas que o usuário enxerga — mesma regra do módulo de Membros e da busca
 * de contatos: master vê tudo, os demais ficam presos ao campo (e à própria
 * igreja quando o perfil é restrito).
 */
export async function resolveScopeChurchIds(user: AuthUser): Promise<string[]> {
  const where: Record<string, unknown> = { deletedAt: null }

  if (user.profileType !== 'master') {
    if (!user.campoId) return []
    where.regional = { campoId: user.campoId }
  }
  if (isRestrictedToOwnChurch(user)) {
    if (!user.churchId) return []
    where.id = user.churchId
  }

  const churches = await prisma.church.findMany({ where, select: { id: true } })
  return churches.map(c => c.id)
}

// ── Colunas do arquivo (o "padrão aceito") ───────────────────────────────────
// A chave é a variável {{...}} da mensagem — é isso que casa os dados do
// arquivo com o template escrito na tela.

export interface ImportField {
  key: string
  label: string
  required: boolean
  /** cabeçalhos reconhecidos automaticamente (normalizados: sem acento/caixa) */
  aliases: string[]
}

export const IMPORT_FIELDS: ImportField[] = [
  { key: 'nome',       label: 'Nome',            required: true,  aliases: ['nome', 'nome completo', 'contato', 'name', 'full name'] },
  { key: 'telefone',   label: 'Telefone',        required: true,  aliases: ['telefone', 'celular', 'whatsapp', 'fone', 'phone', 'numero', 'contato telefone'] },
  { key: 'email',      label: 'E-mail',          required: false, aliases: ['email', 'e-mail', 'mail'] },
  { key: 'igreja',     label: 'Igreja',          required: false, aliases: ['igreja', 'congregacao', 'church'] },
  { key: 'regional',   label: 'Regional',        required: false, aliases: ['regional', 'campo', 'setor'] },
  { key: 'tipo',       label: 'Tipo/Categoria',  required: false, aliases: ['tipo', 'categoria', 'assunto', 'motivo'] },
  { key: 'rol',        label: 'ROL',             required: false, aliases: ['rol', 'matricula'] },
  { key: 'cargo',      label: 'Cargo',           required: false, aliases: ['cargo', 'funcao', 'titulo', 'titulo eclesiastico'] },
  { key: 'observacao', label: 'Observação',      required: false, aliases: ['observacao', 'obs', 'anotacao', 'notas', 'nota'] },
]

/** Cabeçalho do arquivo-modelo oferecido para download. */
export const IMPORT_TEMPLATE_HEADERS = IMPORT_FIELDS.map(f => f.key)

/** Normaliza um cabeçalho para comparação: sem acento, minúsculo, sem pontuação. */
export function normalizeHeader(header: string): string {
  return String(header ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Casa os cabeçalhos do arquivo com os campos do sistema (fase 2 do modal). */
export function autoMap(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {}
  const used = new Set<string>()
  for (const field of IMPORT_FIELDS) {
    const hit = headers.find(
      h => !used.has(h) && field.aliases.includes(normalizeHeader(h))
    )
    if (hit) {
      mapping[field.key] = hit
      used.add(hit)
    }
  }
  return mapping
}

// ── Telefone ─────────────────────────────────────────────────────────────────

/**
 * Normaliza para o formato que a Z-API espera (55 + DDD + número, só dígitos).
 * Retorna null se não for um telefone brasileiro plausível.
 */
export function normalizePhone(raw: string): string | null {
  let d = String(raw ?? '').replace(/\D/g, '')
  if (!d) return null
  d = d.replace(/^0+/, '')
  // já veio com DDI 55
  if (d.length >= 12 && d.startsWith('55')) d = d.slice(2)
  // sobrou DDD + número (10 = fixo/celular antigo, 11 = celular com o 9)
  if (d.length < 10 || d.length > 11) return null
  return `55${d}`
}

/** Chave de comparação entre bases: os 8 últimos dígitos (imune ao nono dígito e ao DDI). */
export function phoneKey(raw: string): string {
  return String(raw ?? '').replace(/\D/g, '').slice(-8)
}

function firstName(full: string): string {
  return (full || '').trim().split(/\s+/)[0] ?? ''
}

// ── De-para contra a base ────────────────────────────────────────────────────

export type MatchStatus = 'new' | 'member' | 'pipeline' | 'both' | 'duplicate_in_file' | 'invalid'

export interface AnalyzedRow {
  rowNumber: number
  raw: Record<string, string>
  name: string
  phone: string | null
  email: string | null
  variables: Record<string, string>
  matchStatus: MatchStatus
  matchedMemberId: string | null
  matchedAttendanceId: string | null
  matchedStage: string | null
  decision: 'send' | 'skip'
  skipReason: string | null
}

export interface AnalyzeOptions {
  /** enviar mesmo para quem já é membro (padrão: não) */
  includeMembers?: boolean
  /** enviar mesmo para quem já está no pipeline (padrão: não) */
  includePipeline?: boolean
}

const SKIP_REASONS: Record<string, string> = {
  invalid: 'Telefone inválido',
  duplicate_in_file: 'Número repetido no arquivo',
  member: 'Já cadastrado como membro',
  pipeline: 'Já existe no pipeline',
  both: 'Já é membro e já está no pipeline',
}

/** Busca membros do escopo cujo telefone bate com algum do arquivo. */
async function findMembersByPhone(churchIds: string[], keys: string[]) {
  if (!churchIds.length || !keys.length) return new Map<string, { id: string; name: string }>()

  const rows = await prisma.$queryRaw<Array<{ id: string; full_name: string | null; phone: string | null; mobile: string | null }>>`
    SELECT id::text AS id, full_name, phone, mobile
    FROM members
    WHERE deleted_at IS NULL
      AND church_id = ANY(${churchIds}::uuid[])
      AND (
        right(regexp_replace(coalesce(mobile, ''), '[^0-9]', '', 'g'), 8) = ANY(${keys}::text[])
        OR right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 8) = ANY(${keys}::text[])
      )
  `

  const byKey = new Map<string, { id: string; name: string }>()
  for (const m of rows) {
    for (const p of [m.mobile, m.phone]) {
      const k = phoneKey(p ?? '')
      if (k && !byKey.has(k)) byKey.set(k, { id: m.id, name: m.full_name ?? '' })
    }
  }
  return byKey
}

/** Busca atendimentos do pipeline (qualquer fase) cujo telefone bate com o arquivo. */
async function findPipelineByPhone(churchIds: string[], keys: string[]) {
  const byKey = new Map<string, { id: string; stage: string }>()
  if (!churchIds.length || !keys.length) return byKey

  const { data: rows } = await supabaseAdmin
    .from('pastoral_attendances')
    .select('id, phone, column_id, created_at')
    .in('church_id', churchIds)
    .is('deleted_at', null)
    .not('phone', 'is', null)
    .neq('phone', '')
    .order('created_at', { ascending: false })

  const columnIds = Array.from(new Set((rows ?? []).map(r => r.column_id).filter(Boolean) as string[]))
  const stageById = new Map<string, string>()
  if (columnIds.length) {
    const { data: cols } = await supabaseAdmin
      .from('pastoral_pipeline_columns')
      .select('id, name')
      .in('id', columnIds)
    for (const c of cols ?? []) stageById.set(c.id, c.name)
  }

  const wanted = new Set(keys)
  for (const r of rows ?? []) {
    const k = phoneKey(String(r.phone ?? ''))
    // mantém o mais recente (a query já vem ordenada desc)
    if (k && wanted.has(k) && !byKey.has(k)) {
      byKey.set(k, { id: r.id, stage: (r.column_id && stageById.get(r.column_id)) || '—' })
    }
  }
  return byKey
}

/**
 * Analisa as linhas do arquivo: valida telefone, marca duplicados internos e
 * faz o de-para com membros e pipeline dentro do escopo de igrejas do usuário.
 */
export async function analyzeRows(
  rawRows: Array<Record<string, string>>,
  mapping: Record<string, string>,
  churchIds: string[],
  options: AnalyzeOptions = {}
): Promise<AnalyzedRow[]> {
  const pick = (row: Record<string, string>, field: string): string => {
    const header = mapping[field]
    return header ? String(row[header] ?? '').trim() : ''
  }

  // 1ª passada: normaliza e detecta duplicados dentro do próprio arquivo
  const seen = new Set<string>()
  const staged = rawRows.map((raw, i) => {
    const name = pick(raw, 'nome')
    const phone = normalizePhone(pick(raw, 'telefone'))
    const key = phone ? phoneKey(phone) : ''

    let status: MatchStatus = 'new'
    if (!phone || !name) status = 'invalid'
    else if (seen.has(key)) status = 'duplicate_in_file'
    else seen.add(key)

    return { raw, name, phone, key, rowNumber: i + 1, status }
  })

  // 2ª passada: de-para com a base (só para as linhas válidas e únicas)
  const keys = Array.from(new Set(staged.filter(s => s.status === 'new').map(s => s.key)))
  const [members, pipeline] = await Promise.all([
    findMembersByPhone(churchIds, keys),
    findPipelineByPhone(churchIds, keys),
  ])

  return staged.map((s): AnalyzedRow => {
    const member = s.status === 'new' ? members.get(s.key) : undefined
    const attendance = s.status === 'new' ? pipeline.get(s.key) : undefined

    let matchStatus: MatchStatus = s.status
    if (matchStatus === 'new') {
      if (member && attendance) matchStatus = 'both'
      else if (member) matchStatus = 'member'
      else if (attendance) matchStatus = 'pipeline'
    }

    // decisão de envio: inválido/duplicado nunca envia; membro/pipeline só se o
    // usuário marcar "enviar mesmo assim" na fase 2
    let decision: 'send' | 'skip' = 'send'
    if (matchStatus === 'invalid' || matchStatus === 'duplicate_in_file') decision = 'skip'
    else if (matchStatus === 'member') decision = options.includeMembers ? 'send' : 'skip'
    else if (matchStatus === 'pipeline') decision = options.includePipeline ? 'send' : 'skip'
    else if (matchStatus === 'both') {
      decision = options.includeMembers && options.includePipeline ? 'send' : 'skip'
    }

    const email = pick(s.raw, 'email') || null
    const variables: Record<string, string> = {
      nome: s.name,
      primeiro_nome: firstName(s.name),
      telefone: s.phone ?? '',
      igreja: pick(s.raw, 'igreja'),
      regional: pick(s.raw, 'regional'),
      tipo: pick(s.raw, 'tipo'),
      rol: pick(s.raw, 'rol'),
      cargo: pick(s.raw, 'cargo'),
      email: email ?? '',
      data_cadastro: new Date().toLocaleDateString('pt-BR'),
      protocolo: '',
    }

    return {
      rowNumber: s.rowNumber,
      raw: s.raw,
      name: s.name,
      phone: s.phone,
      email,
      variables,
      matchStatus,
      matchedMemberId: member?.id ?? null,
      matchedAttendanceId: attendance?.id ?? null,
      matchedStage: attendance?.stage ?? null,
      decision,
      skipReason: decision === 'skip' ? (SKIP_REASONS[matchStatus] ?? null) : null,
    }
  })
}

/** Resumo mostrado na fase 2 do modal (e no cabeçalho da aba Importações). */
export function summarize(rows: Array<{ status: MatchStatus | string; decision: string }>) {
  const count = (s: MatchStatus) => rows.filter(r => r.status === s).length
  return {
    total: rows.length,
    new: count('new'),
    member: count('member'),
    pipeline: count('pipeline'),
    both: count('both'),
    invalid: count('invalid'),
    duplicate: count('duplicate_in_file'),
    sendable: rows.filter(r => r.decision === 'send').length,
    skipped: rows.filter(r => r.decision === 'skip').length,
  }
}

// ── Card no pipeline (coluna FAZENDO) ────────────────────────────────────────

const DEFAULT_COLUMNS = [
  { name: 'POR FAZER',  position: 0, color: '#94a3b8', column_key: 'todo',      icon: 'circle' },
  { name: 'FAZENDO',    position: 1, color: '#3b82f6', column_key: 'doing',     icon: 'loader' },
  { name: 'CONCLUÍDO',  position: 2, color: '#22c55e', column_key: 'done',      icon: 'check-circle' },
  { name: 'CANCELADO',  position: 3, color: '#ef4444', column_key: 'cancelled', icon: 'x-circle' },
]

/** Pipeline ativo da igreja (cria com as 4 colunas fixas se ainda não existir). */
async function getOrCreatePipeline(churchId: string): Promise<{ pipelineId: string; columnId: string } | null> {
  let { data: pipeline } = await supabaseAdmin
    .from('pastoral_pipelines')
    .select('id')
    .eq('church_id', churchId)
    .eq('active', true)
    .limit(1)
    .maybeSingle()

  if (!pipeline) {
    const { data: created, error } = await supabaseAdmin
      .from('pastoral_pipelines')
      .insert({ church_id: churchId, name: 'Atendimento Pastoral', active: true })
      .select('id')
      .single()
    if (error || !created) return null
    pipeline = created
  }

  const { data: col } = await supabaseAdmin
    .from('pastoral_pipeline_columns')
    .select('id')
    .eq('pipeline_id', pipeline.id)
    .eq('column_key', 'doing')
    .limit(1)
    .maybeSingle()

  if (col) return { pipelineId: pipeline.id, columnId: col.id }

  const { data: inserted } = await supabaseAdmin
    .from('pastoral_pipeline_columns')
    .insert(
      DEFAULT_COLUMNS.map(c => ({ ...c, pipeline_id: pipeline!.id, church_id: churchId, fixed_column: true }))
    )
    .select('id, column_key')

  const doing = inserted?.find(c => c.column_key === 'doing') ?? inserted?.[0]
  return doing ? { pipelineId: pipeline.id, columnId: doing.id } : null
}

export interface PipelineCardInput {
  churchId: string
  name: string
  phone: string
  email?: string | null
  attendanceType: string
  message: string
  campaignName: string
  instanceName: string
  ownerUserId: string
}

/**
 * Cria o card de acompanhamento do envio na coluna FAZENDO + entrada na timeline.
 * Retorna o id do atendimento, ou null se não foi possível criar (nunca lança:
 * uma falha aqui não pode derrubar o envio, que já aconteceu).
 */
export async function createPipelineCardForSend(input: PipelineCardInput): Promise<string | null> {
  try {
    const target = await getOrCreatePipeline(input.churchId)
    if (!target) return null

    const { data: attendance, error } = await supabaseAdmin
      .from('pastoral_attendances')
      .insert({
        church_id: input.churchId,
        pipeline_id: target.pipelineId,
        column_id: target.columnId,
        visitor_name: input.name,
        phone: input.phone,
        email: input.email || null,
        attendance_type: input.attendanceType,
        title: `WhatsApp em massa · ${input.campaignName}`,
        notes: input.message,
        status: 'open',
        priority: 'normal',
        started_at: new Date().toISOString(),
        created_by: input.ownerUserId,
        tags: ['envio-em-massa'],
      })
      .select('id')
      .single()

    if (error || !attendance) {
      console.error('[whatsapp-import] falha ao criar card', error)
      return null
    }

    await supabaseAdmin.from('pastoral_attendance_timeline').insert({
      attendance_id: attendance.id,
      church_id: input.churchId,
      event_type: 'created',
      description: `Mensagem de WhatsApp enviada pela instância ${input.instanceName} (campanha "${input.campaignName}")`,
    })

    return attendance.id as string
  } catch (err) {
    console.error('[whatsapp-import] createPipelineCardForSend', err)
    return null
  }
}
