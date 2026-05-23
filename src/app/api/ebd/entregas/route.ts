import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { resolveScopedFieldId, serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const campoId = resolveScopedFieldId(user, req.nextUrl.searchParams.get("campoId") || undefined);
    if (!campoId) return NextResponse.json({ error: "campoId obrigatório" }, { status: 400 });
    const churchId = req.nextUrl.searchParams.get("churchId");
    const trimestreId = req.nextUrl.searchParams.get("trimestreId");
    const status = req.nextUrl.searchParams.get("status");

    const rows = await prisma.ebdEntrega.findMany({
      where: {
        campoId,
        deletedAt: null,
        ...(churchId && { churchId }),
        ...(trimestreId && { trimestreId }),
        ...(status && { status }),
      },
      include: {
        church: { select: { id: true, name: true } },
        trimestre: { select: { id: true, nome: true, ano: true } },
        responsavel: { select: { id: true, fullName: true } },
        itens: {
          include: { produto: { include: { categoria: { select: { id: true, nome: true } } } } },
        },
      },
      orderBy: { dataEntrega: "desc" },
      take: 100,
    });
    return NextResponse.json(serializeBigInts(rows));
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const {
      campoId: reqCampoId, churchId, trimestreId, dataEntrega,
      responsavelId, observacao, itens,
    } = body;
    const campoId = resolveScopedFieldId(user, reqCampoId);
    if (!campoId) return NextResponse.json({ error: "campoId obrigatório" }, { status: 400 });
    if (!churchId || !dataEntrega || !Array.isArray(itens) || itens.length === 0) {
      return NextResponse.json({ error: "churchId, dataEntrega e itens são obrigatórios" }, { status: 400 });
    }

    const valorTotal = itens.reduce((s: number, i: { quantidade: number; valorUnit: number }) =>
      s + Number(i.quantidade) * Number(i.valorUnit), 0);

    // Busca saldo anterior da igreja
    const finKey = { campoId, churchId, trimestreId: trimestreId || null };
    const finRow = await prisma.ebdFinanceiro.findFirst({
      where: finKey as Parameters<typeof prisma.ebdFinanceiro.findFirst>[0]["where"],
    });
    const saldoAnterior = finRow ? Number(finRow.saldo) : 0;
    const novoSaldo = saldoAnterior + valorTotal;

    // Gera número do documento
    const count = await prisma.ebdEntrega.count({ where: { campoId } });
    const numeroDoc = `EBD-${String(count + 1).padStart(5, "0")}`;

    const entrega = await prisma.$transaction(async (tx) => {
      const e = await tx.ebdEntrega.create({
        data: {
          campoId,
          churchId,
          trimestreId: trimestreId || null,
          numeroDoc,
          dataEntrega: new Date(dataEntrega),
          status: "separando",
          responsavelId: responsavelId || null,
          valorTotal,
          saldoAnterior,
          novoSaldo,
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
        include: {
          church: { select: { id: true, name: true } },
          itens: { include: { produto: { include: { categoria: { select: { id: true, nome: true } } } } } },
        },
      });

      // Debita estoque
      for (const item of itens) {
        await tx.ebdEstoque.updateMany({
          where: { campoId, produtoId: item.produtoId },
          data: { quantidade: { decrement: Number(item.quantidade) } },
        });
        await tx.ebdEstoqueMovimento.create({
          data: {
            campoId,
            produtoId: item.produtoId,
            tipo: "saida",
            quantidade: Number(item.quantidade),
            valorUnit: Number(item.valorUnit),
            referencia: `Entrega ${numeroDoc}`,
            referenciaId: e.id,
            dataMovimento: new Date(dataEntrega),
            createdBy: user.id ?? undefined,
          },
        });
      }

      // Gera débito financeiro
      if (finRow) {
        await tx.ebdFinanceiro.update({
          where: { id: finRow.id },
          data: { saldo: novoSaldo, entregaId: e.id },
        });
      } else {
        await tx.ebdFinanceiro.create({
          data: {
            campoId,
            churchId,
            trimestreId: trimestreId || null,
            entregaId: e.id,
            saldo: novoSaldo,
          },
        });
      }

      // Cria movimento financeiro de débito
      const fin = finRow || await tx.ebdFinanceiro.findFirst({ where: { campoId, churchId } });
      if (fin) {
        await tx.ebdFinanceiroMovimento.create({
          data: {
            financeiroId: fin.id,
            campoId,
            tipo: "debito",
            valor: valorTotal,
            saldoAntes: saldoAnterior,
            saldoDepois: novoSaldo,
            data: new Date(dataEntrega),
            descricao: `Entrega ${numeroDoc}`,
            referenciaId: e.id,
            createdBy: user.id ?? undefined,
          },
        });
      }

      // Histórico
      const churchRow = await tx.church.findUnique({ where: { id: churchId }, select: { name: true } });
      await tx.ebdHistorico.create({
        data: {
          campoId,
          churchId,
          tipo: "entrega",
          titulo: `Entrega ${numeroDoc} — ${churchRow?.name ?? ""}`,
          descricao: `${itens.length} produto(s) | Valor: R$ ${valorTotal.toFixed(2)}`,
          valor: valorTotal,
          referenciaId: e.id,
          data: new Date(dataEntrega),
          createdBy: user.id ?? undefined,
        },
      });

      return e;
    });

    return NextResponse.json(serializeBigInts(entrega), { status: 201 });
  });
}
