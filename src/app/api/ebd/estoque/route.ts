import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { resolveScopedFieldId, serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const campoId = resolveScopedFieldId(user, req.nextUrl.searchParams.get("campoId") || undefined);
    if (!campoId) return NextResponse.json({ error: "campoId obrigatório" }, { status: 400 });

    const rows = await prisma.ebdEstoque.findMany({
      where: { campoId },
      include: {
        produto: {
          include: {
            categoria: { select: { id: true, nome: true } },
            trimestre: { select: { id: true, nome: true, ano: true } },
          },
        },
      },
      orderBy: { produto: { nome: "asc" } },
    });
    return NextResponse.json(serializeBigInts(rows));
  });
}
