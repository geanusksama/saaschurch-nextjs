import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { resolveScopedFieldId, serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest, { params }: { params: { churchId: string } }) {
  return withAuth(req, async (user) => {
    const campoId = resolveScopedFieldId(user, req.nextUrl.searchParams.get("campoId") || undefined);
    if (!campoId) return NextResponse.json({ error: "campoId obrigatório" }, { status: 400 });

    const [rows, negociacoes] = await Promise.all([
      prisma.ebdFinanceiro.findMany({
        where: { campoId, churchId: params.churchId },
        include: {
          trimestre: { select: { id: true, nome: true, ano: true, dataFim: true } },
          movimentos: { orderBy: { data: "asc" } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.ebdNegociacao.findMany({
        where: { campoId, churchId: params.churchId, deletedAt: null },
        include: { parcelas: { orderBy: { numParcela: "asc" } } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const totalAcumulado = rows.reduce((s, r) => s + Math.max(0, Number(r.saldo)), 0);

    return NextResponse.json(serializeBigInts({
      rows,
      negociacoes,
      totalAcumulado,
      trimestresComSaldo: rows.filter((r) => Number(r.saldo) > 0).length,
    }));
  });
}
