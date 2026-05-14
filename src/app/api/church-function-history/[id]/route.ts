import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, assertChurchAccess, parseDateValue } from "@/lib/helpers";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const existing = await prisma.churchFunctionHistory.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return NextResponse.json({ error: "function history not found" }, { status: 404 });
    const ok = await assertChurchAccess(user, existing.churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const nextFunctionId = body.functionId || existing.functionId;
    const nextDepartment = body.department === undefined ? existing.department : body.department?.trim() || null;
    const nextEndDate = body.endDate === undefined ? existing.endDate : parseDateValue(body.endDate);
    const nextFunction = await prisma.churchFunctionCatalog.findUnique({ where: { id: nextFunctionId } });
    const nextIsActive = nextEndDate ? false : body.isActive ?? existing.isActive;
    if (nextIsActive && nextFunctionId) {
      const activeDuplicate = await prisma.churchFunctionHistory.findFirst({
        where: {
          churchId: existing.churchId, functionId: nextFunctionId,
          deletedAt: null, endDate: null, isActive: true, id: { not: existing.id },
          ...(nextFunction?.isLeaderRole ? {} : { department: nextDepartment }),
        },
      });
      if (activeDuplicate) {
        return NextResponse.json({
          error: nextFunction?.isLeaderRole
            ? "Já existe um dirigente ativo para esta igreja."
            : "Já existe uma função ativa desse tipo para esta igreja nesse departamento.",
        }, { status: 409 });
      }
    }
    const updated = await prisma.churchFunctionHistory.update({
      where: { id },
      data: {
        memberId: body.memberId || undefined,
        functionId: body.functionId || undefined,
        department: body.department === undefined ? undefined : body.department?.trim() || null,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate === undefined ? undefined : parseDateValue(body.endDate) as Date | null | undefined,
        notes: body.notes,
        isActive: nextIsActive,
      },
      include: {
        member: { select: { id: true, fullName: true } },
        function: { select: { id: true, name: true, isLeaderRole: true } },
      },
    });
    return NextResponse.json(serializeBigInts(updated));
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const existing = await prisma.churchFunctionHistory.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return NextResponse.json({ error: "function history not found" }, { status: 404 });
    const ok = await assertChurchAccess(user, existing.churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    await prisma.churchFunctionHistory.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false, endDate: existing.endDate || new Date() },
    });
    return new NextResponse(null, { status: 204 });
  });
}
