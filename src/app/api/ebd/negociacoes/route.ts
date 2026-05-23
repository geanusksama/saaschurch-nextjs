import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { resolveScopedFieldId, serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const params = req.nextUrl.searchParams;
    const campoId = resolveScopedFieldId(user, params.get("campoId") || undefined);
    if (!campoId) return NextResponse.json({ error: "campoId obrigatório" }, { status: 400 });

    const churchId = params.get("churchId") || undefined;
    const status = params.get("status") || undefined;

    const rows = await prisma.ebdNegociacao.findMany({
      where: {
        campoId,
        deletedAt: null,
        ...(churchId && { churchId }),
        ...(status && { status }),
      },
      include: {
        church: { select: { id: true, name: true } },
        parcelas: { orderBy: { numParcela: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Auto-atualizar status de negociações vencidas
    const hoje = new Date();
    for (const n of rows) {
      if (n.status === "aberta" && n.dataVencimento && n.dataVencimento < hoje) {
        const todasPagas = n.parcelas.every((p) => p.status === "pago");
        if (!todasPagas) {
          await prisma.ebdNegociacao.update({ where: { id: n.id }, data: { status: "vencida" } });
          n.status = "vencida";
        }
      }
    }

    return NextResponse.json(serializeBigInts(rows));
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const { campoId: reqCampoId, churchId, titulo, descricao, valorTotal, numParcelas, dataInicio, dataVencimento, observacao, parcelas } = body;

    const campoId = resolveScopedFieldId(user, reqCampoId);
    if (!campoId) return NextResponse.json({ error: "campoId obrigatório" }, { status: 400 });
    if (!churchId || !titulo || !valorTotal || !dataInicio) {
      return NextResponse.json({ error: "churchId, titulo, valorTotal e dataInicio são obrigatórios" }, { status: 400 });
    }

    const negociacao = await prisma.ebdNegociacao.create({
      data: {
        campoId,
        churchId,
        titulo,
        descricao: descricao || null,
        valorTotal: Number(valorTotal),
        numParcelas: Number(numParcelas) || 1,
        dataInicio: new Date(dataInicio),
        dataVencimento: dataVencimento ? new Date(dataVencimento) : null,
        observacao: observacao || null,
        status: "aberta",
        createdBy: user.id ?? undefined,
        parcelas: parcelas && Array.isArray(parcelas) && parcelas.length > 0
          ? {
              create: parcelas.map((p: { numParcela: number; valor: number; dataVencimento: string }) => ({
                numParcela: p.numParcela,
                valor: Number(p.valor),
                dataVencimento: new Date(p.dataVencimento),
                status: "pendente",
              })),
            }
          : undefined,
      },
      include: { church: { select: { id: true, name: true } }, parcelas: true },
    });

    return NextResponse.json(serializeBigInts(negociacao), { status: 201 });
  });
}
