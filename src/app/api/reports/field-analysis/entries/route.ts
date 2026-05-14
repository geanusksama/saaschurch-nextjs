import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const { startDate, endDate, regionalId, churchIds } = body;
    if (!startDate || !endDate) return NextResponse.json({ error: "Informe o periodo inicial e final." }, { status: 400 });
    if (isNaN(new Date(startDate).getTime()) || isNaN(new Date(endDate).getTime())) return NextResponse.json({ error: "Periodo invalido para o relatorio." }, { status: 400 });

    const requestedChurchIds = Array.isArray(churchIds) ? churchIds.filter((i: unknown) => typeof i === "string" && i) : [];
    const conditions = ["lc.data_lancamento >= $1::date", "lc.data_lancamento < $2::date"];
    const params: unknown[] = [startDate, endDate];
    let nextParam = 3;

    if (user?.churchId && user?.profileType === "church") {
      conditions.push(`lc.church_id = $${nextParam}::uuid`); params.push(user.churchId); nextParam++;
    } else {
      if (requestedChurchIds.length) { conditions.push(`lc.church_id = ANY($${nextParam}::uuid[])`); params.push(requestedChurchIds); nextParam++; }
      if (regionalId) { conditions.push(`c.regional_id = $${nextParam}::uuid`); params.push(regionalId); nextParam++; }
      if (user?.campoId) { conditions.push(`r.campo_id = $${nextParam}::uuid`); params.push(user.campoId); nextParam++; }
    }

    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT lc.church_id::text AS "churchId", c.name AS "churchName", c.regional_id::text AS "regionalId", r.name AS "regionalName", TO_CHAR(lc.data_lancamento, 'YYYY-MM-DD') AS "dataLancamento", lc.tipo AS "tipo", lc.valor::numeric AS "valor"
       FROM livro_caixa lc JOIN churches c ON c.id = lc.church_id JOIN regionais r ON r.id = c.regional_id
       WHERE ${conditions.join(" AND ")} ORDER BY lc.data_lancamento ASC, lc.church_id ASC`,
      ...params
    );
    return NextResponse.json({ entries: rows.map((row) => ({ churchId: row.churchId, churchName: row.churchName || "Sem Igreja", regionalId: row.regionalId || "", regionalName: row.regionalName || "Sem Regional", dataLancamento: typeof row.dataLancamento === "string" ? row.dataLancamento.slice(0, 10) : new Date(row.dataLancamento as string).toISOString().slice(0, 10), tipo: row.tipo, valor: Number(row.valor || 0) })) });
  });
}
