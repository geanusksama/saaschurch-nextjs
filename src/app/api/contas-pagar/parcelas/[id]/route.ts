import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";
import { podeAcessarIgreja } from "@/lib/contasPagarScope";
import { RegraContasPagarError, TX_CONTAS_PAGAR, excluirParcela } from "@/lib/contasPagarService";

/**
 * GET /api/contas-pagar/parcelas/[id]
 *
 * A parcela com a coleção de pagamentos que ela recebeu — os "anexos" de
 * pagamento. Traz os estornados também, marcados: o histórico precisa mostrar
 * que houve um estorno, não escondê-lo.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;

    const parcela = await prisma.parcelaContaPagar.findUnique({
      where: { id },
      include: {
        contaPagar: {
          include: {
            credor: { select: { id: true, nome: true, tipoCredor: true, chavePix: true, bancoNome: true, agencia: true, conta: true } },
            planoDeConta: { select: { id: true, nome: true, codigo: true } },
            departamento: { select: { id: true, nome: true, cor: true } },
            banco: { select: { id: true, nome: true } },
          },
        },
        pagamentos: {
          orderBy: { dataPagamento: "asc" },
          include: { banco: { select: { id: true, nome: true } } },
        },
        church: { select: { id: true, name: true, code: true } },
      },
    });

    if (!parcela) return NextResponse.json({ error: "Parcela não encontrada." }, { status: 404 });
    if (!(await podeAcessarIgreja(user, parcela.churchId, prisma))) {
      return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    }

    return NextResponse.json(serializeBigInts(parcela));
  });
}

/**
 * DELETE /api/contas-pagar/parcelas/[id]
 *
 * Exclui a parcela e redistribui o valor dela entre as parcelas restantes —
 * o compromisso com o credor não encolhe só porque o parcelamento mudou.
 * Ver excluirParcela() para as regras.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;

    const parcela = await prisma.parcelaContaPagar.findUnique({
      where: { id },
      select: { id: true, churchId: true, contaPagar: { select: { deletedAt: true } } },
    });
    if (!parcela || parcela.contaPagar?.deletedAt) {
      return NextResponse.json({ error: "Parcela não encontrada." }, { status: 404 });
    }
    if (!(await podeAcessarIgreja(user, parcela.churchId, prisma))) {
      return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    }

    try {
      const resultado = await prisma.$transaction(
        async (tx) => excluirParcela(tx, id),
        TX_CONTAS_PAGAR
      );
      return NextResponse.json(serializeBigInts({ ok: true, ...resultado }));
    } catch (e) {
      if (e instanceof RegraContasPagarError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      throw e;
    }
  });
}
