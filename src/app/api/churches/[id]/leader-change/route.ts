import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, assertChurchAccess } from "@/lib/helpers";

function parseNumberValue(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  return Number(value);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const churchId = (await params).id;
    const ok = await assertChurchAccess(user, churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const { functionId, memberId, indicatedBy, changeReason, entryDate, currentCash, averageIncome, averageExpense, maxIncome, totalMembers, totalWorkers, notes } = body;
    if (!functionId || !memberId || !indicatedBy || !changeReason || !entryDate) {
      return NextResponse.json({ error: "functionId, memberId, indicatedBy, changeReason and entryDate are required" }, { status: 400 });
    }
    const [church, catalogFunction] = await Promise.all([
      prisma.church.findFirst({ where: { id: churchId, deletedAt: null }, select: { id: true, regional: { select: { campoId: true } } } }),
      prisma.churchFunctionCatalog.findUnique({ where: { id: functionId } }),
    ]);
    if (!church) return NextResponse.json({ error: "church not found" }, { status: 404 });
    if (!catalogFunction) return NextResponse.json({ error: "function not found" }, { status: 404 });
    const effectiveEntryDate = new Date(entryDate);
    const result = await prisma.$transaction(async (tx) => {
      const activeLeaderAssignments = await tx.churchFunctionHistory.findMany({
        where: { churchId, deletedAt: null, endDate: null, isActive: true, function: { isLeaderRole: true } },
        include: { member: { select: { id: true, fullName: true } } },
        orderBy: { startDate: "desc" },
      });
      for (const rec of activeLeaderAssignments) {
        await tx.churchFunctionHistory.update({ where: { id: rec.id }, data: { endDate: effectiveEntryDate, isActive: false } });
      }
      await tx.churchFunctionHistory.create({
        data: { churchId, memberId, functionId, startDate: effectiveEntryDate, notes, isActive: true },
      });
      const previousLeader = activeLeaderAssignments[0]?.member || null;
      const leaderHistory = await tx.churchLeaderHistory.create({
        data: {
          churchId, previousLeaderMemberId: previousLeader?.id, newLeaderMemberId: memberId, functionId, indicatedBy, changeReason,
          entryDate: effectiveEntryDate, previousExitDate: activeLeaderAssignments[0] ? effectiveEntryDate : null,
          currentCash: parseNumberValue(currentCash), averageIncome: parseNumberValue(averageIncome),
          averageExpense: parseNumberValue(averageExpense), maxIncome: parseNumberValue(maxIncome),
          totalMembers: totalMembers === undefined || totalMembers === "" ? null : Number(totalMembers),
          totalWorkers: totalWorkers === undefined || totalWorkers === "" ? null : Number(totalWorkers),
          notes,
        },
        include: { previousLeaderMember: { select: { id: true, fullName: true } }, newLeaderMember: { select: { id: true, fullName: true } }, function: { select: { id: true, name: true } } },
      });
      const member = await tx.member.findUnique({ where: { id: memberId }, select: { fullName: true, rol: true } });
      await tx.church.update({
        where: { id: churchId },
        data: {
          currentLeaderName: member?.fullName || null,
          currentLeaderRole: catalogFunction.name || null,
          currentLeaderRoleDate: effectiveEntryDate,
          leaderRoll: member?.rol == null ? null : String(member.rol),
        },
      });
      return leaderHistory;
    });
    return NextResponse.json(serializeBigInts(result), { status: 201 });
  });
}
