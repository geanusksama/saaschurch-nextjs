import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";
import { escopoDeIgrejas, igrejaDeGravacao, podeAcessarIgreja } from "@/lib/contasPagarScope";
import { condicaoDeColuna } from "@/lib/contasPagarFiltros";
import {
  RegraContasPagarError,
  TX_CONTAS_PAGAR,
  alcadaDaIgreja,
  aprovacaoInicial,
  criarContaComParcelas,
} from "@/lib/contasPagarService";

const INCLUDE_LISTA = {
  // memberId/tipoPessoa/cpfCnpj vêm junto porque a tela de despesa preenche o
  // favorecido a partir do credor — membro precisa de member_id e ROL.
  credor: {
    select: {
      id: true, nome: true, tipoCredor: true, tipoPessoa: true, cpfCnpj: true, memberId: true,
      favorecidoChurchId: true,
      member: { select: { id: true, fullName: true, rol: true } },
      igrejaFavorecida: { select: { id: true, name: true } },
    },
  },
  planoDeConta: { select: { id: true, nome: true, codigo: true } },
  departamento: { select: { id: true, nome: true, cor: true } },
  banco: { select: { id: true, nome: true } },
  church: { select: { id: true, name: true, code: true, regional: { select: { id: true, name: true } } } },
  parcelas: {
    orderBy: { numeroParcela: "asc" },
    select: {
      id: true, numeroParcela: true, totalParcelas: true, valorParcela: true,
      valorPago: true, valorSaldo: true, dataVencimento: true, status: true,
    },
  },
} as const;

/** GET /api/contas-pagar — lista os títulos com os filtros da tela. */
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

    const q = (sp.get("q") ?? "").trim();
    if (q) {
      where.OR = [
        { descricao: { contains: q, mode: "insensitive" } },
        { numero: { contains: q, mode: "insensitive" } },
        { numeroDocumento: { contains: q, mode: "insensitive" } },
        { credor: { nome: { contains: q, mode: "insensitive" } } },
      ];
    }

    const listaOuNada = (chave: string) => {
      const raw = sp.get(chave);
      return raw ? raw.split(",").filter(Boolean) : null;
    };

    const aprovacao = listaOuNada("statusAprovacao");
    if (aprovacao) where.statusAprovacao = { in: aprovacao };

    // Credor, plano de contas, departamento e banco aceitam vários ids (os
    // filtros de coluna da tabela) e o valor "sem" para o campo não informado.
    // Vão no AND porque `where.OR` já é da busca textual.
    const and: Record<string, unknown>[] = [];
    for (const [chave, campo] of [
      ["credorId", "credorId"],
      ["planoDeContaId", "planoDeContaId"],
      ["departamentoId", "departamentoId"],
      ["bancoId", "bancoId"],
    ] as const) {
      const cond = condicaoDeColuna(sp.get(chave), campo);
      if (cond) and.push(cond);
    }
    if (and.length) where.AND = and;

    // Só títulos parcelados — evita pular para a visão por parcela só para
    // descobrir quais contas foram divididas.
    if (sp.get("parceladas") === "1") where.numeroParcelas = { gt: 1 };

    const emissaoDe = sp.get("emissaoDe");
    const emissaoAte = sp.get("emissaoAte");
    if (emissaoDe || emissaoAte) {
      const filtro: Record<string, Date> = {};
      if (emissaoDe) filtro.gte = new Date(`${emissaoDe}T00:00:00Z`);
      if (emissaoAte) filtro.lte = new Date(`${emissaoAte}T00:00:00Z`);
      where.dataEmissao = filtro;
    }

    const valorMin = sp.get("valorMin");
    const valorMax = sp.get("valorMax");
    if (valorMin || valorMax) {
      const filtro: Record<string, number> = {};
      if (valorMin) filtro.gte = Number(valorMin);
      if (valorMax) filtro.lte = Number(valorMax);
      where.valorTotal = filtro;
    }

    // Filtros que olham para as PARCELAS entram todos num único `some`: assim a
    // mesma parcela precisa satisfazer faixa de vencimento + status + saldo, e
    // as duas visões da tela (por parcela / por conta) devolvem o mesmo
    // conjunto de títulos.
    //
    // Status aqui é "o título tem parcela nesse status" — e NÃO status_geral.
    // Um título com 1 parcela paga e 3 pendentes tem status_geral PARCIAL;
    // filtrar por "Pendente" precisa continuar mostrando ele, senão a visão por
    // conta some com o registro que a visão por parcela lista.
    const parcelaSome: Record<string, unknown> = {};

    const status = listaOuNada("status");
    if (status) parcelaSome.status = { in: status };

    const vencDe = sp.get("vencimentoDe");
    const vencAte = sp.get("vencimentoAte");
    if (vencDe || vencAte) {
      const filtro: Record<string, Date> = {};
      if (vencDe) filtro.gte = new Date(`${vencDe}T00:00:00Z`);
      if (vencAte) filtro.lte = new Date(`${vencAte}T00:00:00Z`);
      parcelaSome.dataVencimento = filtro;
    }

    // Saldo residual: parcela que já recebeu algo e ainda deve.
    if (sp.get("comSaldo") === "1") {
      parcelaSome.valorSaldo = { gt: 0 };
      parcelaSome.valorPago = { gt: 0 };
    }

    if (Object.keys(parcelaSome).length) where.parcelas = { some: parcelaSome };

    const page = Math.max(1, Number(sp.get("page")) || 1);
    const pageSize = Math.min(Math.max(1, Number(sp.get("pageSize")) || 25), 500);

    const ordenaveis = new Set(["dataEmissao", "valorTotal", "numero", "statusGeral", "createdAt"]);
    const sortBy = ordenaveis.has(sp.get("sortBy") ?? "") ? (sp.get("sortBy") as string) : "dataEmissao";
    const sortDir = sp.get("sortDir") === "asc" ? "asc" : "desc";

    const [data, total, somas] = await Promise.all([
      prisma.contaPagar.findMany({
        where,
        include: INCLUDE_LISTA,
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.contaPagar.count({ where }),
      prisma.contaPagar.aggregate({ where, _sum: { valorTotal: true } }),
    ]);

    return NextResponse.json(
      serializeBigInts({ data, total, valorTotal: somas._sum.valorTotal ?? 0, page, pageSize })
    );
  });
}

/** POST /api/contas-pagar — cria o título e gera as parcelas. */
export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));

    // Perfil igreja sempre cai na própria igreja; campo/admin podem escolher —
    // mas só dentro do campo deles, o que exige ir ao banco conferir.
    const igreja = igrejaDeGravacao(user, body.churchId);
    if (!igreja.ok) return NextResponse.json({ error: igreja.erro }, { status: 403 });
    if (!(await podeAcessarIgreja(user, igreja.churchId, prisma))) {
      return NextResponse.json({ error: "Sem acesso a esta igreja." }, { status: 403 });
    }

    if (!String(body.descricao ?? "").trim()) {
      return NextResponse.json({ error: "Descrição é obrigatória." }, { status: 400 });
    }
    if (!body.dataEmissao) {
      return NextResponse.json({ error: "Data de emissão é obrigatória." }, { status: 400 });
    }
    if (!body.primeiroVencimento) {
      return NextResponse.json({ error: "Data do primeiro vencimento é obrigatória." }, { status: 400 });
    }

    try {
      const conta = await prisma.$transaction(async (tx) => {
        const alcada = await alcadaDaIgreja(tx, igreja.churchId);
        return criarContaComParcelas(tx, {
          churchId: igreja.churchId,
          descricao: String(body.descricao).trim(),
          valorTotal: body.valorTotal,
          dataEmissao: String(body.dataEmissao),
          primeiroVencimento: String(body.primeiroVencimento),
          numeroParcelas: Number(body.numeroParcelas) || 1,
          parcelado: !!body.parcelado,
          recorrente: !!body.recorrente,
          valoresManuais: body.valoresManuais ?? null,
          vencimentosManuais: body.vencimentosManuais ?? null,
          planoDeContaId: body.planoDeContaId ?? null,
          credorId: body.credorId ?? null,
          departamentoId: body.departamentoId ?? null,
          bancoId: body.bancoId ?? null,
          formaPagamentoPrevista: body.formaPagamentoPrevista ?? null,
          numeroDocumento: body.numeroDocumento ?? null,
          anexoDocumentoUrl: body.anexoDocumentoUrl ?? null,
          observacoes: body.observacoes ?? null,
          criadoPor: user.id,
          statusAprovacao: aprovacaoInicial(body.valorTotal, alcada),
        });
      }, TX_CONTAS_PAGAR);

      const completa = await prisma.contaPagar.findUnique({ where: { id: conta.id }, include: INCLUDE_LISTA });
      return NextResponse.json(serializeBigInts(completa), { status: 201 });
    } catch (e) {
      if (e instanceof RegraContasPagarError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      const msg = e instanceof Error ? e.message : "Erro ao criar a conta a pagar.";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  });
}
