import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { withAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (!["master", "admin"].includes(user.profileType)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const { email, password } = body;
    if (!email || !password) return NextResponse.json({ error: "email e senha são obrigatórios." }, { status: 400 });

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
