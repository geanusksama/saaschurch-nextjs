import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";
import { podeAcessarIgreja } from "@/lib/contasPagarScope";
import { RegraContasPagarError, TX_CONTAS_PAGAR, registrarPagamento } from "@/lib/contasPagarService";

/**
 * POST /api/contas-pagar/parcelas/[id]/pagamentos
 * body: { valorPago, dataPagamento, formaPagamento?, bancoId?, comprovanteUrl?, observacao? }
 *
 * Aceita pagamento PARCIAL: o valor é livre e o que sobrar continua em aberto
 * na mesma parcela. O serviço faz a baixa no livro caixa e os recálculos na
 * mesma transação.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;

    const parcela = await prisma.parcelaContaPagar.findUnique({
      where: { id },
      select: { id: true, churchId: true },
    });
    if (!parcela) return NextResponse.json({ error: "Parcela não encontrada." }, { status: 404 });
    if (!(await podeAcessarIgreja(user, parcela.churchId, prisma))) {
      return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    if (!body.dataPagamento) {
      return NextResponse.json({ error: "Data do pagamento é obrigatória." }, { status: 400 });
    }

    try {
      const resultado = await prisma.$transaction(async (tx) =>
        registrarPagamento(tx, {
          parcelaId: id,
          valorPago: body.valorPago,
          dataPagamento: String(body.dataPagamento),
          formaPagamento: body.formaPagamento ?? null,
          bancoId: body.bancoId ?? null,
          comprovanteUrl: body.comprovanteUrl ?? null,
          observacao: body.observacao ?? null,
          registradoPor: user.id,
          operadorNome: user.fullName || user.email || null,
        }),
        TX_CONTAS_PAGAR
      );
      return NextResponse.json(serializeBigInts(resultado), { status: 201 });
    } catch (e) {
      if (e instanceof RegraContasPagarError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      const msg = e instanceof Error ? e.message : "Erro ao registrar o pagamento.";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  });
}
