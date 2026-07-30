import { prisma } from '@/lib/prisma'
import type { AuthUser } from '@/lib/auth'
import { isRestrictedToOwnChurch } from '@/lib/helpers'

/**
 * Escopo de visibilidade das Campanhas da Secretaria.
 *
 * Mesma regra do módulo de membros e do envio em massa: master vê tudo, admin
 * vê o campo dele, e quem é secretaria/tesouraria/perfil de igreja fica preso à
 * própria igreja. Nunca confiar no filtro que veio da tela — o filtro do
 * usuário só pode ESTREITAR o que este arquivo já permitiu.
 */

export interface AudienceFilters {
  regionalIds?: string[]
  churchIds?: string[]
  zones?: string[]
  titleIds?: string[]
  titleNames?: string[]
  /** situação de membresia (ATIVO, INATIVO, ...) */
  statuses?: string[]
  /** true = só quem tem telefone; padrão true, porque sem telefone não há envio */
  requirePhone?: boolean
  /** busca por nome ou ROL */
  q?: string
}

export class ScopeError extends Error {
  status: number
  constructor(message: string, status = 403) {
    super(message)
    this.status = status
  }
}

/**
 * Campo ao qual o usuário está preso.
 *
 * O **master também entra aqui**: ele administra o campo em que está logado, e
 * para ver outro campo troca de campo (com senha). É a mesma regra do módulo de
 * usuários — sem isso, o filtro de público-alvo misturava regionais de campos
 * diferentes numa lista só.
 *
 * Master sem campo definido (conta global) continua vendo tudo.
 */
function campoDoUsuario(user: AuthUser): string | null {
  return user.campoId || null
}

/** Ids das igrejas que o usuário pode enxergar, já cruzados com o filtro pedido. */
export async function resolveVisibleChurches(user: AuthUser, filters: AudienceFilters = {}) {
  const where: Record<string, unknown> = { deletedAt: null }

  const campoId = campoDoUsuario(user)
  if (campoId) {
    where.regional = { campoId }
  } else if (user.profileType !== 'master') {
    throw new ScopeError('Sem acesso. Campo não definido.')
  }
  if (isRestrictedToOwnChurch(user)) {
    if (!user.churchId) throw new ScopeError('Sem acesso. Igreja não definida.')
    where.id = user.churchId
  }

  const churches = await prisma.church.findMany({
    where,
    select: { id: true, name: true, zone: true, regionalId: true, regional: { select: { id: true, name: true } } },
    orderBy: { name: 'asc' },
  })

  // filtros da tela — só estreitam
  const byRegional = filters.regionalIds?.length ? new Set(filters.regionalIds) : null
  const byChurch = filters.churchIds?.length ? new Set(filters.churchIds) : null
  const byZone = filters.zones?.length ? new Set(filters.zones) : null

  return churches.filter(c => {
    if (byChurch && !byChurch.has(c.id)) return false
    if (byRegional && !byRegional.has(c.regionalId)) return false
    if (byZone && !byZone.has(c.zone ?? '')) return false
    return true
  })
}

export interface AudienceMember {
  memberId: string
  name: string
  phone: string | null
  rol: number | null
  churchId: string
  churchName: string
  regionalId: string | null
  regionalName: string | null
  zone: string | null
  titleName: string | null
  status: string | null
}

/**
 * Membros do público-alvo. `limit` alto de propósito: uma regional inteira passa
 * fácil de mil pessoas, e anexar em partes seria pior do que carregar de uma vez.
 */
export async function resolveAudienceMembers(
  user: AuthUser,
  filters: AudienceFilters,
  limit = 5000
): Promise<{ members: AudienceMember[]; churchCount: number }> {
  const churches = await resolveVisibleChurches(user, filters)
  if (!churches.length) return { members: [], churchCount: 0 }

  const churchById = new Map(churches.map(c => [c.id, c]))
  const and: object[] = [{ churchId: { in: churches.map(c => c.id) } }]

  // Título eclesiástico: o cadastro tem a FK em uns e só o texto em outros.
  // Casar pelos dois evita o buraco de sumir com metade dos presbíteros.
  const titleIds = filters.titleIds?.filter(Boolean) ?? []
  const titleNames = [...(filters.titleNames ?? [])]
  if (titleIds.length) {
    const titles = await prisma.ecclesiasticalTitle.findMany({
      where: { id: { in: titleIds } },
      select: { name: true },
    })
    titleNames.push(...titles.map(t => t.name))
  }
  if (titleIds.length || titleNames.length) {
    and.push({
      OR: [
        ...(titleIds.length ? [{ ecclesiasticalTitleId: { in: titleIds } }] : []),
        ...titleNames.map(name => ({
          ecclesiasticalTitle: { equals: name, mode: 'insensitive' as const },
        })),
      ],
    })
  }

  if (filters.statuses?.length) {
    and.push({ membershipStatus: { in: filters.statuses } })
  }

  if (filters.requirePhone !== false) {
    and.push({ OR: [{ phone: { not: null } }, { mobile: { not: null } }] })
  }

  const q = (filters.q ?? '').trim()
  if (q) {
    if (/^\d+$/.test(q)) {
      and.push({ OR: [{ rol: Number(q) }, { phone: { contains: q } }, { mobile: { contains: q } }] })
    } else {
      and.push({ fullName: { contains: q, mode: 'insensitive' } })
    }
  }

  const rows = await prisma.member.findMany({
    where: { deletedAt: null, AND: and },
    select: {
      id: true, fullName: true, phone: true, mobile: true, rol: true,
      churchId: true, ecclesiasticalTitle: true, membershipStatus: true,
      ecclesiasticalTitleRef: { select: { name: true } },
    },
    orderBy: [{ fullName: 'asc' }],
    take: limit,
  })

  const members: AudienceMember[] = rows.map(m => {
    const church = churchById.get(m.churchId)
    return {
      memberId: m.id,
      name: m.fullName,
      phone: (m.mobile || m.phone || '').replace(/\D/g, '') || null,
      rol: m.rol ?? null,
      churchId: m.churchId,
      churchName: church?.name ?? '',
      regionalId: church?.regional?.id ?? null,
      regionalName: church?.regional?.name ?? null,
      zone: church?.zone ?? null,
      titleName: m.ecclesiasticalTitleRef?.name ?? m.ecclesiasticalTitle ?? null,
      status: m.membershipStatus ?? null,
    }
  })

  return { members, churchCount: churches.length }
}

/** A campanha é visível para o dono, para o master, e para quem está no mesmo escopo. */
export async function canAccessCampaign(
  user: AuthUser,
  campaign: { owner_user_id: string; church_id: string | null }
): Promise<boolean> {
  if (user.profileType === 'master') return true
  if (String(user.id) === campaign.owner_user_id) return true
  if (!campaign.church_id) return false

  const churches = await resolveVisibleChurches(user).catch(() => [])
  return churches.some(c => c.id === campaign.church_id)
}
