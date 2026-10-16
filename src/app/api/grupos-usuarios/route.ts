/**
 * Grupos de usuários do campo ativo — modelo Active Directory: o grupo junta
 * usuários e leva regras granulares e igrejas. Quem está em ao menos um grupo
 * passa a valer só pela regra do(s) grupo(s).
 * Ver docs/modules/permissoes-granulares/SPEC.md.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/auth';
import { campoAtivoId } from '@/lib/campoAtivo';
import { exigirGestaoDeGrupos, limparRegras } from '@/lib/permissoes/grupos';

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const negado = await exigirGestaoDeGrupos(user, false);
    if (negado) return negado;

    // ?userId= : em quais grupos este usuário está (aviso na tela dele).
    const userId = new URL(req.url).searchParams.get('userId');

    const grupos = await prisma.grupoUsuarios.findMany({
      where: {
        campoId: campoAtivoId(user),
        deletedAt: null,
        ...(userId ? { users: { some: { userId } } } : {}),
      },
      select: {
        id: true,
        name: true,
        description: true,
        isActive: true,
        updatedAt: true,
        _count: { select: { users: true, igrejas: true } },
      },
      orderBy: { name: 'asc' },
      take: 500,
    });
    return NextResponse.json(grupos, { headers: { 'Cache-Control': 'no-store' } });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const negado = await exigirGestaoDeGrupos(user, true);
    if (negado) return negado;
    if (!user.campoId) {
      return NextResponse.json({ error: 'Selecione um campo antes de criar o grupo.' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const name = String(body.name ?? '').trim();
    if (!name) return NextResponse.json({ error: 'Informe o nome do grupo.' }, { status: 400 });
    if (name.length > 120) {
      return NextResponse.json({ error: 'Nome com no máximo 120 caracteres.' }, { status: 400 });
    }

    const repetido = await prisma.grupoUsuarios.findFirst({
      where: { campoId: user.campoId, deletedAt: null, name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (repetido) {
      return NextResponse.json({ error: 'Já existe um grupo com este nome neste campo.' }, { status: 409 });
    }

    const grupo = await prisma.grupoUsuarios.create({
      data: {
        campoId: user.campoId,
        name,
        description: body.description ? String(body.description).trim() : null,
        // Grupo novo nasce sem nada liberado: whitelist (SPEC, D5).
        permissions: limparRegras(body.permissions),
        createdBy: user.id,
      },
    });
    return NextResponse.json(grupo, { status: 201 });
  });
}
