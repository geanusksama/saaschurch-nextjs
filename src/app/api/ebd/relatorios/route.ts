import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { resolveScopedFieldId, serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const campoId = resolveScopedFieldId(user, req.nextUrl.searchParams.get("campoId") || undefined);
    if (!campoId) return NextResponse.json({ error: "campoId obrigatório" }, { status: 400 });
    const tipo = req.nextUrl.searchParams.get("tipo") || "retiradas"; // retiradas | financeiro | estoque | inadimplencia
    const churchId = req.nextUrl.searchParams.get("churchId");
    const trimestreId = req.nextUrl.searchParams.get("trimestreId");
    const dataInicio = req.nextUrl.searchParams.get("dataInicio");
    const dataFim = req.nextUrl.searchParams.get("dataFim");

    if (tipo === "retiradas") {
      const rows = await prisma.ebdEntrega.findMany({
        where: {
          campoId,
          deletedAt: null,
          ...(churchId && { churchId }),
          ...(trimestreId && { trimestreId }),
          ...(dataInicio && dataFim && {
            dataEntrega: { gte: new Date(dataInicio), lte: new Date(dataFim) },
          }),
        },
        include: {
          church: { select: { id: true, name: true } },
          trimestre: { select: { id: true, nome: true, ano: true } },
          itens: { include: { produto: { include: { categoria: { select: { nome: true } } } } } },
        },
        orderBy: { dataEntrega: "desc" },
      });
      return NextResponse.json(serializeBigInts(rows));
    }

    if (tipo === "financeiro") {
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
    }

    if (tipo === "estoque") {
      const rows = await prisma.ebdEstoque.findMany({
        where: { campoId },
        include: {
          produto: {
            include: {
              categoria: { select: { nome: true } },
              trimestre: { select: { nome: true, ano: true } },
            },
          },
        },
        orderBy: { produto: { nome: "asc" } },
      });
      const movimentos = await prisma.ebdEstoqueMovimento.findMany({
        where: { campoId },
        include: { produto: { select: { nome: true } } },
        orderBy: { dataMovimento: "desc" },
        take: 200,
      });
      return NextResponse.json(serializeBigInts({ estoque: rows, movimentos }));
    }

    if (tipo === "inadimplencia") {
      const rows = await prisma.ebdFinanceiro.findMany({
        where: { campoId, saldo: { gt: 0 } },
        include: {
          church: {
            include: { regional: { select: { id: true, name: true } } },
          },
          trimestre: { select: { id: true, nome: true, ano: true } },
          movimentos: { orderBy: { data: "desc" }, take: 1 },
        },
        orderBy: { saldo: "desc" },
      });
      return NextResponse.json(serializeBigInts(rows));
    }

    return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
  });
}
