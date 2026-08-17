/**
 * Campanhas da Secretaria — tipos do formulário dinâmico e o de-para com o
 * cadastro do membro.
 *
 * A campanha guarda as perguntas em `secretaria_campaigns.form_schema` (jsonb).
 * Cada pergunta pode ser ligada a uma coluna de `members` pelo `memberField`;
 * é isso, e só isso, que a aprovação grava no cadastro. Pergunta sem
 * `memberField` fica só na resposta (serve para "qual seu horário livre?",
 * "confirma presença?", etc.).
 *
 * Compartilhado entre servidor e cliente — não importar nada de servidor aqui.
 */

export type CampaignFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'email'
  | 'phone'
  | 'cpf'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'image'
  | 'file'

export interface CampaignFieldOption {
  /** valor gravado na resposta */
  value: string
  /** texto mostrado para quem preenche */
  label: string
}

export interface SecretariaCampaignField {
  /** estável: é a chave dentro de `answers`. Nunca reaproveitar entre perguntas. */
  id: string
  type: CampaignFieldType
  label: string
  description?: string
  placeholder?: string
  required?: boolean
  /** só para select | radio | checkbox */
  options?: CampaignFieldOption[]
  /** coluna de `members` atualizada na aprovação; null = pergunta livre */
  memberField?: MemberFieldKey | null
}

/** Tipos que produzem arquivo em vez de texto. */
export const FILE_FIELD_TYPES: CampaignFieldType[] = ['image', 'file']

export const FIELD_TYPE_LABELS: Record<CampaignFieldType, string> = {
  text: 'Texto curto',
  textarea: 'Texto longo',
  number: 'Número',
  date: 'Data',
  email: 'E-mail',
  phone: 'Telefone / WhatsApp',
  cpf: 'CPF',
  select: 'Lista suspensa',
  radio: 'Escolha única (radio)',
  checkbox: 'Múltipla escolha (checkbox)',
  image: 'Foto / imagem',
  file: 'Arquivo PDF',
}

// ── De-para com a tabela `members` ───────────────────────────────────────────
// Lista fechada de propósito: a aprovação só escreve no que está aqui. Uma
// campanha nunca pode mexer em ROL, igreja, título ou status — essas mudanças
// têm processo próprio (transferência, consagração, matriz do pipeline).

export type MemberValueKind = 'string' | 'date' | 'digits' | 'url' | 'number'

export interface MemberFieldSpec {
  /** nome do campo no Prisma (client-side é só rótulo/identificador) */
  prismaField: string
  label: string
  group: string
  kind: MemberValueKind
  /** tipos de pergunta que fazem sentido para esse campo */
  accepts: readonly CampaignFieldType[]
  /** tamanho máximo da coluna, quando há */
  maxLength?: number
  /**
   * `false` tira o campo das campanhas. A campanha pede ao próprio membro
   * aquilo que só ele sabe corrigir (CPF errado, celular novo, CEP, zona
   * eleitoral). Nome civil, filiação e batismo mudam por processo da
   * secretaria — com documento na mão — e por isso não entram aqui.
   * Ausente = elegível.
   */
  campaignEligible?: boolean
  /** opções prontas: o campo escolhido pelo chip já nasce respondível */
  suggestedOptions?: readonly CampaignFieldOption[]
}

const OPCOES_SEXO = [
  { value: 'MASCULINO', label: 'Masculino' },
  { value: 'FEMININO', label: 'Feminino' },
] as const

// Mesmos valores gravados pelas telas de cadastro de membro (MemberRegistration
// / MemberEdit). Gravar outra grafia aqui criaria mais um dialeto na coluna.
const OPCOES_ESTADO_CIVIL = [
  { value: 'SOLTEIRO', label: 'Solteiro(a)' },
  { value: 'CASADO', label: 'Casado(a)' },
  { value: 'DIVORCIADO', label: 'Divorciado(a)' },
  { value: 'VIUVO', label: 'Viúvo(a)' },
] as const

export const MEMBER_FIELD_MAP = {
  full_name:              { prismaField: 'fullName',              label: 'Nome completo',        group: 'Identificação', kind: 'string', accepts: ['text'], maxLength: 255, campaignEligible: false },
  preferred_name:         { prismaField: 'preferredName',         label: 'Como gosta de ser chamado', group: 'Identificação', kind: 'string', accepts: ['text'], maxLength: 100 },
  photo_url:              { prismaField: 'photoUrl',              label: 'Foto de perfil',       group: 'Identificação', kind: 'url',    accepts: ['image'], maxLength: 500 },
  birth_date:             { prismaField: 'birthDate',             label: 'Data de nascimento',   group: 'Identificação', kind: 'date',   accepts: ['date'] },
  gender:                 { prismaField: 'gender',                label: 'Sexo',                 group: 'Identificação', kind: 'string', accepts: ['select', 'radio'], maxLength: 20, suggestedOptions: OPCOES_SEXO },
  marital_status:         { prismaField: 'maritalStatus',         label: 'Estado civil',         group: 'Identificação', kind: 'string', accepts: ['select', 'radio'], maxLength: 20, suggestedOptions: OPCOES_ESTADO_CIVIL },

  cpf:                    { prismaField: 'cpf',                   label: 'CPF',                  group: 'Documentos',    kind: 'digits', accepts: ['cpf', 'text'], maxLength: 14 },
  rg:                     { prismaField: 'rg',                    label: 'RG',                   group: 'Documentos',    kind: 'string', accepts: ['text'], maxLength: 20 },
  voter_registration:     { prismaField: 'voterRegistration',     label: 'Título de eleitor',    group: 'Documentos',    kind: 'string', accepts: ['text'], maxLength: 20 },
  voter_zone:             { prismaField: 'voterZone',             label: 'Zona eleitoral',       group: 'Documentos',    kind: 'string', accepts: ['text'], maxLength: 10 },
  voter_section:          { prismaField: 'voterSection',          label: 'Seção eleitoral',      group: 'Documentos',    kind: 'string', accepts: ['text'], maxLength: 10 },

  email:                  { prismaField: 'email',                 label: 'E-mail',               group: 'Contato',       kind: 'string', accepts: ['email', 'text'], maxLength: 255 },
  phone:                  { prismaField: 'phone',                 label: 'Telefone fixo',        group: 'Contato',       kind: 'string', accepts: ['phone', 'text'], maxLength: 20 },
  mobile:                 { prismaField: 'mobile',                label: 'Celular / WhatsApp',   group: 'Contato',       kind: 'string', accepts: ['phone', 'text'], maxLength: 20 },
  emergency_contact_name: { prismaField: 'emergencyContactName',  label: 'Contato de emergência (nome)',  group: 'Contato', kind: 'string', accepts: ['text'], maxLength: 255 },
  emergency_contact_phone:{ prismaField: 'emergencyContactPhone', label: 'Contato de emergência (telefone)', group: 'Contato', kind: 'string', accepts: ['phone', 'text'], maxLength: 20 },

  address_street:         { prismaField: 'addressStreet',         label: 'Rua',                  group: 'Endereço',      kind: 'string', accepts: ['text'], maxLength: 255 },
  address_number:         { prismaField: 'addressNumber',         label: 'Número',               group: 'Endereço',      kind: 'string', accepts: ['text', 'number'], maxLength: 20 },
  address_complement:     { prismaField: 'addressComplement',     label: 'Complemento',          group: 'Endereço',      kind: 'string', accepts: ['text'], maxLength: 100 },
  address_neighborhood:   { prismaField: 'addressNeighborhood',   label: 'Bairro',               group: 'Endereço',      kind: 'string', accepts: ['text'], maxLength: 100 },
  address_city:           { prismaField: 'addressCity',           label: 'Cidade',               group: 'Endereço',      kind: 'string', accepts: ['text'], maxLength: 100 },
  address_state:          { prismaField: 'addressState',          label: 'Estado (UF)',          group: 'Endereço',      kind: 'string', accepts: ['text', 'select'], maxLength: 50 },
  address_zipcode:        { prismaField: 'addressZipcode',        label: 'CEP',                  group: 'Endereço',      kind: 'string', accepts: ['text'], maxLength: 10 },

  // Filiação é ficha de secretaria (entra na admissão, conferida com documento).
  father_name:            { prismaField: 'fatherName',            label: 'Nome do pai',          group: 'Família',       kind: 'string', accepts: ['text'], maxLength: 255, campaignEligible: false },
  mother_name:            { prismaField: 'motherName',            label: 'Nome da mãe',          group: 'Família',       kind: 'string', accepts: ['text'], maxLength: 255, campaignEligible: false },
  spouse_name:            { prismaField: 'spouseName',            label: 'Nome do cônjuge',      group: 'Família',       kind: 'string', accepts: ['text'], maxLength: 255, campaignEligible: false },

  naturality_city:        { prismaField: 'naturalityCity',        label: 'Cidade de nascimento', group: 'Naturalidade',  kind: 'string', accepts: ['text'], maxLength: 100 },
  naturality_state:       { prismaField: 'naturalityState',       label: 'UF de nascimento',     group: 'Naturalidade',  kind: 'string', accepts: ['text', 'select'], maxLength: 2 },
  nationality:            { prismaField: 'nationality',           label: 'Nacionalidade',        group: 'Naturalidade',  kind: 'string', accepts: ['text'], maxLength: 100 },

  occupation:             { prismaField: 'occupation',            label: 'Profissão',            group: 'Profissional',  kind: 'string', accepts: ['text'], maxLength: 255 },
  company:                { prismaField: 'company',               label: 'Empresa',              group: 'Profissional',  kind: 'string', accepts: ['text'], maxLength: 255 },

  // Batismo é ato eclesiástico registrado pela secretaria, não autodeclaração.
  baptism_date:           { prismaField: 'baptismDate',           label: 'Data de batismo',      group: 'Eclesiástico',  kind: 'date',   accepts: ['date'], campaignEligible: false },
  notes:                  { prismaField: 'notes',                 label: 'Observações',          group: 'Outros',        kind: 'string', accepts: ['textarea', 'text'] },
} as const satisfies Record<string, MemberFieldSpec>

export type MemberFieldKey = keyof typeof MEMBER_FIELD_MAP

export const MEMBER_FIELD_KEYS = Object.keys(MEMBER_FIELD_MAP) as MemberFieldKey[]

export function getMemberFieldSpec(key: string | null | undefined): MemberFieldSpec | null {
  if (!key) return null
  return (MEMBER_FIELD_MAP as Record<string, MemberFieldSpec>)[key] ?? null
}

/** O campo pode ser pedido numa campanha? (ver `campaignEligible`) */
export function isCampaignEligible(key: string | null | undefined): boolean {
  const spec = getMemberFieldSpec(key)
  return !!spec && spec.campaignEligible !== false
}

/** Só os campos que uma campanha pode atualizar. */
export const CAMPAIGN_FIELD_KEYS = MEMBER_FIELD_KEYS.filter(isCampaignEligible)

/**
 * Agrupa os campos disponíveis para montar o seletor do construtor.
 * Por padrão devolve só os elegíveis a campanha — é o que a tela oferece.
 */
export function memberFieldsByGroup(
  { todos = false }: { todos?: boolean } = {}
): { group: string; fields: { key: MemberFieldKey; spec: MemberFieldSpec }[] }[] {
  const byGroup = new Map<string, { key: MemberFieldKey; spec: MemberFieldSpec }[]>()
  for (const key of MEMBER_FIELD_KEYS) {
    if (!todos && !isCampaignEligible(key)) continue
    const spec = MEMBER_FIELD_MAP[key] as MemberFieldSpec
    if (!byGroup.has(spec.group)) byGroup.set(spec.group, [])
    byGroup.get(spec.group)!.push({ key, spec })
  }
  return Array.from(byGroup, ([group, fields]) => ({ group, fields }))
}

/**
 * Pergunta pronta a partir de uma coluna do cadastro — é o que o seletor de
 * chips monta. O tipo é o primeiro que o campo aceita (o mais natural dele) e
 * as opções vêm do próprio catálogo, então nada fica pela metade.
 */
export function buildFieldFromMemberKey(key: MemberFieldKey, taken: Set<string>): SecretariaCampaignField {
  const spec = MEMBER_FIELD_MAP[key] as MemberFieldSpec
  const type = spec.accepts[0]
  const id = slugFieldId(spec.label, taken)
  return {
    id,
    type,
    label: spec.label,
    required: false,
    memberField: key,
    options: spec.suggestedOptions ? spec.suggestedOptions.map(o => ({ ...o })) : undefined,
  }
}

// ── Validação do schema (roda no servidor ao salvar a campanha) ───────────────

export interface SchemaValidationResult {
  ok: boolean
  errors: string[]
  fields: SecretariaCampaignField[]
}

const ID_RE = /^[a-z0-9_]{1,40}$/

export function validateFormSchema(raw: unknown): SchemaValidationResult {
  const errors: string[] = []
  if (!Array.isArray(raw)) return { ok: false, errors: ['O formulário precisa ser uma lista de perguntas.'], fields: [] }

  const fields: SecretariaCampaignField[] = []
  const vistos = new Set<string>()
  const camposUsados = new Set<string>()

  raw.forEach((item, i) => {
    const pos = `Pergunta ${i + 1}`
    const f = item as Partial<SecretariaCampaignField>

    const id = String(f.id ?? '').trim()
    if (!ID_RE.test(id)) {
      errors.push(`${pos}: identificador inválido (use letras minúsculas, números e _).`)
      return
    }
    if (vistos.has(id)) {
      errors.push(`${pos}: identificador "${id}" repetido.`)
      return
    }
    vistos.add(id)

    const type = String(f.type ?? '') as CampaignFieldType
    if (!(type in FIELD_TYPE_LABELS)) {
      errors.push(`${pos}: tipo de campo desconhecido.`)
      return
    }

    const label = String(f.label ?? '').trim()
    if (!label) {
      errors.push(`${pos}: o título da pergunta é obrigatório.`)
      return
    }

    let options: CampaignFieldOption[] | undefined
    if (type === 'select' || type === 'radio' || type === 'checkbox') {
      const rawOpts = Array.isArray(f.options) ? f.options : []
      options = rawOpts
        .map(o => ({ value: String(o?.value ?? o?.label ?? '').trim(), label: String(o?.label ?? o?.value ?? '').trim() }))
        .filter(o => o.value && o.label)
      if (!options.length) {
        errors.push(`${pos}: campos de escolha precisam de pelo menos uma opção.`)
        return
      }
    }

    let memberField: MemberFieldKey | null = null
    const rawMember = f.memberField ? String(f.memberField) : ''
    if (rawMember) {
      const spec = getMemberFieldSpec(rawMember)
      if (!spec) {
        errors.push(`${pos}: campo do cadastro "${rawMember}" não é atualizável por campanha.`)
        return
      }
      if (spec.campaignEligible === false) {
        errors.push(
          `${pos}: "${spec.label}" é rotina da secretaria e não pode ser pedido em campanha.`
        )
        return
      }
      if (!spec.accepts.includes(type)) {
        errors.push(`${pos}: "${spec.label}" não aceita o tipo "${FIELD_TYPE_LABELS[type]}".`)
        return
      }
      if (camposUsados.has(rawMember)) {
        errors.push(`${pos}: "${spec.label}" já está ligado a outra pergunta.`)
        return
      }
      camposUsados.add(rawMember)
      memberField = rawMember as MemberFieldKey
    }

    fields.push({
      id,
      type,
      label,
      description: f.description ? String(f.description).slice(0, 500) : undefined,
      placeholder: f.placeholder ? String(f.placeholder).slice(0, 120) : undefined,
      required: !!f.required,
      options,
      memberField,
    })
  })

  return { ok: errors.length === 0, errors, fields }
}

/** Gera um id de pergunta a partir do título, sem colidir com os já usados. */
export function slugFieldId(label: string, taken: Set<string>): string {
  const base =
    label
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 32) || 'campo'
  let id = base
  let n = 2
  while (taken.has(id)) id = `${base}_${n++}`
  return id
}
