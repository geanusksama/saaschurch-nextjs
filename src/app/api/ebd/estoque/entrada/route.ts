import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { resolveScopedFieldId, serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const campoId = resolveScopedFieldId(user, req.nextUrl.searchParams.get("campoId") || undefined);
    if (!campoId) return NextResponse.json({ error: "campoId obrigatório" }, { status: 400 });
    const rows = await prisma.ebdEntrada.findMany({
      where: { campoId, deletedAt: null },
      include: { itens: { include: { produto: { select: { id: true, nome: true } } } } },
      orderBy: { dataEntrada: "desc" },
      take: 50,
    });
    return NextResponse.json(serializeBigInts(rows));
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const { campoId: reqCampoId, fornecedor, numNf, dataEntrada, observacao, itens } = body;
    const campoId = resolveScopedFieldId(user, reqCampoId);
    if (!campoId) return NextResponse.json({ error: "campoId obrigatório" }, { status: 400 });
    if (!dataEntrada || !Array.isArray(itens) || itens.length === 0) {
      return NextResponse.json({ error: "dataEntrada e itens são obrigatórios" }, { status: 400 });
    }

    const valorTotal = itens.reduce((s: number, i: { quantidade: number; valorUnit: number }) =>
      s + (Number(i.quantidade) * Number(i.valorUnit)), 0);

    const entrada = await prisma.$transaction(async (tx) => {
      const e = await tx.ebdEntrada.create({
        data: {
          campoId,
          fornecedor: fornecedor || null,
          numNf: numNf || null,
          dataEntrada: new Date(dataEntrada),
          valorTotal,
          observacao: observacao || null,
          createdBy: user.id ?? undefined,
          itens: {
            create: itens.map((i: { produtoId: string; quantidade: number; valorUnit: number }) => ({
              produtoId: i.produtoId,
              quantidade: Number(i.quantidade),
              valorUnit: Number(i.valorUnit),
              valorTotal: Number(i.quantidade) * Number(i.valorUnit),
            })),
          },
        },
        include: { itens: { include: { produto: { select: { id: true, nome: true } } } } },
      });

      // Atualiza estoque e cria movimentos
      for (const item of itens) {
        await tx.ebdEstoque.upsert({
          where: { campoId_produtoId: { campoId, produtoId: item.produtoId } },
          create: { campoId, produtoId: item.produtoId, quantidade: Number(item.quantidade) },
          update: { quantidade: { increment: Number(item.quantidade) } },
        });
        await tx.ebdEstoqueMovimento.create({
          data: {
            campoId,
            produtoId: item.produtoId,
            tipo: "entrada",
            quantidade: Number(item.quantidade),
            valorUnit: Number(item.valorUnit),
            referencia: `NF ${numNf || "s/n"}`,
            referenciaId: e.id,
            fornecedor: fornecedor || null,
            numNf: numNf || null,
            dataMovimento: new Date(dataEntrada),
            createdBy: user.id ?? undefined,
          },
        });
      }

      await tx.ebdHistorico.create({
        data: {
          campoId,
          tipo: "entrada_estoque",
          titulo: `Entrada de estoque — NF ${numNf || "s/n"}`,
          descricao: `Fornecedor: ${fornecedor || "–"} | ${itens.length} produto(s)`,
          valor: valorTotal,
          referenciaId: e.id,
          data: new Date(dataEntrada),
          createdBy: user.id ?? undefined,
        },
      });

      return e;
    });

    return NextResponse.json(serializeBigInts(entrada), { status: 201 });
  });
}
