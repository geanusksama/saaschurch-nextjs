import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { resolveScopedFieldId, serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const campoId = resolveScopedFieldId(user, req.nextUrl.searchParams.get("campoId") || undefined);
    if (!campoId) return NextResponse.json({ error: "campoId obrigatório" }, { status: 400 });
    const churchId = req.nextUrl.searchParams.get("churchId");
    const tipo = req.nextUrl.searchParams.get("tipo");
    const from = req.nextUrl.searchParams.get("from");
    const to = req.nextUrl.searchParams.get("to");
    const take = Math.min(Number(req.nextUrl.searchParams.get("take") || 200), 500);

    const rows = await prisma.ebdHistorico.findMany({
      where: {
        campoId,
        ...(churchId && { churchId }),
        ...(tipo && { tipo }),
        ...((from || to) && {
          data: {
            ...(from && { gte: new Date(from) }),
            ...(to && { lte: new Date(to + "T23:59:59Z") }),
          },
        }),
      },
      include: {
        church: { select: { id: true, name: true } },
      },
      orderBy: { data: "desc" },
      take,
    });
    return NextResponse.json(serializeBigInts(rows));
  });
}
