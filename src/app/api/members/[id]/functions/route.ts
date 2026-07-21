import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, assertChurchAccess, parseDateValue } from "@/lib/helpers";
import { findActiveFunctionConflict, churchFunctionInclude } from "@/lib/churchFunctions";

/**
 * Funções exercidas por um membro.
 *
 * Grava na MESMA tabela usada pela aba "Funcoes" da tela de Editar Igreja
 * (church_function_history), então o que é criado aqui aparece lá e vice-versa.
 */

// GET /api/members/[id]/functions — todas as funções do membro (ativas primeiro)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const member = await prisma.member.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, churchId: true },
    });
    if (!member) return NextResponse.json({ error: "member not found" }, { status: 404 });
    const ok = await assertChurchAccess(user, member.churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

    const records = await prisma.churchFunctionHistory.findMany({
      where: { memberId: id, deletedAt: null },
      include: churchFunctionInclude,
      orderBy: [{ isActive: "desc" }, { startDate: "desc" }],
    });
    return NextResponse.json(serializeBigInts(records));
  });
}

// POST /api/members/[id]/functions — cria função para o membro.
// A igreja default é a do próprio membro; `isCampoWide` marca alcance de campo.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const member = await prisma.member.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, churchId: true },
    });
    if (!member) return NextResponse.json({ error: "member not found" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const { functionId, department, startDate, endDate, notes, isActive, isCampoWide } = body;
    const churchId: string = body.churchId || member.churchId;

    if (!functionId || !startDate) {
      return NextResponse.json({ error: "functionId and startDate are required" }, { status: 400 });
    }

    // Precisa ter acesso à igreja onde a função será registrada.
    const ok = await assertChurchAccess(user, churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

    const catalogFunction = await prisma.churchFunctionCatalog.findUnique({ where: { id: functionId } });
    if (!catalogFunction) return NextResponse.json({ error: "function not found" }, { status: 404 });

    const normalizedDepartment = department?.trim() || null;
    const nextIsActive = endDate ? false : isActive ?? true;

    if (nextIsActive) {
      const conflict = await findActiveFunctionConflict({
        churchId, functionId, department: normalizedDepartment,
      });
      if (conflict) return NextResponse.json({ error: conflict }, { status: 409 });
    }

    const record = await prisma.churchFunctionHistory.create({
      data: {
        churchId,
        memberId: id,
        functionId,
        department: normalizedDepartment,
        startDate: new Date(startDate),
        endDate: parseDateValue(endDate) as Date | undefined,
        notes: notes || null,
        isActive: nextIsActive,
        isCampoWide: isCampoWide ?? false,
      },
      include: churchFunctionInclude,
    });
    return NextResponse.json(serializeBigInts(record), { status: 201 });
  });
}
