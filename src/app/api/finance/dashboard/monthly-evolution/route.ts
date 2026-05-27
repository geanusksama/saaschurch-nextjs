import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const { churchId: reqChurchId, months = 24 } = body;

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

    const safeMonths = Math.min(Math.max(Number(months) || 24, 6), 60);
    conditions.push(
      `lc.data_lancamento >= DATE_TRUNC('month', NOW()) - INTERVAL '${safeMonths - 1} months'`
    );

    const where = conditions.join(" AND ");

    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT
         TO_CHAR(lc.data_lancamento, 'YYYY-MM') AS mes,
         lc.tipo AS tipo,
         SUM(lc.valor)::numeric AS total,
         COUNT(*)::int AS count
       FROM livro_caixa lc
       ${needsJoin ? "JOIN churches c ON c.id = lc.church_id JOIN regionais r ON r.id = c.regional_id" : ""}
       WHERE ${where}
       GROUP BY mes, lc.tipo
       ORDER BY mes ASC, lc.tipo`,
      ...params
    );

    const monthMap: Record<string, { mes: string; receita: number; despesa: number; saldo: number }> = {};
    for (let i = safeMonths - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthMap[key] = { mes: key, receita: 0, despesa: 0, saldo: 0 };
    }

    for (const row of rows) {
      const key = row.mes as string;
      if (!monthMap[key]) continue;
      if (row.tipo === "RECEITA") monthMap[key].receita = Number(row.total);
      if (row.tipo === "DESPESA") monthMap[key].despesa = Number(row.total);
    }

    let accumulated = 0;
    const data = Object.values(monthMap).map((m) => {
      m.saldo = m.receita - m.despesa;
      accumulated += m.saldo;
      return { ...m, saldoAcumulado: Math.round(accumulated * 100) / 100 };
    });

    return NextResponse.json({ data });
  });
}
