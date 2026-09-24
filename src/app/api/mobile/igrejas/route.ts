import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jsonSemCache, rotaMobile } from '@/lib/mobile/rota';

/** Painel Mobile — igrejas do campo para os campos "Igreja" dos formulários. */
export async function GET(req: NextRequest) {
  return rotaMobile(req, 'mobile_painel', 'view', async ({ campoId }) => {
    const igrejas = await prisma.church.findMany({
      where: { deletedAt: null, regional: { campoId } },
      orderBy: { name: 'asc' },
      take: 1000,
      select: { id: true, name: true, regional: { select: { name: true } } },
    });
    return jsonSemCache(igrejas.map((i) => ({ id: i.id, nome: i.regional?.name ? `${i.name} · ${i.regional.name}` : i.name })));
  });
}
