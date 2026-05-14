import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, assertChurchAccess } from "@/lib/helpers";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const member = await prisma.member.findFirst({ where: { id, deletedAt: null } });
    if (!member) return NextResponse.json({ error: "member not found" }, { status: 404 });
    const ok = await assertChurchAccess(user, member.churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    const rows = await prisma.memberTitleHistory.findMany({
      where: { memberId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const userIds = [...new Set(rows.map((r) => r.createdBy).filter(Boolean))] as string[];
    const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true } }) : [];
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
    const enriched = rows.map((r) => ({ ...r, createdByUser: r.createdBy ? userMap[r.createdBy] || null : null }));
    return NextResponse.json(serializeBigInts(enriched));
  });
}
