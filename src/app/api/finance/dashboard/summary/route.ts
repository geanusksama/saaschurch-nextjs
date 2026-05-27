import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const { churchId: reqChurchId } = body;

    const conditions: string[] = ["lc.deleted_at IS NULL"];
    const params: unknown[] = [];
    let p = 1;
    let needsJoin = false;

    if (user?.churchId && user?.profileType === "church") {
      conditions.push(`lc.church_id = $${p}::uuid`);
      params.push(user.churchId);
      p++;
    } else if (reqChurchId) {
      conditions.push(`lc.church_id = $${p}::uuid`);
      params.push(reqChurchId);
      p++;
    } else if (user?.campoId) {
      conditions.push(`r.campo_id = $${p}::uuid`);
      params.push(user.campoId);
      p++;
      needsJoin = true;
    }

    const where = conditions.join(" AND ");

    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT
         lc.tipo AS tipo,
         EXTRACT(YEAR FROM lc.data_lancamento)::int AS ano,
         SUM(lc.valor)::numeric AS total,
         COUNT(*)::int AS count
       FROM livro_caixa lc
       ${needsJoin ? "JOIN churches c ON c.id = lc.church_id JOIN regionais r ON r.id = c.regional_id" : ""}
       WHERE ${where}
         AND lc.data_lancamento >= DATE_TRUNC('year', NOW()) - INTERVAL '1 year'
       GROUP BY lc.tipo, ano
       ORDER BY ano, lc.tipo`,
      ...params
    );

    const currentYear = new Date().getFullYear();
    const prevYear = currentYear - 1;

    const get = (tipo: string, ano: number) => {
      const row = rows.find((r) => r.tipo === tipo && Number(r.ano) === ano);
      return { total: Number(row?.total ?? 0), count: Number(row?.count ?? 0) };
    };

    const receitaAtual = get("RECEITA", currentYear);
    const receitaAnterior = get("RECEITA", prevYear);
    const despesaAtual = get("DESPESA", currentYear);
    const despesaAnterior = get("DESPESA", prevYear);

    const pctGrowth = (curr: number, prev: number) =>
      prev > 0 ? Math.round(((curr - prev) / prev) * 100 * 10) / 10 : null;

    const now = new Date();
    const monthsElapsed = now.getMonth() + 1;

    return NextResponse.json({
      currentYear,
      prevYear,
      receita: {
        atual: receitaAtual.total,
        anterior: receitaAnterior.total,
        pct: pctGrowth(receitaAtual.total, receitaAnterior.total),
        mediaMensal: monthsElapsed > 0 ? Math.round((receitaAtual.total / monthsElapsed) * 100) / 100 : 0,
      },
      despesa: {
        atual: despesaAtual.total,
        anterior: despesaAnterior.total,
        pct: pctGrowth(despesaAtual.total, despesaAnterior.total),
        mediaMensal: monthsElapsed > 0 ? Math.round((despesaAtual.total / monthsElapsed) * 100) / 100 : 0,
      },
      saldo: {
        atual: receitaAtual.total - despesaAtual.total,
        anterior: receitaAnterior.total - despesaAnterior.total,
      },
    });
  });
}
