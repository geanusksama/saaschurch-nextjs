import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/auth';
import { exigirGestaoDeGrupos, grupoDoCampo, grupoNaoEncontrado } from '@/lib/permissoes/grupos';

type Params = { params: Promise<{ id: string }> };

/**
 * Troca a lista inteira de igrejas do grupo. Lista vazia = o grupo não
 * restringe igreja (vale a lotação de cada usuário, como hoje).
 */
export async function PUT(req: NextRequest, { params }: Params) {
  return withAuth(req, async (user) => {
    const negado = await exigirGestaoDeGrupos(user, true);
    if (negado) return negado;
    const { id } = await params;
    const grupo = await grupoDoCampo(id, user);
    if (!grupo) return grupoNaoEncontrado();

    const body = await req.json().catch(() => ({}));
    const pedidas: string[] = Array.isArray(body.churchIds)
      ? [...new Set(body.churchIds.filter((x: unknown): x is string => typeof x === 'string') as string[])]
      : [];

    const doCampo = pedidas.length
      ? await prisma.church.findMany({
          where: { id: { in: pedidas }, deletedAt: null, regional: { campoId: grupo.campoId } },
          select: { id: true },
        })
      : [];
    if (doCampo.length !== pedidas.length) {
      return NextResponse.json({ error: 'Há igreja que não pertence a este campo.' }, { status: 403 });
    }

    // deleteMany + createMany: duas idas ao banco, sem transação interativa
    // (que estoura em ~7 statements no pooler — AGENTS.md).
    await prisma.$transaction([
      prisma.grupoUsuariosIgreja.deleteMany({ where: { grupoId: id } }),
      prisma.grupoUsuariosIgreja.createMany({
        data: pedidas.map((churchId) => ({ grupoId: id, churchId })),
      }),
    ]);
    return NextResponse.json({ igrejas: pedidas.length });
  });
}
