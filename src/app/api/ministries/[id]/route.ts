import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, assertChurchAccess } from "@/lib/helpers";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const existing = await prisma.ministry.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return NextResponse.json({ error: "ministry not found" }, { status: 404 });
    const ok = await assertChurchAccess(user, existing.churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const { parentMinistryId, leaderId, ...data } = body;
    if (leaderId) {
      const leader = await prisma.member.findFirst({ where: { id: leaderId, churchId: existing.churchId, deletedAt: null } });
      if (!leader) return NextResponse.json({ error: "leader not found for church" }, { status: 404 });
    }
    const updated = await prisma.ministry.update({
      where: { id },
      data: { ...data, parentMinistryId: parentMinistryId === undefined ? undefined : parentMinistryId || null, leaderId: leaderId === undefined ? undefined : leaderId || null },
      include: { leader: { select: { id: true, fullName: true } }, members: { where: { isActive: true, leftAt: null }, select: { id: true } } },
    });
    return NextResponse.json({ ...serializeBigInts(updated), totalMembers: updated.members.length, activeMembers: updated.members.length });
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const existing = await prisma.ministry.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return NextResponse.json({ error: "ministry not found" }, { status: 404 });
    const ok = await assertChurchAccess(user, existing.churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    await prisma.$transaction([
      prisma.ministryMember.updateMany({ where: { ministryId: id, isActive: true, leftAt: null }, data: { isActive: false, leftAt: new Date() } }),
      prisma.ministry.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } }),
    ]);
    return new NextResponse(null, { status: 204 });
  });
}
