import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { isRestrictedToOwnChurch } from "@/lib/helpers";

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const { churchId, date } = body;
    const referenceDate = typeof date === "string" ? date.slice(0, 10) : null;
    if (!churchId || !referenceDate || isNaN(new Date(referenceDate).getTime())) {
      return NextResponse.json({ error: "Informe igreja e data validas para checar o caixa." }, { status: 400 });
    }
    if (isRestrictedToOwnChurch(user) && user.churchId && user.churchId !== churchId) {
      return NextResponse.json({ error: "Voce nao tem acesso a este caixa." }, { status: 403 });
    }
    const parsedDate = new Date(referenceDate);
    const referenceYear = parsedDate.getUTCFullYear();
    const referenceMonth = parsedDate.getUTCMonth() + 1;
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT status AS "status", allow_until AS "allowUntil" FROM church_cashbook_status WHERE church_id = $1::uuid AND reference_year = $2::int AND reference_month = $3::int LIMIT 1`,
      churchId, referenceYear, referenceMonth
    );
    const row = rows[0] || null;
    const allowUntil = row?.allowUntil ? (typeof row.allowUntil === "string" ? row.allowUntil.slice(0, 10) : new Date(row.allowUntil as string).toISOString().slice(0, 10)) : null;
    const rawStatus = String(row?.status || "OPEN").toUpperCase();
    const isOpen = rawStatus === "OPEN" || (allowUntil !== null && allowUntil >= referenceDate);
    return NextResponse.json({ churchId, date: referenceDate, year: referenceYear, month: referenceMonth, canInsert: isOpen, status: rawStatus, allowUntil, message: isOpen ? "Caixa liberado para lancamentos." : "Caixa fechado para esta igreja neste periodo." });
  });
}
