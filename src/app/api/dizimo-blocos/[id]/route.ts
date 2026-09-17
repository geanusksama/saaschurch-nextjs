import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";
import { podeAcessarIgreja } from "@/lib/contasPagarScope";
import { STATUS_LIVRE, STATUS_USADO } from "@/lib/dizimoNumeracao";

async function carregarComAcesso(id: string, user: Parameters<typeof podeAcessarIgreja>[0]) {
  const bloco = await prisma.dizimoBloco.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true, churchId: true, numeroBloco: true, numeroInicial: true, numeroFinal: true,
      observacao: true, ativo: true,
      church: { select: { id: true, name: true, code: true, regional: { select: { id: true, name: true } } } },
    },
  });
  if (!bloco) return { erro: NextResponse.json({ error: "Bloco não encontrado." }, { status: 404 }) };
  if (!(await podeAcessarIgreja(user, bloco.churchId, prisma))) {
    return { erro: NextResponse.json({ error: "Sem acesso a esta igreja." }, { status: 403 }) };
  }
  return { bloco };
}

/** GET /api/dizimo-blocos/[id] — o bloco com o resumo da cartela. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const { bloco, erro } = await carregarComAcesso(id, user);
    if (erro) return erro;

    const contagem = await prisma.dizimoNumero.groupBy({
      by: ["status"],
      where: { blocoId: bloco!.id },
      _count: { _all: true },
    });
    const resumo = Object.fromEntries(contagem.map((c) => [c.status, c._count._all]));

    return NextResponse.json(
      serializeBigInts({
        ...bloco,
        quantidade: bloco!.numeroFinal - bloco!.numeroInicial + 1,
        livres: resumo[STATUS_LIVRE] ?? 0,
        usados: resumo[STATUS_USADO] ?? 0,
      })
    );
  });
}

/** PATCH /api/dizimo-blocos/[id] — observação e ativo/inativo do bloco. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const { bloco, erro } = await carregarComAcesso(id, user);
    if (erro) return erro;

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });

    const data: Record<string, unknown> = {};
    if (typeof body.observacao === "string") data.observacao = body.observacao.trim() || null;
    if (typeof body.ativo === "boolean") data.ativo = body.ativo;
    if (!Object.keys(data).length) {
      return NextResponse.json({ error: "Nada para alterar." }, { status: 400 });
    }

    const atualizado = await prisma.dizimoBloco.update({
      where: { id: bloco!.id },
      data,
      select: { id: true, observacao: true, ativo: true },
    });
    return NextResponse.json(serializeBigInts(atualizado));
  });
}

/**
 * DELETE /api/dizimo-blocos/[id] — leva a cartela junto, em cascata.
 *
 * O que trava a exclusão é o VÍNCULO COM O DINHEIRO, não o status da linha.
 * Um bloco cujos números estão todos livres some inteiro; um bloco com número
 * preso a um dízimo lançado não some, porque isso deixaria o lançamento no
 * livro caixa dizendo "recibo 7" sem nada que prove de qual talão veio.
 *
 * Número marcado como USADO mas com o lançamento já apagado (`livro_caixa_id`
 * nulo, efeito do ON DELETE SET NULL) NÃO segura o bloco: não há lançamento
 * para ficar órfão, e sem esta brecha o bloco ficaria impossível de limpar.
 *
 * Quem quer só tirar o bloco da circulação sem apagar nada usa o PATCH
 * (`ativo: false`).
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const { bloco, erro } = await carregarComAcesso(id, user);
    if (erro) return erro;

    const presos = await prisma.dizimoNumero.count({
      where: { blocoId: bloco!.id, livroCaixaId: { not: null } },
    });
    if (presos > 0) {
      return NextResponse.json(
        {
          error: `Este bloco tem ${presos} número(s) preso(s) a dízimos já lançados e não pode ser excluído — apagá-lo deixaria esses lançamentos sem o recibo de origem. Exclua os lançamentos primeiro, ou inative o bloco para tirá-lo da lista.`,
        },
        { status: 409 }
      );
    }

    // A cartela vai junto pela FK em cascade.
    const quantos = await prisma.dizimoNumero.count({ where: { blocoId: bloco!.id } });
    await prisma.dizimoBloco.delete({ where: { id: bloco!.id } });
    return NextResponse.json({ ok: true, numerosRemovidos: quantos });
  });
}
