import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { podeGerenciarUsuario } from "@/lib/camposNavegaveis";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

type AuthUser = import("@/lib/auth").AuthUser;

// Scoped campo: admin and campo profiles are restricted to their own campo
function getManagedCampoId(user: AuthUser) {
  if (["admin", "campo"].includes(user.profileType) && user.campoId) return user.campoId;
  return null;
}

// master: unrestricted; admin/campo: scoped to own campo (assertUserManagementAccess)
function canAccessPermissionsEndpoint(user: AuthUser): boolean {
  return ["master", "admin", "campo"].includes(user.profileType);
}

function canEditPermissions(user: AuthUser): boolean {
  return ["master", "admin", "campo"].includes(user.profileType);
}

async function assertUserManagementAccess(user: AuthUser, targetUser: { campoId: string | null }) {
  const managedCampoId = getManagedCampoId(user);
  if (!managedCampoId) return true;
  return targetUser?.campoId === managedCampoId;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    if (!canAccessPermissionsEndpoint(user)) {
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
    if (!canEditPermissions(user)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { permissions } = body;
    const existing = await prisma.user.findFirst({ where: { id, deletedAt: null }, select: { id: true, campoId: true, profileType: true } });
    if (!existing) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    const ok = await assertUserManagementAccess(user, existing);
    if (!ok) return NextResponse.json({ error: "Sem acesso a usuários de outro campo." }, { status: 403 });
    // Ninguém amplia as próprias permissões, e só o master mexe nas de um master.
    if (!podeGerenciarUsuario(user, existing) || (existing.id === user.id && user.profileType !== "master")) {
      return NextResponse.json({ error: "Seu perfil não pode alterar as permissões deste usuário." }, { status: 403 });
    }
    const updated = await prisma.user.update({
      where: { id },
      data: { permissions },
      select: { id: true, permissions: true },
    });
    return NextResponse.json(serializeBigInts(updated));
  });
}
