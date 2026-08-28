import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, kanScopeFilter, kanQueueWindow, KAN_QUEUE_CAP, kanQueueTake } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const sp = new URL(req.url).searchParams;
    const canManage = user.profileType === "master" || user.profileType === "admin";
    const cards = await prisma.kanCard.findMany({
      where: {
        deletedAt: null,
        ...kanScopeFilter(user),
        service: { is: { serviceGroup: "TRANSFERENCIA" } },
        ...kanQueueWindow(sp),
      },
      include: {
        church: { select: { id: true, name: true, code: true } },
        destinationChurch: { select: { id: true, name: true, code: true } },
        member: { select: { id: true, fullName: true, ecclesiasticalTitle: true, membershipStatus: true } },
        service: { select: { id: true, sigla: true, description: true } },
        column: { select: { id: true, name: true, columnIndex: true, color: true } },
      },
      orderBy: { openedAt: "desc" },
      // undefined quando o chamador passou all=1 (relatórios): sem teto.
      take: kanQueueTake(sp),
    });

    const truncated = cards.length > KAN_QUEUE_CAP && sp.get("all") !== "1";
    if (truncated) cards.length = KAN_QUEUE_CAP;

    // As opções de status vêm do pipeline, não dos cards carregados. Derivá-las
    // dos cards fazia o filtro perder opções sempre que a fila visível não
    // tinha nenhum card naquela coluna — o que passou a ser comum agora que a
    // fila chega recortada por data.
    const columnMap = new Map<number, { value: string; label: string; columnIndex: number }>();
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
    // Coluna que aparece num card mas não no pipeline (dado legado) não some do filtro.
    for (const card of cards) {
      if (card.column && !columnMap.has(card.columnIndex)) {
        columnMap.set(card.columnIndex, {
          value: String(card.columnIndex),
          label: card.column.name,
          columnIndex: card.columnIndex,
        });
      }
    }
    const statusOptions = Array.from(columnMap.values()).sort((a, b) => a.columnIndex - b.columnIndex);

    return NextResponse.json(serializeBigInts({
      canManage, queue: cards, truncated, queueCap: KAN_QUEUE_CAP,
      statusOptions,
      stats: {
        pendingCount: cards.filter((c) => c.columnIndex === 1).length,
        approvedCount: cards.filter((c) => c.columnIndex === 2).length,
        totalCount: cards.length,
      },
    }));
  });
}
