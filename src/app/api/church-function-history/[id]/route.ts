import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, assertChurchAccess, parseDateValue } from "@/lib/helpers";
import { findActiveFunctionConflict, churchFunctionInclude } from "@/lib/churchFunctions";

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
    const nextIsActive = nextEndDate ? false : body.isActive ?? existing.isActive;
    if (nextIsActive && nextFunctionId) {
      const conflict = await findActiveFunctionConflict({
        churchId: existing.churchId,
        functionId: nextFunctionId,
        department: nextDepartment,
        ignoreId: existing.id,
      });
      if (conflict) return NextResponse.json({ error: conflict }, { status: 409 });
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
        isCampoWide: body.isCampoWide === undefined ? undefined : !!body.isCampoWide,
      },
      include: churchFunctionInclude,
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
