import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, kanScopeFilter } from "@/lib/helpers";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const stageId = Number(id);

    const stage = await prisma.kanStage.findUnique({
      where: { id: stageId },
      include: { columns: { orderBy: { columnIndex: "asc" } }, service: true, pipeline: true },
    });
    if (!stage) return NextResponse.json({ stage: null, columns: [] });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cardWhere: Record<string, any> = { stageId, deletedAt: null, ...kanScopeFilter(user) };
    const churchId = searchParams.get("churchId");
    const campoId = searchParams.get("campoId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const q = searchParams.get("q");

    if (churchId) cardWhere.churchId = churchId;
    if (campoId) cardWhere.church = { ...(cardWhere.church || {}), regional: { campoId } };
    if (from || to) {
      cardWhere.openedAt = {};
      if (from) cardWhere.openedAt.gte = new Date(from);
      if (to) { const toDate = new Date(to); toDate.setHours(23, 59, 59, 999); cardWhere.openedAt.lte = toDate; }
    }
    if (q) {
      cardWhere.OR = [
        { protocol: { contains: q, mode: "insensitive" } },
        { candidateName: { contains: q, mode: "insensitive" } },
      ];
    }

    const cards = await prisma.kanCard.findMany({
      where: cardWhere,
      include: {
        church: { select: { id: true, name: true, code: true } },
        destinationChurch: { select: { id: true, name: true, code: true } },
        member: { select: { id: true, fullName: true, ecclesiasticalTitle: true, membershipStatus: true, rol: true, memberType: true } },
        service: { select: { sigla: true, description: true } },
        column: { select: { id: true, name: true, columnIndex: true, color: true } },
      },
      orderBy: { openedAt: "desc" },
    });

    const grouped = stage.columns.map((col) => ({
      ...col,
      cards: cards.filter((c) => c.columnIndex === col.columnIndex),
    }));

    return NextResponse.json(serializeBigInts({ stage, columns: grouped, totalCards: cards.length }));
  });
}
