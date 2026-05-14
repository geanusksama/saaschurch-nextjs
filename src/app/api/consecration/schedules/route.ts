import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (user.profileType !== "master" && user.profileType !== "admin") {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const { churchId, scheduledDate, notes } = body;
    if (!churchId || !scheduledDate) return NextResponse.json({ error: "churchId and scheduledDate are required" }, { status: 400 });
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `INSERT INTO consecration_schedules (church_id, scheduled_date, notes, created_by)
       VALUES ($1::uuid, $2::date, $3, $4::uuid)
       ON CONFLICT (church_id, scheduled_date)
       DO UPDATE SET notes = EXCLUDED.notes, is_active = TRUE, updated_at = NOW()
       RETURNING id::text AS id, church_id::text AS "churchId", scheduled_date AS "scheduledDate", notes, is_active AS "isActive"`,
      churchId, scheduledDate, notes || null, user.id || null
    );
    return NextResponse.json(serializeBigInts(rows[0]), { status: 201 });
  });
}
