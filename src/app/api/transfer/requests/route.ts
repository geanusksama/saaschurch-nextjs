import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, assertChurchAccess, buildProtocol } from "@/lib/helpers";

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const { memberId, targetChurchId, notes } = body;
    if (!memberId) return NextResponse.json({ error: "memberId is required" }, { status: 400 });

    const member = await prisma.member.findFirst({ where: { id: memberId, deletedAt: null } });
    if (!member) return NextResponse.json({ error: "member not found" }, { status: 404 });
    const ok = await assertChurchAccess(user, member.churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

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
        memberId: member.id, candidateName: member.fullName, status: "pendente",
        statusLabel: firstColumn.name, observations: notes || null, createdBy: user.id || null,
        metadata: { flowType: "transferencia", targetChurchId: targetChurchId || null },
      },
    });
    return NextResponse.json(serializeBigInts({ ok: true, card }), { status: 201 });
  });
}
