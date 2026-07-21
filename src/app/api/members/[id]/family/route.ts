import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, assertChurchAccess, parseDateValue } from "@/lib/helpers";

/**
 * Núcleo familiar do membro (filhos, cônjuge, pais, irmãos).
 *
 * O familiar pode ser um membro cadastrado (relatedMemberId) OU uma pessoa sem
 * cadastro (relatedName + relatedBirthDate + relatedGender) — o caso comum de
 * filhos pequenos.
 */

export const RELATIONSHIP_TYPES = ["FILHO", "CONJUGE", "PAI_MAE", "IRMAO"] as const;

const familyInclude = {
  relatedMember: {
    select: { id: true, fullName: true, rol: true, birthDate: true, gender: true, photoUrl: true },
  },
} as const;

// GET /api/members/[id]/family
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

    const rows = await prisma.memberFamilyRelationship.findMany({
      where: { memberId: id, deletedAt: null },
      include: familyInclude,
      orderBy: [{ relationshipType: "asc" }, { relatedBirthDate: "asc" }],
    });
    return NextResponse.json(serializeBigInts(rows));
  });
}

// POST /api/members/[id]/family
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const member = await prisma.member.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, churchId: true },
    });
    if (!member) return NextResponse.json({ error: "member not found" }, { status: 404 });
    const ok = await assertChurchAccess(user, member.churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { relationshipType, relatedMemberId, relatedName, relatedBirthDate, relatedGender, notes } = body;

    if (!relationshipType) {
      return NextResponse.json({ error: "Informe o tipo de vínculo." }, { status: 400 });
    }
    // Precisa de um vínculo com membro OU de um nome avulso.
    if (!relatedMemberId && !String(relatedName ?? "").trim()) {
      return NextResponse.json(
        { error: "Informe o nome do familiar ou vincule um membro existente." },
        { status: 400 }
      );
    }

    const created = await prisma.memberFamilyRelationship.create({
      data: {
        memberId: id,
        relationshipType: String(relationshipType).toUpperCase(),
        relatedMemberId: relatedMemberId || null,
        relatedName: relatedMemberId ? null : String(relatedName).trim(),
        relatedBirthDate: (parseDateValue(relatedBirthDate) as Date | null) ?? null,
        relatedGender: relatedGender || null,
        notes: notes || null,
        createdBy: user.id ? String(user.id) : null,
      },
      include: familyInclude,
    });
    return NextResponse.json(serializeBigInts(created), { status: 201 });
  });
}
