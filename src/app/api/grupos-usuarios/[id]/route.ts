import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/auth';
import {
  exigirGestaoDeGrupos,
  grupoDoCampo,
  grupoNaoEncontrado,
  limparRegras,
} from '@/lib/permissoes/grupos';

type Params = { params: Promise<{ id: string }> };

/** Grupo com as regras, os usuários e as igrejas. */
export async function GET(req: NextRequest, { params }: Params) {
  return withAuth(req, async (user) => {
    const negado = await exigirGestaoDeGrupos(user, false);
    if (negado) return negado;
    const { id } = await params;
    if (!(await grupoDoCampo(id, user))) return grupoNaoEncontrado();

    const grupo = await prisma.grupoUsuarios.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        permissions: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        users: {
          select: {
            createdAt: true,
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                profileType: true,
                isActive: true,
                role: { select: { name: true } },
                church: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { user: { fullName: 'asc' } },
        },
        igrejas: { select: { churchId: true } },
      },
    });
    return NextResponse.json(
      {
        ...grupo,
        users: grupo?.users.map((u) => ({ ...u.user, adicionadoEm: u.createdAt })) ?? [],
        igrejas: grupo?.igrejas.map((i) => i.churchId) ?? [],
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return withAuth(req, async (user) => {
    const negado = await exigirGestaoDeGrupos(user, true);
    if (negado) return negado;
    const { id } = await params;
    const grupo = await grupoDoCampo(id, user);
    if (!grupo) return grupoNaoEncontrado();

    const body = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) return NextResponse.json({ error: 'Informe o nome do grupo.' }, { status: 400 });
      const repetido = await prisma.grupoUsuarios.findFirst({
        where: {
          campoId: grupo.campoId,
          deletedAt: null,
          id: { not: id },
          name: { equals: name, mode: 'insensitive' },
        },
        select: { id: true },
      });
      if (repetido) {
        return NextResponse.json({ error: 'Já existe um grupo com este nome neste campo.' }, { status: 409 });
      }
      data.name = name.slice(0, 120);
    }
    if (body.description !== undefined) data.description = String(body.description ?? '').trim() || null;
    if (typeof body.isActive === 'boolean') data.isActive = body.isActive;
    if (body.permissions !== undefined) data.permissions = limparRegras(body.permissions);

    if (!Object.keys(data).length) {
      return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 400 });
    }
    const atualizado = await prisma.grupoUsuarios.update({ where: { id }, data });
    return NextResponse.json(atualizado);
  });
}

/** Soft delete: os usuários saem do grupo e voltam às regras de antes. */
export async function DELETE(req: NextRequest, { params }: Params) {
  return withAuth(req, async (user) => {
    const negado = await exigirGestaoDeGrupos(user, true);
    if (negado) return negado;
    const { id } = await params;
    if (!(await grupoDoCampo(id, user))) return grupoNaoEncontrado();

    // auth.ts só considera grupo ativo e não excluído: marcar basta para
    // tirar o efeito; os vínculos ficam para a auditoria.
    await prisma.grupoUsuarios.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    return NextResponse.json({ ok: true });
  });
}
