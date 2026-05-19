/**
 * PATCH /api/events/orders/[id]/status
 * Move o pedido para um novo status (drag-drop Kanban).
 *
 * Body: { status: string }
 *
 * Transições permitidas:
 *   AGUARDANDO_PAGAMENTO  → PAGO | CANCELADO
 *   EXPIRADO              → PAGO | CANCELADO
 *   PAGO                  → SOLICITANDO_REEMBOLSO
 *   SOLICITANDO_REEMBOLSO → REEMBOLSADO | PAGO
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  AGUARDANDO_PAGAMENTO:  ["PAGO", "CANCELADO"],
  EXPIRADO:              ["PAGO", "CANCELADO"],
  PAGO:                  ["SOLICITANDO_REEMBOLSO"],
  SOLICITANDO_REEMBOLSO: ["REEMBOLSADO", "PAGO"],
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const { status: newStatus, notes } = await req.json().catch(() => ({}));

    if (!newStatus) {
      return NextResponse.json({ error: "status é obrigatório" }, { status: 400 });
    }

    const order = await prisma.eventOrder.findUnique({ where: { id } });
    if (!order) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });

    const allowed = ALLOWED_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(newStatus)) {
      return NextResponse.json({
        error: `Transição inválida: ${order.status} → ${newStatus}. Permitidas: ${allowed.join(", ")}`,
      }, { status: 422 });
    }

    const data: Record<string, unknown> = {
      status: newStatus,
      updatedAt: new Date(),
    };

    const updated = await prisma.eventOrder.update({ where: { id }, data });

    // Notificação de histórico via event_notifications
    await prisma.eventNotification.create({
      data: {
        eventId:  order.eventId,
        userId:   order.userId,
        orderId:  order.id,
        tipo:     "status_change",
        titulo:   `Pedido movido para ${newStatus}`,
        mensagem: notes ?? `Movido de ${order.status} para ${newStatus} por ${user.fullName ?? "admin"}`,
      },
    }).catch(() => null);

    return NextResponse.json(serializeBigInts(updated));
  });
}
