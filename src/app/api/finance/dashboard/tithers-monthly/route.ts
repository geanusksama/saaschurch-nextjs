import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const { churchId: reqChurchId, months = 24 } = body;

    const safeMonths = Math.min(Math.max(Number(months) || 24, 6), 60);

    const conditions: string[] = [
      "lc.deleted_at IS NULL",
      "lc.tipo = 'RECEITA'",
      "lc.plano_de_conta ILIKE '%dizimo%'",
      `lc.data_lancamento >= DATE_TRUNC('month', NOW()) - INTERVAL '${safeMonths - 1} months'`,
    ];
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
         TO_CHAR(lc.data_lancamento, 'YYYY-MM') AS mes,
         COUNT(DISTINCT COALESCE(NULLIF(TRIM(lc.id_favorecido_externo), ''), NULLIF(TRIM(lc.favorecido), ''), lc.id::text))::int AS dizimistas,
         SUM(lc.valor)::numeric AS total
       FROM livro_caixa lc
       ${needsJoin ? "JOIN churches c ON c.id = lc.church_id JOIN regionais r ON r.id = c.regional_id" : ""}
       WHERE ${where}
       GROUP BY mes
       ORDER BY mes ASC`,
      ...params
    );

    const monthMap: Record<string, { mes: string; dizimistas: number; total: number }> = {};
    for (let i = safeMonths - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthMap[key] = { mes: key, dizimistas: 0, total: 0 };
    }

    for (const row of rows) {
      const key = row.mes as string;
      if (monthMap[key]) {
        monthMap[key].dizimistas = Number(row.dizimistas);
        monthMap[key].total = Number(row.total);
      }
    }

    return NextResponse.json({ data: Object.values(monthMap) });
  });
}
