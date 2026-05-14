import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, assertChurchAccess, parseDateValue } from "@/lib/helpers";

function parseNumberValue(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return Number(value);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const churchId = (await params).id;
    const ok = await assertChurchAccess(user, churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    const records = await prisma.churchFunctionHistory.findMany({
      where: { churchId, deletedAt: null },
      include: {
        member: { select: { id: true, fullName: true } },
        function: { select: { id: true, name: true, isLeaderRole: true } },
      },
      orderBy: [{ isActive: "desc" }, { startDate: "desc" }],
    });
    return NextResponse.json(serializeBigInts(records));
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const churchId = (await params).id;
    const ok = await assertChurchAccess(user, churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const { memberId, functionId, department, startDate, endDate, notes, isActive } = body;
    if (!memberId || !functionId || !startDate) {
      return NextResponse.json({ error: "memberId, functionId and startDate are required" }, { status: 400 });
    }

    const catalogFunction = await prisma.churchFunctionCatalog.findUnique({ where: { id: functionId } });
    if (!catalogFunction) return NextResponse.json({ error: "function not found" }, { status: 404 });

    const normalizedDepartment = department?.trim() || null;
    const nextIsActive = endDate ? false : isActive ?? true;

    if (nextIsActive) {
      const activeDuplicate = await prisma.churchFunctionHistory.findFirst({
        where: {
          churchId, functionId, deletedAt: null, endDate: null, isActive: true,
          ...(catalogFunction.isLeaderRole ? {} : { department: normalizedDepartment }),
        },
      });
      if (activeDuplicate) {
        return NextResponse.json({
          error: catalogFunction.isLeaderRole
            ? "Já existe um dirigente ativo para esta igreja."
            : "Já existe uma função ativa desse tipo para esta igreja nesse departamento.",
        }, { status: 409 });
      }
    }

    const record = await prisma.churchFunctionHistory.create({
      data: {
        churchId, memberId, functionId,
        department: normalizedDepartment,
        startDate: new Date(startDate),
        endDate: parseDateValue(endDate) as Date | undefined,
        notes, isActive: nextIsActive,
      },
      include: {
        member: { select: { id: true, fullName: true } },
        function: { select: { id: true, name: true, isLeaderRole: true } },
      },
    });
    return NextResponse.json(serializeBigInts(record), { status: 201 });
  });
}
