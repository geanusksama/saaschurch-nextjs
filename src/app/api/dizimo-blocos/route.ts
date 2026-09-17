import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";
import { escopoDeIgrejas, podeAcessarIgreja } from "@/lib/contasPagarScope";
import {
  MAX_NUMEROS_POR_BLOCO,
  STATUS_LIVRE,
  STATUS_USADO,
  validarFaixa,
} from "@/lib/dizimoNumeracao";

/**
 * Blocos de numeração de dízimo.
 *
 * Escopo: reaproveita `escopoDeIgrejas` do Contas a Pagar — a mesma regra que
 * impede tesoureiro de uma igreja enxergar dinheiro de outra vale aqui, porque
 * o número do recibo é a chave do dinheiro.
 */

const PAGE_SIZE_PADRAO = 50;
const PAGE_SIZE_MAX = 200;

/**
 * GET /api/dizimo-blocos — a tabela da tela: um bloco por linha, com quanto já
 * foi gasto dele.
 *
 * A contagem de usados sai de um `groupBy` só, e não de um count por linha:
 * com 200 igrejas e alguns blocos cada, a segunda forma viraria centenas de
 * consultas por abertura de tela.
 */
export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const sp = new URL(req.url).searchParams;

    const escopo = escopoDeIgrejas(user, {
      churchId: sp.get("churchId") ?? undefined,
      regionalId: sp.get("regionalId") ?? undefined,
      campoId: sp.get("campoId") ?? undefined,
    });
    if (!escopo.ok) return NextResponse.json({ error: escopo.erro }, { status: 403 });

    const where: Record<string, unknown> = { deletedAt: null, church: escopo.churchWhere };

    // Campo único da tela: nome e código da igreja, mais o número do bloco
    // quando o que se digitou é um número. O código entra aqui porque a tela
    // não tem mais um seletor de igreja ao lado — este campo é o único jeito
    // de chegar na igreja, e a secretaria procura pelo código tanto quanto
    // pelo nome.
    const q = (sp.get("q") ?? "").trim();
    if (q) {
      const comoNumero = /^\d+$/.test(q) ? Number(q) : null;
      where.OR = [
        { church: { name: { contains: q, mode: "insensitive" } } },
        { church: { code: { contains: q, mode: "insensitive" } } },
        ...(comoNumero !== null ? [{ numeroBloco: comoNumero }] : []),
      ];
    }

    const pagina = Math.max(1, Number(sp.get("pagina") ?? 1) || 1);
    const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, Number(sp.get("pageSize") ?? PAGE_SIZE_PADRAO) || PAGE_SIZE_PADRAO));

    const [blocos, total] = await Promise.all([
      prisma.dizimoBloco.findMany({
        where,
        orderBy: [{ church: { name: "asc" } }, { numeroBloco: "asc" }],
        skip: (pagina - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, numeroBloco: true, numeroInicial: true, numeroFinal: true,
          observacao: true, ativo: true, createdAt: true,
          church: {
            select: {
              id: true, name: true, code: true,
              regional: { select: { id: true, name: true } },
              dizimoNumeracaoConfig: { select: { exige: true } },
            },
          },
        },
      }),
      prisma.dizimoBloco.count({ where }),
    ]);

    // Usados por bloco, numa consulta só, restrita aos blocos da página.
    const ids = blocos.map((b) => b.id);
    const usados = ids.length
      ? await prisma.dizimoNumero.groupBy({
          by: ["blocoId", "status"],
          where: { blocoId: { in: ids } },
          _count: { _all: true },
        })
      : [];

    const porBloco = new Map<string, { usados: number; livres: number; reservados: number }>();
    for (const linha of usados) {
      const atual = porBloco.get(linha.blocoId) ?? { usados: 0, livres: 0, reservados: 0 };
      const n = linha._count._all;
      if (linha.status === STATUS_USADO) atual.usados += n;
      else if (linha.status === STATUS_LIVRE) atual.livres += n;
      else atual.reservados += n;
      porBloco.set(linha.blocoId, atual);
    }

    const data = blocos.map((b) => {
      const c = porBloco.get(b.id) ?? { usados: 0, livres: 0, reservados: 0 };
      return {
        id: b.id,
        numeroBloco: b.numeroBloco,
        numeroInicial: b.numeroInicial,
        numeroFinal: b.numeroFinal,
        observacao: b.observacao,
        ativo: b.ativo,
        createdAt: b.createdAt,
        // Contagem real das linhas, não `fim - início + 1`: números podem ser
        // excluídos um a um (folha rasgada, número borrado), e aí a conta
        // aritmética passaria a mentir para sempre.
        quantidade: c.usados + c.reservados + c.livres,
        usados: c.usados,
        reservados: c.reservados,
        livres: c.livres,
        church: {
          id: b.church.id,
          name: b.church.name,
          code: b.church.code,
          regional: b.church.regional,
          exigeNumeracao: b.church.dizimoNumeracaoConfig?.exige ?? false,
        },
      };
    });

    return NextResponse.json(serializeBigInts({ data, total, pagina, pageSize }));
  });
}

/**
 * POST /api/dizimo-blocos — cadastra o bloco e materializa a cartela.
 *
 * Os números nascem todos aqui, num `createMany` único. Gravar linha a linha
 * estouraria o limite de transação interativa do pooler (ver AGENTS.md), e
 * guardar só a faixa deixaria a tela de "usados x livres" virar cálculo em
 * JavaScript em cima da tabela inteira.
 */
export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });

    const churchId = String(body.churchId ?? "").trim();
    const numeroBloco = Number(body.numeroBloco);
    const numeroInicial = Number(body.numeroInicial);
    const numeroFinal = Number(body.numeroFinal);
    const observacao = String(body.observacao ?? "").trim() || null;

    if (!churchId) return NextResponse.json({ error: "Selecione a igreja." }, { status: 400 });
    if (!Number.isSafeInteger(numeroBloco) || numeroBloco <= 0) {
      return NextResponse.json({ error: "Informe o número do bloco." }, { status: 400 });
    }
    const erroFaixa = validarFaixa({ numeroInicial, numeroFinal });
    if (erroFaixa) return NextResponse.json({ error: erroFaixa }, { status: 400 });

    if (!(await podeAcessarIgreja(user, churchId, prisma))) {
      return NextResponse.json({ error: "Sem acesso a esta igreja." }, { status: 403 });
    }

    // Bloco repetido na mesma igreja.
    const jaExiste = await prisma.dizimoBloco.findFirst({
      where: { churchId, numeroBloco, deletedAt: null },
      select: { id: true },
    });
    if (jaExiste) {
      return NextResponse.json(
        { error: `A igreja já tem o bloco ${numeroBloco} cadastrado.` },
        { status: 409 }
      );
    }

    // Sobreposição de faixa. O unique de (church_id, numero) barraria de
    // qualquer jeito, mas com uma mensagem de banco — aqui o tesoureiro lê
    // QUAL bloco está no caminho.
    const conflito = await prisma.dizimoBloco.findFirst({
      where: {
        churchId,
        deletedAt: null,
        numeroInicial: { lte: numeroFinal },
        numeroFinal: { gte: numeroInicial },
      },
      select: { numeroBloco: true, numeroInicial: true, numeroFinal: true },
    });
    if (conflito) {
      return NextResponse.json(
        {
          error: `A faixa ${numeroInicial}–${numeroFinal} encosta no bloco ${conflito.numeroBloco} desta igreja (${conflito.numeroInicial}–${conflito.numeroFinal}). Cada número só pode existir uma vez na igreja.`,
        },
        { status: 409 }
      );
    }

    const quantidade = numeroFinal - numeroInicial + 1;
    if (quantidade > MAX_NUMEROS_POR_BLOCO) {
      return NextResponse.json({ error: "Faixa acima do limite por bloco." }, { status: 400 });
    }

    const bloco = await prisma.dizimoBloco.create({
      data: { churchId, numeroBloco, numeroInicial, numeroFinal, observacao, createdBy: user.id },
      select: { id: true, numeroBloco: true, numeroInicial: true, numeroFinal: true },
    });

    const numeros = Array.from({ length: quantidade }, (_, i) => ({
      blocoId: bloco.id,
      churchId,
      numero: numeroInicial + i,
      status: STATUS_LIVRE,
    }));

    try {
      await prisma.dizimoNumero.createMany({ data: numeros, skipDuplicates: false });
    } catch (err) {
      // A cartela é o bloco: bloco sem números é uma linha que promete recibo
      // e não entrega nenhum. Se a geração falhou, o cadastro não aconteceu.
      await prisma.dizimoBloco.delete({ where: { id: bloco.id } }).catch(() => {});
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("dizimo_numeros_church_id_numero_key")) {
        return NextResponse.json(
          { error: "Algum número desta faixa já pertence a outro bloco da igreja." },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: "Não foi possível gerar os números do bloco." }, { status: 500 });
    }

    return NextResponse.json(serializeBigInts({ ...bloco, quantidade }), { status: 201 });
  });
}
