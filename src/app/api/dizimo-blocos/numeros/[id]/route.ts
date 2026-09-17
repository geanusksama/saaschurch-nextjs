import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { podeAcessarIgreja } from "@/lib/contasPagarScope";

/**
 * DELETE /api/dizimo-blocos/numeros/[id] — tira UM número da cartela.
 *
 * Serve para o talão que veio com folha rasgada, número borrado ou faixa
 * digitada errada no cadastro: o número existe no sistema mas não existe no
 * papel, e deixá-lo na lista faria alguém tentar usá-lo.
 *
 * O QUE SE PROTEGE AQUI é o vínculo com o dinheiro, não a linha.
 *
 *   - LIVRE → sai sem discussão.
 *   - USADO, mas com o lançamento já apagado (`livro_caixa_id` nulo, efeito do
 *     ON DELETE SET NULL) → sai. Esse é justamente o número preso: sem esta
 *     porta ele ficaria queimado para sempre, marcado como gasto sem nada que
 *     comprove o gasto.
 *   - USADO com lançamento vivo → NÃO sai. Apagar aqui deixaria o dízimo no
 *     livro caixa dizendo "recibo 7" sem nada que prove de qual talão veio, e
 *     liberaria o 7 para ser lançado de novo — o contrário do que este módulo
 *     existe para fazer. Primeiro se exclui o lançamento.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;

    const numero = await prisma.dizimoNumero.findUnique({
      where: { id },
      select: {
        id: true, numero: true, status: true, churchId: true, livroCaixaId: true,
        bloco: { select: { numeroBloco: true } },
        livroCaixa: { select: { id: true, dataLancamento: true, favorecido: true, valor: true } },
      },
    });
    if (!numero) return NextResponse.json({ error: "Número não encontrado." }, { status: 404 });

    if (!(await podeAcessarIgreja(user, numero.churchId, prisma))) {
      return NextResponse.json({ error: "Sem acesso a esta igreja." }, { status: 403 });
    }

    if (numero.livroCaixaId && numero.livroCaixa) {
      const quando = new Date(numero.livroCaixa.dataLancamento)
        .toLocaleDateString("pt-BR", { timeZone: "UTC" });
      return NextResponse.json(
        {
          error: `O número ${numero.numero} está preso ao dízimo de ${quando}${numero.livroCaixa.favorecido ? ` (${numero.livroCaixa.favorecido})` : ""}. Exclua o lançamento primeiro — apagar o número aqui deixaria esse dízimo sem o recibo que o comprova.`,
        },
        { status: 409 }
      );
    }

    await prisma.dizimoNumero.delete({ where: { id: numero.id } });

    return NextResponse.json({
      ok: true,
      numero: numero.numero,
      // A tela avisa quando o que saiu era um número marcado como gasto: é uma
      // exclusão de outra natureza e a pessoa precisa saber o que fez.
      estavaUsado: numero.status !== "LIVRE",
    });
  });
}
