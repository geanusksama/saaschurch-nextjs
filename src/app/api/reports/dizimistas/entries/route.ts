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

    const conditions = ["lc.data_lancamento >= $1::date", "lc.data_lancamento < $2::date", "lc.plano_de_conta = '01.200 - DIZIMOS'", "lc.tipo = 'RECEITA'"];
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
    // A vinculação lançamento->membro é INCONSISTENTE no histórico: lançamentos mais novos usam
    // a FK lc.member_id; lançamentos mais antigos usam lc.id_favorecido_externo = rol do membro.
    // Para não perder nenhuma competência, juntamos pelos DOIS critérios.
    //  • Match por FK (m.id = lc.member_id): member_id é chave única, então identifica o membro
    //    correto INDEPENDENTE da igreja. Isso faz aparecer quem é de outra igreja mas dizima na
    //    SEDE (o dízimo é atribuído à igreja do lançamento, igual à Análise do Campo).
    //  • Match legado por ROL: usado só quando NÃO há member_id. O rol é único por CAMPO (pode
    //    repetir entre campos diferentes), então desambiguamos exigindo que o membro seja do MESMO
    //    campo do lançamento (r.campo_id) — não da mesma igreja. Assim quem é de outra igreja do
    //    mesmo campo e dízima na SEDE também casa. O "member_id IS NULL" evita casar duas vezes
    //    (FK + ROL) e contar em dobro.
    // Quando há filtro de título, INNER JOIN restringe aos membros; senão, LEFT JOIN inclui não-membros.
    const memberMatch = `((m.id = lc.member_id) OR (lc.member_id IS NULL AND m.rol::text = lc.id_favorecido_externo AND EXISTS (SELECT 1 FROM churches mc JOIN regionais mr ON mr.id = mc.regional_id WHERE mc.id = m.church_id AND mr.campo_id = r.campo_id))) AND m.deleted_at IS NULL`;
    const memberJoin = reqTitleIds.length
      ? `JOIN members m ON ${memberMatch}`
      : `LEFT JOIN members m ON ${memberMatch}`;

    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT COALESCE(m.id::text, NULLIF(TRIM(lc.id_favorecido_externo), ''), CONCAT(lc.church_id::text, ':', UPPER(TRIM(COALESCE(lc.favorecido, 'SEM NOME'))))) AS "memberId",
       COALESCE(m.full_name, lc.favorecido) AS "memberName", COALESCE(m.ecclesiastical_title, '') AS "ecclesiasticalTitle", m.rol AS "rol",
       lc.church_id::text AS "churchId", c.name AS "churchName", c.regional_id::text AS "regionalId", r.name AS "regionalName",
       TO_CHAR(lc.data_lancamento, 'YYYY-MM-DD') AS "dataLancamento", lc.valor::numeric AS "valor"
       FROM livro_caixa lc JOIN churches c ON c.id = lc.church_id JOIN regionais r ON r.id = c.regional_id ${memberJoin}
       WHERE ${conditions.join(" AND ")} ORDER BY r.name ASC, c.name ASC, COALESCE(m.full_name, lc.favorecido) ASC, lc.data_lancamento ASC`,
      ...params
    );
    return NextResponse.json({ entries: rows.map((row) => ({ memberId: row.memberId || `${row.dataLancamento}_${Math.random()}`, memberName: row.memberName || "Sem Nome", ecclesiasticalTitle: row.ecclesiasticalTitle || "", rol: row.rol != null ? Number(row.rol) : null, churchId: row.churchId, churchName: row.churchName || "Sem Igreja", regionalId: row.regionalId || "", regionalName: row.regionalName || "Sem Regional", dataLancamento: typeof row.dataLancamento === "string" ? row.dataLancamento.slice(0, 10) : new Date(row.dataLancamento as string).toISOString().slice(0, 10), valor: Number(row.valor || 0) })) });
  });
}
