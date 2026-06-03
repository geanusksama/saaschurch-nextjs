import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

/**
 * POST /api/consecration/requests/[id]/apply-matrix
 * Backfill: applies the columnIndex=1 matrix rule for an existing card that
 * was created without the rule being triggered (legacy data or bug recovery).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    if (!["master", "admin"].includes(user.profileType || "")) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const columnIndex: number = Number(body.columnIndex ?? 1);

    const card = await prisma.kanCard.findFirst({
      where: { id, deletedAt: null },
      include: {
        service: { select: { id: true, sigla: true, description: true, serviceGroup: true } },
        member: { select: { id: true, fullName: true, ecclesiasticalTitle: true } },
      },
    });
    if (!card) return NextResponse.json({ error: "card not found" }, { status: 404 });

    const rule = await prisma.kanMatrixRule.findUnique({
      where: { serviceId_columnIndex: { serviceId: card.serviceId, columnIndex } },
    });
    if (!rule) return NextResponse.json({ error: `No matrix rule for columnIndex ${columnIndex}` }, { status: 404 });

    const serviceGroup = card.service?.serviceGroup || card.service?.sigla || "GERAL";
    const serviceName = card.service?.description || card.service?.sigla || "";
    const applied: string[] = [];

    // Member update
    if (card.memberId && (rule.changeStatus || rule.changeTitle)) {
      const memberUpdate: Record<string, unknown> = {};
      let prevMember: { ecclesiasticalTitle: string | null; addressCity: string | null; addressState: string | null; nationality: string | null } | null = null;
      if (rule.changeStatus && rule.newStatus) {
        memberUpdate.membershipStatus = rule.newStatus.toUpperCase();
        applied.push(`Status → ${rule.newStatus}`);
      }
      if (rule.changeTitle && rule.newTitle) {
        prevMember = await prisma.member.findUnique({
          where: { id: card.memberId },
          select: { ecclesiasticalTitle: true, addressCity: true, addressState: true, nationality: true },
        });
        memberUpdate.ecclesiasticalTitle = rule.newTitle;
        const titleRecord = await prisma.ecclesiasticalTitle.findFirst({
          where: { name: { equals: rule.newTitle, mode: "insensitive" }, deletedAt: null, isActive: true },
        });
        memberUpdate.ecclesiasticalTitleId = titleRecord?.id ?? null;
        applied.push(`Título → ${rule.newTitle}`);
      }
      if (Object.keys(memberUpdate).length > 0) {
        await prisma.member.update({ where: { id: card.memberId }, data: memberUpdate });
      }
      if (rule.changeTitle && rule.newTitle) {
        // Check if a title history record already exists for this card to avoid duplicates
        const existing = await prisma.memberTitleHistory.findFirst({
          where: { memberId: card.memberId, cardId: card.id },
        });
        if (!existing) {
          await prisma.memberTitleHistory.create({
            data: {
              memberId: card.memberId,
              churchId: card.churchId,
              cardId: card.id,
              previousTitle: prevMember?.ecclesiasticalTitle ?? null,
              newTitle: rule.newTitle,
              source: "MATRIZ_BACKFILL",
              serviceGroup,
              serviceName,
              memberCity: prevMember?.addressCity ?? null,
              memberState: prevMember?.addressState ?? null,
              memberCountry: prevMember?.nationality ?? null,
              notes: rule.message ?? null,
              createdBy: user.id ?? null,
            },
          });
          applied.push(`Histórico de título registrado: ${rule.newTitle}`);
        } else {
          applied.push(`Histórico de título já existia (cardId: ${card.id})`);
        }
      }
    }

    // Insert occurrence
    if (rule.insertOccurrence !== false) {
      await prisma.memberEventHistory.create({
        data: {
          memberId: card.memberId || null,
          churchId: card.churchId,
          serviceGroup,
          serviceName,
          columnIndex,
          action: rule.occurrenceName || serviceName || "MOVIMENTO",
          notes: rule.message || null,
          metadata: { source: "MATRIX_BACKFILL", cardId: card.id },
          cardId: card.id,
          createdBy: user.id || null,
        },
      });
      applied.push(`Ocorrência registrada: ${rule.occurrenceName || serviceName}`);
    }

    return NextResponse.json(serializeBigInts({ ok: true, applied, rule }));
  });
}
