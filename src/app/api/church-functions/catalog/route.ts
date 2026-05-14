import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeBigInts } from "@/lib/helpers";

export async function GET() {
  try {
    const catalog = await prisma.churchFunctionCatalog.findMany({
      where: { OR: [{ isActive: true }, { isActive: null }] },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(serializeBigInts(catalog));
  } catch (e) {
    console.error("[GET /api/church-functions/catalog]", e);
    return NextResponse.json({ error: "Erro ao buscar catálogo." }, { status: 500 });
  }
}
