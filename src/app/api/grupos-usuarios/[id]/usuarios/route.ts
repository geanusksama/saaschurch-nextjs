import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/auth';
import {
  exigirGestaoDeGrupos,
  grupoDoCampo,
  grupoNaoEncontrado,
  usuariosDoCampo,
} from '@/lib/permissoes/grupos';

type Params = { params: Promise<{ id: string }> };

/** Adiciona usuários ao grupo. Só usuários do campo do grupo. */
export async function POST(req: NextRequest, { params }: Params) {
  return withAuth(req, async (user) => {
    const negado = await exigirGestaoDeGrupos(user, true);
    if (negado) return negado;
    const { id } = await params;
    const grupo = await grupoDoCampo(id, user);
    if (!grupo) return grupoNaoEncontrado();

    const body = await req.json().catch(() => ({}));
    const pedidos: string[] = Array.isArray(body.userIds)
      ? [...new Set(body.userIds.filter((x: unknown): x is string => typeof x === 'string') as string[])]
      : [];
    if (!pedidos.length) return NextResponse.json({ error: 'Informe os usuários.' }, { status: 400 });
    if (pedidos.length > 200) {
      return NextResponse.json({ error: 'No máximo 200 usuários por vez.' }, { status: 400 });
    }

    const validos = await usuariosDoCampo(pedidos, grupo.campoId);
    const fora = pedidos.filter((p) => !validos.includes(p));
    if (fora.length) {
      return NextResponse.json(
        { error: 'Há usuário que não pertence a este campo.', userIds: fora },
        { status: 403 },
      );
    }

    // createMany + skipDuplicates: uma ida ao banco, e repetir não dá erro.
    const r = await prisma.grupoUsuariosUser.createMany({
      data: validos.map((userId) => ({ grupoId: id, userId, createdBy: user.id })),
      skipDuplicates: true,
    });
    return NextResponse.json({ adicionados: r.count }, { status: 201 });
  });
}

/** Tira um usuário do grupo: ?userId=. */
export async function DELETE(req: NextRequest, { params }: Params) {
  return withAuth(req, async (user) => {
    const negado = await exigirGestaoDeGrupos(user, true);
    if (negado) return negado;
    const { id } = await params;
    if (!(await grupoDoCampo(id, user))) return grupoNaoEncontrado();

    const userId = new URL(req.url).searchParams.get('userId');
    if (!userId) return NextResponse.json({ error: 'Informe o usuário.' }, { status: 400 });

    const r = await prisma.grupoUsuariosUser.deleteMany({ where: { grupoId: id, userId } });
    return NextResponse.json({ removidos: r.count });
  });
}
