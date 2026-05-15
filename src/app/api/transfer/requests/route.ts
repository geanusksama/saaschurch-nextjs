import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, assertChurchAccess, buildProtocol } from "@/lib/helpers";

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    async function applyMatrixRule({ card, serviceId, columnIndex, user, extraMessage }: { card: Record<string, unknown>; serviceId: number; columnIndex: number; user: { id?: string }; extraMessage?: string | null }) {
      try {
        const rule = await prisma.kanMatrixRule.findUnique({ where: { serviceId_columnIndex: { serviceId, columnIndex } } });
        if (!rule) return;
        const service = await prisma.kanService.findUnique({ where: { id: serviceId } });
        const serviceGroup = service?.serviceGroup || service?.sigla || "GERAL";
        const serviceName = service?.description || service?.sigla || "";
        if (card.memberId && (rule.changeStatus || rule.changeTitle || rule.doesTransfer)) {
          const memberData: Record<string, unknown> = {};
          if (rule.changeStatus && rule.newStatus) memberData.membershipStatus = rule.newStatus.toUpperCase();
          if (rule.changeTitle && rule.newTitle) {
            memberData.ecclesiasticalTitle = rule.newTitle;
            const titleRecord = await prisma.ecclesiasticalTitle.findFirst({ where: { name: { equals: rule.newTitle, mode: "insensitive" }, deletedAt: null, isActive: true } });
            memberData.ecclesiasticalTitleId = titleRecord?.id ?? null;
          }
          if (rule.doesTransfer && card.destinationChurchId) {
            const destChurch = await prisma.church.findUnique({ where: { id: card.destinationChurchId as string }, select: { regionalId: true } });
            if (destChurch) {
              memberData.churchId = card.destinationChurchId;
              memberData.regionalId = destChurch.regionalId ?? null;
            }
          }
          if (Object.keys(memberData).length > 0) await prisma.member.update({ where: { id: card.memberId as string }, data: memberData });
        }
        if (rule.insertOccurrence !== false) {
          await prisma.memberEventHistory.create({
            data: {
              memberId: (card.memberId as string) || null, churchId: card.churchId as string,
              serviceGroup, serviceName, columnIndex,
              action: rule.occurrenceName || serviceName || "MOVIMENTO",
              notes: extraMessage || rule.message || null,
              metadata: { source: "MATRIX", cardId: card.id },
              cardId: card.id as string,
              createdBy: user?.id || null,
            },
          }).catch(() => null);
        }
      } catch (e) { console.error("applyMatrixRule error:", e); }
    }
    const body = await req.json().catch(() => ({}));
    const { memberId, targetChurchId, destinationChurchId, notes } = body;
    const resolvedTargetChurchId = targetChurchId || destinationChurchId || null;
    if (!memberId) return NextResponse.json({ error: "memberId is required" }, { status: 400 });

    const member = await prisma.member.findFirst({ where: { id: memberId, deletedAt: null } });
    if (!member) return NextResponse.json({ error: "member not found" }, { status: 404 });
    const ok = await assertChurchAccess(user, member.churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    if (resolvedTargetChurchId && resolvedTargetChurchId === member.churchId) {
      return NextResponse.json({ error: "Selecione uma igreja de destino diferente da origem." }, { status: 400 });
    }

    const service = await prisma.kanService.findFirst({ where: { isActive: true, serviceGroup: "TRANSFERENCIA" } });
    if (!service) return NextResponse.json({ error: "transfer service not configured" }, { status: 404 });
    const stage = await prisma.kanStage.findFirst({ where: { serviceId: service.id, isActive: true }, include: { columns: { where: { columnIndex: 1 }, take: 1 } } });
    if (!stage) return NextResponse.json({ error: "transfer stage not configured" }, { status: 404 });
    const firstColumn = stage.columns[0];
    if (!firstColumn) return NextResponse.json({ error: "stage has no first column" }, { status: 400 });

    const card = await prisma.kanCard.create({
      data: {
        protocol: buildProtocol(service.sigla), stageId: stage.id, serviceId: service.id,
        columnId: firstColumn.id, columnIndex: 1, churchId: member.churchId,
        destinationChurchId: resolvedTargetChurchId || null,
        memberId: member.id, candidateName: member.fullName, status: "pendente",
        statusLabel: firstColumn.name, observations: notes || null, createdBy: user.id || null,
        metadata: { flowType: "transferencia", targetChurchId: resolvedTargetChurchId },
      },
    });

    await applyMatrixRule({
      card: card as unknown as Record<string, unknown>,
      serviceId: service.id,
      columnIndex: 1,
      user,
      extraMessage: notes
    });

    return NextResponse.json(serializeBigInts({ ok: true, card }), { status: 201 });
  });
}
