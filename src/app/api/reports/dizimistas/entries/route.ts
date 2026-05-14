import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const { startDate, endDate, churchIds, regionalIds, titleIds } = body;
    if (!startDate || !endDate) return NextResponse.json({ error: "Informe o periodo inicial e final." }, { status: 400 });
    if (isNaN(new Date(startDate).getTime()) || isNaN(new Date(endDate).getTime())) return NextResponse.json({ error: "Periodo invalido para o relatorio." }, { status: 400 });

    const reqChurchIds = Array.isArray(churchIds) ? churchIds.filter((i: unknown) => typeof i === "string" && i) : [];
    const reqRegionalIds = Array.isArray(regionalIds) ? regionalIds.filter((i: unknown) => typeof i === "string" && i) : [];
    const reqTitleIds = Array.isArray(titleIds) ? titleIds.filter((i: unknown) => typeof i === "string" && i) : [];

    const conditions = ["lc.data_lancamento >= $1::date", "lc.data_lancamento < $2::date", "lc.plano_de_conta = '01.200 - DIZIMOS'", "lc.categoria = 'RECEITA'"];
    const params: unknown[] = [startDate, endDate];
    let nextParam = 3;

    if (user?.churchId && user?.profileType === "church") {
      conditions.push(`lc.church_id = $${nextParam}::uuid`); params.push(user.churchId); nextParam++;
    } else {
      if (reqChurchIds.length) { conditions.push(`lc.church_id = ANY($${nextParam}::uuid[])`); params.push(reqChurchIds); nextParam++; }
      if (reqRegionalIds.length) { conditions.push(`c.regional_id = ANY($${nextParam}::uuid[])`); params.push(reqRegionalIds); nextParam++; }
      if (user?.campoId) { conditions.push(`r.campo_id = $${nextParam}::uuid`); params.push(user.campoId); nextParam++; }
    }
    if (reqTitleIds.length) {
      conditions.push(`UPPER(COALESCE(m.ecclesiastical_title, '')) IN (SELECT UPPER(name) FROM ecclesiastical_titles WHERE id = ANY($${nextParam}::uuid[]) AND deleted_at IS NULL)`);
      params.push(reqTitleIds); nextParam++;
    }
    const memberJoin = reqTitleIds.length
      ? "JOIN members m ON m.rol::text = lc.id_favorecido_externo AND m.church_id = lc.church_id AND m.deleted_at IS NULL"
      : "LEFT JOIN members m ON m.rol::text = lc.id_favorecido_externo AND m.church_id = lc.church_id AND m.deleted_at IS NULL";

    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT COALESCE(m.id::text, NULLIF(TRIM(lc.id_favorecido_externo), ''), CONCAT(lc.church_id::text, ':', UPPER(TRIM(COALESCE(lc.favorecido, 'SEM NOME'))))) AS "memberId",
       COALESCE(m.full_name, lc.favorecido) AS "memberName", COALESCE(m.ecclesiastical_title, '') AS "ecclesiasticalTitle", m.rol AS "rol",
       lc.church_id::text AS "churchId", c.name AS "churchName", c.regional_id::text AS "regionalId", r.name AS "regionalName",
       TO_CHAR(lc.data_lancamento, 'YYYY-MM-DD') AS "dataLancamento", lc.valor::numeric AS "valor"
       FROM livro_caixa lc ${memberJoin} JOIN churches c ON c.id = lc.church_id JOIN regionais r ON r.id = c.regional_id
       WHERE ${conditions.join(" AND ")} ORDER BY r.name ASC, c.name ASC, COALESCE(m.full_name, lc.favorecido) ASC, lc.data_lancamento ASC`,
      ...params
    );
    return NextResponse.json({ entries: rows.map((row) => ({ memberId: row.memberId || `${row.dataLancamento}_${Math.random()}`, memberName: row.memberName || "Sem Nome", ecclesiasticalTitle: row.ecclesiasticalTitle || "", rol: row.rol != null ? Number(row.rol) : null, churchId: row.churchId, churchName: row.churchName || "Sem Igreja", regionalId: row.regionalId || "", regionalName: row.regionalName || "Sem Regional", dataLancamento: typeof row.dataLancamento === "string" ? row.dataLancamento.slice(0, 10) : new Date(row.dataLancamento as string).toISOString().slice(0, 10), valor: Number(row.valor || 0) })) });
  });
}
