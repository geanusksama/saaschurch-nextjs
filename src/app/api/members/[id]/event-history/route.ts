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
    const history = await prisma.memberEventHistory.findMany({
      where: { memberId: id },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const cardIds = [...new Set(history.map((h) => h.cardId).filter(Boolean))] as string[];
    const userIds = [...new Set(history.map((h) => h.createdBy).filter(Boolean))] as string[];
    const [cards, users] = await Promise.all([
      cardIds.length ? prisma.kanCard.findMany({ where: { id: { in: cardIds } }, select: { id: true, protocol: true, church: { select: { name: true } }, openedAt: true, createdAt: true } }) : [],
      userIds.length ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true } }) : [],
    ]);
    const cardMap = Object.fromEntries(cards.map((c) => [c.id, c]));
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
    const enriched = history.map((h) => ({ ...h, card: h.cardId ? cardMap[h.cardId] || null : null, createdByUser: h.createdBy ? userMap[h.createdBy] || null : null }));
    return NextResponse.json(serializeBigInts(enriched));
  });
}
