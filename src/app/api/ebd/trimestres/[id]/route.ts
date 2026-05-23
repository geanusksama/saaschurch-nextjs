import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { nome, ano, dataInicio, dataFim, ativo } = body;
    const row = await prisma.ebdTrimestre.update({
      where: { id, deletedAt: null },
      data: {
        ...(nome && { nome }),
        ...(ano && { ano: Number(ano) }),
        ...(dataInicio && { dataInicio: new Date(dataInicio) }),
        ...(dataFim && { dataFim: new Date(dataFim) }),
        ...(ativo !== undefined && { ativo }),
      },
    });
    return NextResponse.json(row);
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await params;
    await prisma.ebdTrimestre.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  });
}
