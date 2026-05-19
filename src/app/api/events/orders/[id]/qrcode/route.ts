/**
 * POST /api/events/orders/[id]/qrcode
 * Gera (ou regenera) QR Codes para todos os itens ativos do pedido.
 * Só disponível para pedidos com status PAGO.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";
import crypto from "crypto";

function generateTicketCode(eventId: string, itemIndex: number): string {
  const prefix = `EVT-${eventId.substring(0, 8).toUpperCase()}`;
  const suffix = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}-${suffix}-${itemIndex}`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(req, async (user) => {
    const { id } = await params;

    const order = await prisma.eventOrder.findUnique({
      where: { id },
      include: { items: { where: { status: "ATIVO" } } },
    });
    if (!order) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
    if (order.status !== "PAGO") {
      return NextResponse.json({ error: "QR Codes só podem ser gerados para pedidos PAGO." }, { status: 422 });
    }

    // Cancelar QR Codes existentes não usados antes de regenerar
    await prisma.eventQRCode.updateMany({
      where: { orderId: id, isUsed: false, isCancelled: false },
      data: { isCancelled: true, cancelledAt: new Date() },
    });

    const created: string[] = [];
    let itemIndex = 0;

    if (order.items.length > 0) {
      // Gerar 1 QR por item/assento
      for (const item of order.items) {
        for (let q = 0; q < item.qty; q++) {
          itemIndex++;
          const ticketCode = generateTicketCode(order.eventId, itemIndex);
          const qrData = JSON.stringify({ tc: ticketCode, ev: order.eventId, oi: order.id, ui: order.userId });
          await prisma.eventQRCode.create({
            data: {
              orderId:     order.id,
              orderItemId: item.id,
              eventId:     order.eventId,
              userId:      order.userId,
              seatId:      item.seatId ?? null,
              ticketCode,
              qrData,
              isUsed:      false,
              isCancelled: false,
            },
          });
          created.push(ticketCode);
        }
      }
    } else {
      // Sem itens registrados (pedido vindo do app sem event_order_items)
      // Gera 1 QR Code geral para o pedido
      const ticketCode = generateTicketCode(order.eventId, 1);
      const qrData = JSON.stringify({ tc: ticketCode, ev: order.eventId, oi: order.id, ui: order.userId });
      await prisma.eventQRCode.create({
        data: {
          orderId:     order.id,
          eventId:     order.eventId,
          userId:      order.userId,
          ticketCode,
          qrData,
          isUsed:      false,
          isCancelled: false,
        },
      });
      created.push(ticketCode);
    }

    // Notificação de confirmação
    await prisma.eventNotification.create({
      data: {
        eventId:  order.eventId,
        userId:   order.userId,
        orderId:  order.id,
        tipo:     "ticket_confirmed",
        titulo:   "Ingresso confirmado!",
        mensagem: `${created.length} QR Code(s) gerado(s) por ${user.fullName ?? "admin"}`,
      },
    }).catch(() => null);

    return NextResponse.json(serializeBigInts({ generated: created.length, ticketCodes: created }));
  });
}
