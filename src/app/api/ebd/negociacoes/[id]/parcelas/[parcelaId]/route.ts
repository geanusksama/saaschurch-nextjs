import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { resolveScopedFieldId, serializeBigInts } from "@/lib/helpers";

export async function PATCH(req: NextRequest, { params }: { params: { id: string; parcelaId: string } }) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const { campoId: reqCampoId, status, dataPagamento, observacao } = body;
    const campoId = resolveScopedFieldId(user, reqCampoId);
    if (!campoId) return NextResponse.json({ error: "campoId obrigatório" }, { status: 400 });

    const negociacao = await prisma.ebdNegociacao.findFirst({
      where: { id: params.id, campoId, deletedAt: null },
      include: { parcelas: { orderBy: { numParcela: "asc" } } },
    });
    if (!negociacao) return NextResponse.json({ error: "Negociação não encontrada" }, { status: 404 });

    const parcela = negociacao.parcelas.find((p) => p.id === params.parcelaId);
    if (!parcela) return NextResponse.json({ error: "Parcela não encontrada" }, { status: 404 });

    const novoPago = status === "pago" || (!!dataPagamento && !status);
    const jaPaga = parcela.status === "pago";

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.ebdNegociacaoParcela.update({
        where: { id: params.parcelaId },
        data: {
          status: status || (dataPagamento ? "pago" : parcela.status),
          dataPagamento: dataPagamento ? new Date(dataPagamento) : parcela.dataPagamento,
          ...(observacao !== undefined && { observacao }),
        },
      });

      // Ao pagar uma parcela pela primeira vez → registra movimento financeiro automático
      if (novoPago && !jaPaga) {
        const valor = Number(parcela.valor);
        const dataMov = dataPagamento ? new Date(dataPagamento) : new Date();

        // Busca o trimestre com maior saldo devedor para este church (abate do mais antigo primeiro)
        const finMaisAntigo = await tx.ebdFinanceiro.findFirst({
          where: { campoId, churchId: negociacao.churchId, saldo: { gt: 0 } },
          orderBy: { createdAt: "asc" },
        });

        let finId: string;
        if (finMaisAntigo) {
          const saldoDepois = Number(finMaisAntigo.saldo) - valor;
          await tx.ebdFinanceiro.update({
            where: { id: finMaisAntigo.id },
            data: { saldo: saldoDepois },
          });
          finId = finMaisAntigo.id;

          await tx.ebdFinanceiroMovimento.create({
            data: {
              financeiroId: finId,
              campoId,
              tipo: "pagamento",
              valor,
              saldoAntes: Number(finMaisAntigo.saldo),
              saldoDepois,
              data: dataMov,
              descricao: `Parcela ${parcela.numParcela}/${negociacao.numParcelas} - ${negociacao.titulo}`,
              createdBy: user.id ?? undefined,
            },
          });
        } else {
          // Sem trimestre com saldo, cria entrada geral
          let fin = await tx.ebdFinanceiro.findFirst({
            where: { campoId, churchId: negociacao.churchId, trimestreId: null },
          });
          if (!fin) {
            fin = await tx.ebdFinanceiro.create({
              data: { campoId, churchId: negociacao.churchId, trimestreId: null, saldo: 0 },
            });
          }
          const saldoDepois = Number(fin.saldo) - valor;
          await tx.ebdFinanceiro.update({ where: { id: fin.id }, data: { saldo: saldoDepois } });

          await tx.ebdFinanceiroMovimento.create({
            data: {
              financeiroId: fin.id,
              campoId,
              tipo: "pagamento",
              valor,
              saldoAntes: Number(fin.saldo),
              saldoDepois,
              data: dataMov,
              descricao: `Parcela ${parcela.numParcela}/${negociacao.numParcelas} - ${negociacao.titulo}`,
              createdBy: user.id ?? undefined,
            },
          });
        }

        await tx.ebdHistorico.create({
          data: {
            campoId,
            churchId: negociacao.churchId,
            tipo: "pagamento",
            titulo: "Pagamento de parcela",
            descricao: `Parcela ${parcela.numParcela}/${negociacao.numParcelas} da negociação "${negociacao.titulo}" — R$ ${valor.toFixed(2)}`,
            valor,
            data: dataMov,
            createdBy: user.id ?? undefined,
          },
        });
      }

      // Fecha negociação se todas as parcelas foram pagas
      const allParcelas = await tx.ebdNegociacaoParcela.findMany({ where: { negociacaoId: params.id } });
      const todasPagas = allParcelas.every((p) => p.id === params.parcelaId ? novoPago : p.status === "pago");
      if (todasPagas) {
        await tx.ebdNegociacao.update({ where: { id: params.id }, data: { status: "fechada" } });
      }

      return p;
    });

    return NextResponse.json(serializeBigInts(updated));
  });
}
