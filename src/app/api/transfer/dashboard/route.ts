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
        member: { select: { id: true, fullName: true, ecclesiasticalTitle: true, membershipStatus: true } },
        service: { select: { id: true, sigla: true, description: true } },
        column: { select: { id: true, name: true, columnIndex: true, color: true } },
      },
      orderBy: { openedAt: "desc" },
    });
    return NextResponse.json(serializeBigInts({
      canManage, queue: cards,
      stats: {
        pendingCount: cards.filter((c) => c.columnIndex === 1).length,
        approvedCount: cards.filter((c) => c.columnIndex === 2).length,
        totalCount: cards.length,
      },
    }));
  });
}
