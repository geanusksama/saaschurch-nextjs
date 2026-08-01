/**
 * Lista pública de Grupos Familiares — usada pela home (ícone "Grupos
 * Familiares") e pela rota /api/public/gf-list. Extraído para cá para que o
 * E2E exercite a mesma consulta/transformação usada em produção, e não uma
 * cópia (mesmo padrão de gfContactReportService.ts).
 */

import { prisma } from './prisma';

// Mesma sede usada nas demais rotas públicas do site (pastoral/adesão) —
// este site é o portal público de UMA igreja só, então os GFs listados aqui
// são os dela.
export const DEFAULT_SEDE_ID = '6d2688df-5249-4bd2-89cc-0cd8c324b3d8';

export interface PublicGfItem {
  id: string;
  name: string;
  description: string | null;
  cellType: string | null;
  meetingDay: string | null;
  meetingTime: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  addressNeighborhood: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressZipcode: string | null;
  latitude: number | null;
  longitude: number | null;
  color: string | null;
  photo: string | null;
  leaderName: string | null;
  leaderPhone: string | null;
  leaderPhotoUrl: string | null;
}

export async function listPublicGfs(churchId: string = DEFAULT_SEDE_ID): Promise<PublicGfItem[]> {
  const cells = await prisma.cellGroup.findMany({
    where: {
      churchId,
      deletedAt: null,
      status: 'active',
    },
    select: {
      id: true,
      name: true,
      description: true,
      cellType: true,
      meetingDay: true,
      meetingTime: true,
      addressStreet: true,
      addressNumber: true,
      addressComplement: true,
      addressNeighborhood: true,
      addressCity: true,
      addressState: true,
      addressZipcode: true,
      latitude: true,
      longitude: true,
      color: true,
      photo: true,
      leader: { select: { fullName: true, phone: true, mobile: true, photoUrl: true } },
    },
    orderBy: { name: 'asc' },
  });

  return cells.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    cellType: c.cellType,
    meetingDay: c.meetingDay,
    // devolvido só HH:mm — toISOString() (não String()!), senão o horário sai
    // deslocado pelo fuso do servidor (ex.: 19:50 virava 16:50 em UTC-3)
    meetingTime: c.meetingTime ? c.meetingTime.toISOString().slice(11, 16) : null,
    addressStreet: c.addressStreet,
    addressNumber: c.addressNumber,
    addressComplement: c.addressComplement,
    addressNeighborhood: c.addressNeighborhood,
    addressCity: c.addressCity,
    addressState: c.addressState,
    addressZipcode: c.addressZipcode,
    latitude: c.latitude ? Number(c.latitude) : null,
    longitude: c.longitude ? Number(c.longitude) : null,
    color: c.color,
    photo: c.photo,
    leaderName: c.leader?.fullName ?? null,
    leaderPhone: c.leader?.mobile || c.leader?.phone || null,
    leaderPhotoUrl: c.leader?.photoUrl ?? null,
  }));
}
