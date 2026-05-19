/**
 * PATCH /api/events/orders/[id]/refund
 * Aprova ou nega uma solicitação de reembolso.
 *
 * Body: { action: "approve" | "deny", motivo?: string }
 *
 * Chama as RPCs do banco:
 *   fn_aprovar_reembolso(order_id, admin_id)
 *   fn_negar_reembolso(order_id, motivo, admin_id)
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const { action, motivo } = await req.json().catch(() => ({}));

    if (!["approve", "deny"].includes(action)) {
      return NextResponse.json({ error: "action deve ser 'approve' ou 'deny'" }, { status: 400 });
    }

    // Valida existência e status em ambas as tabelas (MRM e Flutter)
    const mrmOrder = await prisma.eventOrder.findUnique({ where: { id }, select: { status: true } });
    if (mrmOrder) {
      if (mrmOrder.status !== "SOLICITANDO_REEMBOLSO") {
        return NextResponse.json({ error: "Pedido não está com solicitação de reembolso ativa." }, { status: 422 });
      }
    } else {
      const flutterOrder = await prisma.order.findUnique({ where: { id }, select: { status: true } });
      if (!flutterOrder) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
      if (!["REFUND_REQUESTED", "REQUESTING_REFUND"].includes(flutterOrder.status)) {
        return NextResponse.json({ error: "Pedido não está com solicitação de reembolso ativa." }, { status: 422 });
      }
    }

    const adminId = user.id ?? null;
    const newOrderStatus = action === "approve" ? "REEMBOLSADO" : "PAGO";

    if (action === "approve") {
      try {
        await prisma.$executeRawUnsafe(`SELECT fn_aprovar_reembolso($1::uuid, $2::uuid)`, id, adminId);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[refund] fn_aprovar_reembolso error:", msg);
        return NextResponse.json({ error: msg }, { status: 500 });
      }

      // Cancela QR Codes MRM e libera assentos (event_seats) de pedidos MRM
      await prisma.eventQRCode.updateMany({
        where: { orderId: id, isCancelled: false },
        data: { isCancelled: true, cancelledAt: new Date() },
      }).catch(() => null);

      const items = await prisma.eventOrderItem.findMany({
        where: { orderId: id },
        select: { seatId: true },
      }).catch(() => []);
      const seatIds = items.map((i: { seatId: string | null }) => i.seatId).filter(Boolean) as string[];
      if (seatIds.length > 0) {
        await prisma.eventSeat.updateMany({
          where: { id: { in: seatIds } },
          data: { status: "LIVRE", reservadoPor: null, reservadoEm: null, reservaExpira: null, orderItemId: null },
        }).catch(() => null);
      }
    } else {
      if (!motivo?.trim()) {
        return NextResponse.json({ error: "Informe o motivo da negação." }, { status: 400 });
      }
      try {
        await prisma.$executeRawUnsafe(`SELECT fn_negar_reembolso($1::uuid, $2::text, $3::uuid)`, id, motivo.trim(), adminId);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[refund] fn_negar_reembolso error:", msg);
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }

    // Para pedidos MRM (só em event_orders, sem linha em orders):
    // o RPC opera na tabela orders do Flutter — o sync trigger não atualizaria event_orders.
    // Garantir status correto via Prisma diretamente.
    if (mrmOrder) {
      await prisma.eventOrder.update({
        where: { id },
        data: { status: newOrderStatus, updatedAt: new Date() },
      }).catch(() => null);
    }

    return NextResponse.json({ status: newOrderStatus });
  });
}
