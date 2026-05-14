import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, assertChurchAccess } from "@/lib/helpers";

function parseNumberValue(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  return Number(value);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const existing = await prisma.churchLeaderHistory.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "leader history not found" }, { status: 404 });
    const ok = await assertChurchAccess(user, existing.churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    await prisma.$transaction(async (tx) => {
      await tx.churchLeaderHistory.delete({ where: { id } });
      const activeLeader = await tx.churchFunctionHistory.findFirst({
        where: { churchId: existing.churchId, deletedAt: null, endDate: null, isActive: true, function: { isLeaderRole: true } },
        include: { member: { select: { id: true, fullName: true, rol: true } }, function: { select: { id: true, name: true } } },
        orderBy: { startDate: "desc" },
      });
      await tx.church.update({
        where: { id: existing.churchId },
        data: {
          currentLeaderName: activeLeader?.member?.fullName || null,
          currentLeaderRole: activeLeader?.function?.name || null,
          currentLeaderRoleDate: activeLeader?.startDate || null,
          leaderRoll: activeLeader?.member?.rol == null ? null : String(activeLeader.member.rol),
        },
      });
    });
    return new NextResponse(null, { status: 204 });
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const existing = await prisma.churchLeaderHistory.findUnique({
      where: { id },
      include: { church: { select: { id: true, regional: { select: { campoId: true } } } } },
    });
    if (!existing) return NextResponse.json({ error: "leader history not found" }, { status: 404 });
    const ok = await assertChurchAccess(user, existing.churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const { functionId, memberId, indicatedBy, changeReason, entryDate, currentCash, averageIncome, averageExpense, maxIncome, totalMembers, totalWorkers, notes } = body;
    if (!functionId || !memberId || !indicatedBy || !changeReason || !entryDate) {
      return NextResponse.json({ error: "functionId, memberId, indicatedBy, changeReason and entryDate are required" }, { status: 400 });
    }
    const effectiveEntryDate = new Date(entryDate);
    const result = await prisma.$transaction(async (tx) => {
      const updatedHistory = await tx.churchLeaderHistory.update({
        where: { id },
        data: {
          newLeaderMemberId: memberId, functionId, indicatedBy, changeReason, entryDate: effectiveEntryDate,
          currentCash: parseNumberValue(currentCash), averageIncome: parseNumberValue(averageIncome),
          averageExpense: parseNumberValue(averageExpense), maxIncome: parseNumberValue(maxIncome),
          totalMembers: totalMembers === undefined || totalMembers === "" ? null : Number(totalMembers),
          totalWorkers: totalWorkers === undefined || totalWorkers === "" ? null : Number(totalWorkers),
          notes,
        },
        include: { previousLeaderMember: { select: { id: true, fullName: true } }, newLeaderMember: { select: { id: true, fullName: true } }, function: { select: { id: true, name: true } } },
      });
      const activeLeader = await tx.churchFunctionHistory.findFirst({
        where: { churchId: existing.churchId, deletedAt: null, endDate: null, isActive: true, function: { isLeaderRole: true } },
        orderBy: { startDate: "desc" },
      });
      if (activeLeader) {
        await tx.churchFunctionHistory.update({ where: { id: activeLeader.id }, data: { memberId, functionId, startDate: effectiveEntryDate, notes } });
      }
      const latestHistory = await tx.churchLeaderHistory.findFirst({
        where: { churchId: existing.churchId },
        include: { newLeaderMember: { select: { id: true, fullName: true, rol: true } }, function: { select: { id: true, name: true } } },
        orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
      });
      await tx.church.update({
        where: { id: existing.churchId },
        data: {
          currentLeaderName: latestHistory?.newLeaderMember?.fullName || null,
          currentLeaderRole: latestHistory?.function?.name || null,
          currentLeaderRoleDate: latestHistory?.entryDate || null,
          leaderRoll: latestHistory?.newLeaderMember?.rol == null ? null : String(latestHistory.newLeaderMember.rol),
        },
      });
      return updatedHistory;
    });
    return NextResponse.json(serializeBigInts(result));
  });
}
