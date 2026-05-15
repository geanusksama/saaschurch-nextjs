import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, kanScopeFilter } from "@/lib/helpers";

function buildScheduleScope(user: {
  profileType?: string;
  campoId?: string;
  churchId?: string;
}): { clause: string; params: string[] } {
  const pt = user?.profileType;
  if (pt === "master" || pt === "admin") return { clause: "", params: [] };

  if (user?.campoId) {
    return {
      clause: "AND r.campo_id = $1::uuid",
      params: [user.campoId],
    };
  }

  if (user?.churchId) {
    return {
      clause: `AND r.campo_id = (
        SELECT r2.campo_id
          FROM churches c2
          LEFT JOIN regionais r2 ON r2.id = c2.regional_id
         WHERE c2.id = $1::uuid
         LIMIT 1
      )`,
      params: [user.churchId],
    };
  }

  return { clause: "", params: [] };
}

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const canManageSchedules = user.profileType === "master" || user.profileType === "admin";
    const scope = buildScheduleScope(user);

    // Raw query for baptism schedules
    const scheduleRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT bs.id::text AS id,
              bs.church_id::text AS "churchId",
              bs.scheduled_date AS "scheduledDate",
              bs.notes,
              bs.is_active AS "isActive",
              bs.created_at AS "createdAt",
              r.campo_id::text AS "fieldId",
              c.name AS "churchName",
              c.code AS "churchCode"
       FROM baptism_schedules bs
       JOIN churches c ON c.id = bs.church_id
       LEFT JOIN regionais r ON r.id = c.regional_id
       WHERE bs.is_active = TRUE
         AND bs.scheduled_date >= CURRENT_DATE
         ${scope.clause}
       ORDER BY bs.scheduled_date ASC
       LIMIT 100`,
      ...scope.params,
    ).catch(() => [] as Array<Record<string, unknown>>);

    const nextByChurch = new Map<string, Record<string, unknown>>();
    const nextByField = new Map<string, Record<string, unknown>>();
    for (const row of scheduleRows) {
      const churchId = row.churchId as string;
      const fieldId = row.fieldId as string | null;
      if (churchId && !nextByChurch.has(churchId)) nextByChurch.set(churchId, row);
      if (fieldId && !nextByField.has(fieldId)) nextByField.set(fieldId, row);
    }

    const cards = await prisma.kanCard.findMany({
      where: { deletedAt: null, ...kanScopeFilter(user), service: { is: { serviceGroup: "BATISMO" } } },
      include: {
        church: {
          select: {
            id: true,
            name: true,
            code: true,
            regional: { select: { id: true, campoId: true } },
          },
        },
        member: { select: { id: true, fullName: true, phone: true, mobile: true, baptismStatus: true, ecclesiasticalTitle: true, membershipStatus: true } },
        service: { select: { id: true, sigla: true, description: true } },
        column: { select: { id: true, name: true, columnIndex: true, color: true } },
      },
      orderBy: { openedAt: "desc" },
    });

    const queue = cards.map((card) => {
      const churchCampoId = card.church?.regional?.campoId || null;
      const nextBaptism = nextByChurch.get(card.churchId) || (churchCampoId ? nextByField.get(churchCampoId) : null) || null;

      return {
        id: card.id,
        protocol: card.protocol,
        church: card.church,
        member: card.member,
        service: card.service,
        status: card.status,
        statusLabel: card.statusLabel || card.column?.name || "Pendente",
        columnIndex: card.columnIndex,
        openedAt: card.openedAt,
        nextBaptism,
      };
    });

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
