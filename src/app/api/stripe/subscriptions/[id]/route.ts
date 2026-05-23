import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { getStripeForCampo } from "@/lib/stripeEncrypt";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { action } = body; // cancel | pause | reactivate

    const record = await prisma.stripeSubscription.findUnique({ where: { id } });
    if (!record) return NextResponse.json({ error: "Assinatura não encontrada" }, { status: 404 });

    const { stripe } = await getStripeForCampo(record.campoId).catch(() => {
      throw new Error("Stripe não configurado para este campo");
    });

    let updated;
    if (action === "cancel") {
      updated = await stripe.subscriptions.cancel(record.stripeSubscriptionId);
      await prisma.stripeSubscription.update({
        where: { id },
        data: { status: "cancelada", canceladaEm: new Date() },
      });
    } else if (action === "pause") {
      updated = await stripe.subscriptions.update(record.stripeSubscriptionId, {
        pause_collection: { behavior: "void" },
      });
      await prisma.stripeSubscription.update({ where: { id }, data: { status: "pausada" } });
    } else if (action === "reactivate") {
      updated = await stripe.subscriptions.update(record.stripeSubscriptionId, {
        pause_collection: "",
      });
      await prisma.stripeSubscription.update({ where: { id }, data: { status: "ativa" } });
    } else {
      return NextResponse.json({ error: "Ação inválida. Use: cancel | pause | reactivate" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, stripeStatus: updated.status });
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (_user) => {
    const { id } = await params;
    const record = await prisma.stripeSubscription.findUnique({ where: { id } });
    if (!record) return NextResponse.json({ error: "Assinatura não encontrada" }, { status: 404 });
    return NextResponse.json(record);
  });
}
