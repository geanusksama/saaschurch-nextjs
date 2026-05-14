import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function GET() {
  try {
    const campos = await prisma.campo.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, domain: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(serializeBigInts(campos));
  } catch (e) {
    console.error("[GET /api/campos/list-all]", e);
    return NextResponse.json({ error: "Erro ao carregar campos." }, { status: 500 });
  }
}
