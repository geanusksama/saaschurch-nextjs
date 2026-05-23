import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { resolveScopedFieldId } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const campoId = resolveScopedFieldId(user, req.nextUrl.searchParams.get("campoId") || undefined);
    if (!campoId) return NextResponse.json({ error: "campoId obrigatório" }, { status: 400 });
    const trimestreId = req.nextUrl.searchParams.get("trimestreId");
    const categoriaId = req.nextUrl.searchParams.get("categoriaId");
    const ativo = req.nextUrl.searchParams.get("ativo");
    const rows = await prisma.ebdProduto.findMany({
      where: {
        campoId,
        deletedAt: null,
        ...(trimestreId && { trimestreId }),
        ...(categoriaId && { categoriaId }),
        ...(ativo !== null && { ativo: ativo === "true" }),
      },
      include: {
        categoria: { select: { id: true, nome: true } },
        trimestre: { select: { id: true, nome: true, ano: true } },
      },
      orderBy: [{ categoria: { nome: "asc" } }, { nome: "asc" }],
    });
    return NextResponse.json(rows);
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const {
      campoId: reqCampoId, categoriaId, trimestreId, codigo, nome, tipo,
      tema, descricao, unidade, precoCusto, precoVenda, ativo,
    } = body;
    const campoId = resolveScopedFieldId(user, reqCampoId);
    if (!campoId) return NextResponse.json({ error: "campoId obrigatório" }, { status: 400 });
    if (!nome || !categoriaId || !tipo) {
      return NextResponse.json({ error: "nome, categoriaId e tipo são obrigatórios" }, { status: 400 });
    }
    const row = await prisma.ebdProduto.create({
      data: {
        campoId,
        categoriaId,
        trimestreId: trimestreId || null,
        codigo: codigo || null,
        nome,
        tipo,
        tema: tema || null,
        descricao: descricao || null,
        unidade: unidade || "un",
        precoCusto: precoCusto ? Number(precoCusto) : 0,
        precoVenda: precoVenda ? Number(precoVenda) : 0,
        ativo: ativo !== false,
        createdBy: user.id ?? undefined,
      },
      include: {
        categoria: { select: { id: true, nome: true } },
        trimestre: { select: { id: true, nome: true, ano: true } },
      },
    });
    return NextResponse.json(row, { status: 201 });
  });
}
