import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { columnIndex, status, statusLabel, observations } = body;
    const data: Record<string, unknown> = { updatedBy: user.id || null };
    if (columnIndex !== undefined) data.columnIndex = columnIndex;
    if (status !== undefined) data.status = status;
    if (statusLabel !== undefined) data.statusLabel = statusLabel;
    if (observations !== undefined) data.observations = observations;
    const updated = await prisma.kanCard.update({ where: { id }, data });
    return NextResponse.json(serializeBigInts(updated));
  });
}
