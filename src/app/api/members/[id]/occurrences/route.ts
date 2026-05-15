import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, assertChurchAccess } from "@/lib/helpers";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const member = await prisma.member.findFirst({ where: { id, deletedAt: null } });
    if (!member) return NextResponse.json({ error: "member not found" }, { status: 404 });
    const ok = await assertChurchAccess(user, member.churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { action, notes, serviceGroup, serviceName, metadata, serviceId, columnIndex, date } = body;

    // ── Mode 1: direct occurrence (legacy) ──────────────────────────────────
    if (!serviceId) {
      if (!action) return NextResponse.json({ error: "action is required" }, { status: 400 });
      const occurrence = await prisma.memberEventHistory.create({
        data: {
          memberId: id,
          churchId: member.churchId,
          serviceGroup: serviceGroup || "OCORRENCIA",
          serviceName: serviceName || "Ocorrência",
          action,
          notes: notes || null,
          metadata: metadata || null,
          createdBy: user.id || null,
        },
      });
      return NextResponse.json(serializeBigInts(occurrence), { status: 201 });
    }

    // ── Mode 2: matrix-driven quick occurrence ───────────────────────────────
    const svcId = Number(serviceId);
    const colIdx = columnIndex != null ? Number(columnIndex) : null;

    const service = await prisma.kanService.findUnique({ where: { id: svcId } });
    if (!service) return NextResponse.json({ error: "Serviço não encontrado." }, { status: 404 });

    const appliedActions: string[] = [];

    // Apply matrix rule if columnIndex provided
    if (colIdx != null) {
      const rule = await prisma.kanMatrixRule.findUnique({
        where: { serviceId_columnIndex: { serviceId: svcId, columnIndex: colIdx } },
      });

      if (rule) {
        const memberUpdate: Record<string, unknown> = {};

        // Change member status
        if (rule.changeStatus && rule.newStatus) {
          memberUpdate.membershipStatus = rule.newStatus.toUpperCase();
          appliedActions.push(`Status alterado → ${rule.newStatus}`);
        }

        // Change ecclesiastical title
        if (rule.changeTitle && rule.newTitle) {
          memberUpdate.ecclesiasticalTitle = rule.newTitle;
          const titleRecord = await prisma.ecclesiasticalTitle.findFirst({
            where: { name: { equals: rule.newTitle, mode: "insensitive" }, deletedAt: null, isActive: true },
          });
          if (titleRecord) {
            memberUpdate.ecclesiasticalTitleId = titleRecord.id;
            // Record title history
            await prisma.memberTitleHistory.create({
              data: {
                memberId: id,
                previousTitle: member.ecclesiasticalTitle || null,
                newTitle: rule.newTitle,
                source: "OCORRENCIA_RAPIDA",
                serviceGroup: service.sigla,
                serviceName: service.description,
                createdBy: user.id || null,
              },
            }).catch(() => null);
          }
          appliedActions.push(`Título alterado → ${rule.newTitle}`);
        }

        if (Object.keys(memberUpdate).length > 0) {
          await prisma.member.update({ where: { id }, data: memberUpdate });
        }

        // Insert occurrence if configured
        if (rule.insertOccurrence !== false) {
          const occurrenceLabel = rule.occurrenceName || service.description || "MOVIMENTO";
          await prisma.memberEventHistory.create({
            data: {
              memberId: id,
              churchId: member.churchId,
              serviceGroup: service.sigla || "OCORRENCIA_RAPIDA",
              serviceName: service.description,
              columnIndex: colIdx,
              action: occurrenceLabel,
              notes: notes || rule.message || null,
              metadata: { source: "OCORRENCIA_RAPIDA", serviceId: svcId, columnIndex: colIdx, date: date || null },
              createdBy: user.id || null,
            },
          });
          appliedActions.push(`Ocorrência registrada: ${occurrenceLabel}`);
        }

        if (rule.message && !appliedActions.length) {
          appliedActions.push(rule.message);
        }
      }
    } else {
      // No columnIndex: just record the occurrence without matrix execution
      await prisma.memberEventHistory.create({
        data: {
          memberId: id,
          churchId: member.churchId,
          serviceGroup: service.sigla || "OCORRENCIA",
          serviceName: service.description,
          action: service.description || "Ocorrência",
          notes: notes || null,
          metadata: { source: "OCORRENCIA_RAPIDA", serviceId: svcId, date: date || null },
          createdBy: user.id || null,
        },
      });
      appliedActions.push("Ocorrência registrada");
    }

    return NextResponse.json(serializeBigInts({ appliedActions }), { status: 201 });
  });
}
