import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const { churchId: reqChurchId, year } = body;

    const targetYear = Number(year) || new Date().getFullYear();

    const conditions: string[] = [
      "lc.deleted_at IS NULL",
      `EXTRACT(YEAR FROM lc.data_lancamento) = ${targetYear}`,
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

    // Use expression in GROUP BY to avoid collision with the real `categoria` column in livro_caixa
    const expr = `COALESCE(NULLIF(TRIM(lc.plano_de_conta), ''), 'Sem categoria')`;

    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT
         lc.tipo AS tipo,
         ${expr} AS plano_nome,
         SUM(lc.valor)::numeric AS total,
         COUNT(*)::int AS qtd
       FROM livro_caixa lc
       ${needsJoin ? "JOIN churches c ON c.id = lc.church_id JOIN regionais r ON r.id = c.regional_id" : ""}
       WHERE ${where}
       GROUP BY lc.tipo, ${expr}
       ORDER BY lc.tipo, SUM(lc.valor) DESC`,
      ...params
    );

    const receitas = rows
      .filter((r) => r.tipo === "RECEITA")
      .map((r) => ({ categoria: r.plano_nome as string, total: Number(r.total), count: Number(r.qtd) }));

    const despesas = rows
      .filter((r) => r.tipo === "DESPESA")
      .map((r) => ({ categoria: r.plano_nome as string, total: Number(r.total), count: Number(r.qtd) }));

    return NextResponse.json({ receitas, despesas, year: targetYear });
  });
}
