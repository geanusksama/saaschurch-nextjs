import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const isGlobal = user.profileType === "master" || user.profileType === "admin";
    let campoChurchIds: string[] | null = null;
    if (!isGlobal && user.profileType === "campo" && user.campoId) {
      const campoChurches = await prisma.church.findMany({ where: { regional: { campoId: user.campoId }, deletedAt: null }, select: { id: true } });
      campoChurchIds = campoChurches.map((c) => c.id);
    }
    const churchFilter = isGlobal ? {} : campoChurchIds ? { churchId: { in: campoChurchIds } } : (user.churchId ? { churchId: user.churchId } : { churchId: null as unknown as string });

    const now = new Date();
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const months6 = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      return { year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleDateString("pt-BR", { month: "short" }) };
    });

    const [
      totalMembers, newMembersThisMonth, newMembersLastMonth, newLeadsThisMonth, newLeadsLastMonth,
      upcomingEvents, recentHistory, membersByMinistry, transactionsByMonth, membersByMonth, openCards,
    ] = await Promise.all([
      prisma.member.count({ where: { ...churchFilter, deletedAt: null, membershipStatus: { not: "INATIVO" } } }),
      prisma.member.count({ where: { ...churchFilter, deletedAt: null, createdAt: { gte: startOfThisMonth } } }),
      prisma.member.count({ where: { ...churchFilter, deletedAt: null, createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } } }),
      prisma.lead.count({ where: { ...(isGlobal ? {} : campoChurchIds ? { churchId: { in: campoChurchIds } } : user.churchId ? { churchId: user.churchId } : {}), createdAt: { gte: startOfThisMonth } } }).catch(() => 0),
      prisma.lead.count({ where: { ...(isGlobal ? {} : campoChurchIds ? { churchId: { in: campoChurchIds } } : user.churchId ? { churchId: user.churchId } : {}), createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } } }).catch(() => 0),
      prisma.event.findMany({
        where: { ...churchFilter, startDatetime: { gte: now, lte: new Date(now.getTime() + 30 * 86400000) } },
        orderBy: { startDatetime: "asc" }, take: 5, select: { id: true, title: true, startDatetime: true, endDatetime: true },
      }).catch(() => []),
      prisma.memberEventHistory.findMany({
        where: { ...churchFilter },
        orderBy: { createdAt: "desc" }, take: 10,
        select: { id: true, action: true, serviceName: true, serviceGroup: true, createdAt: true, member: { select: { fullName: true } } },
      }).catch(() => []),
      prisma.ministryMember.groupBy({
        by: ["ministryId"],
        _count: { memberId: true },
        where: isGlobal ? {} : (campoChurchIds ? { ministry: { churchId: { in: campoChurchIds } } } : (user.churchId ? { ministry: { churchId: user.churchId } } : {})),
        orderBy: { _count: { memberId: "desc" } }, take: 5,
      }).then(async (rows) => {
        const ids = rows.map((r) => r.ministryId);
        const mins = await prisma.ministry.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } });
        const map = Object.fromEntries(mins.map((m) => [m.id, m.name]));
        return rows.map((r) => ({ name: map[r.ministryId] || "Sem nome", value: r._count.memberId }));
      }).catch(() => []),
      Promise.all(months6.map(async ({ year, month }) => {
        const start = new Date(year, month, 1);
        const end = new Date(year, month + 1, 0, 23, 59, 59);
        const filter = { ...churchFilter, transactionDate: { gte: start, lte: end } };
        const [inc, exp] = await Promise.all([
          prisma.transaction.aggregate({ where: { ...filter, type: "INCOME" }, _sum: { amount: true } }).catch(() => ({ _sum: { amount: 0 } })),
          prisma.transaction.aggregate({ where: { ...filter, type: "EXPENSE" }, _sum: { amount: true } }).catch(() => ({ _sum: { amount: 0 } })),
        ]);
        return { receita: Number(inc._sum.amount || 0), despesa: Number(exp._sum.amount || 0) };
      })),
      Promise.all(months6.map(async ({ year, month }) => {
        const start = new Date(year, month, 1);
        const end = new Date(year, month + 1, 0, 23, 59, 59);
        const [members, leads] = await Promise.all([
          prisma.member.count({ where: { ...churchFilter, deletedAt: null, createdAt: { gte: start, lte: end } } }),
          prisma.lead.count({ where: { ...(isGlobal ? {} : campoChurchIds ? { churchId: { in: campoChurchIds } } : user.churchId ? { churchId: user.churchId } : {}), createdAt: { gte: start, lte: end } } }).catch(() => 0),
        ]);
        return { presenca: members, visitantes: leads };
      })),
      prisma.kanCard.count({ where: { ...churchFilter, deletedAt: null, closedAt: null } }).catch(() => 0),
    ]);

    const pct = (curr: number, prev: number) => prev === 0 ? null : Math.round(((curr - prev) / prev) * 100);
    const COLORS = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"];

    return NextResponse.json(serializeBigInts({
      stats: {
        totalMembers, newMembersThisMonth, membersChangePct: pct(newMembersThisMonth, newMembersLastMonth),
        newLeadsThisMonth, leadsChangePct: pct(newLeadsThisMonth, newLeadsLastMonth),
        upcomingEventsCount: upcomingEvents.length, openCards,
      },
      attendanceChart: months6.map(({ year, month, label }, i) => ({
        name: label, referenceDate: new Date(year, month, 1).toISOString(),
        presenca: membersByMonth[i].presenca, visitantes: membersByMonth[i].visitantes,
      })),
      financeChart: months6.map(({ label }, i) => ({ name: label, receita: transactionsByMonth[i].receita, despesa: transactionsByMonth[i].despesa })),
      ministryPie: (membersByMinistry as Array<{ name: string; value: number }>).map((m, i) => ({ ...m, color: COLORS[i % COLORS.length] })),
      activities: recentHistory.map((h) => ({
        id: h.id, title: (h.serviceName || h.serviceGroup || h.action || "Movimentação"), description: (h.member?.fullName ? `Membro: ${h.member.fullName}` : (h.action || "")), time: h.createdAt,
      })),
      upcomingEvents: upcomingEvents.map((e) => ({ id: e.id, name: e.title, startDate: e.startDatetime })),
    }));
  });
}
