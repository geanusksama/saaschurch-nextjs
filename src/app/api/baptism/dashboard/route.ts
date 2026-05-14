import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, kanScopeFilter } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const canManageSchedules = user.profileType === "master" || user.profileType === "admin";

    // Raw query for baptism schedules
    const scheduleRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT bs.id::text AS id, bs.church_id::text AS "churchId", bs.scheduled_date AS "scheduledDate", bs.notes, bs.is_active AS "isActive", bs.created_at AS "createdAt", c.name AS "churchName", c.code AS "churchCode"
       FROM baptism_schedules bs
       JOIN churches c ON c.id = bs.church_id
       WHERE bs.is_active = TRUE AND bs.scheduled_date >= CURRENT_DATE
       ORDER BY bs.scheduled_date ASC
       LIMIT 100`
    );

    const cards = await prisma.kanCard.findMany({
      where: { deletedAt: null, ...kanScopeFilter(user), service: { is: { serviceGroup: "BATISMO" } } },
      include: {
        church: { select: { id: true, name: true, code: true } },
        member: { select: { id: true, fullName: true, phone: true, mobile: true, baptismStatus: true, ecclesiasticalTitle: true, membershipStatus: true } },
        service: { select: { id: true, sigla: true, description: true } },
        column: { select: { id: true, name: true, columnIndex: true, color: true } },
      },
      orderBy: { openedAt: "desc" },
    });

    const queue = cards.map((card) => ({
      id: card.id, protocol: card.protocol, church: card.church, member: card.member, service: card.service,
      status: card.status, statusLabel: card.statusLabel || card.column?.name || "Pendente",
      columnIndex: card.columnIndex, openedAt: card.openedAt,
    }));

    return NextResponse.json(serializeBigInts({
      canManageSchedules, schedules: scheduleRows, queue,
      stats: {
        pendingCount: queue.filter((i) => i.columnIndex === 1).length,
        approvedCount: queue.filter((i) => i.columnIndex === 2).length,
        cancelledCount: queue.filter((i) => i.columnIndex === 3).length,
        nextBaptismDate: (scheduleRows[0] as Record<string, unknown>)?.scheduledDate || null,
      },
    }));
  });
}
