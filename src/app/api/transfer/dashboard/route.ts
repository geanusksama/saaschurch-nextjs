import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, kanScopeFilter } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const canManage = user.profileType === "master" || user.profileType === "admin";
    const cards = await prisma.kanCard.findMany({
      where: { deletedAt: null, ...kanScopeFilter(user), service: { is: { serviceGroup: "TRANSFERENCIA" } } },
      include: {
        church: { select: { id: true, name: true, code: true } },
        destinationChurch: { select: { id: true, name: true, code: true } },
        member: { select: { id: true, fullName: true, ecclesiasticalTitle: true, membershipStatus: true } },
        service: { select: { id: true, sigla: true, description: true } },
        column: { select: { id: true, name: true, columnIndex: true, color: true } },
      },
      orderBy: { openedAt: "desc" },
    });
    // Build unique statusOptions from the distinct columns present in the loaded cards
    const columnMap = new Map<number, { value: string; label: string; columnIndex: number }>();
    for (const card of cards) {
      if (card.column && !columnMap.has(card.columnIndex)) {
        columnMap.set(card.columnIndex, {
          value: String(card.columnIndex),
          label: card.column.name,
          columnIndex: card.columnIndex,
        });
      }
    }
    // If no cards yet, query the columns directly from the TRANSFERENCIA pipeline stages
    if (columnMap.size === 0) {
      const columns = await prisma.kanColumn.findMany({
        where: { stage: { service: { serviceGroup: "TRANSFERENCIA" } } },
        orderBy: { columnIndex: "asc" },
        select: { id: true, name: true, columnIndex: true },
      });
      for (const col of columns) {
        if (!columnMap.has(col.columnIndex)) {
          columnMap.set(col.columnIndex, { value: String(col.columnIndex), label: col.name, columnIndex: col.columnIndex });
        }
      }
    }
    const statusOptions = Array.from(columnMap.values()).sort((a, b) => a.columnIndex - b.columnIndex);

    return NextResponse.json(serializeBigInts({
      canManage, queue: cards,
      statusOptions,
      stats: {
        pendingCount: cards.filter((c) => c.columnIndex === 1).length,
        approvedCount: cards.filter((c) => c.columnIndex === 2).length,
        totalCount: cards.length,
      },
    }));
  });
}
