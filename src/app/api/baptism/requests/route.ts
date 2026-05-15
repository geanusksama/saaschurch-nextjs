import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, assertChurchAccess, buildProtocol } from "@/lib/helpers";

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

    const svc = await prisma.kanService.findUnique({ where: { id: serviceId } });
    const serviceGroup = svc?.serviceGroup || svc?.sigla || "GERAL";
    const serviceName = svc?.description || svc?.sigla || "";

    if (card.memberId && (rule.changeStatus || rule.changeTitle)) {
      const memberData: Record<string, unknown> = {};
      if (rule.changeStatus && rule.newStatus) memberData.membershipStatus = rule.newStatus.toUpperCase();
      if (rule.changeTitle && rule.newTitle) {
        memberData.ecclesiasticalTitle = rule.newTitle;
        const titleRecord = await prisma.ecclesiasticalTitle.findFirst({
          where: { name: { equals: rule.newTitle, mode: "insensitive" }, deletedAt: null, isActive: true },
        });
        memberData.ecclesiasticalTitleId = titleRecord?.id ?? null;
      }
      if (Object.keys(memberData).length > 0) {
        await prisma.member.update({ where: { id: card.memberId as string }, data: memberData });
      }
    }

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
    console.error("applyMatrixRule (baptism) error:", e);
  }
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const { memberId, baptismDate, notes } = body;
    if (!memberId) return NextResponse.json({ error: "memberId is required" }, { status: 400 });

    const member = await prisma.member.findFirst({
      where: { id: memberId, deletedAt: null },
      include: { church: { select: { id: true, name: true, code: true } } },
    });
    if (!member) return NextResponse.json({ error: "member not found" }, { status: 404 });
    const ok = await assertChurchAccess(user, member.churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

    // Find baptism service
    const service = await prisma.kanService.findFirst({ where: { isActive: true, serviceGroup: "BATISMO" } });
    if (!service) return NextResponse.json({ error: "baptism service not configured" }, { status: 404 });

    // Find stage — by serviceId first, fallback to name
    let stage = await prisma.kanStage.findFirst({
      where: { serviceId: service.id, isActive: true },
      include: { columns: { where: { columnIndex: 1 }, take: 1 } },
      orderBy: { id: "asc" },
    });
    if (!stage || !stage.columns?.length) {
      const rule = await prisma.kanMatrixRule.findFirst({
        where: { serviceId: service.id, columnIndex: 1, isActive: true },
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
    if (!stage) return NextResponse.json({ error: "baptism stage not configured" }, { status: 404 });
    const firstColumn = stage.columns[0];
    if (!firstColumn) return NextResponse.json({ error: "stage has no first column" }, { status: 400 });

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
        status: "pendente",
        statusLabel: firstColumn.name,
        observations: notes || null,
        description: notes || null,
        createdBy: user.id || null,
        metadata: { flowType: "batismo", baptismDate: baptismDate || null },
      },
      include: {
        church: { select: { id: true, name: true, code: true } },
        member: { select: { id: true, fullName: true, ecclesiasticalTitle: true } },
        service: { select: { id: true, sigla: true, description: true, serviceGroup: true } },
      },
    });

    // Apply matrix rule for columnIndex=1 (triggers occurrence insertion)
    await applyMatrixRule({
      card: card as unknown as Record<string, unknown>,
      serviceId: service.id,
      columnIndex: 1,
      user,
      extraMessage: notes || null,
    });

    return NextResponse.json(serializeBigInts({ ok: true, card }), { status: 201 });
  });
}
