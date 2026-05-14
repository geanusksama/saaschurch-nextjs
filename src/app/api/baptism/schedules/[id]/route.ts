import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    if (user.profileType !== "master" && user.profileType !== "admin") {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { scheduledDate, notes, isActive } = body;
    const data: Record<string, unknown> = {};
    if (scheduledDate !== undefined) data.scheduledDate = scheduledDate;
    if (notes !== undefined) data.notes = notes;
    if (isActive !== undefined) data.isActive = isActive;
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `UPDATE baptism_schedules SET notes = COALESCE($2, notes), is_active = COALESCE($3, is_active), updated_at = NOW() WHERE id = $1::uuid RETURNING id::text, scheduled_date AS "scheduledDate", notes, is_active AS "isActive"`,
      id, notes ?? null, isActive ?? null
    );
    if (!rows.length) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(serializeBigInts(rows[0]));
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    if (user.profileType !== "master" && user.profileType !== "admin") {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }
    const { id } = await params;
    await prisma.$queryRawUnsafe(`UPDATE baptism_schedules SET is_active = FALSE WHERE id = $1::uuid`, id);
    return new NextResponse(null, { status: 204 });
  });
}
