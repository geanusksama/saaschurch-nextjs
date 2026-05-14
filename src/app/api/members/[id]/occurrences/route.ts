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
    const { action, notes, serviceGroup, serviceName, metadata } = body;
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
  });
}
