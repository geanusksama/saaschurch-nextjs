import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { swapWithId } = body;
    if (!swapWithId) return NextResponse.json({ error: "swapWithId required" }, { status: 400 });
    const colId = Number(id);
    const swapId = Number(swapWithId);
    const [colA, colB] = await Promise.all([
      prisma.kanColumn.findUnique({ where: { id: colId } }),
      prisma.kanColumn.findUnique({ where: { id: swapId } }),
    ]);
    if (!colA || !colB) return NextResponse.json({ error: "column not found" }, { status: 404 });
    const idxA = colA.columnIndex;
    const idxB = colB.columnIndex;
    await prisma.$transaction([
      prisma.kanColumn.update({ where: { id: colId }, data: { columnIndex: -1 } }),
      prisma.kanColumn.update({ where: { id: swapId }, data: { columnIndex: idxA } }),
      prisma.kanColumn.update({ where: { id: colId }, data: { columnIndex: idxB } }),
      prisma.kanCard.updateMany({ where: { stageId: colA.stageId, columnIndex: idxA, deletedAt: null }, data: { columnIndex: -1 } }),
      prisma.kanCard.updateMany({ where: { stageId: colA.stageId, columnIndex: idxB, deletedAt: null }, data: { columnIndex: idxA } }),
      prisma.kanCard.updateMany({ where: { stageId: colA.stageId, columnIndex: -1, deletedAt: null }, data: { columnIndex: idxB } }),
    ]);
    return NextResponse.json({ ok: true });
  });
}
