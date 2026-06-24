import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const churches = await prisma.church.findMany({
      where: {
        deletedAt: null,
        status: "active",
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(churches);
  } catch (e) {
    console.error("[GET /api/public/churches]", e);
    return NextResponse.json({ error: "Erro ao carregar igrejas." }, { status: 500 });
  }
}
