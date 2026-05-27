import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const { churchId: reqChurchId, months = 3 } = body;

    const safeMonths = Math.min(Math.max(Number(months) || 3, 1), 24);

    const conditions: string[] = [
      "lc.deleted_at IS NULL",
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
         c.name AS church_name,
         lc.church_id::text AS church_id,
         SUM(CASE WHEN lc.tipo = 'RECEITA' THEN lc.valor ELSE 0 END)::numeric AS receita,
         SUM(CASE WHEN lc.tipo = 'DESPESA' THEN lc.valor ELSE 0 END)::numeric AS despesa,
         COUNT(*)::int AS lancamentos
       FROM livro_caixa lc
       JOIN churches c ON c.id = lc.church_id
       ${needsJoin ? "JOIN regionais r ON r.id = c.regional_id" : ""}
       WHERE ${where}
       GROUP BY lc.church_id, c.name
       ORDER BY receita DESC
       LIMIT 15`,
      ...params
    );

    return NextResponse.json({
      churches: rows.map((r) => ({
        churchId: r.church_id as string,
        churchName: r.church_name as string,
        receita: Number(r.receita),
        despesa: Number(r.despesa),
        saldo: Number(r.receita) - Number(r.despesa),
        lancamentos: Number(r.lancamentos),
      })),
    });
  });
}
