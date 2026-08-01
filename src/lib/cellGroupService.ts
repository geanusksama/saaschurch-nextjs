/**
 * Regras do módulo GF (Grupos Familiares) compartilhadas entre as rotas.
 *
 * Server-side apenas.
 */

import { prisma } from '@/lib/prisma'
import { buildAddressLabel } from '@/lib/geo'

export interface CellGroupAddressInput {
  addressStreet?: string | null
  addressNumber?: string | null
  addressComplement?: string | null
  addressNeighborhood?: string | null
  addressCity?: string | null
  addressState?: string | null
  addressZipcode?: string | null
  latitude?: string | number | null
  longitude?: string | number | null
}

function emptyToNull(value: unknown): string | null {
  const text = String(value ?? '').trim()
  return text || null
}

function decimalOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Traduz o corpo do formulário para os campos do banco.
 *
 * `address` continua sendo gravado com o rótulo montado porque as telas antigas
 * do GF leem esse campo direto.
 */
export function cellGroupDataFromBody(body: Record<string, unknown>) {
  const address: CellGroupAddressInput = {
    addressStreet: emptyToNull(body.addressStreet),
    addressNumber: emptyToNull(body.addressNumber),
    addressComplement: emptyToNull(body.addressComplement),
    addressNeighborhood: emptyToNull(body.addressNeighborhood),
    addressCity: emptyToNull(body.addressCity),
    addressState: emptyToNull(body.addressState),
    addressZipcode: emptyToNull(body.addressZipcode),
  }

  const meetingTime = emptyToNull(body.meetingTime)

  return {
    name: String(body.name ?? '').trim(),
    cellType: emptyToNull(body.network) ?? emptyToNull(body.cellType),
    leaderId: emptyToNull(body.leaderId),
    color: emptyToNull(body.color),
    photo: emptyToNull(body.photo),
    meetingDay: emptyToNull(body.meetingDay),
    meetingTime: meetingTime ? new Date(`1970-01-01T${meetingTime}:00Z`) : null,
    ...address,
    address: buildAddressLabel(address) || null,
    latitude: decimalOrNull(body.latitude),
    longitude: decimalOrNull(body.longitude),
  }
}

/**
 * Tag do GF, criada sob demanda. É ela que aparece colorida no perfil de quem
 * participa do grupo, e some junto com o GF (FK em cascata).
 */
export async function ensureCellGroupTag(cellGroupId: string) {
  const existing = await prisma.memberTag.findFirst({ where: { cellGroupId } })
  if (existing) return existing

  const cell = await prisma.cellGroup.findUnique({
    where: { id: cellGroupId },
    select: { id: true, name: true, color: true, churchId: true },
  })
  if (!cell) return null

  const name = `GF ${cell.name}`.slice(0, 100)
  const color = /^#[0-9a-f]{6}$/i.test(cell.color ?? '') ? cell.color : '#8b5cf6'

  // A tag é única por (igreja, nome): se a secretaria já tinha criado uma com
  // esse nome à mão, adotamos ela em vez de estourar erro de duplicidade.
  const sameName = await prisma.memberTag.findUnique({
    where: { churchId_name: { churchId: cell.churchId, name } },
  })
  if (sameName) {
    return prisma.memberTag.update({ where: { id: sameName.id }, data: { cellGroupId } })
  }

  return prisma.memberTag.create({ data: { churchId: cell.churchId, name, color, cellGroupId } })
}

export async function assignCellGroupTag(cellGroupId: string, memberId: string) {
  const tag = await ensureCellGroupTag(cellGroupId)
  if (!tag) return
  await prisma.memberTagAssignment.upsert({
    where: { memberId_tagId: { memberId, tagId: tag.id } },
    create: { memberId, tagId: tag.id },
    update: {},
  })
}

export async function removeCellGroupTag(cellGroupId: string, memberId: string) {
  const tag = await prisma.memberTag.findFirst({ where: { cellGroupId } })
  if (!tag) return
  await prisma.memberTagAssignment
    .delete({ where: { memberId_tagId: { memberId, tagId: tag.id } } })
    .catch(() => null)
}
