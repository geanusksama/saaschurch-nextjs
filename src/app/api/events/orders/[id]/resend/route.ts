/**
 * POST /api/events/orders/[id]/resend
 * Simula reenvio de cobrança (registra notificação e incrementa tentativas).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(req, async (user) => {
    const { id } = await params;

    const order = await prisma.eventOrder.findUnique({ where: { id } });
    if (!order) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
    if (!["AGUARDANDO_PAGAMENTO", "EXPIRADO"].includes(order.status)) {
      return NextResponse.json({ error: "Reenvio de cobrança só é possível para pedidos pendentes." }, { status: 422 });
    }

    const [updated] = await Promise.all([
      prisma.eventOrder.update({
        where: { id },
        data: { paymentAttempts: { increment: 1 }, status: "AGUARDANDO_PAGAMENTO" },
      }),
      prisma.eventNotification.create({
        data: {
          eventId:  order.eventId,
          userId:   order.userId,
          orderId:  order.id,
          tipo:     "payment_reminder",
          titulo:   "Cobrança reenviada",
          mensagem: `Tentativa ${order.paymentAttempts + 1} — reenviado por ${user.fullName ?? "admin"}`,
        },
      }).catch(() => null),
    ]);

    return NextResponse.json(serializeBigInts(updated));
  });
}
