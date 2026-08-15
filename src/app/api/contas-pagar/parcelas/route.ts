import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";
import { escopoDeIgrejas } from "@/lib/contasPagarScope";
import { condicaoDeColuna } from "@/lib/contasPagarFiltros";

/**
 * GET /api/contas-pagar/parcelas — a visão do dia a dia da tesouraria
 * ("o que vence essa semana", "o que está vencido", "onde sobrou saldo").
 *
 * Aceita os mesmos filtros da visão por título, mais:
 *   comSaldo=1     só parcelas com saldo residual > 0 e algum pagamento feito
 *   vencidas=1     vencimento < hoje e ainda não quitada
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

    const contaWhere: Record<string, unknown> = { deletedAt: null };
    const where: Record<string, unknown> = {
      church: escopo.churchWhere,
      contaPagar: contaWhere,
    };

    const q = (sp.get("q") ?? "").trim();
    if (q) {
      contaWhere.OR = [
        { descricao: { contains: q, mode: "insensitive" } },
        { numero: { contains: q, mode: "insensitive" } },
        { numeroDocumento: { contains: q, mode: "insensitive" } },
        { credor: { nome: { contains: q, mode: "insensitive" } } },
      ];
    }

    // Mesmos filtros de coluna da visão por título: lista de ids, com "sem"
    // para o campo não informado.
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
    if (sp.get("parceladas") === "1") and.push({ numeroParcelas: { gt: 1 } });
    if (and.length) contaWhere.AND = and;
    const statusAprovacao = sp.get("statusAprovacao");
    if (statusAprovacao) contaWhere.statusAprovacao = { in: statusAprovacao.split(",").filter(Boolean) };

    const status = sp.get("status");
    if (status) where.status = { in: status.split(",").filter(Boolean) };

    const vencDe = sp.get("vencimentoDe");
    const vencAte = sp.get("vencimentoAte");
    const filtroVenc: Record<string, Date> = {};
    if (vencDe) filtroVenc.gte = new Date(`${vencDe}T00:00:00Z`);
    if (vencAte) filtroVenc.lte = new Date(`${vencAte}T00:00:00Z`);

    const hoje = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
    if (sp.get("vencidas") === "1") {
      filtroVenc.lt = hoje;
      where.status = { in: ["ATRASADO", "PARCIAL", "PENDENTE"] };
    }
    if (Object.keys(filtroVenc).length) where.dataVencimento = filtroVenc;

    // Saldo residual: parcela que já recebeu algo e ainda deve — é o relatório
    // do pastor pago pela metade.
    if (sp.get("comSaldo") === "1") {
      where.valorSaldo = { gt: 0 };
      where.valorPago = { gt: 0 };
    }

    const page = Math.max(1, Number(sp.get("page")) || 1);
    const pageSize = Math.min(Math.max(1, Number(sp.get("pageSize")) || 25), 500);

    const ordenaveis = new Set(["dataVencimento", "valorParcela", "valorSaldo", "status"]);
    const sortBy = ordenaveis.has(sp.get("sortBy") ?? "") ? (sp.get("sortBy") as string) : "dataVencimento";
    const sortDir = sp.get("sortDir") === "desc" ? "desc" : "asc";

    const [data, total, somas] = await Promise.all([
      prisma.parcelaContaPagar.findMany({
        where,
        include: {
          contaPagar: {
            select: {
              id: true, numero: true, descricao: true, numeroDocumento: true,
              statusAprovacao: true, valorTotal: true,
              credor: { select: { id: true, nome: true, tipoCredor: true } },
              planoDeConta: { select: { id: true, nome: true, codigo: true } },
              departamento: { select: { id: true, nome: true, cor: true } },
              banco: { select: { id: true, nome: true } },
            },
          },
          church: { select: { id: true, name: true, code: true } },
        },
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.parcelaContaPagar.count({ where }),
      prisma.parcelaContaPagar.aggregate({
        where,
        _sum: { valorParcela: true, valorPago: true, valorSaldo: true },
      }),
    ]);

    return NextResponse.json(
      serializeBigInts({
        data,
        total,
        page,
        pageSize,
        totais: {
          valorParcela: somas._sum.valorParcela ?? 0,
          valorPago: somas._sum.valorPago ?? 0,
          valorSaldo: somas._sum.valorSaldo ?? 0,
        },
      })
    );
  });
}
