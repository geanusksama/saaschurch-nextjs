import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { assertChurchAccess, serializeBigInts } from "@/lib/helpers";
import { RegraContasPagarError, TX_CONTAS_PAGAR, estornarPagamento } from "@/lib/contasPagarService";

/**
 * DELETE /api/livro-caixa/[id] — exclui um lançamento do livro caixa.
 *
 * Quando o lançamento nasceu do pagamento de uma parcela do Contas a Pagar,
 * apagar a linha "na mão" deixaria o sistema mentindo: o dinheiro sumiria do
 * livro caixa e a parcela continuaria quitada. Nesse caso a exclusão vira
 * ESTORNO — o mesmo caminho do botão de estorno do Contas a Pagar:
 *
 *   - o pagamento é marcado como estornado (fica no histórico, com quem e quando);
 *   - o lançamento do livro caixa é baixado logicamente (deleted_at);
 *   - parcela e conta são recalculados: o saldo volta a ficar em aberto.
 *
 * Lançamento avulso (digitado direto no livro caixa) continua sendo apagado
 * como antes.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;

    const lancamento = await prisma.livroCaixa.findUnique({
      where: { id },
      select: { id: true, churchId: true, deletedAt: true },
    });
    if (!lancamento) return NextResponse.json({ error: "Lançamento não encontrado." }, { status: 404 });
    if (!(await assertChurchAccess(user, lancamento.churchId, prisma))) {
      return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    }

    const pagamento = await prisma.pagamentoParcela.findFirst({
      where: { livroCaixaId: id, estornadoEm: null },
      select: {
        id: true,
        parcela: {
          select: {
            numeroParcela: true,
            totalParcelas: true,
            contaPagar: { select: { numero: true } },
          },
        },
      },
    });

    const body = await req.json().catch(() => ({}));

    if (pagamento) {
      try {
        const resultado = await prisma.$transaction(
          async (tx) => estornarPagamento(
            tx,
            pagamento.id,
            String(body.motivo || "").trim() || "Lançamento excluído pelo Livro Caixa",
            { id: user.id, nome: user.fullName || user.email || null }
          ),
          TX_CONTAS_PAGAR
        );
        return NextResponse.json(serializeBigInts({
          ok: true,
          estornado: true,
          conta: pagamento.parcela.contaPagar.numero,
          parcela: `${pagamento.parcela.numeroParcela}/${pagamento.parcela.totalParcelas}`,
          statusGeral: resultado.statusGeral,
        }));
      } catch (e) {
        if (e instanceof RegraContasPagarError) {
          return NextResponse.json({ error: e.message }, { status: e.status });
        }
        throw e;
      }
    }

    await prisma.livroCaixa.delete({ where: { id } });
    return NextResponse.json({ ok: true, estornado: false });
  });
}
