import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, isRestrictedToOwnChurch } from "@/lib/helpers";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function applyMatrixRule({ card, serviceId, columnIndex, user, extraMessage }: { card: Record<string, unknown>; serviceId: number; columnIndex: number; user: { id?: string }; extraMessage?: string | null }) {
  try {
    const rule = await prisma.kanMatrixRule.findUnique({ where: { serviceId_columnIndex: { serviceId, columnIndex } } });
    if (!rule) return;
    const service = (card.service as Record<string, string> | null) || await prisma.kanService.findUnique({ where: { id: serviceId } });
    const serviceGroup = (service as Record<string, string> | null)?.serviceGroup || (service as Record<string, string> | null)?.sigla || "GERAL";
    const serviceName = (service as Record<string, string> | null)?.description || (service as Record<string, string> | null)?.sigla || "";
    if (card.memberId && (rule.changeStatus || rule.changeTitle || rule.doesTransfer)) {
      const memberData: Record<string, unknown> = {};
      if (rule.changeStatus && rule.newStatus) memberData.membershipStatus = rule.newStatus.toUpperCase();
      if (rule.changeTitle && rule.newTitle) {
        memberData.ecclesiasticalTitle = rule.newTitle;
        const titleRecord = await prisma.ecclesiasticalTitle.findFirst({ where: { name: { equals: rule.newTitle, mode: "insensitive" }, deletedAt: null, isActive: true } });
        memberData.ecclesiasticalTitleId = titleRecord?.id ?? null;
      }
      if (rule.doesTransfer && card.destinationChurchId) {
        const destChurch = await prisma.church.findUnique({
          where: { id: card.destinationChurchId as string },
          select: { regionalId: true }
        });
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

async function notifyKanAction({ user, card, action, message }: { user: { id?: string; profileType?: string; campoId?: string }; card: { id: string; protocol?: string | null; churchId?: string | null }; action: string; message?: string | null }) {
  if (!user?.id) return;
  try {
    await prisma.notification.create({
      data: {
        userId: user.id,
        notificationType: "kan_action",
        title: `${action} — ${card?.protocol || card?.id || ""}`.trim(),
        message: message || null,
        actionUrl: "/admin/secretaria/pipeline",
        actionText: "Ver",
        data: {
          scope: "field",
          campoId: user.campoId || null,
          createdBy: user.id,
          cardId: card?.id || null,
          churchId: card?.churchId || null,
          action,
          iconKey: "bell",
          colorKey: "purple",
        },
      },
    });
  } catch (e) { console.warn("notifyKanAction failed:", e); }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const card = await prisma.kanCard.findUnique({
      where: { id },
      include: {
        church: { select: { id: true, name: true, code: true } },
        destinationChurch: { select: { id: true, name: true, code: true } },
        member: { select: { id: true, fullName: true, ecclesiasticalTitle: true, membershipStatus: true, rol: true, memberType: true } },
        service: { select: { sigla: true, description: true, serviceGroup: true } },
        column: { select: { id: true, name: true, columnIndex: true, color: true } },
        originRegional: { select: { id: true, name: true, code: true } },
        destinationRegional: { select: { id: true, name: true, code: true } },
        eventHistory: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    });
    if (!card || card.deletedAt) return NextResponse.json({ error: "card not found" }, { status: 404 });
    if (isRestrictedToOwnChurch(user) && user.churchId && card.churchId !== user.churchId) {
      return NextResponse.json({ error: "Sem acesso a registros de outra igreja." }, { status: 403 });
    }
    const userIds = [...new Set([card.createdBy, card.updatedBy, ...card.eventHistory.map((h) => h.createdBy)].filter(Boolean))] as string[];
    const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true, email: true } }) : [];
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
    return NextResponse.json(serializeBigInts({
      ...card,
      createdByUser: card.createdBy ? userMap[card.createdBy] || null : null,
      updatedByUser: card.updatedBy ? userMap[card.updatedBy] || null : null,
      eventHistory: card.eventHistory.map((h) => ({ ...h, createdByUser: h.createdBy ? userMap[h.createdBy] || null : null })),
    }));
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const card = await prisma.kanCard.findUnique({
      where: { id },
      include: { stage: { include: { columns: true } } },
    });
    if (!card || card.deletedAt) return NextResponse.json({ error: "card not found" }, { status: 404 });
    if (isRestrictedToOwnChurch(user) && user.churchId && card.churchId !== user.churchId) {
      return NextResponse.json({ error: "Sem acesso para alterar registros de outra igreja." }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const newColumnIndex = body.columnIndex != null ? Number(body.columnIndex) : null;
    const isMasterOrAdmin = user.profileType === "master" || user.profileType === "admin";
    if (newColumnIndex != null && newColumnIndex !== card.columnIndex && !isMasterOrAdmin) {
      return NextResponse.json({ error: "Apenas administradores e master podem mover registros entre etapas." }, { status: 403 });
    }

    const data: Record<string, unknown> = {};
    if (newColumnIndex && newColumnIndex !== card.columnIndex) {
      const targetColumn = card.stage?.columns.find((c) => c.columnIndex === newColumnIndex);
      if (!targetColumn) return NextResponse.json({ error: "invalid columnIndex" }, { status: 400 });
      const rule = await prisma.kanMatrixRule.findUnique({ where: { serviceId_columnIndex: { serviceId: card.serviceId, columnIndex: newColumnIndex } } });
      if (rule?.requireDocument) {
        const attachments = body.attachments || card.attachments || [];
        const list = Array.isArray(attachments) ? attachments : Object.values(attachments as Record<string, unknown>);
        if (list.length === 0) return NextResponse.json({ error: "documento obrigatório para esta coluna" }, { status: 400 });
      }
      data.columnId = targetColumn.id;
      data.columnIndex = newColumnIndex;
      data.statusLabel = targetColumn.name;
      if (newColumnIndex === card.stage?.columns.length) data.closedAt = new Date();
      if (newColumnIndex >= 2) { data.approvedBy = user.id || null; data.approvedAt = new Date(); }
    }

    const fields = ["attachments", "metadata", "justification", "observations", "description", "subject", "requesterName", "requesterChurchId", "requestedChurchId", "status"];
    for (const f of fields) { if (body[f] !== undefined) data[f] = body[f]; }
    if (body.destinationChurchId !== undefined) {
      data.destinationChurchId = body.destinationChurchId;
      if (body.destinationChurchId) {
        const destChurch = await prisma.church.findUnique({ where: { id: body.destinationChurchId }, select: { regionalId: true } });
        if (destChurch?.regionalId) data.destinationRegionalId = destChurch.regionalId;
      }
    }
    data.updatedBy = user.id || null;

    const updated = await prisma.kanCard.update({
      where: { id: card.id }, data,
      include: {
        church: { select: { id: true, name: true, code: true } },
        destinationChurch: { select: { id: true, name: true, code: true } },
        member: { select: { id: true, fullName: true, ecclesiasticalTitle: true, membershipStatus: true, memberType: true } },
        service: { select: { sigla: true, description: true } },
        column: { select: { id: true, name: true, columnIndex: true, color: true } },
      },
    });

    if (newColumnIndex && newColumnIndex !== card.columnIndex) {
      await applyMatrixRule({ card: updated as unknown as Record<string, unknown>, serviceId: updated.serviceId, columnIndex: newColumnIndex, user, extraMessage: body.message });
      // Notify about column move
      await notifyKanAction({
        user,
        card: { id: updated.id, protocol: updated.protocol, churchId: updated.churchId },
        action: `Movido para "${updated.statusLabel || newColumnIndex}"`,
        message: updated.member?.fullName || null,
      });
      const meta = (updated.metadata && typeof updated.metadata === "object") ? updated.metadata as Record<string, unknown> : {};
      if (meta.flowType === "credential" && meta.credentialRequestId) {
        const colName = (updated.statusLabel || "").toLowerCase();
        let credSituacao = null;
        if (newColumnIndex === 1 || colName.includes("pendente")) credSituacao = "Pendente";
        else if (newColumnIndex === 2 || colName.includes("aprovad")) credSituacao = "Aprovado";
        else if (colName.includes("entregue") || colName.includes("conclui") || newColumnIndex >= 3) credSituacao = "Entregue";
        else if (colName.includes("cancelad") || colName.includes("recusad")) credSituacao = "Cancelado";
        if (credSituacao) {
          await supabaseAdmin.from("tbcredencial").update({ situacao: credSituacao, updated_at: new Date().toISOString() }).eq("id", meta.credentialRequestId);
        }
      }
    }
    return NextResponse.json(serializeBigInts(updated));
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const existing = await prisma.kanCard.findUnique({ where: { id }, select: { id: true, protocol: true, churchId: true, memberId: true, candidateName: true } });
    if (!existing) return NextResponse.json({ error: "card not found" }, { status: 404 });
    await prisma.kanCard.update({ where: { id }, data: { deletedAt: new Date(), updatedBy: user.id || null } });
    // Notify about deletion
    await notifyKanAction({
      user,
      card: { id: existing.id, protocol: existing.protocol, churchId: existing.churchId },
      action: "Registro excluído",
      message: existing.candidateName || null,
    });
    return new NextResponse(null, { status: 204 });
  });
}
