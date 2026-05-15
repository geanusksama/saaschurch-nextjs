import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, kanScopeFilter } from "@/lib/helpers";

/** Mirrors old buildScheduleDashboardScope – returns a SQL clause + params. */
function buildScheduleScope(user: {
  profileType?: string;
  campoId?: string;
  churchId?: string;
}): { clause: string; params: string[] } {
  const pt = user?.profileType;
  if (pt === "master" || pt === "admin") return { clause: "", params: [] };

  // User bound to a campo directly
  if (user?.campoId) {
    return {
      clause: "AND r.campo_id = $1::uuid",
      params: [user.campoId],
    };
  }

  // User bound to a church → derive campo from that church
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

// Detect whether a KanService belongs to a consecration process
function isConsecrationService(s: { serviceGroup?: string | null; sigla?: string; description?: string } | null) {
  if (!s) return false;
  if (s.serviceGroup?.toUpperCase() === "CONSAGRACAO") return true;
  const key = `${s.sigla || ""} ${s.description || ""}`.toLowerCase();
  return /consagra|diacono|diaconisa|evangelista|missionari|pastor|cooperador|presbiter/.test(key);
}

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const canManageSchedules = user.profileType === "master" || user.profileType === "admin";
    const scope = buildScheduleScope(user);

    // ── Schedules ─────────────────────────────────────────────────────────
    // Mirror old query: JOIN regionais to get campo_id for field-based lookup
    const scheduleRows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT cs.id::text AS id,
              cs.church_id::text AS "churchId",
              cs.scheduled_date AS "scheduledDate",
              cs.notes,
              cs.is_active AS "isActive",
              cs.created_at AS "createdAt",
              r.campo_id::text AS "fieldId",
              c.name AS "churchName",
              c.code AS "churchCode"
         FROM consecration_schedules cs
         JOIN churches c ON c.id = cs.church_id
        LEFT JOIN regionais r ON r.id = c.regional_id
        WHERE cs.is_active = TRUE
          AND cs.scheduled_date >= CURRENT_DATE
          ${scope.clause}
        ORDER BY cs.scheduled_date ASC
        LIMIT 100`,
      ...scope.params,
    ).catch(() => [] as Array<Record<string, unknown>>);

    // Build lookup maps (mirror old nextScheduleByChurchId / nextScheduleByFieldId)
    const nextByChurch = new Map<string, Record<string, unknown>>();
    const nextByField = new Map<string, Record<string, unknown>>();
    for (const row of scheduleRows) {
      const cId = row.churchId as string;
      const fId = row.fieldId as string | null;
      if (cId && !nextByChurch.has(cId)) nextByChurch.set(cId, row);
      if (fId && !nextByField.has(fId)) nextByField.set(fId, row);
    }

    // ── Cards ──────────────────────────────────────────────────────────────
    const cards = await prisma.kanCard.findMany({
      where: {
        deletedAt: null,
        ...kanScopeFilter(user),
        service: { is: { OR: [{ serviceGroup: "CONSAGRACAO" }, { serviceGroup: null }] } },
      },
      include: {
        church: {
          select: {
            id: true, name: true, code: true,
            regional: { select: { id: true, campoId: true } },
          },
        },
        member: { select: { id: true, fullName: true, phone: true, mobile: true, ecclesiasticalTitle: true, membershipStatus: true, memberType: true } },
        service: { select: { id: true, sigla: true, description: true, serviceGroup: true } },
        column: { select: { id: true, name: true, columnIndex: true, color: true } },
      },
      orderBy: { openedAt: "desc" },
    });

    // Filter to consecration-only services after fetch (covers null serviceGroup)
    const consecCards = cards.filter((c) => isConsecrationService(c.service));

    const queue = consecCards.map((card) => {
      const churchCampoId = card.church?.regional?.campoId || null;
      const nextConsecration =
        nextByChurch.get(card.churchId) ||
        (churchCampoId ? nextByField.get(churchCampoId) : null) ||
        null;

      return {
        id: card.id,
        protocol: card.protocol,
        church: card.church,
        member: card.member,
        service: card.service,
        intendedTitle: card.intendedTitle || null,
        currentTitle: card.currentTitle || card.member?.ecclesiasticalTitle || null,
        status: card.status,
        statusLabel: card.statusLabel || card.column?.name || "Pendente",
        columnIndex: card.columnIndex,
        openedAt: card.openedAt,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        consecrationDate: (card.metadata as any)?.consecrationDate || null,
        nextConsecration,
        notes: card.observations || card.description || null,
      };
    });

    const now = new Date();
    const stats = {
      totalCount: queue.length,
      thisMonthCount: queue.filter((item) => {
        const d = item.consecrationDate || item.nextConsecration?.scheduledDate || item.openedAt;
        if (!d) return false;
        const date = new Date(d as string);
        return !Number.isNaN(date.getTime()) && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      }).length,
      pendingCount: queue.filter((item) => item.columnIndex === 1).length,
      completedCount: queue.filter((item) => item.columnIndex === 4).length,
      nextConsecrationDate: scheduleRows[0]?.scheduledDate || null,
    };

    return NextResponse.json(
      serializeBigInts({ canManageSchedules, schedules: scheduleRows, queue, stats }),
    );
  });
}
