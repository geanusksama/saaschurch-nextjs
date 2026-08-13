import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { assertChurchAccess, serializeBigInts } from "@/lib/helpers";
import { RegraContasPagarError, TX_CONTAS_PAGAR, estornarPagamento } from "@/lib/contasPagarService";

/**
 * POST /api/contas-pagar/pagamentos/[id]/estorno
 * body: { motivo: string }
 *
 * Estorno lógico: o pagamento fica no histórico marcado com quem/quando/por quê,
 * o lançamento do livro caixa é estornado e parcela e conta são recalculadas.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;

    const pagamento = await prisma.pagamentoParcela.findUnique({
      where: { id },
      select: { id: true, churchId: true },
    });
    if (!pagamento) return NextResponse.json({ error: "Pagamento não encontrado." }, { status: 404 });
    if (!(await assertChurchAccess(user, pagamento.churchId, prisma))) {
      return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));

    try {
      const resultado = await prisma.$transaction(async (tx) =>
        estornarPagamento(tx, id, String(body.motivo ?? ""), {
          id: user.id,
          nome: user.fullName || user.email || null,
        }),
        TX_CONTAS_PAGAR
      );
      return NextResponse.json(serializeBigInts(resultado));
    } catch (e) {
      if (e instanceof RegraContasPagarError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      const msg = e instanceof Error ? e.message : "Erro ao estornar o pagamento.";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  });
}
