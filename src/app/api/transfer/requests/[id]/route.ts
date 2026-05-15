import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { columnIndex, status, statusLabel, observations, destinationChurchId } = body;
    const data: Record<string, unknown> = { updatedBy: user.id || null };
    if (columnIndex !== undefined) data.columnIndex = columnIndex;
    if (status !== undefined) data.status = status;
    if (statusLabel !== undefined) data.statusLabel = statusLabel;
    if (observations !== undefined) data.observations = observations;
    if (destinationChurchId !== undefined) {
      data.destinationChurchId = destinationChurchId;
      if (destinationChurchId) {
        const destChurch = await prisma.church.findUnique({ where: { id: destinationChurchId }, select: { regionalId: true } });
        if (destChurch && destChurch.regionalId) data.destinationRegionalId = destChurch.regionalId;
      }
    }
    const updated = await prisma.kanCard.update({ where: { id }, data });
    return NextResponse.json(serializeBigInts(updated));
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const updated = await prisma.kanCard.update({ where: { id }, data: { deletedAt: new Date(), updatedBy: user.id || null } });
    return new NextResponse(null, { status: 204 });
  });
}
