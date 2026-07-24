import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/campos/public
// Lista pública (sem auth) de campos, apenas id + name — usada na tela de
// registro (Criar Conta), que não tem token. Não expõe nenhum dado sensível.
export async function GET() {
  try {
    const campos = await prisma.campo.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(campos);
  } catch (e) {
    console.error("[GET /api/campos/public]", e);
    return NextResponse.json({ error: "Erro ao carregar campos." }, { status: 500 });
  }
}
