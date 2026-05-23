import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { resolveScopedFieldId } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const campoId = resolveScopedFieldId(user, req.nextUrl.searchParams.get("campoId") || undefined);
    if (!campoId) return NextResponse.json({ error: "campoId obrigatório" }, { status: 400 });
    const rows = await prisma.ebdCategoria.findMany({
      where: { campoId, deletedAt: null },
      orderBy: [{ ordem: "asc" }, { nome: "asc" }],
    });
    return NextResponse.json(rows);
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const { campoId: reqCampoId, nome, descricao, ordem } = body;
    const campoId = resolveScopedFieldId(user, reqCampoId);
    if (!campoId) return NextResponse.json({ error: "campoId obrigatório" }, { status: 400 });
    if (!nome) return NextResponse.json({ error: "nome é obrigatório" }, { status: 400 });
    const row = await prisma.ebdCategoria.create({
      data: { campoId, nome, descricao, ordem: Number(ordem ?? 0), createdBy: user.id ?? undefined },
    });
    return NextResponse.json(row, { status: 201 });
  });
}
