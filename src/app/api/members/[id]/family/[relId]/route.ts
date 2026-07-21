import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, assertChurchAccess, parseDateValue } from "@/lib/helpers";

/** Carrega o vínculo garantindo que ele pertence ao membro da URL. */
async function loadRelationship(memberId: string, relId: string) {
  return prisma.memberFamilyRelationship.findFirst({
    where: { id: relId, memberId, deletedAt: null },
    include: { member: { select: { id: true, churchId: true } } },
  });
}

// PATCH /api/members/[id]/family/[relId]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; relId: string }> }) {
  return withAuth(req, async (user) => {
    const { id, relId } = await params;
    const existing = await loadRelationship(id, relId);
    if (!existing) return NextResponse.json({ error: "Vínculo não encontrado." }, { status: 404 });
    const ok = await assertChurchAccess(user, existing.member.churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const linkedMemberId =
      body.relatedMemberId === undefined ? existing.relatedMemberId : body.relatedMemberId || null;

    const updated = await prisma.memberFamilyRelationship.update({
      where: { id: relId },
      data: {
        relationshipType: body.relationshipType ? String(body.relationshipType).toUpperCase() : undefined,
        relatedMemberId: body.relatedMemberId === undefined ? undefined : linkedMemberId,
        // Nome avulso só faz sentido quando NÃO há membro vinculado.
        relatedName:
          body.relatedName === undefined
            ? linkedMemberId
              ? null
              : undefined
            : linkedMemberId
              ? null
              : String(body.relatedName).trim() || null,
        relatedBirthDate:
          body.relatedBirthDate === undefined
            ? undefined
            : ((parseDateValue(body.relatedBirthDate) as Date | null) ?? null),
        relatedGender: body.relatedGender === undefined ? undefined : body.relatedGender || null,
        notes: body.notes === undefined ? undefined : body.notes || null,
      },
      include: {
        relatedMember: {
          select: { id: true, fullName: true, rol: true, birthDate: true, gender: true, photoUrl: true },
        },
      },
    });
    return NextResponse.json(serializeBigInts(updated));
  });
}

// DELETE /api/members/[id]/family/[relId] — exclusão lógica
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; relId: string }> }) {
  return withAuth(req, async (user) => {
    const { id, relId } = await params;
    const existing = await loadRelationship(id, relId);
    if (!existing) return NextResponse.json({ error: "Vínculo não encontrado." }, { status: 404 });
    const ok = await assertChurchAccess(user, existing.member.churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

    await prisma.memberFamilyRelationship.update({
      where: { id: relId },
      data: { deletedAt: new Date() },
    });
    return new NextResponse(null, { status: 204 });
  });
}
