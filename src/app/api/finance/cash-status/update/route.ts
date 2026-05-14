import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { isRestrictedToOwnChurch } from "@/lib/helpers";
import { randomUUID } from "crypto";

async function listScopedChurchRows({ user, churchIds = [] as string[], regionalIds = [] as string[] }) {
  const conditions: string[] = ["c.deleted_at IS NULL"];
  const params: unknown[] = [];
  let nextParam = 1;
  if (isRestrictedToOwnChurch(user) && user?.churchId) { conditions.push(`c.id = $${nextParam}::uuid`); params.push(user.churchId); nextParam++; }
  else { if (churchIds.length) { conditions.push(`c.id = ANY($${nextParam}::uuid[])`); params.push(churchIds); nextParam++; } if (regionalIds.length) { conditions.push(`c.regional_id = ANY($${nextParam}::uuid[])`); params.push(regionalIds); nextParam++; } if (user?.campoId) { conditions.push(`r.campo_id = $${nextParam}::uuid`); params.push(user.campoId); nextParam++; } }
  return prisma.$queryRawUnsafe<Array<{ churchId: string }>>(
    `SELECT c.id::text AS "churchId", c.name AS "churchName" FROM churches c JOIN regionais r ON r.id = c.regional_id WHERE ${conditions.join(" AND ")} ORDER BY r.name ASC, c.name ASC`,
    ...params
  );
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const { year, months, churchIds, regionalIds, action, allowUntil, notes } = body;
    const referenceYear = Number(year);
    if (!Number.isInteger(referenceYear) || referenceYear < 2000) return NextResponse.json({ error: "Informe um ano valido." }, { status: 400 });
    const selectedMonths = (Array.isArray(months) ? months.map(Number).filter((m) => Number.isInteger(m) && m >= 1 && m <= 12) : []);
    if (!selectedMonths.length) return NextResponse.json({ error: "Selecione pelo menos um mes." }, { status: 400 });
    const normalizedAction = String(action || "").toLowerCase();
    if (!["open", "close", "allow"].includes(normalizedAction)) return NextResponse.json({ error: "Acao invalida para o caixa." }, { status: 400 });
    if (normalizedAction === "allow" && (!allowUntil || isNaN(new Date(allowUntil).getTime()))) return NextResponse.json({ error: "Informe a data limite da permissao temporaria." }, { status: 400 });

    const scopedChurches = await listScopedChurchRows({ user, churchIds: Array.isArray(churchIds) ? churchIds : [], regionalIds: Array.isArray(regionalIds) ? regionalIds : [] });
    if (!scopedChurches.length) return NextResponse.json({ error: "Nenhuma igreja encontrada." }, { status: 400 });

    const statusValue = normalizedAction === "open" ? "OPEN" : "CLOSED";
    const allowUntilValue = normalizedAction === "allow" ? String(allowUntil).slice(0, 10) : null;
    const operatorId = user.id || null;
    let updatedCount = 0;
    for (const church of scopedChurches) {
      for (const month of selectedMonths) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO church_cashbook_status (id, church_id, reference_year, reference_month, status, allow_until, notes, updated_by, created_at, updated_at)
           VALUES ($1::uuid, $2::uuid, $3::int, $4::int, $5::varchar, $6::date, $7::text, $8::uuid, now(), now())
           ON CONFLICT (church_id, reference_year, reference_month) DO UPDATE SET status = EXCLUDED.status, allow_until = EXCLUDED.allow_until, notes = EXCLUDED.notes, updated_by = EXCLUDED.updated_by, updated_at = now()`,
          randomUUID(), church.churchId, referenceYear, month, statusValue, allowUntilValue, notes || null, operatorId
        );
        updatedCount++;
      }
    }
    return NextResponse.json({ updatedCount, churches: scopedChurches.length, months: selectedMonths, action: normalizedAction });
  });
}
