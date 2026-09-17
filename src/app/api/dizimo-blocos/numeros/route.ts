import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";
import { podeAcessarIgreja } from "@/lib/contasPagarScope";
import {
  MSG,
  STATUS_LIVRE,
  STATUS_RESERVADO,
  STATUS_USADO,
  parseNumeroRecibo,
} from "@/lib/dizimoNumeracao";

/**
 * Os números vistos do lado do lançamento de dízimo.
 *
 * GET  — "esta igreja exige número?", "quais estão livres?", "o 137 serve?"
 * POST — reservar / confirmar / liberar, em volta da gravação no livro caixa.
 *
 * Por que três ações e não uma: o insert do livro caixa acontece no navegador,
 * direto pelo cliente Supabase, e não dentro de uma transação com esta rota.
 * Marcar o número DEPOIS do insert abriria a janela em que dois tesoureiros
 * gravam o mesmo recibo; marcar antes e não voltar atrás queimaria o número
 * quando a gravação falhasse. Então: reserva (atômica), grava, confirma — e
 * libera se a gravação não foi.
 */

/** Reserva órfã vira livre de novo. O tesoureiro fechou a aba no meio. */
const MINUTOS_PARA_EXPIRAR_RESERVA = 15;

const PAGE_SIZE_MAX = 500;

function expiradaAntesDe() {
  return new Date(Date.now() - MINUTOS_PARA_EXPIRAR_RESERVA * 60_000);
}

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const sp = new URL(req.url).searchParams;
    const churchId = (sp.get("churchId") ?? "").trim();
    if (!churchId) return NextResponse.json({ error: "Informe a igreja." }, { status: 400 });
    if (!(await podeAcessarIgreja(user, churchId, prisma))) {
      return NextResponse.json({ error: "Sem acesso a esta igreja." }, { status: 403 });
    }

    const config = await prisma.dizimoNumeracaoConfig.findUnique({
      where: { churchId },
      select: { exige: true },
    });
    const exigeNumeracao = config?.exige ?? false;

    // Validação de um número específico — é o que a tela chama ao sair do campo
    // e ao salvar.
    const numeroPedido = parseNumeroRecibo(sp.get("numero"));
    if (sp.get("numero") !== null) {
      if (numeroPedido === null) {
        return NextResponse.json({
          exigeNumeracao,
          ok: false,
          motivo: "INVALIDO",
          mensagem: "O número do recibo é um número inteiro positivo.",
        });
      }

      const linha = await prisma.dizimoNumero.findUnique({
        where: { churchId_numero: { churchId, numero: numeroPedido } },
        select: {
          id: true, numero: true, status: true, usadoEm: true,
          bloco: { select: { id: true, numeroBloco: true, ativo: true, deletedAt: true } },
          livroCaixa: { select: { id: true, dataLancamento: true, favorecido: true, valor: true } },
        },
      });

      // Fora de qualquer bloco DESTA igreja. O número pode até existir na
      // igreja vizinha — e é exatamente por isso que a resposta é a mesma:
      // ninguém descobre o talão do outro por tentativa e erro.
      if (!linha || !linha.bloco || linha.bloco.deletedAt) {
        return NextResponse.json({
          exigeNumeracao,
          ok: false,
          motivo: "FORA_DO_BLOCO",
          mensagem: MSG.foraDoBloco(numeroPedido),
        });
      }

      if (!linha.bloco.ativo) {
        return NextResponse.json({
          exigeNumeracao,
          ok: false,
          motivo: "BLOCO_INATIVO",
          mensagem: `O número ${numeroPedido} está no bloco ${linha.bloco.numeroBloco}, que foi inativado.`,
        });
      }

      if (linha.status === STATUS_USADO) {
        const quando = linha.livroCaixa?.dataLancamento
          ? new Date(linha.livroCaixa.dataLancamento).toLocaleDateString("pt-BR", { timeZone: "UTC" })
          : null;
        return NextResponse.json(
          serializeBigInts({
            exigeNumeracao,
            ok: false,
            motivo: "JA_USADO",
            mensagem: MSG.jaUsado(numeroPedido, quando, linha.livroCaixa?.favorecido),
            lancamento: linha.livroCaixa,
          })
        );
      }

      if (linha.status === STATUS_RESERVADO && linha.usadoEm && linha.usadoEm > expiradaAntesDe()) {
        return NextResponse.json({
          exigeNumeracao,
          ok: false,
          motivo: "RESERVADO",
          mensagem: `O número ${numeroPedido} está sendo usado em outro lançamento neste momento. Escolha outro.`,
        });
      }

      return NextResponse.json(
        serializeBigInts({
          exigeNumeracao,
          ok: true,
          numeroId: linha.id,
          numero: linha.numero,
          bloco: { id: linha.bloco.id, numeroBloco: linha.bloco.numeroBloco },
        })
      );
    }

    // Lista para a lupa: os números livres da igreja, na ordem do talão.
    const pagina = Math.max(1, Number(sp.get("pagina") ?? 1) || 1);
    const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, Number(sp.get("pageSize") ?? 200) || 200));
    const blocoId = (sp.get("blocoId") ?? "").trim();

    const where: Record<string, unknown> = {
      churchId,
      status: STATUS_LIVRE,
      bloco: { ativo: true, deletedAt: null },
    };
    if (blocoId) where.blocoId = blocoId;

    const [livres, total, blocos] = await Promise.all([
      prisma.dizimoNumero.findMany({
        where,
        orderBy: { numero: "asc" },
        skip: (pagina - 1) * pageSize,
        take: pageSize,
        select: { id: true, numero: true, bloco: { select: { id: true, numeroBloco: true } } },
      }),
      prisma.dizimoNumero.count({ where }),
      prisma.dizimoBloco.findMany({
        where: { churchId, ativo: true, deletedAt: null },
        orderBy: { numeroBloco: "asc" },
        take: 200,
        select: { id: true, numeroBloco: true, numeroInicial: true, numeroFinal: true },
      }),
    ]);

    return NextResponse.json(
      serializeBigInts({ exigeNumeracao, temBloco: blocos.length > 0, blocos, data: livres, total, pagina, pageSize })
    );
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });

    const acao = String(body.acao ?? "").trim().toLowerCase();
    const churchId = String(body.churchId ?? "").trim();
    if (!churchId) return NextResponse.json({ error: "Informe a igreja." }, { status: 400 });
    if (!(await podeAcessarIgreja(user, churchId, prisma))) {
      return NextResponse.json({ error: "Sem acesso a esta igreja." }, { status: 403 });
    }

    if (acao === "reservar") return reservar(body, churchId, user.id);
    if (acao === "confirmar") return confirmar(body, churchId);
    if (acao === "liberar") return liberar(body, churchId);
    return NextResponse.json({ error: "Ação desconhecida." }, { status: 400 });
  });
}

/**
 * Pega o número para este lançamento, se ninguém pegou antes.
 *
 * O `updateMany` com o status no `where` é o que faz isso ser à prova de dois
 * tesoureiros salvando no mesmo segundo: o Postgres deixa uma das duas
 * atualizações encontrar a linha e a outra volta com `count: 0`. Um
 * `findUnique` seguido de `update` teria a janela entre as duas.
 */
async function reservar(body: Record<string, unknown>, churchId: string, userId: string | null) {
  const numero = parseNumeroRecibo(body.numero as string | number);
  if (numero === null) return NextResponse.json({ error: "Número inválido." }, { status: 400 });

  const linha = await prisma.dizimoNumero.findUnique({
    where: { churchId_numero: { churchId, numero } },
    select: {
      id: true, status: true, usadoEm: true,
      bloco: { select: { numeroBloco: true, ativo: true, deletedAt: true } },
      livroCaixa: { select: { id: true, dataLancamento: true, favorecido: true } },
    },
  });

  if (!linha || !linha.bloco || linha.bloco.deletedAt) {
    return NextResponse.json({ error: MSG.foraDoBloco(numero), motivo: "FORA_DO_BLOCO" }, { status: 409 });
  }
  if (!linha.bloco.ativo) {
    return NextResponse.json(
      { error: `O bloco ${linha.bloco.numeroBloco} está inativo.`, motivo: "BLOCO_INATIVO" },
      { status: 409 }
    );
  }
  if (linha.status === STATUS_USADO) {
    const quando = linha.livroCaixa?.dataLancamento
      ? new Date(linha.livroCaixa.dataLancamento).toLocaleDateString("pt-BR", { timeZone: "UTC" })
      : null;
    return NextResponse.json(
      { error: MSG.jaUsado(numero, quando, linha.livroCaixa?.favorecido), motivo: "JA_USADO" },
      { status: 409 }
    );
  }

  // Reserva viva de outro lançamento fica de pé; reserva velha é abandono de
  // aba fechada e pode ser retomada.
  const limite = expiradaAntesDe();
  const podeRetomar = linha.status === STATUS_RESERVADO && (!linha.usadoEm || linha.usadoEm <= limite);
  if (linha.status === STATUS_RESERVADO && !podeRetomar) {
    return NextResponse.json(
      { error: `O número ${numero} está sendo usado em outro lançamento neste momento.`, motivo: "RESERVADO" },
      { status: 409 }
    );
  }

  const { count } = await prisma.dizimoNumero.updateMany({
    where: {
      id: linha.id,
      churchId,
      livroCaixaId: null,
      ...(podeRetomar
        ? { status: STATUS_RESERVADO, usadoEm: { lte: limite } }
        : { status: STATUS_LIVRE }),
    },
    data: { status: STATUS_RESERVADO, usadoEm: new Date(), usadoPor: userId },
  });

  if (count === 0) {
    return NextResponse.json(
      { error: `O número ${numero} acabou de ser usado em outro lançamento. Escolha o próximo livre.`, motivo: "CORRIDA" },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true, numeroId: linha.id, numero });
}

/** O livro caixa gravou: o número passa a apontar para o lançamento. */
async function confirmar(body: Record<string, unknown>, churchId: string) {
  const numeroId = String(body.numeroId ?? "").trim();
  const livroCaixaId = String(body.livroCaixaId ?? "").trim();
  if (!numeroId || !livroCaixaId) {
    return NextResponse.json({ error: "Informe o número reservado e o lançamento." }, { status: 400 });
  }

  const { count } = await prisma.dizimoNumero.updateMany({
    where: { id: numeroId, churchId, status: STATUS_RESERVADO },
    data: { status: STATUS_USADO, livroCaixaId, usadoEm: new Date() },
  });

  if (count === 0) {
    return NextResponse.json({ error: "A reserva do número não está mais válida." }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}

/** A gravação não foi: devolve o número para a cartela. */
async function liberar(body: Record<string, unknown>, churchId: string) {
  const numeroId = String(body.numeroId ?? "").trim();
  if (!numeroId) return NextResponse.json({ error: "Informe o número reservado." }, { status: 400 });

  // `livroCaixaId: null` no where é o cinto de segurança: número já confirmado
  // nunca volta para livre por esta porta.
  await prisma.dizimoNumero.updateMany({
    where: { id: numeroId, churchId, status: STATUS_RESERVADO, livroCaixaId: null },
    data: { status: STATUS_LIVRE, usadoEm: null, usadoPor: null },
  });
  return NextResponse.json({ ok: true });
}
