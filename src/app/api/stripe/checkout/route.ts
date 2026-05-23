import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { getStripeForCampo } from "@/lib/stripeEncrypt";
import { resolveScopedFieldId } from "@/lib/helpers";

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const {
      campoId: reqCampoId,
      churchId,
      orderId,
      tipo = "ingresso",
      valor,
      descricao = "Pagamento MRM",
      metodo = "card",    // card | pix | link
      successUrl,
      cancelUrl,
      customerEmail,
      customerName,
      userId: bodyUserId,
      memberId,
      metadata,
    } = body;

    const campoId = resolveScopedFieldId(user, reqCampoId);
    if (!campoId) return NextResponse.json({ error: "campoId obrigatório" }, { status: 400 });
    if (!valor || Number(valor) <= 0) return NextResponse.json({ error: "valor inválido" }, { status: 400 });

    const { stripe, config } = await getStripeForCampo(campoId).catch(() => {
      throw new Error("Stripe não configurado para este campo");
    });

    const valorCentavos = Math.round(Number(valor) * 100);
    const currency = config.currency || "brl";
    const resolvedUserId = bodyUserId || user.id;

    // Monta payment_method_types baseado no método e na config
    const paymentMethods: string[] = [];
    if (metodo === "pix" && config.pixEnabled) {
      paymentMethods.push("pix");
    } else if (metodo === "card" && config.cardEnabled) {
      paymentMethods.push("card");
    } else {
      if (config.cardEnabled) paymentMethods.push("card");
      if (config.pixEnabled) paymentMethods.push("pix");
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.mrm.com.br";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payment_method_types: paymentMethods as any,
      line_items: [{
        price_data: {
          currency,
          product_data: { name: descricao },
          unit_amount: valorCentavos,
        },
        quantity: 1,
      }],
      success_url: successUrl || `${baseUrl}/app-ui/app/orders?session_id={CHECKOUT_SESSION_ID}&status=success`,
      cancel_url: cancelUrl || `${baseUrl}/app-ui/app/orders?status=cancelled`,
      customer_email: customerEmail || user.email || undefined,
      metadata: {
        campo_id: campoId,
        church_id: churchId || "",
        order_id: orderId || "",
        user_id: resolvedUserId || "",
        member_id: memberId || "",
        tipo,
        ...(metadata || {}),
      },
    });

    // Persiste registro de pagamento
    const payment = await prisma.stripePayment.create({
      data: {
        configId: config.id,
        campoId,
        churchId: churchId || null,
        userId: resolvedUserId || null,
        memberId: memberId || null,
        orderId: orderId || null,
        stripeSessionId: session.id,
        valor: Number(valor),
        moeda: currency,
        metodo,
        tipo,
        status: "pendente",
        descricao,
        metadata: metadata || null,
      },
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
      paymentId: payment.id,
    });
  });
}
