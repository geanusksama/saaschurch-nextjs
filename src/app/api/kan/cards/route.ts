import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, kanScopeFilter, isRestrictedToOwnChurch, buildProtocol } from "@/lib/helpers";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function applyMatrixRule({ card, serviceId, columnIndex, user, extraMessage }: { card: Record<string, unknown>; serviceId: number; columnIndex: number; user: { id?: string; profileType?: string }; extraMessage?: string | null }) {
  try {
    const rule = await prisma.kanMatrixRule.findUnique({ where: { serviceId_columnIndex: { serviceId, columnIndex } } });
    if (!rule) return;
    const service = (card.service as Record<string, unknown> | null) || await prisma.kanService.findUnique({ where: { id: serviceId } });
    const serviceGroup = (service as Record<string, string> | null)?.serviceGroup || (service as Record<string, string> | null)?.sigla || "GERAL";
    const serviceName = (service as Record<string, string> | null)?.description || (service as Record<string, string> | null)?.sigla || "";
    if (card.memberId && (rule.changeStatus || rule.changeTitle)) {
      const memberData: Record<string, unknown> = {};
      if (rule.changeStatus && rule.newStatus) memberData.membershipStatus = rule.newStatus.toUpperCase();
      if (rule.changeTitle && rule.newTitle) {
        memberData.ecclesiasticalTitle = rule.newTitle;
        const titleRecord = await prisma.ecclesiasticalTitle.findFirst({ where: { name: { equals: rule.newTitle, mode: "insensitive" }, deletedAt: null, isActive: true } });
        memberData.ecclesiasticalTitleId = titleRecord?.id ?? null;
      }
      if (Object.keys(memberData).length > 0) await prisma.member.update({ where: { id: card.memberId as string }, data: memberData });
    }
    if (rule.insertOccurrence !== false) {
      await prisma.memberEventHistory.create({
        data: {
          memberId: (card.memberId as string) || null,
          churchId: card.churchId as string,
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

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const { stageId, serviceId, churchId, memberId, candidateName, destinationChurchId, originRegionalId, destinationRegionalId, requesterChurchId, requestedChurchId, requesterName, subject, justification, observations, description, intendedTitle, metadata, attachments } = body;

    if (isRestrictedToOwnChurch(user) && user.churchId && churchId !== user.churchId) {
      return NextResponse.json({ error: "Perfil de igreja só pode abrir processos da própria igreja." }, { status: 403 });
    }
    if (!serviceId || !churchId) return NextResponse.json({ error: "serviceId, churchId required" }, { status: 400 });

    const service = await prisma.kanService.findUnique({ where: { id: Number(serviceId) } });
    if (!service) return NextResponse.json({ error: "service not found" }, { status: 404 });

    let stage = null;
    if (stageId) {
      stage = await prisma.kanStage.findUnique({ where: { id: Number(stageId) }, include: { columns: { where: { columnIndex: 1 }, take: 1 } } });
    }
    if (!stage || !stage.columns?.length) {
      const firstRule = await prisma.kanMatrixRule.findFirst({ where: { serviceId: Number(serviceId), columnIndex: 1, isActive: true }, orderBy: { id: "asc" }, select: { stageId: true } });
      if (firstRule?.stageId) {
        stage = await prisma.kanStage.findUnique({ where: { id: Number(firstRule.stageId) }, include: { columns: { where: { columnIndex: 1 }, take: 1 } } });
      }
    }
    if (!stage) return NextResponse.json({ error: "stage not found" }, { status: 404 });
    const firstColumn = stage.columns[0];
    if (!firstColumn) return NextResponse.json({ error: "stage has no first column" }, { status: 400 });

    const protocol = buildProtocol(service.sigla);
    let member = memberId ? await prisma.member.findUnique({ where: { id: memberId } }) : null;
    if (member && isRestrictedToOwnChurch(user) && user.churchId && member.churchId !== user.churchId) {
      return NextResponse.json({ error: "Perfil de igreja só pode vincular membros da própria igreja." }, { status: 403 });
    }
    let resolvedMemberId = memberId || null;
    if (!resolvedMemberId && candidateName && churchId) {
      const foundMember = await prisma.member.findFirst({ where: { churchId, deletedAt: null, fullName: { equals: candidateName.trim(), mode: "insensitive" } } });
      if (foundMember) { member = foundMember; resolvedMemberId = foundMember.id; }
    }
    let resolvedOriginRegionalId = originRegionalId || null;
    if (!resolvedOriginRegionalId && churchId) {
      const originChurch = await prisma.church.findUnique({ where: { id: churchId }, select: { regionalId: true } });
      resolvedOriginRegionalId = originChurch?.regionalId || null;
    }
    let resolvedDestRegionalId = destinationRegionalId || null;
    if (!resolvedDestRegionalId && destinationChurchId) {
      const destChurch = await prisma.church.findUnique({ where: { id: destinationChurchId }, select: { regionalId: true } });
      resolvedDestRegionalId = destChurch?.regionalId || null;
    }

    const card = await prisma.kanCard.create({
      data: {
        protocol, stageId: stage.id, serviceId: service.id, columnId: firstColumn.id, columnIndex: 1, churchId,
        memberId: resolvedMemberId, destinationChurchId: destinationChurchId || null,
        originRegionalId: resolvedOriginRegionalId, destinationRegionalId: resolvedDestRegionalId,
        requesterChurchId: requesterChurchId || null, requestedChurchId: requestedChurchId || null,
        requesterName: requesterName || null, candidateName: candidateName || member?.fullName || null,
        currentTitle: member?.ecclesiasticalTitle || null, intendedTitle: intendedTitle || null,
        subject: subject || null, justification: justification || null, observations: observations || null,
        description: description || null, status: "pendente", statusLabel: firstColumn.name,
        metadata: metadata || null, attachments: attachments || null, createdBy: user.id || null,
      },
      include: {
        church: { select: { id: true, name: true, code: true } },
        destinationChurch: { select: { id: true, name: true, code: true } },
        member: { select: { id: true, fullName: true, ecclesiasticalTitle: true, membershipStatus: true, memberType: true } },
        service: { select: { sigla: true, description: true } },
      },
    });

    await applyMatrixRule({ card: card as unknown as Record<string, unknown>, serviceId: service.id, columnIndex: 1, user, extraMessage: justification });
    return NextResponse.json(serializeBigInts(card), { status: 201 });
  });
}
