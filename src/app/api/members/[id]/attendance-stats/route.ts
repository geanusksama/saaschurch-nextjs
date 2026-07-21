import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { assertChurchAccess } from "@/lib/helpers";

/**
 * Estatísticas de presença REAL do membro (tabela face_presencas).
 *
 * Antes, o perfil montava esses gráficos a partir de /members/[id]/event-history,
 * que é a trilha de auditoria do CRM (quando alguém MEXEU no cadastro) — ou seja,
 * mostrava "dia da semana em que a secretária editou o registro", não presença.
 *
 * A agregação é feita no SERVIDOR porque /api/face-presence limita pageSize a 100;
 * puxar as linhas e somar no cliente truncaria silenciosamente quem tem mais de
 * 100 presenças.
 *
 * O casamento membro→presença segue o mesmo critério já usado no módulo de
 * Presença Facial: por `rol` OU por `nome` (maiúsculas, sem espaços nas pontas),
 * já que face_presencas não tem FK para members.
 *
 * Período usa a MESMA regra do módulo de Presença Facial: corte às 13h
 * (Manhã < 13h, Noite >= 13h), para os números baterem entre as telas.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const sp = new URL(req.url).searchParams;
    const de = sp.get("de");
    const ate = sp.get("ate");

    const member = await prisma.member.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, churchId: true, rol: true, fullName: true },
    });
    if (!member) return NextResponse.json({ error: "member not found" }, { status: 404 });
    const ok = await assertChurchAccess(user, member.churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

    const conditions: string[] = [];
    const values: unknown[] = [];

    // rol OU nome — mesmo critério do AttendanceModule.
    if (member.rol != null) {
      values.push(member.rol, member.fullName);
      conditions.push(`(rol = $${values.length - 1}::int OR UPPER(TRIM(nome)) = UPPER(TRIM($${values.length}::text)))`);
    } else {
      values.push(member.fullName);
      conditions.push(`UPPER(TRIM(nome)) = UPPER(TRIM($${values.length}::text))`);
    }

    if (de) { values.push(`${de}T00:00:00`); conditions.push(`horario >= $${values.length}::timestamp`); }
    if (ate) { values.push(`${ate}T23:59:59`); conditions.push(`horario <= $${values.length}::timestamp`); }

    const where = conditions.join(" AND ");

    // Uma única varredura: contagem por dia da semana e por período.
    const rows = await prisma.$queryRawUnsafe<Array<{ dow: number; periodo: string; total: bigint }>>(
      `SELECT EXTRACT(DOW FROM horario)::int AS dow,
              CASE WHEN EXTRACT(HOUR FROM horario) < 13 THEN 'manha' ELSE 'noite' END AS periodo,
              COUNT(*)::bigint AS total
         FROM face_presencas
        WHERE ${where}
        GROUP BY 1, 2`,
      ...values
    );

    const lastRows = await prisma.$queryRawUnsafe<Array<{ horario: Date; igreja_regional: string | null }>>(
      `SELECT horario, igreja_regional FROM face_presencas WHERE ${where} ORDER BY horario DESC LIMIT 1`,
      ...values
    );

    // Dias distintos com presença (um culto pode gerar várias detecções).
    const distinctRows = await prisma.$queryRawUnsafe<Array<{ dias: bigint }>>(
      `SELECT COUNT(DISTINCT DATE(horario))::bigint AS dias FROM face_presencas WHERE ${where}`,
      ...values
    );

    const byDay = [0, 0, 0, 0, 0, 0, 0]; // Dom..Sáb
    const byPeriod = { manha: 0, noite: 0 };
    let total = 0;
    for (const r of rows) {
      const n = Number(r.total);
      total += n;
      if (r.dow >= 0 && r.dow <= 6) byDay[r.dow] += n;
      if (r.periodo === "manha") byPeriod.manha += n;
      else byPeriod.noite += n;
    }

    return NextResponse.json({
      byDay,
      byPeriod,
      total,
      distinctDays: distinctRows.length ? Number(distinctRows[0].dias) : 0,
      lastPresence: lastRows.length
        ? { horario: lastRows[0].horario, igrejaRegional: lastRows[0].igreja_regional }
        : null,
      matchedBy: member.rol != null ? "rol+nome" : "nome",
    });
  });
}
