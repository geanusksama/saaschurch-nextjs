import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, assertChurchAccess, buildProtocol, isRestrictedToOwnChurch } from "@/lib/helpers";

// ── Helpers mirroring old server ────────────────────────────────────────────

function normalizeLookup(v: string) {
  return String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Mirrors old findConsecrationServiceForTitle */
function findServiceForTitle(
  title: { name: string; abbreviation?: string | null },
  services: Array<{ id: number; sigla: string; description: string }>,
) {
  const abbr = normalizeLookup(title.abbreviation || "");
  const name = normalizeLookup(title.name);
  return (
    services.find((s) => {
      const sigla = normalizeLookup(s.sigla);
      if (abbr && (sigla === abbr || sigla.endsWith(abbr) || abbr.endsWith(sigla))) return true;
      return normalizeLookup(s.description).includes(name);
    }) || null
  );
}

/** Mirrors old resolveConsecrationSetup */
async function resolveConsecrationSetup({
  titleId,
  intendedTitle,
  serviceId,
}: {
  titleId?: string;
  intendedTitle?: string;
  serviceId?: number | null;
}) {
  const [allTitles, allServices] = await Promise.all([
    prisma.ecclesiasticalTitle.findMany({
      where: { isActive: true, deletedAt: null, name: { notIn: ["CONGREGADO", "MEMBRO"] } },
      orderBy: [{ displayOrder: "asc" }, { level: "asc" }, { name: "asc" }],
    }),
    prisma.kanService.findMany({ where: { isActive: true }, orderBy: { id: "asc" } }),
  ]);

  // Filter to consecration services (serviceGroup or keyword match)
  const services = allServices.filter((s) => {
    if (s.serviceGroup?.toUpperCase() === "CONSAGRACAO") return true;
    const key = `${s.sigla} ${s.description}`.toLowerCase();
    return /consagra|diacono|diaconisa|evangelista|missionari|pastor|cooperador|presbiter/.test(key);
  });

  let title = titleId ? allTitles.find((t) => t.id === titleId) || null : null;
  if (!title && intendedTitle) {
    const key = normalizeLookup(intendedTitle);
    title = allTitles.find((t) => normalizeLookup(t.name) === key) || null;
  }

  let service = serviceId ? services.find((s) => s.id === Number(serviceId)) || null : null;
  if (!service && title) service = findServiceForTitle(title, services);

  return { title, service };
}

/** Mirrors old resolveConsecrationStage */
async function resolveConsecrationStage() {
  // Try by name first
  let stage = await prisma.kanStage.findFirst({
    where: { isActive: true, name: { contains: "Consagra", mode: "insensitive" } },
    include: { columns: { where: { columnIndex: 1 }, take: 1 } },
    orderBy: { id: "asc" },
  });

  // Fallback: find via KanMatrixRule → stageId for a consecration service
  if (!stage) {
    const rule = await prisma.kanMatrixRule.findFirst({
      where: {
        columnIndex: 1,
        isActive: true,
        service: {
          isActive: true,
          OR: [
            { serviceGroup: "CONSAGRACAO" },
            { description: { contains: "Consagra", mode: "insensitive" } },
          ],
        },
      },
      orderBy: { id: "asc" },
      select: { stageId: true },
    });

    if (rule?.stageId) {
      stage = await prisma.kanStage.findUnique({
        where: { id: rule.stageId },
        include: { columns: { where: { columnIndex: 1 }, take: 1 } },
      });
    }
  }

  // Fallback: find any stage linked to a consecration service
  if (!stage) {
    const consecSvc = await prisma.kanService.findFirst({
      where: {
        isActive: true,
        OR: [
          { serviceGroup: "CONSAGRACAO" },
          { description: { contains: "Consagra", mode: "insensitive" } },
        ],
      },
      orderBy: { id: "asc" },
    });
    if (consecSvc) {
      stage = await prisma.kanStage.findFirst({
        where: { serviceId: consecSvc.id, isActive: true },
        include: { columns: { where: { columnIndex: 1 }, take: 1 } },
        orderBy: { id: "asc" },
      });
    }
  }

  return stage;
}

/** Mirrors old getNextConsecrationScheduleForChurch (field-aware lookup) */
async function getNextScheduleForChurch(churchId: string) {
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT cs.id::text AS id,
            cs.church_id::text AS "churchId",
            cs.scheduled_date AS "scheduledDate",
            cs.notes,
            cs.created_at AS "createdAt",
            c.name AS "churchName",
            c.code AS "churchCode"
       FROM consecration_schedules cs
       JOIN churches c ON c.id = cs.church_id
      LEFT JOIN regionais r ON r.id = c.regional_id
       JOIN churches tc ON tc.id = $1::uuid
      LEFT JOIN regionais tr ON tr.id = tc.regional_id
      WHERE cs.is_active = TRUE
        AND cs.scheduled_date >= CURRENT_DATE
        AND (
          cs.church_id = tc.id
          OR (tr.campo_id IS NOT NULL AND r.campo_id = tr.campo_id)
        )
      ORDER BY CASE
                 WHEN cs.church_id = tc.id THEN 0
                 WHEN c.parent_church_id IS NULL THEN 1
                 ELSE 2
               END,
               cs.scheduled_date ASC
      LIMIT 1`,
    churchId,
  ).catch(() => [] as Array<Record<string, unknown>>);
  return rows[0] || null;
}

// ── applyMatrixRule (mirrors old server logic) ──────────────────────────────

async function applyMatrixRule({
  card,
  serviceId,
  columnIndex,
  user,
  extraMessage,
}: {
  card: Record<string, unknown>;
  serviceId: number;
  columnIndex: number;
  user: { id?: string; profileType?: string };
  extraMessage?: string | null;
}) {
  try {
    const rule = await prisma.kanMatrixRule.findUnique({
      where: { serviceId_columnIndex: { serviceId, columnIndex } },
    });
    if (!rule) return;

    const svc = (card.service as Record<string, string> | null) ||
      await prisma.kanService.findUnique({ where: { id: serviceId } });
    const serviceGroup = (svc as Record<string, string> | null)?.serviceGroup ||
      (svc as Record<string, string> | null)?.sigla || "GERAL";
    const serviceName = (svc as Record<string, string> | null)?.description ||
      (svc as Record<string, string> | null)?.sigla || "";

    // Update member status / title
    if (card.memberId && (rule.changeStatus || rule.changeTitle)) {
      const memberUpdate: Record<string, unknown> = {};
      if (rule.changeStatus && rule.newStatus) memberUpdate.membershipStatus = rule.newStatus.toUpperCase();
      if (rule.changeTitle && rule.newTitle) {
        memberUpdate.ecclesiasticalTitle = rule.newTitle;
        const titleRecord = await prisma.ecclesiasticalTitle.findFirst({
          where: { name: { equals: rule.newTitle, mode: "insensitive" }, deletedAt: null, isActive: true },
        });
        memberUpdate.ecclesiasticalTitleId = titleRecord?.id ?? null;
      }
      if (Object.keys(memberUpdate).length > 0) {
        await prisma.member.update({ where: { id: card.memberId as string }, data: memberUpdate });
      }
    }

    // Insert occurrence in MemberEventHistory
    if (rule.insertOccurrence !== false) {
      await prisma.memberEventHistory.create({
        data: {
          memberId: (card.memberId as string) || null,
          churchId: card.churchId as string,
          serviceGroup,
          serviceName,
          columnIndex,
          action: rule.occurrenceName || serviceName || "MOVIMENTO",
          notes: extraMessage || rule.message || null,
          metadata: { source: "MATRIX", cardId: card.id },
          cardId: card.id as string,
          createdBy: user?.id || null,
        },
      }).catch(() => null);
    }
  } catch (e) {
    console.error("applyMatrixRule (consecration) error:", e);
  }
}

// ── POST /api/consecration/requests ────────────────────────────────────────

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const { memberId, titleId, serviceId, intendedTitle, consecrationDate, notes } = body;

    if (!memberId || (!titleId && !serviceId && !intendedTitle)) {
      return NextResponse.json({ error: "memberId e titulo sao obrigatorios" }, { status: 400 });
    }

    const member = await prisma.member.findFirst({
      where: { id: memberId, deletedAt: null },
      include: { church: { select: { id: true, name: true, code: true } } },
    });
    if (!member) return NextResponse.json({ error: "member not found" }, { status: 404 });

    const ok = await assertChurchAccess(user, member.churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

    if (isRestrictedToOwnChurch(user) && user.churchId && user.churchId !== member.churchId) {
      return NextResponse.json({ error: "Sem acesso a este membro." }, { status: 403 });
    }

    // Resolve title + service for the chosen ecclesiastical title
    const { title, service } = await resolveConsecrationSetup({
      titleId,
      intendedTitle,
      serviceId: serviceId ? Number(serviceId) : null,
    });

    if (!title) return NextResponse.json({ error: "Título eclesiástico não encontrado." }, { status: 404 });
    if (!service) return NextResponse.json({ error: "Serviço de consagração não configurado para este título." }, { status: 404 });

    // Find the consecration kanban stage
    const stage = await resolveConsecrationStage();
    if (!stage) return NextResponse.json({ error: "Etapa de consagração não configurada no kanban." }, { status: 404 });
    const firstColumn = stage.columns[0];
    if (!firstColumn) return NextResponse.json({ error: "Stage has no first column." }, { status: 400 });

    // Get next schedule for the church (field-aware)
    const nextSchedule = await getNextScheduleForChurch(member.churchId);
    const canChooseDate = user.profileType === "master" || user.profileType === "admin";
    const resolvedDate = canChooseDate
      ? (consecrationDate || nextSchedule?.scheduledDate || null)
      : (nextSchedule?.scheduledDate || null);

    if (!resolvedDate) {
      return NextResponse.json({ error: "Nenhuma data de consagração configurada para esta igreja." }, { status: 400 });
    }

    const card = await prisma.kanCard.create({
      data: {
        protocol: buildProtocol(service.sigla),
        stageId: stage.id,
        serviceId: service.id,
        columnId: firstColumn.id,
        columnIndex: 1,
        churchId: member.churchId,
        memberId: member.id,
        candidateName: member.fullName,
        currentTitle: member.ecclesiasticalTitle || null,
        intendedTitle: title.name,
        status: "pendente",
        statusLabel: firstColumn.name,
        observations: notes || null,
        description: notes || null,
        createdBy: user.id || null,
        metadata: {
          flowType: "consecration",
          consecrationDate: resolvedDate,
          scheduleId: nextSchedule?.id || null,
          targetTitleId: title.id,
          targetTitleName: title.name,
          serviceSigla: service.sigla,
        },
      },
      include: {
        church: { select: { id: true, name: true, code: true } },
        member: { select: { id: true, fullName: true, ecclesiasticalTitle: true, membershipStatus: true } },
        service: { select: { id: true, sigla: true, description: true, serviceGroup: true } },
      },
    });

    // Apply matrix rule for columnIndex=1 (inserts occurrence, changes status/title if configured)
    await applyMatrixRule({
      card: card as unknown as Record<string, unknown>,
      serviceId: service.id,
      columnIndex: 1,
      user,
      extraMessage: notes || null,
    });



    return NextResponse.json(
      serializeBigInts({ ok: true, card, nextConsecration: nextSchedule, intendedTitle: title.name, consecrationDate: resolvedDate }),
      { status: 201 },
    );
  });
}
