import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, assertChurchAccess, parseDateValue } from "@/lib/helpers";

/**
 * Histórico do membro em outras igrejas (antes de entrar nesta).
 *
 * A igreja de origem não está cadastrada no sistema, então tudo aqui é texto
 * livre digitado pela secretaria: nome da igreja, título eclesiástico que ele
 * tinha lá, datas (conversão, batismo, consagração), pastor e funções.
 */

async function loadMember(id: string) {
  return prisma.member.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, churchId: true },
  });
}

// GET /api/members/[id]/previous-churches
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const member = await loadMember(id);
    if (!member) return NextResponse.json({ error: "member not found" }, { status: 404 });
    const ok = await assertChurchAccess(user, member.churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

    const rows = await prisma.memberPreviousChurch.findMany({
      where: { memberId: id, deletedAt: null },
      // Mais antigo primeiro: a trajetória lida de cima para baixo.
      orderBy: [{ conversionDate: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json(serializeBigInts(rows));
  });
}

// POST /api/members/[id]/previous-churches
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const member = await loadMember(id);
    if (!member) return NextResponse.json({ error: "member not found" }, { status: 404 });
    const ok = await assertChurchAccess(user, member.churchId, prisma);
    if (!ok) return NextResponse.json({ error: "Sem acesso." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const churchName = String(body.churchName ?? "").trim();
    if (!churchName) {
      return NextResponse.json({ error: "Informe o nome da igreja." }, { status: 400 });
    }

    const created = await prisma.memberPreviousChurch.create({
      data: {
        memberId: id,
        churchName,
        ecclesiasticalTitle: body.ecclesiasticalTitle?.trim() || null,
        conversionDate: (parseDateValue(body.conversionDate) as Date | null) ?? null,
        baptismDate: (parseDateValue(body.baptismDate) as Date | null) ?? null,
        consecrationDate: (parseDateValue(body.consecrationDate) as Date | null) ?? null,
        consecrationTitle: body.consecrationTitle?.trim() || null,
        pastorName: body.pastorName?.trim() || null,
        functions: body.functions?.trim() || null,
        notes: body.notes?.trim() || null,
        createdBy: user.id ? String(user.id) : null,
      },
    });
    return NextResponse.json(serializeBigInts(created), { status: 201 });
  });
}
