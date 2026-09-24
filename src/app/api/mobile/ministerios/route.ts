import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jsonSemCache, rotaMobile } from '@/lib/mobile/rota';

/** Painel Mobile — ministérios ativos do campo para o campo "Ministério" das categorias. */
export async function GET(req: NextRequest) {
  return rotaMobile(req, 'mobile_painel', 'view', async ({ campoId }) => {
    const mins = await prisma.ministry.findMany({
      where: { deletedAt: null, isActive: true, OR: [{ campoId }, { church: { regional: { campoId } } }] },
      orderBy: { name: 'asc' },
      take: 500,
      select: { id: true, name: true, church: { select: { name: true } } },
    });
    return jsonSemCache(mins.map((m) => ({ id: m.id, nome: m.church?.name ? `${m.name} · ${m.church.name}` : m.name })));
  });
}
