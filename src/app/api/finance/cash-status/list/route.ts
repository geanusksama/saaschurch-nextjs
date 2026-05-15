import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { isRestrictedToOwnChurch } from "@/lib/helpers";

async function listScopedChurchRows({ user, churchIds = [] as string[], regionalIds = [] as string[], search = "" }) {
  const conditions: string[] = ["c.deleted_at IS NULL"];
  const params: unknown[] = [];
  let nextParam = 1;
  if (isRestrictedToOwnChurch(user) && user?.churchId) {
    conditions.push(`c.id = $${nextParam}::uuid`); params.push(user.churchId); nextParam++;
  } else {
    if (churchIds.length) { conditions.push(`c.id = ANY($${nextParam}::uuid[])`); params.push(churchIds); nextParam++; }
    if (regionalIds.length) { conditions.push(`c.regional_id = ANY($${nextParam}::uuid[])`); params.push(regionalIds); nextParam++; }
    if (user?.campoId) { conditions.push(`r.campo_id = $${nextParam}::uuid`); params.push(user.campoId); nextParam++; }
  }
  if (search?.trim()) { conditions.push(`(c.name ILIKE $${nextParam} OR COALESCE(r.name, '') ILIKE $${nextParam})`); params.push(`%${search.trim()}%`); }
  return prisma.$queryRawUnsafe<Array<{ churchId: string; churchName: string; regionalId: string | null; regionalName: string | null }>>(
    `SELECT c.id::text AS "churchId", c.name AS "churchName", r.id::text AS "regionalId", r.name AS "regionalName" FROM churches c LEFT JOIN regionais r ON r.id = c.regional_id WHERE ${conditions.join(" AND ")} ORDER BY COALESCE(r.name, '') ASC, c.name ASC`,
    ...params
  );

}

function normalizeCashStatusRow(row: Record<string, unknown> | null, referenceDate?: string) {
  const effectiveDate = referenceDate || new Date().toISOString().slice(0, 10);
  const allowUntil = row?.allowUntil ? (typeof row.allowUntil === "string" ? row.allowUntil.slice(0, 10) : new Date(row.allowUntil as string).toISOString().slice(0, 10)) : null;
  const rawStatus = String(row?.status || "OPEN").toUpperCase();
  const isOpen = rawStatus === "OPEN" || (allowUntil !== null && allowUntil >= effectiveDate);
  return { status: rawStatus, allowUntil, isOpen, label: rawStatus === "OPEN" ? "Aberto" : (allowUntil && allowUntil >= effectiveDate ? `Permitido ate ${allowUntil}` : "Fechado") };
}

function sanitizeMonthList(months: unknown) {
  if (!Array.isArray(months)) return [];
  return [...new Set(months.map(Number).filter((m) => Number.isInteger(m) && m >= 1 && m <= 12))].sort((a, b) => a - b);
}
function sanitizeUuidList(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  return ids.filter((i) => typeof i === "string" && i.trim());
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const { year, months, churchIds, regionalIds, search } = body;
    const referenceYear = Number(year);
    if (!Number.isInteger(referenceYear) || referenceYear < 2000) return NextResponse.json({ error: "Informe um ano valido." }, { status: 400 });
    const selectedMonths = sanitizeMonthList(months);
    if (!selectedMonths.length) return NextResponse.json({ error: "Selecione pelo menos um mes." }, { status: 400 });

    const scopedChurches = await listScopedChurchRows({ user, churchIds: sanitizeUuidList(churchIds), regionalIds: sanitizeUuidList(regionalIds), search });
    if (!scopedChurches.length) return NextResponse.json({ rows: [] });
    const churchIdList = scopedChurches.map((r) => r.churchId);

    const statusRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT church_id::text AS "churchId", reference_month AS "month", status AS "status", allow_until AS "allowUntil", updated_at AS "updatedAt" FROM church_cashbook_status WHERE reference_year = $1 AND church_id = ANY($2::uuid[]) AND reference_month = ANY($3::int[])`,
      referenceYear, churchIdList, selectedMonths
    );
    const statusMap = new Map<string, ReturnType<typeof normalizeCashStatusRow>>();
    statusRows.forEach((row) => { statusMap.set(`${row.churchId}:${row.month}`, normalizeCashStatusRow(row)); });

    return NextResponse.json({ rows: scopedChurches.map((churchRow) => ({ churchId: churchRow.churchId, churchName: churchRow.churchName, regionalId: churchRow.regionalId, regionalName: churchRow.regionalName, months: selectedMonths.map((month) => { const c = statusMap.get(`${churchRow.churchId}:${month}`) || normalizeCashStatusRow(null); return { month, status: c.status, allowUntil: c.allowUntil, isOpen: c.isOpen, label: c.label }; }) })) });
  });
}
