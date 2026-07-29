import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, assertChurchAccess } from "@/lib/helpers";
import { LEADER_TX_OPTIONS, parseOptionalDate, recordLeaderEntryEvent, recordLeaderExitEvent } from "@/lib/leaderChangeEvents";

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
    const { functionId, memberId, indicatedBy, changeReason, entryDate, currentCash, averageIncome, averageExpense, maxIncome, totalMembers, totalWorkers, distanceKm, notes } = body;
    if (!functionId || !memberId || !indicatedBy || !changeReason || !entryDate) {
      return NextResponse.json({ error: "functionId, memberId, indicatedBy, changeReason and entryDate are required" }, { status: 400 });
    }
    // Leituras fora da transação: cada round-trip até o banco custa ~150 ms, e a
    // transação interativa do Prisma expira em 5 s por padrão.
    const [church, catalogFunction, member] = await Promise.all([
      prisma.church.findFirst({ where: { id: churchId, deletedAt: null }, select: { id: true, name: true, regional: { select: { campoId: true } } } }),
      prisma.churchFunctionCatalog.findUnique({ where: { id: functionId } }),
      prisma.member.findUnique({ where: { id: memberId }, select: { fullName: true, rol: true } }),
    ]);
    if (!church) return NextResponse.json({ error: "church not found" }, { status: 404 });
    if (!catalogFunction) return NextResponse.json({ error: "function not found" }, { status: 404 });
    if (!member) return NextResponse.json({ error: "member not found" }, { status: 404 });
    const effectiveEntryDate = new Date(entryDate);
    // Datas de saída são manuais e opcionais. Sem `previousExitDate`, a saída do
    // dirigente anterior continua caindo na data de entrada do novo (comportamento
    // histórico). `exitDate` em branco significa "dirigente ainda em exercício".
    const previousExitDate = parseOptionalDate(body.previousExitDate) ?? effectiveEntryDate;
    const exitDate = parseOptionalDate(body.exitDate);
    if (exitDate && exitDate < effectiveEntryDate) {
      return NextResponse.json({ error: "A data de saída não pode ser anterior à data de entrada." }, { status: 400 });
    }
    if (previousExitDate > effectiveEntryDate) {
      return NextResponse.json({ error: "A saída do dirigente anterior não pode ser posterior à entrada do novo." }, { status: 400 });
    }
    const result = await prisma.$transaction(async (tx) => {
      const activeLeaderAssignments = await tx.churchFunctionHistory.findMany({
        where: { churchId, deletedAt: null, endDate: null, isActive: true, function: { isLeaderRole: true } },
        include: { member: { select: { id: true, fullName: true } }, function: { select: { id: true, name: true } } },
        orderBy: { startDate: "desc" },
      });
      if (activeLeaderAssignments.length) {
        await tx.churchFunctionHistory.updateMany({
          where: { id: { in: activeLeaderAssignments.map((rec) => rec.id) } },
          data: { endDate: previousExitDate, isActive: false },
        });
      }
      // A movimentação anterior deixa de estar "em exercício" — sem isso ela
      // continuaria sem data de saída mesmo depois de outro dirigente assumir.
      await tx.churchLeaderHistory.updateMany({
        where: { churchId, exitDate: null },
        data: { exitDate: previousExitDate },
      });
      await tx.churchFunctionHistory.create({
        data: {
          churchId,
          memberId,
          functionId,
          startDate: effectiveEntryDate,
          endDate: exitDate,
          isActive: !exitDate,
          notes,
        },
      });
      const previousAssignment = activeLeaderAssignments[0] || null;
      const previousLeader = previousAssignment?.member || null;
      const leaderHistory = await tx.churchLeaderHistory.create({
        data: {
          churchId, previousLeaderMemberId: previousLeader?.id, newLeaderMemberId: memberId, functionId, indicatedBy, changeReason,
          entryDate: effectiveEntryDate, previousExitDate: previousAssignment ? previousExitDate : null, exitDate,
          currentCash: parseNumberValue(currentCash), averageIncome: parseNumberValue(averageIncome),
          averageExpense: parseNumberValue(averageExpense), maxIncome: parseNumberValue(maxIncome),
          totalMembers: totalMembers === undefined || totalMembers === "" ? null : Number(totalMembers),
          totalWorkers: totalWorkers === undefined || totalWorkers === "" ? null : Number(totalWorkers),
          // distância membro→igreja congelada nesta posse
          distanceKm: parseNumberValue(distanceKm),
          notes,
        },
        include: {
          previousLeaderMember: { select: { id: true, fullName: true, rol: true } },
          newLeaderMember: { select: { id: true, fullName: true, rol: true } },
          function: { select: { id: true, name: true } },
        },
      });

      // Ocorrências no perfil dos envolvidos — é o que alimenta a aba "Histórico".
      await recordLeaderEntryEvent(tx, {
        memberId, churchId, churchName: church.name, functionName: catalogFunction.name,
        leaderHistoryId: leaderHistory.id, date: effectiveEntryDate, indicatedBy, changeReason, userId: user.id || null,
      });
      if (exitDate) {
        await recordLeaderExitEvent(tx, {
          memberId, churchId, churchName: church.name, functionName: catalogFunction.name,
          leaderHistoryId: leaderHistory.id, date: exitDate, userId: user.id || null,
        });
      }
      if (previousLeader) {
        await recordLeaderExitEvent(tx, {
          memberId: previousLeader.id, churchId, churchName: church.name,
          functionName: previousAssignment?.function?.name || catalogFunction.name,
          leaderHistoryId: leaderHistory.id, date: previousExitDate, changeReason, userId: user.id || null,
        });
      }

      // Com data de saída preenchida a igreja fica sem dirigente em exercício.
      await tx.church.update({
        where: { id: churchId },
        data: {
          currentLeaderName: exitDate ? null : member.fullName || null,
          currentLeaderRole: exitDate ? null : catalogFunction.name || null,
          currentLeaderRoleDate: exitDate ? null : effectiveEntryDate,
          leaderRoll: exitDate || member.rol == null ? null : String(member.rol),
        },
      });
      return leaderHistory;
    }, LEADER_TX_OPTIONS);
    return NextResponse.json(serializeBigInts(result), { status: 201 });
  });
}
