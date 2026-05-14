import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, assertChurchAccess } from "@/lib/helpers";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const churchId = (await params).id;
    const ok = await assertChurchAccess(user, churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    const records = await prisma.ministry.findMany({
      where: { churchId, deletedAt: null },
      include: {
        leader: { select: { id: true, fullName: true } },
        members: { where: { isActive: true, leftAt: null }, select: { id: true, role: true, member: { select: { id: true, fullName: true } } } },
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });
    return NextResponse.json(records.map((r) => ({ ...serializeBigInts(r), totalMembers: r.members.length, activeMembers: r.members.length })));
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const churchId = (await params).id;
    const ok = await assertChurchAccess(user, churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const { name, description, email, phone, color, icon, isActive, parentMinistryId, leaderId } = body;
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
    const church = await prisma.church.findFirst({ where: { id: churchId, deletedAt: null } });
    if (!church) return NextResponse.json({ error: "church not found" }, { status: 404 });
    if (leaderId) {
      const leader = await prisma.member.findFirst({ where: { id: leaderId, churchId, deletedAt: null } });
      if (!leader) return NextResponse.json({ error: "leader not found for church" }, { status: 404 });
    }
    const ministry = await prisma.ministry.create({
      data: { churchId, parentMinistryId: parentMinistryId || undefined, name, description, email, phone, color, icon, isActive: isActive ?? true, leaderId: leaderId || null },
      include: { leader: { select: { id: true, fullName: true } }, members: { where: { isActive: true, leftAt: null }, select: { id: true } } },
    });
    return NextResponse.json({ ...serializeBigInts(ministry), totalMembers: ministry.members.length, activeMembers: ministry.members.length }, { status: 201 });
  });
}
