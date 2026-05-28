import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { resolveScopedFieldId } from "@/lib/helpers";

const CreateProductSchema = z.object({
  campoId: z.string().uuid().optional(),
  categoriaId: z.string().uuid("categoriaId deve ser UUID válido"),
  trimestreId: z.string().uuid().optional().nullable(),
  codigo: z.string().max(100).optional().nullable(),
  nome: z.string().min(1, "nome é obrigatório").max(255),
  tipo: z.string().min(1, "tipo é obrigatório"),
  tema: z.string().optional().nullable(),
  descricao: z.string().optional().nullable(),
  unidade: z.string().max(20).optional(),
  precoCusto: z.coerce.number().min(0).optional(),
  precoVenda: z.coerce.number().min(0).optional(),
  ativo: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const campoId = resolveScopedFieldId(user, req.nextUrl.searchParams.get("campoId") || undefined);
    if (!campoId) return NextResponse.json({ error: "campoId obrigatório" }, { status: 400 });
    const trimestreId = req.nextUrl.searchParams.get("trimestreId");
    const categoriaId = req.nextUrl.searchParams.get("categoriaId");
    const ativo = req.nextUrl.searchParams.get("ativo");
    const limit = Math.min(500, Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") || "200")));

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
      take: limit,
    });

    return NextResponse.json(rows);
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const parsed = CreateProductSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos.", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { campoId: reqCampoId, categoriaId, trimestreId, codigo, nome, tipo, tema, descricao, unidade, precoCusto, precoVenda, ativo } = parsed.data;
    const campoId = resolveScopedFieldId(user, reqCampoId);
    if (!campoId) return NextResponse.json({ error: "campoId obrigatório" }, { status: 400 });

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
        precoCusto: precoCusto ?? 0,
        precoVenda: precoVenda ?? 0,
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
