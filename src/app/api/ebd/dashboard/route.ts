import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { resolveScopedFieldId, serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const campoId = resolveScopedFieldId(user, req.nextUrl.searchParams.get("campoId") || undefined);
    if (!campoId) return NextResponse.json({ error: "campoId obrigatório" }, { status: 400 });

    const [
      estoque,
      finRows,
      entregasRecentes,
      entradasRecentes,
    ] = await Promise.all([
      prisma.ebdEstoque.findMany({
        where: { campoId },
        include: { produto: { include: { categoria: { select: { id: true, nome: true } } } } },
      }),
      prisma.ebdFinanceiro.findMany({
        where: { campoId },
        include: { church: { select: { id: true, name: true } } },
      }),
      prisma.ebdEntrega.findMany({
        where: { campoId, deletedAt: null },
        include: {
          church: { select: { id: true, name: true } },
          itens: true,
        },
        orderBy: { dataEntrega: "desc" },
        take: 5,
      }),
      prisma.ebdEntrada.findMany({
        where: { campoId, deletedAt: null },
        orderBy: { dataEntrada: "desc" },
        take: 5,
      }),
    ]);

    const totalDistribuido = await prisma.ebdEntregaItem.aggregate({
      where: { entrega: { campoId, deletedAt: null } },
      _sum: { quantidade: true },
    });

    const totalPendente = finRows.reduce((s, r) => s + Math.max(0, Number(r.saldo)), 0);
    const igrejesInadimplentes = finRows.filter((r) => Number(r.saldo) > 0).length;
    const estoquesBaixos = estoque.filter((e) => e.quantidade <= 10).length;

    // Distribuição por categoria
    const distPorCategoria: Record<string, number> = {};
    const itensEntregues = await prisma.ebdEntregaItem.findMany({
      where: { entrega: { campoId, deletedAt: null } },
      include: { produto: { include: { categoria: { select: { nome: true } } } } },
    });
    for (const item of itensEntregues) {
      const cat = item.produto.categoria.nome;
      distPorCategoria[cat] = (distPorCategoria[cat] || 0) + item.quantidade;
    }

    return NextResponse.json(serializeBigInts({
      cards: {
        totalDistribuido: totalDistribuido._sum.quantidade ?? 0,
        totalPendente,
        igrejesInadimplentes,
        estoquesBaixos,
        entregasRecentes: entregasRecentes.length,
        entradasRecentes: entradasRecentes.length,
      },
      distribuicaoPorCategoria: Object.entries(distPorCategoria).map(([nome, qtd]) => ({ nome, qtd })),
      financeiroResumo: {
        recebido: finRows.reduce((s, r) => {
          const movsPag = 0; // calculado nos movimentos — simplificado aqui
          return s + movsPag;
        }, 0),
        pendente: totalPendente,
      },
      entregasRecentes,
      entradasRecentes,
      estoque: estoque.map((e) => ({
        produto: e.produto.nome,
        categoria: e.produto.categoria.nome,
        quantidade: e.quantidade,
        baixo: e.quantidade <= 10,
      })),
    }));
  });
}
