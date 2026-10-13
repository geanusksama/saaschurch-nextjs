import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  CampoNavegavelError,
  listarCamposNavegaveis,
  podeAtribuirPerfil,
  podeGerenciarUsuario,
  salvarCamposNavegaveis,
} from "@/lib/camposNavegaveis";


function getManagedCampoId(user: import("@/lib/auth").AuthUser) {
  if ((user.profileType === "admin" || user.profileType === "campo") && user.campoId) return user.campoId;
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
    if (!["master", "admin", "campo"].includes(user.profileType)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    const { id } = await params;
    const targetUser = await prisma.user.findFirst({ where: { id, deletedAt: null }, include: userInclude });
    if (!targetUser) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    const ok = await assertUserManagementAccess(user, targetUser);
    if (!ok) return NextResponse.json({ error: "Sem acesso a usuários de outro campo." }, { status: 403 });
    const camposNavegaveis = await listarCamposNavegaveis(targetUser.id);
    return NextResponse.json(serializeBigInts({ ...targetUser, camposNavegaveis }));
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    if (!["master", "admin", "campo"].includes(user.profileType)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    const { id } = await params;
    const raw = await req.json().catch(() => ({}));

    const existing = await prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    const ok = await assertUserManagementAccess(user, existing);
    if (!ok) return NextResponse.json({ error: "Sem acesso a usuários de outro campo." }, { status: 403 });
    if (!podeGerenciarUsuario(user, existing)) {
      return NextResponse.json({ error: "Só o master altera um usuário master." }, { status: 403 });
    }

    // Só estes campos passam. Antes o corpo ia inteiro para o update: dava
    // para gravar profileType "master", permissions ou email por aqui.
    const body: Record<string, unknown> = {};
    for (const campo of ["fullName", "phone", "campoId", "regionalId", "churchId", "isActive", "avatarUrl"] as const) {
      if (raw[campo] !== undefined) body[campo] = raw[campo];
    }
    // Perfil, função e admin: só o master (a tela já dizia isso; agora o servidor confere).
    if (user.profileType === "master") {
      for (const campo of ["profileType", "roleId", "isAdmin"] as const) {
        if (raw[campo] !== undefined) body[campo] = raw[campo];
      }
      if (body.profileType !== undefined && !podeAtribuirPerfil(user, String(body.profileType))) {
        return NextResponse.json({ error: "Perfil inválido." }, { status: 400 });
      }
    } else if (raw.profileType !== undefined || raw.roleId !== undefined || raw.isAdmin !== undefined || raw.camposNavegaveis !== undefined) {
      return NextResponse.json({ error: "Só o master altera perfil, função, administrador e campos liberados." }, { status: 403 });
    }

    if (body.churchId !== undefined || body.regionalId !== undefined || body.campoId !== undefined) {
      const managedCampoId = getManagedCampoId(user);
      let nextCampoId = managedCampoId || ((body.campoId as string | null | undefined) ?? existing.campoId ?? null);
      let nextRegionalId = (body.regionalId as string | null | undefined) ?? existing.regionalId ?? null;
      let nextChurchId = (body.churchId as string | null | undefined) ?? existing.churchId ?? null;

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

    // Campos que ele pode navegar (só o master manda isto).
    if (user.profileType === "master" && Array.isArray(raw.camposNavegaveis)) {
      try {
        await salvarCamposNavegaveis(updated, raw.camposNavegaveis);
      } catch (err) {
        if (err instanceof CampoNavegavelError) return NextResponse.json({ error: err.message }, { status: 400 });
        throw err;
      }
    }

    // Sync metadata with Supabase Auth
    try {
      await supabaseAdmin.auth.admin.updateUserById(id, {
        user_metadata: {
          full_name: updated.fullName,
          profile_type: updated.profileType,
          role_name: updated.role?.name || null,
        }
      });
    } catch (sbErr) {
      console.error("[users_id_patch] Supabase sync failed:", sbErr);
    }

    const camposNavegaveis = await listarCamposNavegaveis(updated.id);
    return NextResponse.json(serializeBigInts({ ...updated, camposNavegaveis }));
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    if (!["master", "admin", "campo"].includes(user.profileType)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    const { id } = await params;
    if (id === user.sub) {
      return NextResponse.json({ error: "Não é possível excluir o próprio usuário." }, { status: 400 });
    }
    const targetUser = await prisma.user.findFirst({ where: { id, deletedAt: null }, select: { id: true, campoId: true, profileType: true } });
    if (!targetUser) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    const ok = await assertUserManagementAccess(user, targetUser);
    if (!ok) return NextResponse.json({ error: "Sem acesso a usuários de outro campo." }, { status: 403 });
    if (!podeGerenciarUsuario(user, targetUser)) {
      return NextResponse.json({ error: "Só o master exclui um usuário master." }, { status: 403 });
    }
    await prisma.user.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    return new NextResponse(null, { status: 204 });
  });
}
