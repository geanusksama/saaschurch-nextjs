import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const row = await prisma.ebdProduto.update({
      where: { id, deletedAt: null },
      data: {
        ...(body.categoriaId && { categoriaId: body.categoriaId }),
        ...(body.trimestreId !== undefined && { trimestreId: body.trimestreId || null }),
        ...(body.codigo !== undefined && { codigo: body.codigo }),
        ...(body.nome && { nome: body.nome }),
        ...(body.tipo && { tipo: body.tipo }),
        ...(body.tema !== undefined && { tema: body.tema }),
        ...(body.descricao !== undefined && { descricao: body.descricao }),
        ...(body.unidade && { unidade: body.unidade }),
        ...(body.precoCusto !== undefined && { precoCusto: Number(body.precoCusto) }),
        ...(body.precoVenda !== undefined && { precoVenda: Number(body.precoVenda) }),
        ...(body.ativo !== undefined && { ativo: body.ativo }),
      },
      include: {
        categoria: { select: { id: true, nome: true } },
        trimestre: { select: { id: true, nome: true, ano: true } },
      },
    });
    return NextResponse.json(row);
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await params;
    await prisma.ebdProduto.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  });
}
