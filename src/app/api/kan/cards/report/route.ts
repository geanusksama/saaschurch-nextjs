import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, kanScopeFilter } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const campoId = searchParams.get("campoId");
    const regionalId = searchParams.get("regionalId");
    const churchId = searchParams.get("churchId");
    const status = searchParams.get("status");
    const serviceId = searchParams.get("serviceId");
    const q = searchParams.get("q");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = { deletedAt: null, ...kanScopeFilter(user), service: { serviceGroup: "REQUERIMENTO" } };
    if (churchId) where.churchId = churchId;
    else if (regionalId) where.church = { regionalId };
    else if (campoId) where.church = { regional: { campoId } };
    if (status) where.status = status;
    if (serviceId) where.serviceId = Number(serviceId);
    if (from || to) {
      where.openedAt = {};
      if (from) where.openedAt.gte = new Date(from);
      if (to) { const toDate = new Date(to); toDate.setHours(23, 59, 59, 999); where.openedAt.lte = toDate; }
    }
    if (q) where.OR = [{ protocol: { contains: q, mode: "insensitive" } }, { candidateName: { contains: q, mode: "insensitive" } }];

    const cards = await prisma.kanCard.findMany({
      where,
      include: {
        church: { select: { id: true, name: true, code: true, regional: { select: { id: true, name: true, campoId: true, campo: { select: { id: true, name: true } } } } } },
        member: { select: { id: true, fullName: true, ecclesiasticalTitle: true, membershipStatus: true, rol: true, memberType: true } },
        service: { select: { id: true, sigla: true, description: true, serviceGroup: true } },
        column: { select: { id: true, name: true, columnIndex: true } },
        eventHistory: { orderBy: { createdAt: "asc" }, select: { id: true, action: true, notes: true, serviceName: true, createdAt: true, createdBy: true } },
      },
      orderBy: { openedAt: "desc" },
      take: 2000,
    });

    const userIds = [...new Set(cards.flatMap((c) => c.eventHistory.map((h) => h.createdBy)).filter(Boolean))] as string[];
    const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true } }) : [];
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
    const enriched = cards.map((card) => ({
      ...card,
      eventHistory: card.eventHistory.map((h) => ({ ...h, createdByUser: h.createdBy ? userMap[h.createdBy] || null : null })),
    }));
    return NextResponse.json(serializeBigInts(enriched));
  });
}
