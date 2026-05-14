import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

function getManagedCampoId(user: import("@/lib/auth").AuthUser) {
  if (user.profileType === "admin" && user.campoId) return user.campoId;
  return null;
}

async function assertUserManagementAccess(user: import("@/lib/auth").AuthUser, targetUser: { campoId: string | null }) {
  const managedCampoId = getManagedCampoId(user);
  if (!managedCampoId) return true;
  return targetUser?.campoId === managedCampoId;
}

const userInclude = {
  role: { select: { id: true, name: true } },
  campo: { select: { id: true, name: true, code: true } },
  regional: { select: { id: true, name: true, code: true, campoId: true } },
  church: { select: { id: true, name: true } },
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    if (!["master", "admin"].includes(user.profileType)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    const { id } = await params;
    const targetUser = await prisma.user.findFirst({ where: { id, deletedAt: null }, include: userInclude });
    if (!targetUser) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    const ok = await assertUserManagementAccess(user, targetUser);
    if (!ok) return NextResponse.json({ error: "Sem acesso a usuários de outro campo." }, { status: 403 });
    return NextResponse.json(serializeBigInts(targetUser));
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    if (!["master", "admin"].includes(user.profileType)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    // Never update password fields
    delete body.passwordHash;
    Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);

    const existing = await prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    const ok = await assertUserManagementAccess(user, existing);
    if (!ok) return NextResponse.json({ error: "Sem acesso a usuários de outro campo." }, { status: 403 });

    if (body.churchId !== undefined || body.regionalId !== undefined || body.campoId !== undefined) {
      const managedCampoId = getManagedCampoId(user);
      let nextCampoId = managedCampoId || (body.campoId ?? existing.campoId ?? null);
      let nextRegionalId = body.regionalId ?? existing.regionalId ?? null;
      let nextChurchId = body.churchId ?? existing.churchId ?? null;

      if (nextChurchId) {
        const church = await prisma.church.findFirst({
          where: { id: nextChurchId, deletedAt: null },
          select: { id: true, regionalId: true, regional: { select: { campoId: true } } },
        });
        if (!church) return NextResponse.json({ error: "Igreja não encontrada." }, { status: 404 });
        nextRegionalId = church.regionalId;
        nextCampoId = church.regional?.campoId || nextCampoId;
      } else if (nextRegionalId) {
        const regional = await prisma.regional.findFirst({
          where: { id: nextRegionalId, deletedAt: null },
          select: { id: true, campoId: true },
        });
        if (!regional) return NextResponse.json({ error: "Regional não encontrada." }, { status: 404 });
        nextCampoId = regional.campoId;
      }

      if (managedCampoId && nextCampoId && nextCampoId !== managedCampoId) {
        return NextResponse.json({ error: "Não é permitido mover usuários para outro campo." }, { status: 403 });
      }
      body.campoId = nextCampoId;
      body.regionalId = nextRegionalId;
      body.churchId = nextChurchId;
    }

    const updated = await prisma.user.update({ where: { id }, data: body, include: userInclude });
    return NextResponse.json(serializeBigInts(updated));
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    if (!["master", "admin"].includes(user.profileType)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    const { id } = await params;
    if (id === user.sub) {
      return NextResponse.json({ error: "Não é possível excluir o próprio usuário." }, { status: 400 });
    }
    const targetUser = await prisma.user.findFirst({ where: { id, deletedAt: null }, select: { id: true, campoId: true } });
    if (!targetUser) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    const ok = await assertUserManagementAccess(user, targetUser);
    if (!ok) return NextResponse.json({ error: "Sem acesso a usuários de outro campo." }, { status: 403 });
    await prisma.user.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    return new NextResponse(null, { status: 204 });
  });
}
