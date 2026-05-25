import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { resolveScopedFieldId, serializeBigInts } from "@/lib/helpers";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { campoId: reqCampoId, status, titulo, descricao, observacao, dataVencimento } = body;
    const campoId = resolveScopedFieldId(user, reqCampoId);
    if (!campoId) return NextResponse.json({ error: "campoId obrigatório" }, { status: 400 });

    const neg = await prisma.ebdNegociacao.findFirst({ where: { id, campoId, deletedAt: null } });
    if (!neg) return NextResponse.json({ error: "Negociação não encontrada" }, { status: 404 });

    const updated = await prisma.ebdNegociacao.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(titulo && { titulo }),
        ...(descricao !== undefined && { descricao }),
        ...(observacao !== undefined && { observacao }),
        ...(dataVencimento && { dataVencimento: new Date(dataVencimento) }),
        updatedAt: new Date(),
      },
      include: { church: { select: { id: true, name: true } }, parcelas: { orderBy: { numParcela: "asc" } } },
    });

    return NextResponse.json(serializeBigInts(updated));
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const campoId = resolveScopedFieldId(user, req.nextUrl.searchParams.get("campoId") || undefined);
    if (!campoId) return NextResponse.json({ error: "campoId obrigatório" }, { status: 400 });

    await prisma.ebdNegociacao.updateMany({
      where: { id, campoId, deletedAt: null },
      data: { deletedAt: new Date(), status: "cancelada" },
    });

    return NextResponse.json({ ok: true });
  });
}
