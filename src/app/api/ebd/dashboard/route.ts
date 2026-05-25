import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { resolveScopedFieldId, serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const campoId = resolveScopedFieldId(user, req.nextUrl.searchParams.get("campoId") || undefined);
    if (!campoId) return NextResponse.json({ error: "campoId obrigatório" }, { status: 400 });

    const from = req.nextUrl.searchParams.get("from");
    const to   = req.nextUrl.searchParams.get("to");

    const dateFilter = (from || to) ? {
      gte: from ? new Date(from) : undefined,
      lte: to   ? new Date(to + "T23:59:59Z") : undefined,
    } : undefined;

    const [estoque, finRows, entregasRecentes, entradasRecentes, pagamentosMovimentos] = await Promise.all([
      prisma.ebdEstoque.findMany({
        where: { campoId },
        include: { produto: { include: { categoria: { select: { id: true, nome: true } } } } },
      }),
      prisma.ebdFinanceiro.findMany({
        where: { campoId },
        include: { church: { select: { id: true, name: true } } },
      }),
      prisma.ebdEntrega.findMany({
        where: {
          campoId, deletedAt: null,
          ...(dateFilter && { dataEntrega: dateFilter }),
        },
        include: {
          church: { select: { id: true, name: true } },
          itens: { include: { produto: { include: { categoria: { select: { nome: true } } } } } },
        },
        orderBy: { dataEntrega: "desc" },
        take: 10,
      }),
      prisma.ebdEntrada.findMany({
        where: {
          campoId, deletedAt: null,
          ...(dateFilter && { dataEntrada: dateFilter }),
        },
        include: { itens: { include: { produto: { select: { nome: true } } } } },
        orderBy: { dataEntrada: "desc" },
        take: 10,
      }),
      prisma.ebdFinanceiroMovimento.findMany({
        where: {
          campoId,
          tipo: "pagamento",
          ...(dateFilter && { data: dateFilter }),
        },
        select: { valor: true, data: true, financeiroId: true },
      }),
    ]);

    // Total distribuído no período
    const totalDistribuido = entregasRecentes.reduce(
      (s, e) => s + e.itens.reduce((si, i) => si + i.quantidade, 0), 0
    );

    // Distribuição por categoria no período
    const distPorCategoria: Record<string, number> = {};
    for (const e of entregasRecentes) {
      for (const item of e.itens) {
        const cat = item.produto.categoria.nome;
        distPorCategoria[cat] = (distPorCategoria[cat] || 0) + item.quantidade;
      }
    }

    const totalPendente = finRows.reduce((s, r) => s + Math.max(0, Number(r.saldo)), 0);
    const igrejesInadimplentes = finRows.filter((r) => Number(r.saldo) > 0).length;
    const estoquesBaixos = estoque.filter((e) => e.quantidade <= 10).length;
    const totalRecebidoPeriodo = pagamentosMovimentos.reduce((s, m) => s + Number(m.valor), 0);

    // Total compras no período
    const totalCompras = entradasRecentes.reduce((s, e) => s + Number(e.valorTotal), 0);

    // Top inadimplentes (máx 5)
    const topInadimplentes = [...finRows]
      .filter((r) => Number(r.saldo) > 0)
      .sort((a, b) => Number(b.saldo) - Number(a.saldo))
      .slice(0, 5)
      .map((r) => ({ churchName: r.church.name, saldo: Number(r.saldo) }));

    return NextResponse.json(serializeBigInts({
      cards: {
        totalDistribuido,
        totalPendente,
        igrejesInadimplentes,
        estoquesBaixos,
        entregasRecentes: entregasRecentes.length,
        entradasRecentes: entradasRecentes.length,
      },
      distribuicaoPorCategoria: Object.entries(distPorCategoria).map(([nome, qtd]) => ({ nome, qtd })),
      financeiroResumo: {
        recebidoPeriodo: totalRecebidoPeriodo,
        pendente: totalPendente,
        comprasPeriodo: totalCompras,
      },
      topInadimplentes,
      entregasRecentes: entregasRecentes.map((e) => ({
        id: e.id, numeroDoc: e.numeroDoc, dataEntrega: e.dataEntrega,
        status: e.status, valorTotal: e.valorTotal, church: e.church,
      })),
      entradasRecentes: entradasRecentes.map((e) => ({
        id: e.id, numNf: e.numNf, dataEntrada: e.dataEntrada,
        valorTotal: e.valorTotal, fornecedor: e.fornecedor,
      })),
      estoque: estoque.map((e) => ({
        produto: e.produto.nome,
        categoria: e.produto.categoria.nome,
        quantidade: e.quantidade,
        baixo: e.quantidade <= 10,
      })),
    }));
  });
}
