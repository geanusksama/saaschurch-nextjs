import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { assertChurchAccess, serializeBigInts } from "@/lib/helpers";

/**
 * GET /api/contas-pagar/parcelas/[id]
 *
 * A parcela com a coleção de pagamentos que ela recebeu — os "anexos" de
 * pagamento. Traz os estornados também, marcados: o histórico precisa mostrar
 * que houve um estorno, não escondê-lo.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;

    const parcela = await prisma.parcelaContaPagar.findUnique({
      where: { id },
      include: {
        contaPagar: {
          include: {
            credor: { select: { id: true, nome: true, tipoCredor: true, chavePix: true, bancoNome: true, agencia: true, conta: true } },
            planoDeConta: { select: { id: true, nome: true, codigo: true } },
            departamento: { select: { id: true, nome: true, cor: true } },
            banco: { select: { id: true, nome: true } },
          },
        },
        pagamentos: {
          orderBy: { dataPagamento: "asc" },
          include: { banco: { select: { id: true, nome: true } } },
        },
        church: { select: { id: true, name: true, code: true } },
      },
    });

    if (!parcela) return NextResponse.json({ error: "Parcela não encontrada." }, { status: 404 });
    if (!(await assertChurchAccess(user, parcela.churchId, prisma))) {
      return NextResponse.json({ error: "Sem acesso." }, { status: 403 });
    }

    return NextResponse.json(serializeBigInts(parcela));
  });
}
