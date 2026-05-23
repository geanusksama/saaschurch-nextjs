import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { resolveScopedFieldId } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const params = req.nextUrl.searchParams;
    const campoId = resolveScopedFieldId(user, params.get("campoId") || undefined);
    if (!campoId) return NextResponse.json({ error: "campoId obrigatório" }, { status: 400 });

    const status = params.get("status") || undefined;
    const paymentId = params.get("paymentId") || undefined;
    const page = Math.max(1, Number(params.get("page") || 1));
    const limit = Math.min(100, Math.max(1, Number(params.get("limit") || 20)));
    const skip = (page - 1) * limit;

    const where = {
      payment: { campoId },
      ...(status && { status }),
      ...(paymentId && { paymentId }),
    };

    const [total, items] = await Promise.all([
      prisma.stripeRefund.count({ where }),
      prisma.stripeRefund.findMany({
        where,
        include: { payment: { select: { valor: true, descricao: true, userId: true, createdAt: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({ items, total, page, limit, pages: Math.ceil(total / limit) });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const { paymentId, valor, motivo } = body;

    if (!paymentId) return NextResponse.json({ error: "paymentId obrigatório" }, { status: 400 });

    const payment = await prisma.stripePayment.findUnique({ where: { id: paymentId } });
    if (!payment) return NextResponse.json({ error: "Pagamento não encontrado" }, { status: 404 });
    if (payment.status !== "aprovado" && payment.status !== "reembolsado") {
      return NextResponse.json({ error: "Pagamento não elegível para reembolso" }, { status: 422 });
    }

    const valorRefund = valor ? Number(valor) : payment.valor - (payment.valorRefunded ?? 0);
    if (valorRefund <= 0) return NextResponse.json({ error: "Valor de reembolso inválido" }, { status: 400 });

    const refund = await prisma.stripeRefund.create({
      data: {
        paymentId,
        valor: valorRefund,
        moeda: payment.moeda,
        motivo: motivo || null,
        status: "solicitado",
        solicitadoPor: user.id || null,
      },
    });

    return NextResponse.json(refund, { status: 201 });
  });
}
