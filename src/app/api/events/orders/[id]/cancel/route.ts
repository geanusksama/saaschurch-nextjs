/**
 * POST /api/events/orders/[id]/cancel
 * Cancela o pedido (com motivo opcional).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

const CANCELLABLE = ["AGUARDANDO_PAGAMENTO", "EXPIRADO", "SOLICITANDO_REEMBOLSO"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const { motivo } = await req.json().catch(() => ({}));

    const order = await prisma.eventOrder.findUnique({ where: { id } });
    if (!order) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
    if (!CANCELLABLE.includes(order.status)) {
      return NextResponse.json({ error: `Pedido no status ${order.status} não pode ser cancelado.` }, { status: 422 });
    }

    const [updated] = await Promise.all([
      prisma.eventOrder.update({
        where: { id },
        data: { status: "CANCELADO", notas: motivo ?? order.notas, cancelledAt: new Date() },
      }),
      // Cancelar QRCodes ativos
      prisma.eventQRCode.updateMany({
        where: { orderId: id, isCancelled: false },
        data: { isCancelled: true, cancelledAt: new Date() },
      }),
      // Notificação de cancelamento
      prisma.eventNotification.create({
        data: {
          eventId:  order.eventId,
          userId:   order.userId,
          orderId:  order.id,
          tipo:     "event_cancelled",
          titulo:   "Pedido cancelado",
          mensagem: motivo ?? `Cancelado por ${user.fullName ?? "admin"}`,
        },
      }).catch(() => null),
    ]);

    return NextResponse.json(serializeBigInts(updated));
  });
}
