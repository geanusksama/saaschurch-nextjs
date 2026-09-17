import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";
import { podeAcessarIgreja } from "@/lib/contasPagarScope";
import { STATUS_LIVRE, STATUS_USADO } from "@/lib/dizimoNumeracao";

const PAGE_SIZE_MAX = 500;

/**
 * GET /api/dizimo-blocos/[id]/numeros — a cartela: os números do bloco, um a
 * um, com quem gastou cada um.
 *
 * Paginada e com teto mesmo sendo "só um bloco": `findMany` sem `take` é o
 * tropeço recorrente deste repositório (ver AGENTS.md), e um bloco pode ter
 * milhares de números.
 *
 * `status=LIVRE` é o que a lupa do lançamento pede.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const sp = new URL(req.url).searchParams;

    const bloco = await prisma.dizimoBloco.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, churchId: true, numeroBloco: true, numeroInicial: true, numeroFinal: true },
    });
    if (!bloco) return NextResponse.json({ error: "Bloco não encontrado." }, { status: 404 });
    if (!(await podeAcessarIgreja(user, bloco.churchId, prisma))) {
      return NextResponse.json({ error: "Sem acesso a esta igreja." }, { status: 403 });
    }

    const where: Record<string, unknown> = { blocoId: bloco.id };
    const status = (sp.get("status") ?? "").trim().toUpperCase();
    if (status === STATUS_LIVRE) where.status = STATUS_LIVRE;
    else if (status === STATUS_USADO) where.status = { not: STATUS_LIVRE };

    const pagina = Math.max(1, Number(sp.get("pagina") ?? 1) || 1);
    const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, Number(sp.get("pageSize") ?? 200) || 200));

    const [numeros, total, contagem] = await Promise.all([
      prisma.dizimoNumero.findMany({
        where,
        orderBy: { numero: "asc" },
        skip: (pagina - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, numero: true, status: true, usadoEm: true,
          livroCaixa: {
            select: { id: true, dataLancamento: true, valor: true, favorecido: true, legacyId: true },
          },
        },
      }),
      prisma.dizimoNumero.count({ where }),
      prisma.dizimoNumero.groupBy({
        by: ["status"],
        where: { blocoId: bloco.id },
        _count: { _all: true },
      }),
    ]);

    const resumo = Object.fromEntries(contagem.map((c) => [c.status, c._count._all]));

    return NextResponse.json(
      serializeBigInts({
        bloco: {
          id: bloco.id,
          numeroBloco: bloco.numeroBloco,
          numeroInicial: bloco.numeroInicial,
          numeroFinal: bloco.numeroFinal,
          quantidade: bloco.numeroFinal - bloco.numeroInicial + 1,
          livres: resumo[STATUS_LIVRE] ?? 0,
          usados: resumo[STATUS_USADO] ?? 0,
        },
        data: numeros,
        total,
        pagina,
        pageSize,
      })
    );
  });
}
