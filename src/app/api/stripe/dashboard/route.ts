import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { resolveScopedFieldId } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const params = req.nextUrl.searchParams;
    const campoId = resolveScopedFieldId(user, params.get("campoId") || undefined);
    if (!campoId) return NextResponse.json({ error: "campoId obrigatório" }, { status: 400 });

    const now = new Date();
    const mesAtual = new Date(now.getFullYear(), now.getMonth(), 1);
    const mesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const fimMesAnterior = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      receitaTotal,
      receitaMes,
      receitaMesAnterior,
      totalPagamentos,
      pagamentosPendentes,
      assinaturasAtivas,
      assinaturasCanceladas,
      reembolsosPendentes,
      reembolsosTotal,
      pagamentosPorMetodo,
      pagamentosPorStatus,
      receitaUltimos6Meses,
    ] = await Promise.all([
      // Receita total aprovada
      prisma.stripePayment.aggregate({
        where: { campoId, status: "aprovado" },
        _sum: { valor: true },
      }),
      // Receita mês atual
      prisma.stripePayment.aggregate({
        where: { campoId, status: "aprovado", createdAt: { gte: mesAtual } },
        _sum: { valor: true },
      }),
      // Receita mês anterior
      prisma.stripePayment.aggregate({
        where: { campoId, status: "aprovado", createdAt: { gte: mesAnterior, lte: fimMesAnterior } },
        _sum: { valor: true },
      }),
      // Total de pagamentos
      prisma.stripePayment.count({ where: { campoId } }),
      // Pagamentos pendentes
      prisma.stripePayment.count({ where: { campoId, status: "pendente" } }),
      // Assinaturas ativas
      prisma.stripeSubscription.count({ where: { campoId, status: "ativa" } }),
      // Assinaturas canceladas
      prisma.stripeSubscription.count({ where: { campoId, status: "cancelada" } }),
      // Reembolsos pendentes de aprovação
      prisma.stripeRefund.count({ where: { payment: { campoId }, status: "solicitado" } }),
      // Total reembolsado
      prisma.stripePayment.aggregate({
        where: { campoId },
        _sum: { valorRefunded: true },
      }),
      // Pagamentos por método
      prisma.stripePayment.groupBy({
        by: ["metodo"],
        where: { campoId, status: "aprovado" },
        _sum: { valor: true },
        _count: true,
      }),
      // Pagamentos por status
      prisma.stripePayment.groupBy({
        by: ["status"],
        where: { campoId },
        _count: true,
      }),
      // Receita últimos 6 meses (agrupado por mês)
      prisma.$queryRaw<{ mes: string; total: number }[]>`
        SELECT
          TO_CHAR(DATE_TRUNC('month', "createdAt"), 'YYYY-MM') as mes,
          SUM(valor)::float as total
        FROM "stripe_payments"
        WHERE "campoId" = ${campoId}
          AND status = 'aprovado'
          AND "createdAt" >= NOW() - INTERVAL '6 months'
        GROUP BY mes
        ORDER BY mes ASC
      `,
    ]);

    const variacaoMes =
      (receitaMesAnterior._sum.valor || 0) > 0
        ? (((receitaMes._sum.valor || 0) - (receitaMesAnterior._sum.valor || 0)) /
            (receitaMesAnterior._sum.valor || 1)) *
          100
        : 0;

    return NextResponse.json({
      receita: {
        total: receitaTotal._sum.valor || 0,
        mes: receitaMes._sum.valor || 0,
        mesAnterior: receitaMesAnterior._sum.valor || 0,
        variacaoMes: Math.round(variacaoMes * 10) / 10,
        totalReembolsado: reembolsosTotal._sum.valorRefunded || 0,
      },
      pagamentos: {
        total: totalPagamentos,
        pendentes: pagamentosPendentes,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        porMetodo: (pagamentosPorMetodo as any[]).map((m) => ({
          metodo: m.metodo,
          total: m._sum?.valor || 0,
          count: m._count,
        })),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        porStatus: (pagamentosPorStatus as any[]).map((s) => ({ status: s.status, count: s._count })),
      },
      assinaturas: {
        ativas: assinaturasAtivas,
        canceladas: assinaturasCanceladas,
      },
      reembolsos: {
        pendentes: reembolsosPendentes,
      },
      grafico: receitaUltimos6Meses,
    });
  });
}
