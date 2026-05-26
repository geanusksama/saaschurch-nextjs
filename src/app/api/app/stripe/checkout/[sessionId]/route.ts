/**
 * GET /api/app/stripe/checkout/[sessionId]
 *
 * Polling de status do pagamento para o app Flutter.
 * Retorna estado atual da sessão Stripe + status do pedido.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { getStripeForCampo } from "@/lib/stripeEncrypt";

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  return withAuth(req, async (user) => {
    const { sessionId } = params;
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId obrigatório" }, { status: 400 });
    }

    // Busca o registro de pagamento pelo sessionId
    const payment = await prisma.stripePayment.findFirst({
      where: { stripeSessionId: sessionId },
      select: {
        id: true,
        status: true,
        orderId: true,
        campoId: true,
        valor: true,
        metodo: true,
        paidAt: true,
      },
    });

    if (!payment) {
      return NextResponse.json({ error: "Pagamento não encontrado" }, { status: 404 });
    }

    // Se já aprovado/falhou, retorna sem chamar a API Stripe
    if (payment.status !== "pendente") {
      let orderStatus: string | null = null;
      if (payment.orderId) {
        const order = await prisma.eventOrder.findUnique({
          where: { id: payment.orderId },
          select: { status: true, numeroPedido: true },
        }).catch(() => null);
        orderStatus = order?.status ?? null;
      }

      return NextResponse.json({
        paymentId:    payment.id,
        status:       payment.status,       // pendente | aprovado | falhou | reembolsado
        orderStatus,
        orderId:      payment.orderId,
        valor:        payment.valor,
        metodo:       payment.metodo,
        paidAt:       payment.paidAt,
      });
    }

    // Consulta status live na API Stripe
    try {
      const { stripe } = await getStripeForCampo(payment.campoId!);
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      let newStatus = payment.status;
      if (session.payment_status === "paid") {
        newStatus = "aprovado";
        // Atualiza no banco se necessário
        await prisma.stripePayment.update({
          where: { id: payment.id },
          data: { status: "aprovado", paidAt: new Date() },
        }).catch(() => {});

        if (payment.orderId) {
          await prisma.eventOrder.update({
            where: { id: payment.orderId },
            data: { status: "PAGO" },
          }).catch(() => {});
        }
      } else if (session.status === "expired") {
        newStatus = "falhou";
        await prisma.stripePayment.update({
          where: { id: payment.id },
          data: { status: "falhou" },
        }).catch(() => {});
      }

      return NextResponse.json({
        paymentId:       payment.id,
        status:          newStatus,
        stripeStatus:    session.payment_status,
        sessionStatus:   session.status,
        orderId:         payment.orderId,
        valor:           payment.valor,
        metodo:          payment.metodo,
        paidAt:          newStatus === "aprovado" ? new Date() : null,
      });
    } catch (err) {
      console.error("[app/stripe/checkout/status]", err);
      return NextResponse.json({
        paymentId: payment.id,
        status:    payment.status,
        orderId:   payment.orderId,
      });
    }
  });
}
