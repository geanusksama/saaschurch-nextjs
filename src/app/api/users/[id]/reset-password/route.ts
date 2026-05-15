import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    if (!["master", "admin"].includes(user.profileType)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { password } = body;

    if (!password || typeof password !== "string" || password.length < 6) {
      return NextResponse.json({ error: "A senha deve ter pelo menos 6 caracteres." }, { status: 400 });
    }

    const targetUser = await prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, email: true, campoId: true },
    });
    if (!targetUser) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

    // Admin can only reset users within their own campo
    if (user.profileType === "admin" && user.campoId && targetUser.campoId !== user.campoId) {
      return NextResponse.json({ error: "Sem acesso a usuários de outro campo." }, { status: 403 });
    }

    // Find Supabase auth user by email (paginate to handle large tenants)
    let authUserId: string | null = null;
    let page = 1;
    const perPage = 1000;

    while (authUserId === null) {
      const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (listError) {
        return NextResponse.json({ error: "Erro ao buscar usuário na autenticação." }, { status: 500 });
      }
      const found = listData.users.find((u) => u.email === targetUser.email);
      if (found) {
        authUserId = found.id;
        break;
      }
      // No more pages
      if (listData.users.length < perPage) break;
      page++;
    }

    if (authUserId) {
      // User already has an auth account — just update the password
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(authUserId, { password });
      if (updateError) {
        return NextResponse.json({ error: updateError.message || "Erro ao atualizar senha." }, { status: 500 });
      }
    } else {
      // Imported user — no auth account yet. Create one now.
      const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: targetUser.email,
        password,
        email_confirm: true,
      });
      if (createError) {
        return NextResponse.json({ error: createError.message || "Erro ao criar conta de autenticação." }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  });
}
