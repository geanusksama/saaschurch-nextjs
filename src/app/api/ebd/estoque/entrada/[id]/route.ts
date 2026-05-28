import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { resolveScopedFieldId } from "@/lib/helpers";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { campoId: reqCampoId, fornecedor, numNf, dataEntrada, observacao } = body;
    const campoId = resolveScopedFieldId(user, reqCampoId);
    if (!campoId) return NextResponse.json({ error: "campoId obrigatório" }, { status: 400 });

    const entrada = await prisma.ebdEntrada.findFirst({ where: { id, campoId, deletedAt: null } });
    if (!entrada) return NextResponse.json({ error: "Entrada não encontrada" }, { status: 404 });

    const updated = await prisma.ebdEntrada.update({
      where: { id },
      data: {
        fornecedor: fornecedor || null,
        numNf: numNf || null,
        dataEntrada: dataEntrada ? new Date(dataEntrada) : entrada.dataEntrada,
        observacao: observacao || null,
        updatedAt: new Date(),
      },
      include: { itens: { include: { produto: { select: { id: true, nome: true } } } } },
    });

    return NextResponse.json(updated);
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const campoId = resolveScopedFieldId(user, req.nextUrl.searchParams.get("campoId") || undefined);
    if (!campoId) return NextResponse.json({ error: "campoId obrigatório" }, { status: 400 });

    const entrada = await prisma.ebdEntrada.findFirst({
      where: { id, campoId, deletedAt: null },
      include: { itens: true },
    });
    if (!entrada) return NextResponse.json({ error: "Entrada não encontrada" }, { status: 404 });

    await prisma.$transaction(async (tx) => {
      for (const item of entrada.itens) {
        await tx.ebdEstoque.updateMany({
          where: { campoId, produtoId: item.produtoId },
          data: { quantidade: { decrement: item.quantidade } },
        });
      }

      await tx.ebdEntrada.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });

    return NextResponse.json({ ok: true });
  });
}
