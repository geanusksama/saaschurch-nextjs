import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, assertChurchAccess, parseDateValue } from "@/lib/helpers";

/** Carrega o registro garantindo que ele pertence ao membro da URL. */
async function loadHistory(memberId: string, historyId: string) {
  return prisma.memberPreviousChurch.findFirst({
    where: { id: historyId, memberId, deletedAt: null },
    include: { member: { select: { id: true, churchId: true } } },
  });
}

// PATCH /api/members/[id]/previous-churches/[historyId]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; historyId: string }> }
) {
  return withAuth(req, async (user) => {
    const { id, historyId } = await params;
    const existing = await loadHistory(id, historyId);
    if (!existing) return NextResponse.json({ error: "Histórico não encontrado." }, { status: 404 });
    const ok = await assertChurchAccess(user, existing.member.churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    if (body.churchName !== undefined && !String(body.churchName).trim()) {
      return NextResponse.json({ error: "Informe o nome da igreja." }, { status: 400 });
    }

    const text = (value: unknown) => (value === undefined ? undefined : String(value ?? "").trim() || null);
    const date = (value: unknown) =>
      value === undefined ? undefined : ((parseDateValue(value) as Date | null) ?? null);

    const updated = await prisma.memberPreviousChurch.update({
      where: { id: historyId },
      data: {
        churchName: body.churchName === undefined ? undefined : String(body.churchName).trim(),
        ecclesiasticalTitle: text(body.ecclesiasticalTitle),
        conversionDate: date(body.conversionDate),
        baptismDate: date(body.baptismDate),
        consecrationDate: date(body.consecrationDate),
        consecrationTitle: text(body.consecrationTitle),
        pastorName: text(body.pastorName),
        functions: text(body.functions),
        notes: text(body.notes),
        updatedBy: user.id ? String(user.id) : null,
      },
    });
    return NextResponse.json(serializeBigInts(updated));
  });
}

// DELETE /api/members/[id]/previous-churches/[historyId] — exclusão lógica
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; historyId: string }> }
) {
  return withAuth(req, async (user) => {
    const { id, historyId } = await params;
    const existing = await loadHistory(id, historyId);
    if (!existing) return NextResponse.json({ error: "Histórico não encontrado." }, { status: 404 });
    const ok = await assertChurchAccess(user, existing.member.churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

    await prisma.memberPreviousChurch.update({
      where: { id: historyId },
      data: { deletedAt: new Date(), updatedBy: user.id ? String(user.id) : null },
    });
    return new NextResponse(null, { status: 204 });
  });
}
