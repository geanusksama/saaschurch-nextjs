import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { resolveScopedFieldId, serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const campoId = resolveScopedFieldId(user, req.nextUrl.searchParams.get("campoId") || undefined);
    if (!campoId) return NextResponse.json({ error: "campoId obrigatório" }, { status: 400 });
    const churchId = req.nextUrl.searchParams.get("churchId");
    const trimestreId = req.nextUrl.searchParams.get("trimestreId");

    const rows = await prisma.ebdFinanceiro.findMany({
      where: {
        campoId,
        ...(churchId && { churchId }),
        ...(trimestreId && { trimestreId }),
      },
      include: {
        church: { select: { id: true, name: true } },
        trimestre: { select: { id: true, nome: true, ano: true } },
        movimentos: { orderBy: { data: "asc" } },
      },
      orderBy: { church: { name: "asc" } },
    });
    return NextResponse.json(serializeBigInts(rows));
  });
}
