import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { resolveScopedFieldId, serializeBigInts } from "@/lib/helpers";

const VALID_TIPOS = ["pagamento", "credito", "desconto", "correcao", "transferencia", "outros"];

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const {
      campoId: reqCampoId, churchId, trimestreId,
      tipo, valor, data, descricao, responsavelId, observacao,
    } = body;
    const campoId = resolveScopedFieldId(user, reqCampoId);
    if (!campoId) return NextResponse.json({ error: "campoId obrigatório" }, { status: 400 });
    if (!churchId || !tipo || !valor || !data) {
      return NextResponse.json({ error: "churchId, tipo, valor e data são obrigatórios" }, { status: 400 });
    }
    if (!VALID_TIPOS.includes(tipo)) {
      return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
    }

    const valorNum = Number(valor);

    const mov = await prisma.$transaction(async (tx) => {
      // Busca/cria o registro financeiro
      let fin = await tx.ebdFinanceiro.findFirst({
        where: { campoId, churchId, trimestreId: trimestreId || null },
      });
      if (!fin) {
        fin = await tx.ebdFinanceiro.create({
          data: { campoId, churchId, trimestreId: trimestreId || null, saldo: 0 },
        });
      }

      const saldoAntes = Number(fin.saldo);
      // Pagamento, crédito e desconto reduzem o saldo; outros aumentam
      const isReducao = ["pagamento", "credito", "desconto"].includes(tipo);
      const saldoDepois = isReducao ? saldoAntes - valorNum : saldoAntes + valorNum;

      await tx.ebdFinanceiro.update({
        where: { id: fin.id },
        data: { saldo: saldoDepois },
      });

      const m = await tx.ebdFinanceiroMovimento.create({
        data: {
          financeiroId: fin.id,
          campoId,
          tipo,
          valor: valorNum,
          saldoAntes,
          saldoDepois,
          data: new Date(data),
          descricao: descricao || null,
          responsavelId: responsavelId || null,
          observacao: observacao || null,
          createdBy: user.id ?? undefined,
        },
      });

      // Histórico
      const tipoMap: Record<string, string> = {
        pagamento: "pagamento", credito: "ajuste", desconto: "ajuste",
        correcao: "ajuste", transferencia: "ajuste", outros: "ajuste",
      };
      const tituloMap: Record<string, string> = {
        pagamento: "Pagamento recebido",
        credito: "Crédito aplicado",
        desconto: "Desconto aplicado",
        correcao: "Correção",
        transferencia: "Transferência",
        outros: "Ajuste",
      };
      await tx.ebdHistorico.create({
        data: {
          campoId,
          churchId,
          tipo: tipoMap[tipo] ?? "ajuste",
          titulo: tituloMap[tipo] ?? tipo,
          descricao: descricao || `Valor: R$ ${valorNum.toFixed(2)}`,
          valor: valorNum,
          referenciaId: m.id,
          data: new Date(data),
          createdBy: user.id ?? undefined,
        },
      });

      return m;
    });

    return NextResponse.json(serializeBigInts(mov), { status: 201 });
  });
}
