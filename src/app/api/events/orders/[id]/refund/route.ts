/**
 * PATCH /api/events/orders/[id]/refund
 * Aprova ou nega uma solicitação de reembolso.
 *
 * Body: { action: "approve" | "deny", notes?: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const { action, notes } = await req.json().catch(() => ({}));

    if (!["approve", "deny"].includes(action)) {
      return NextResponse.json({ error: "action deve ser 'approve' ou 'deny'" }, { status: 400 });
    }

    const order = await prisma.eventOrder.findUnique({
      where: { id },
      include: { refunds: { where: { status: "SOLICITADO" }, orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (!order) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
    if (order.status !== "SOLICITANDO_REEMBOLSO") {
      return NextResponse.json({ error: "Pedido não está com solicitação de reembolso ativa." }, { status: 422 });
    }

    const newOrderStatus = action === "approve" ? "REEMBOLSADO" : "PAGO";
    const refundStatus   = action === "approve" ? "APROVADO"    : "NEGADO";

    await prisma.eventOrder.update({
      where: { id },
      data: { status: newOrderStatus, updatedAt: new Date() },
    });

    // Atualizar registro de reembolso na tabela event_refunds
    const activeRefund = order.refunds[0];
    if (activeRefund) {
      await prisma.eventRefund.update({
        where: { id: activeRefund.id },
        data: {
          status:      refundStatus,
          notasAdmin:  notes ?? null,
          processedBy: user.id ?? null,
          processedAt: new Date(),
        },
      });
    }

    // Notificação
    await prisma.eventNotification.create({
      data: {
        eventId:  order.eventId,
        userId:   order.userId,
        orderId:  order.id,
        tipo:     action === "approve" ? "refund_approved" : "refund_denied",
        titulo:   action === "approve" ? "Reembolso aprovado" : "Reembolso negado",
        mensagem: notes ?? (action === "approve" ? "Seu reembolso foi aprovado." : "Sua solicitação de reembolso foi negada."),
      },
    }).catch(() => null);

    return NextResponse.json({ status: newOrderStatus });
  });
}
