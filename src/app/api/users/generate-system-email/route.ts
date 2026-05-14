import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (!["master", "admin"].includes(user.profileType)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const { email, password } = body;
    if (!email || !password) return NextResponse.json({ error: "Email e senha obrigatórios." }, { status: 400 });

    const profile = user.profile as Record<string, unknown>;
    const userId = profile?.id as string | undefined;
    if (!userId) return NextResponse.json({ error: "Perfil não encontrado." }, { status: 401 });

    const currentUser = await prisma.user.findFirst({ where: { id: userId } });
    if (!currentUser) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

    const domain = user.campoId
      ? (await prisma.campo.findFirst({ where: { id: user.campoId }, select: { domain: true } }))?.domain || "sistema.app"
      : "sistema.app";

    const slug = (currentUser.fullName || email)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, "")
      .trim()
      .replace(/\s+/g, ".");

    const systemEmail = `${slug}@${domain}`;
    const updated = await prisma.user.update({ where: { id: userId }, data: { systemEmail } });
    return NextResponse.json({ systemEmail: updated.systemEmail });
  });
}
