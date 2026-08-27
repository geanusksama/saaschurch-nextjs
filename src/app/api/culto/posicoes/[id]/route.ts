import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthUser } from '@/lib/auth';

function podeGerenciar(user: AuthUser): boolean {
  return ['master', 'admin', 'campo'].includes(user.profileType);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    if (!podeGerenciar(user)) {
      return NextResponse.json({ error: 'Sem permissão para editar posições.' }, { status: 403 });
    }
    const { id } = await params;
    const posicao = await prisma.cultoPosicao.findUnique({ where: { id } });
    if (!posicao || posicao.deletedAt) {
      return NextResponse.json({ error: 'Posição não encontrada.' }, { status: 404 });
    }
    if (posicao.campoId !== user.campoId && user.profileType !== 'master') {
      return NextResponse.json({ error: 'Sem acesso a esta posição.' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    if (typeof body.isActive === 'boolean') data.isActive = body.isActive;
    if (typeof body.titulo === 'string') data.titulo = body.titulo.trim() || null;
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 400 });
    }

    const atualizada = await prisma.cultoPosicao.update({ where: { id }, data });
    return NextResponse.json(atualizada);
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    if (!podeGerenciar(user)) {
      return NextResponse.json({ error: 'Sem permissão para remover posições.' }, { status: 403 });
    }
    const { id } = await params;
    const posicao = await prisma.cultoPosicao.findUnique({ where: { id } });
    if (!posicao || posicao.deletedAt) {
      return NextResponse.json({ error: 'Posição não encontrada.' }, { status: 404 });
    }
    if (posicao.campoId !== user.campoId && user.profileType !== 'master') {
      return NextResponse.json({ error: 'Sem acesso a esta posição.' }, { status: 403 });
    }

    // Soft delete: o histórico de quem aprovou o quê continua fazendo sentido
    // mesmo depois que a pessoa sai da posição.
    await prisma.cultoPosicao.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    return NextResponse.json({ ok: true });
  });
}
