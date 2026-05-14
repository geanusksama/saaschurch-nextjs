import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, kanScopeFilter } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const canManage = user.profileType === "master" || user.profileType === "admin";
    const scheduleRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT cs.id::text AS id, cs.church_id::text AS "churchId", cs.scheduled_date AS "scheduledDate", cs.notes, cs.is_active AS "isActive", cs.created_at AS "createdAt", c.name AS "churchName", c.code AS "churchCode"
       FROM consecration_schedules cs
       JOIN churches c ON c.id = cs.church_id
       WHERE cs.is_active = TRUE AND cs.scheduled_date >= CURRENT_DATE
       ORDER BY cs.scheduled_date ASC
       LIMIT 100`
    ).catch(() => [] as Array<Record<string, unknown>>);

    const cards = await prisma.kanCard.findMany({
      where: { deletedAt: null, ...kanScopeFilter(user), service: { is: { serviceGroup: "CONSAGRACAO" } } },
      include: {
        church: { select: { id: true, name: true, code: true } },
        member: { select: { id: true, fullName: true, ecclesiasticalTitle: true, membershipStatus: true } },
        service: { select: { id: true, sigla: true, description: true } },
        column: { select: { id: true, name: true, columnIndex: true, color: true } },
      },
      orderBy: { openedAt: "desc" },
    });

    return NextResponse.json(serializeBigInts({
      canManage, schedules: scheduleRows, queue: cards,
      stats: {
        pendingCount: cards.filter((c) => c.columnIndex === 1).length,
        approvedCount: cards.filter((c) => c.columnIndex === 2).length,
        totalCount: cards.length,
      },
    }));
  });
}
