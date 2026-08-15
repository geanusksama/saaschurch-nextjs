import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";
import { podeAcessarIgreja } from "@/lib/contasPagarScope";
import { RegraContasPagarError, TX_CONTAS_PAGAR, cancelarConta, recalcularContaCompleta } from "@/lib/contasPagarService";

const INCLUDE_DETALHE = {
  credor: true,
  planoDeConta: { select: { id: true, nome: true, codigo: true } },
  departamento: { select: { id: true, nome: true, cor: true } },
  banco: { select: { id: true, nome: true } },
  church: { select: { id: true, name: true, code: true } },
  parcelas: {
    orderBy: { numeroParcela: "asc" },
    include: {
      pagamentos: { orderBy: { dataPagamento: "asc" }, include: { banco: { select: { id: true, nome: true } } } },
    },
  },
} as const;

async function carregar(id: string) {
  return prisma.contaPagar.findFirst({ where: { id, deletedAt: null }, include: INCLUDE_DETALHE });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const conta = await carregar(id);
    if (!conta) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
    if (!(await podeAcessarIgreja(user, conta.churchId, prisma))) {
      return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    }
    return NextResponse.json(serializeBigInts(conta));
  });
}

/**
 * PATCH — edita os dados cadastrais do título.
 *
 * Valor total, parcelamento e status NÃO são editáveis aqui: mexer neles com
 * pagamento já registrado desmonta o saldo das parcelas. Para isso o caminho é
 * estornar os pagamentos e lançar de novo.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const conta = await carregar(id);
    if (!conta) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
    if (!(await podeAcessarIgreja(user, conta.churchId, prisma))) {
      return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};

    if (body.descricao !== undefined) data.descricao = String(body.descricao).trim();
    if (body.planoDeContaId !== undefined) data.planoDeContaId = body.planoDeContaId || null;
    if (body.credorId !== undefined) data.credorId = body.credorId || null;
    if (body.departamentoId !== undefined) data.departamentoId = body.departamentoId || null;
    if (body.bancoId !== undefined) data.bancoId = body.bancoId || null;
    if (body.formaPagamentoPrevista !== undefined) data.formaPagamentoPrevista = body.formaPagamentoPrevista || null;
    if (body.numeroDocumento !== undefined) data.numeroDocumento = body.numeroDocumento || null;
    if (body.anexoDocumentoUrl !== undefined) data.anexoDocumentoUrl = body.anexoDocumentoUrl || null;
    if (body.observacoes !== undefined) data.observacoes = body.observacoes || null;
    if (body.recorrente !== undefined) data.recorrente = !!body.recorrente;
    if (body.dataEmissao) data.dataEmissao = new Date(`${String(body.dataEmissao).slice(0, 10)}T00:00:00Z`);

    if (!Object.keys(data).length) {
      return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
    }

    await prisma.contaPagar.update({ where: { id }, data });
    const atualizada = await carregar(id);
    return NextResponse.json(serializeBigInts(atualizada));
  });
}

/**
 * DELETE — apaga a conta.
 *
 * Sem histórico de pagamento, some de verdade (parcelas e pagamentos vão junto
 * pelo cascade do banco). Com histórico, vira cancelamento lógico para não
 * deixar despesa órfã no livro caixa. Pagamento ativo bloqueia: estorne antes.
 * Ver cancelarConta().
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const conta = await prisma.contaPagar.findFirst({ where: { id, deletedAt: null }, select: { id: true, churchId: true } });
    if (!conta) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
    if (!(await podeAcessarIgreja(user, conta.churchId, prisma))) {
      return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    }

    try {
      const resultado = await prisma.$transaction(async (tx) => cancelarConta(tx, id), TX_CONTAS_PAGAR);
      return NextResponse.json({ ok: true, ...resultado });
    } catch (e) {
      if (e instanceof RegraContasPagarError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      throw e;
    }
  });
}

/** POST — recalcula a conta (usado após virada de dia / correção manual). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const conta = await prisma.contaPagar.findFirst({ where: { id, deletedAt: null }, select: { id: true, churchId: true } });
    if (!conta) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
    if (!(await podeAcessarIgreja(user, conta.churchId, prisma))) {
      return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    }
    const statusGeral = await prisma.$transaction(async (tx) => recalcularContaCompleta(tx, id), TX_CONTAS_PAGAR);
    return NextResponse.json({ ok: true, statusGeral });
  });
}
