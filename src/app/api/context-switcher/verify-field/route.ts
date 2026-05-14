import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import bcryptjs from "bcryptjs";
import { serializeBigInts } from "@/lib/helpers";

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const { campoId, password } = body;
    if (!campoId || !password) {
      return NextResponse.json({ error: "campoId e password são obrigatórios." }, { status: 400 });
    }

    const campo = await prisma.campo.findFirst({
      where: { id: campoId, deletedAt: null },
      select: { id: true, name: true, accessPasswordHash: true },
    });
    if (!campo) return NextResponse.json({ error: "Campo não encontrado." }, { status: 404 });
    if (!campo.accessPasswordHash) {
      return NextResponse.json({ error: "Este campo não possui senha de acesso configurada." }, { status: 400 });
    }

    const isValid = await bcryptjs.compare(password, campo.accessPasswordHash);
    if (!isValid) {
      return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
    }

    const safeCampo = { id: campo.id, name: campo.name };
    return NextResponse.json({ success: true, campo: serializeBigInts(safeCampo) });
  });
}
