import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { getStripeForCampo } from "@/lib/stripeEncrypt";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    if (user.profileType !== "master" && user.profileType !== "admin") {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { action, motivoRejeicao } = body; // approve | reject

    const refund = await prisma.stripeRefund.findUnique({
      where: { id },
      include: { payment: true },
    });
    if (!refund) return NextResponse.json({ error: "Reembolso não encontrado" }, { status: 404 });
    if (refund.status !== "solicitado") {
      return NextResponse.json({ error: "Reembolso já processado ou rejeitado" }, { status: 422 });
    }

    if (action === "reject") {
      await prisma.stripeRefund.update({
        where: { id },
        data: { status: "rejeitado", motivoRejeicao: motivoRejeicao || null, aprovadoPor: user.id || null },
      });
      return NextResponse.json({ ok: true, status: "rejeitado" });
    }

    if (action === "approve") {
      const payment = refund.payment;
      if (!payment.stripePaymentIntentId) {
        return NextResponse.json({ error: "PaymentIntent não disponível para este pagamento" }, { status: 422 });
      }

      const { stripe } = await getStripeForCampo(payment.campoId).catch(() => {
        throw new Error("Stripe não configurado para este campo");
      });

      const stripeRefund = await stripe.refunds.create({
        payment_intent: payment.stripePaymentIntentId,
        amount: Math.round(refund.valor * 100),
        reason: "requested_by_customer",
      });

      await prisma.$transaction([
        prisma.stripeRefund.update({
          where: { id },
          data: {
            status: stripeRefund.status === "succeeded" ? "processado" : "solicitado",
            stripeRefundId: stripeRefund.id,
            stripeStatus: stripeRefund.status,
            aprovadoPor: user.id || null,
          },
        }),
        prisma.stripePayment.update({
          where: { id: payment.id },
          data: {
            valorRefunded: { increment: refund.valor },
            status: stripeRefund.status === "succeeded" ? "reembolsado" : undefined,
          },
        }),
      ]);

      return NextResponse.json({ ok: true, stripeRefundId: stripeRefund.id, status: stripeRefund.status });
    }

    return NextResponse.json({ error: "Ação inválida. Use: approve | reject" }, { status: 400 });
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (_user) => {
    const { id } = await params;
    const refund = await prisma.stripeRefund.findUnique({
      where: { id },
      include: { payment: { select: { valor: true, descricao: true, status: true, campoId: true } } },
    });
    if (!refund) return NextResponse.json({ error: "Reembolso não encontrado" }, { status: 404 });
    return NextResponse.json(refund);
  });
}
