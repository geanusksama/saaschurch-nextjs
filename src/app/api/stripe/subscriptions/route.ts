import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { getStripeForCampo } from "@/lib/stripeEncrypt";
import { resolveScopedFieldId } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const params = req.nextUrl.searchParams;
    const campoId = resolveScopedFieldId(user, params.get("campoId") || undefined);
    if (!campoId) return NextResponse.json({ error: "campoId obrigatório" }, { status: 400 });

    const status = params.get("status") || undefined;
    const userId = params.get("userId") || undefined;
    const memberId = params.get("memberId") || undefined;
    const page = Math.max(1, Number(params.get("page") || 1));
    const limit = Math.min(100, Math.max(1, Number(params.get("limit") || 20)));
    const skip = (page - 1) * limit;

    const where = {
      campoId,
      ...(status && { status }),
      ...(userId && { userId }),
      ...(memberId && { memberId }),
    };

    const [total, items] = await Promise.all([
      prisma.stripeSubscription.count({ where }),
      prisma.stripeSubscription.findMany({
        where,
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
    const {
      campoId: reqCampoId,
      userId: bodyUserId,
      memberId,
      priceId,
      customerEmail,
      customerName,
      trialDays,
      metadata,
    } = body;

    const campoId = resolveScopedFieldId(user, reqCampoId);
    if (!campoId) return NextResponse.json({ error: "campoId obrigatório" }, { status: 400 });
    if (!priceId) return NextResponse.json({ error: "priceId obrigatório" }, { status: 400 });

    const { stripe, config } = await getStripeForCampo(campoId).catch(() => {
      throw new Error("Stripe não configurado para este campo");
    });

    const resolvedUserId = bodyUserId || user.id;
    const email = customerEmail || user.email || undefined;

    // Cria ou recupera customer
    let customerId: string | undefined;
    if (email) {
      const existing = await stripe.customers.list({ email, limit: 1 });
      if (existing.data.length > 0) {
        customerId = existing.data[0].id;
      } else {
        const customer = await stripe.customers.create({
          email,
          name: customerName || undefined,
          metadata: { campo_id: campoId, user_id: resolvedUserId || "" },
        });
        customerId = customer.id;
      }
    }

    const sub = await stripe.subscriptions.create({
      customer: customerId!,
      items: [{ price: priceId }],
      trial_period_days: trialDays ? Number(trialDays) : undefined,
      metadata: {
        campo_id: campoId,
        user_id: resolvedUserId || "",
        member_id: memberId || "",
        ...(metadata || {}),
      },
    });

    const record = await prisma.stripeSubscription.create({
      data: {
        configId: config.id,
        campoId,
        userId: resolvedUserId || null,
        memberId: memberId || null,
        stripeSubscriptionId: sub.id,
        stripeCustomerId: customerId || null,
        stripePriceId: priceId,
        status: "ativa",
        proximaCobranca: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
      },
    });

    return NextResponse.json(record, { status: 201 });
  });
}
