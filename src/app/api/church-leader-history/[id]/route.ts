import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, assertChurchAccess } from "@/lib/helpers";
import {
  LEADER_TX_OPTIONS,
  parseOptionalDate,
  recordLeaderEntryEvent,
  recordLeaderExitEvent,
  removeLeaderEvents,
} from "@/lib/leaderChangeEvents";

function parseNumberValue(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  return Number(value);
}

/**
 * Reaplica em `churches` quem é o dirigente em exercício.
 * Movimentação com `exitDate` preenchida não conta — o mandato já terminou.
 */
async function syncCurrentLeader(tx: Prisma.TransactionClient, churchId: string) {
  const latestHistory = await tx.churchLeaderHistory.findFirst({
    where: { churchId, exitDate: null },
    include: { newLeaderMember: { select: { id: true, fullName: true, rol: true } }, function: { select: { id: true, name: true } } },
    orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }],
  });
  await tx.church.update({
    where: { id: churchId },
    data: {
      currentLeaderName: latestHistory?.newLeaderMember?.fullName || null,
      currentLeaderRole: latestHistory?.function?.name || null,
      currentLeaderRoleDate: latestHistory?.entryDate || null,
      leaderRoll: latestHistory?.newLeaderMember?.rol == null ? null : String(latestHistory.newLeaderMember.rol),
    },
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const existing = await prisma.churchLeaderHistory.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "leader history not found" }, { status: 404 });
    const ok = await assertChurchAccess(user, existing.churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    await prisma.$transaction(async (tx) => {
      // Sem isso o perfil do membro ficava com ocorrência de uma troca inexistente.
      await removeLeaderEvents(tx, id);
      await tx.churchLeaderHistory.delete({ where: { id } });
      await syncCurrentLeader(tx, existing.churchId);
    }, LEADER_TX_OPTIONS);
    return new NextResponse(null, { status: 204 });
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const existing = await prisma.churchLeaderHistory.findUnique({
      where: { id },
      include: { church: { select: { id: true, name: true, regional: { select: { campoId: true } } } } },
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
    // Ambas as datas de saída são manuais e opcionais: limpar o campo devolve o
    // registro para "sem saída definida" em vez de manter o valor anterior.
    const previousExitDate = parseOptionalDate(body.previousExitDate);
    const exitDate = parseOptionalDate(body.exitDate);
    if (exitDate && exitDate < effectiveEntryDate) {
      return NextResponse.json({ error: "A data de saída não pode ser anterior à data de entrada." }, { status: 400 });
    }
    if (previousExitDate && previousExitDate > effectiveEntryDate) {
      return NextResponse.json({ error: "A saída do dirigente anterior não pode ser posterior à entrada do novo." }, { status: 400 });
    }
    const catalogFunction = await prisma.churchFunctionCatalog.findUnique({ where: { id: functionId } });
    if (!catalogFunction) return NextResponse.json({ error: "function not found" }, { status: 404 });

    const result = await prisma.$transaction(async (tx) => {
      const updatedHistory = await tx.churchLeaderHistory.update({
        where: { id },
        data: {
          newLeaderMemberId: memberId, functionId, indicatedBy, changeReason, entryDate: effectiveEntryDate,
          previousExitDate, exitDate,
          currentCash: parseNumberValue(currentCash), averageIncome: parseNumberValue(averageIncome),
          averageExpense: parseNumberValue(averageExpense), maxIncome: parseNumberValue(maxIncome),
          totalMembers: totalMembers === undefined || totalMembers === "" ? null : Number(totalMembers),
          totalWorkers: totalWorkers === undefined || totalWorkers === "" ? null : Number(totalWorkers),
          notes,
        },
        include: {
          previousLeaderMember: { select: { id: true, fullName: true, rol: true } },
          newLeaderMember: { select: { id: true, fullName: true, rol: true } },
          function: { select: { id: true, name: true } },
        },
      });

      // Função do dirigente empossado por ESTA movimentação (casada pela data de
      // entrada original) — e não simplesmente "a função ativa da igreja", senão
      // editar uma troca antiga sobrescreveria o dirigente atual.
      const ownAssignment = await tx.churchFunctionHistory.findFirst({
        where: {
          churchId: existing.churchId,
          deletedAt: null,
          memberId: existing.newLeaderMemberId ?? memberId,
          startDate: existing.entryDate,
          function: { isLeaderRole: true },
        },
        orderBy: { createdAt: "desc" },
      });
      if (ownAssignment) {
        await tx.churchFunctionHistory.update({
          where: { id: ownAssignment.id },
          data: { memberId, functionId, startDate: effectiveEntryDate, endDate: exitDate, isActive: !exitDate, notes },
        });
      }

      // Saída do dirigente anterior: propaga para o encerramento da função dele.
      if (existing.previousLeaderMemberId) {
        const previousAssignment = await tx.churchFunctionHistory.findFirst({
          where: {
            churchId: existing.churchId,
            deletedAt: null,
            memberId: existing.previousLeaderMemberId,
            function: { isLeaderRole: true },
            startDate: { lte: effectiveEntryDate },
          },
          orderBy: { startDate: "desc" },
        });
        if (previousAssignment) {
          await tx.churchFunctionHistory.update({
            where: { id: previousAssignment.id },
            data: { endDate: previousExitDate, isActive: !previousExitDate },
          });
        }
      }

      // Ocorrências: regravadas do zero para refletir datas/membros editados.
      await removeLeaderEvents(tx, id);
      await recordLeaderEntryEvent(tx, {
        memberId, churchId: existing.churchId, churchName: existing.church?.name, functionName: catalogFunction.name,
        leaderHistoryId: id, date: effectiveEntryDate, indicatedBy, changeReason, userId: user.id || null,
      });
      if (exitDate) {
        await recordLeaderExitEvent(tx, {
          memberId, churchId: existing.churchId, churchName: existing.church?.name, functionName: catalogFunction.name,
          leaderHistoryId: id, date: exitDate, userId: user.id || null,
        });
      }
      if (existing.previousLeaderMemberId && previousExitDate) {
        await recordLeaderExitEvent(tx, {
          memberId: existing.previousLeaderMemberId, churchId: existing.churchId, churchName: existing.church?.name,
          functionName: catalogFunction.name, leaderHistoryId: id, date: previousExitDate, changeReason, userId: user.id || null,
        });
      }

      await syncCurrentLeader(tx, existing.churchId);
      return updatedHistory;
    }, LEADER_TX_OPTIONS);
    return NextResponse.json(serializeBigInts(result));
  });
}
