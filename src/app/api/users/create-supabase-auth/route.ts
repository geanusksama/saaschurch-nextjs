import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { withAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { podeGerenciarUsuario } from "@/lib/camposNavegaveis";

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (!["master", "admin", "campo"].includes(user.profileType)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const { email, password } = body;
    if (!email || !password) return NextResponse.json({ error: "email e senha são obrigatórios." }, { status: 400 });

    // Criar o login de um usuário que já existe e está acima de quem cria
    // (um master importado sem login, por exemplo) seria entrar como ele.
    const existente = await prisma.user.findFirst({
      where: { email: { equals: String(email), mode: "insensitive" }, deletedAt: null },
      select: { profileType: true },
    });
    if (existente && !podeGerenciarUsuario(user, existente)) {
      return NextResponse.json({ error: "Seu perfil não pode criar o acesso deste usuário." }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) {
      if (error.status === 422 || (error.message || "").toLowerCase().includes("already")) {
        return NextResponse.json({ error: "Email já cadastrado no sistema de autenticação." }, { status: 409 });
      }
      return NextResponse.json({ error: error.message || "Erro ao criar usuário no Auth." }, { status: 400 });
    }

    return NextResponse.json({ userId: data.user.id, email: data.user.email }, { status: 201 });
  });
}
