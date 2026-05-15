import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import bcryptjs from "bcryptjs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    if (!["master", "admin"].includes(user.profileType)) {
      return NextResponse.json({ error: "Acesso negado. Apenas master e admin podem definir senhas de campo." }, { status: 403 });
    }
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { password, removePassword } = body;

    if (removePassword) {
      await prisma.campo.update({ where: { id }, data: { accessPasswordHash: null } });
      return NextResponse.json({ ok: true, message: "Senha removida com sucesso." });
    }

    if (!password || typeof password !== "string" || password.length < 4) {
      return NextResponse.json({ error: "A senha deve ter no mínimo 4 caracteres." }, { status: 400 });
    }

    const hash = await bcryptjs.hash(password, 10);
    await prisma.campo.update({ where: { id }, data: { accessPasswordHash: hash } });
    return NextResponse.json({ ok: true, message: "Senha definida com sucesso." });
  });
}
