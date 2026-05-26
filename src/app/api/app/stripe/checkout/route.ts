/**
 * POST /api/app/stripe/checkout
 *
 * Endpoint para o app Flutter iniciar pagamento de ingresso via Stripe Checkout.
 * Autentica com o mesmo Supabase JWT usado no app (mesmo projeto).
 * Retorna URL da sessão Stripe para abrir no WebView do Flutter.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { getStripeForCampo } from "@/lib/stripeEncrypt";

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));

    const {
      orderId,          // event_orders.id (obrigatório)
      campoId: reqCampoId,
      eventId,
      valor,            // total em BRL (ex: 50.00)
      descricao,        // "Ingresso: Nome do Evento"
      metodo = "card",  // card | pix
      successUrl,       // deep link ou URL de retorno do app
      cancelUrl,
      customerEmail,
      customerName,
    } = body;

    // campoId: preferência do body, fallback do token auth
    const campoId: string | null = reqCampoId || user.campoId;
    if (!campoId) {
      return NextResponse.json({ error: "campoId obrigatório" }, { status: 400 });
    }
    if (!orderId) {
      return NextResponse.json({ error: "orderId obrigatório" }, { status: 400 });
    }
    if (!valor || Number(valor) <= 0) {
      return NextResponse.json({ error: "valor inválido" }, { status: 400 });
    }

    // Carrega stripe config do campo
    const { stripe, config } = await getStripeForCampo(campoId).catch(() => {
      throw Object.assign(new Error("Stripe não configurado para este campo"), { status: 400 });
    });

    const valorCentavos = Math.round(Number(valor) * 100);
    const currency = config.currency || "brl";

    // Monta métodos de pagamento
    const paymentMethods: string[] = [];
    if (metodo === "pix" && config.pixEnabled) {
      paymentMethods.push("pix");
    } else if (metodo === "card" && config.cardEnabled) {
      paymentMethods.push("card");
    } else {
      if (config.cardEnabled) paymentMethods.push("card");
      if (config.pixEnabled) paymentMethods.push("pix");
    }
    if (paymentMethods.length === 0) {
      return NextResponse.json({ error: "Nenhum método de pagamento ativo" }, { status: 400 });
    }

    // URLs de retorno: app usa deep link novoigreja://
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.mrm.com.br";
    const successRedirect = successUrl || `${baseUrl}/app-ui/app/orders?session_id={CHECKOUT_SESSION_ID}&status=success`;
    const cancelRedirect  = cancelUrl  || `${baseUrl}/app-ui/app/orders?status=cancelled`;

    // Cria sessão Stripe Checkout
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: paymentMethods as any,
      line_items: [{
        price_data: {
          currency,
          product_data: { name: descricao || "Ingresso" },
          unit_amount: valorCentavos,
        },
        quantity: 1,
      }],
      success_url: successRedirect,
      cancel_url:  cancelRedirect,
      customer_email: customerEmail || user.email || undefined,
      metadata: {
        campo_id:  campoId,
        order_id:  orderId,
        event_id:  eventId || "",
        user_id:   user.sub,
        tipo:      "ingresso",
        source:    "flutter_app",
      },
    });

    // Persiste registro de pagamento pendente
    const payment = await prisma.stripePayment.create({
      data: {
        configId:       config.id,
        campoId,
        userId:         user.sub,
        orderId,
        stripeSessionId: session.id,
        valor:          Number(valor),
        moeda:          currency,
        metodo,
        tipo:           "ingresso",
        status:         "pendente",
        descricao:      descricao || "Ingresso",
        metadata:       { eventId, source: "flutter_app" },
      },
    });

    // Atualiza event_orders com referência ao pagamento
    await prisma.eventOrder.update({
      where: { id: orderId },
      data: {
        paymentRef:     session.id,
        paymentMethod:  metodo,
        status:         "AGUARDANDO_PAGAMENTO",
      },
    }).catch(() => {
      // order pode ainda não existir — não bloqueia
    });

    return NextResponse.json({
      sessionId:  session.id,
      url:        session.url,
      paymentId:  payment.id,
      expiresAt:  session.expires_at,
    });
  });
}
