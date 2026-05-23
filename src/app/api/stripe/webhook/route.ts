import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { decryptKey } from "@/lib/stripeEncrypt";

export const runtime = "nodejs";

// Next.js precisa do raw body para validar a assinatura do webhook
export const dynamic = "force-dynamic";

async function findConfigByCampoId(campoId: string) {
  return prisma.stripeConfig.findUnique({ where: { campoId, ativo: true, deletedAt: null } });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const { campo_id, order_id, user_id, tipo } = session.metadata || {};
  if (!campo_id) return;

  const stripeSessionId = session.id;
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;

  await prisma.stripePayment.updateMany({
    where: { stripeSessionId },
    data: {
      status: "aprovado",
      stripePaymentIntentId: paymentIntentId || undefined,
      stripeCustomerId: typeof session.customer === "string" ? session.customer : undefined,
      paidAt: new Date(),
      receiptUrl: null, // receipt vem do charge
    },
  });

  // Atualiza o pedido original se existir
  if (order_id) {
    await prisma.eventOrder.updateMany({
      where: { id: order_id },
      data: { status: "PAGO", paymentRef: paymentIntentId || stripeSessionId },
    }).catch(() => null);
  }
}

async function handlePaymentFailed(pi: Stripe.PaymentIntent) {
  await prisma.stripePayment.updateMany({
    where: { stripePaymentIntentId: pi.id },
    data: { status: "falhou" },
  });
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const subId = typeof invoice.subscription === "string" ? invoice.subscription : null;
  if (!subId) return;
  await prisma.stripeSubscription.updateMany({
    where: { stripeSubscriptionId: subId },
    data: { status: "ativa" },
  });
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  const statusMap: Record<string, string> = {
    active: "ativa",
    paused: "pausada",
    canceled: "cancelada",
    incomplete: "incompleta",
    past_due: "passado_prazo",
    trialing: "ativa",
    unpaid: "passado_prazo",
    incomplete_expired: "cancelada",
  };

  await prisma.stripeSubscription.updateMany({
    where: { stripeSubscriptionId: sub.id },
    data: {
      status: statusMap[sub.status] || sub.status,
      proximaCobranca: sub.current_period_end
        ? new Date(sub.current_period_end * 1000)
        : undefined,
      canceladaEm: sub.canceled_at ? new Date(sub.canceled_at * 1000) : undefined,
    },
  });
}

async function handleRefundUpdated(refund: Stripe.Refund) {
  if (!refund.payment_intent) return;
  const piId = typeof refund.payment_intent === "string" ? refund.payment_intent : refund.payment_intent.id;
  const payment = await prisma.stripePayment.findFirst({ where: { stripePaymentIntentId: piId } });
  if (!payment) return;

  await prisma.stripeRefund.updateMany({
    where: { stripeRefundId: refund.id },
    data: { status: refund.status === "succeeded" ? "processado" : "solicitado", stripeStatus: refund.status },
  });

  const valorRefund = (refund.amount || 0) / 100;
  await prisma.stripePayment.update({
    where: { id: payment.id },
    data: {
      valorRefunded: { increment: valorRefund },
      status: refund.status === "succeeded" ? "reembolsado" : undefined,
    },
  });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature") || "";

  // Tenta encontrar a config pelo campo_id no payload bruto para validar assinatura
  let event: Stripe.Event;
  let webhookSecret: string | null = null;

  try {
    // Parseia sem verificar assinatura para pegar campo_id
    const rawEvent = JSON.parse(rawBody) as Stripe.Event;
    const campoId = (rawEvent.data.object as { metadata?: { campo_id?: string } })?.metadata?.campo_id;

    if (campoId) {
      const config = await findConfigByCampoId(campoId);
      if (config?.webhookSecretEnc) {
        webhookSecret = decryptKey(config.webhookSecretEnc);
      }
    }

    if (webhookSecret && signature) {
      event = Stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } else {
      // Fallback: usa variável de ambiente global (desenvolvimento)
      const fallbackSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (fallbackSecret && signature) {
        event = Stripe.webhooks.constructEvent(rawBody, signature, fallbackSecret);
      } else {
        event = rawEvent; // sem validação de assinatura em dev sem secret
      }
    }
  } catch (err) {
    console.error("Stripe webhook error:", err);
    return NextResponse.json({ error: "Webhook signature invalid" }, { status: 400 });
  }

  // Log do evento
  const campoId = (event.data.object as { metadata?: { campo_id?: string } })?.metadata?.campo_id || null;
  await prisma.stripeWebhookLog.upsert({
    where: { stripeEventId: event.id },
    create: {
      stripeEventId: event.id,
      eventType: event.type,
      campoId,
      payload: event as unknown as Parameters<typeof prisma.stripeWebhookLog.create>[0]["data"]["payload"],
      processado: false,
    },
    update: {},
  }).catch(() => null);

  // Processa evento
  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "payment_intent.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case "invoice.payment_failed":
        if (typeof (event.data.object as Stripe.Invoice).subscription === "string") {
          await prisma.stripeSubscription.updateMany({
            where: { stripeSubscriptionId: (event.data.object as Stripe.Invoice).subscription as string },
            data: { status: "passado_prazo" },
          });
        }
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await prisma.stripeSubscription.updateMany({
          where: { stripeSubscriptionId: (event.data.object as Stripe.Subscription).id },
          data: { status: "cancelada", canceladaEm: new Date() },
        });
        break;
      case "charge.refunded":
      case "refund.updated":
        await handleRefundUpdated(event.data.object as Stripe.Refund);
        break;
    }

    // Marca como processado
    await prisma.stripeWebhookLog.updateMany({
      where: { stripeEventId: event.id },
      data: { processado: true },
    });
  } catch (err) {
    await prisma.stripeWebhookLog.updateMany({
      where: { stripeEventId: event.id },
      data: { erro: String(err) },
    });
    return NextResponse.json({ error: "Erro ao processar evento" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
