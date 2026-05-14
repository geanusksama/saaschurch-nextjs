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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    if (!["master", "admin"].includes(user.profileType)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    const { id } = await params;
    const targetUser = await prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, fullName: true, email: true, profileType: true, permissions: true, campoId: true },
    });
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
    const { permissions } = body;
    const existing = await prisma.user.findFirst({ where: { id, deletedAt: null }, select: { id: true, campoId: true } });
    if (!existing) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    const ok = await assertUserManagementAccess(user, existing);
    if (!ok) return NextResponse.json({ error: "Sem acesso a usuários de outro campo." }, { status: 403 });
    const updated = await prisma.user.update({
      where: { id },
      data: { permissions },
      select: { id: true, permissions: true },
    });
    return NextResponse.json(serializeBigInts(updated));
  });
}
