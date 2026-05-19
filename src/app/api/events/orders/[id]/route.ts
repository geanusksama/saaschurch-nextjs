/**
 * GET /api/events/orders/[id]
 * Retorna detalhes completos de um pedido para o painel lateral.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(req, async () => {
    const { id } = await params;

    // ── Tenta primeiro na tabela event_orders (MRM/legado) ─────────────────
    const order = await prisma.eventOrder.findUnique({
      where: { id },
      include: {
        event: {
          select: {
            id: true, nome: true, dataInicio: true, dataFim: true,
            local: true, churchId: true, imagemUrl: true, tipoEvento: true,
            gratuito: true, preco: true, descricao: true, localEndereco: true,
            bannerUrl: true,
            participants: {
              select: { id: true, nome: true, papel: true, fotoUrl: true, ordem: true },
              orderBy: { ordem: "asc" },
            },
            sectors: {
              orderBy: { ordem: "asc" as const },
              select: { id: true, nome: true, preco: true, corHex: true, quantidade: true },
            },
          },
        },
        items: {
          include: {
            seat:   { select: { numero: true, status: true, row: { select: { nome: true } } } },
            sector: { select: { nome: true, preco: true, corHex: true } },
          },
        },
        qrcodes: {
          select: { id: true, ticketCode: true, qrData: true, isUsed: true, usedAt: true, isCancelled: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        },
        refunds: {
          select: { id: true, motivo: true, valorSolicitado: true, status: true, notasAdmin: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        },
        notifications: {
          select: { id: true, tipo: true, titulo: true, mensagem: true, lida: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (order) {
      // ── Pedido encontrado em event_orders ─────────────────────────────────
      const timeline: { time: string; label: string; detail?: string | null }[] = [];
      timeline.push({ time: order.createdAt.toISOString(), label: "Pedido criado", detail: order.numeroPedido });

      for (const n of order.notifications) {
        timeline.push({ time: n.createdAt.toISOString(), label: n.titulo, detail: n.mensagem });
      }
      for (const r of order.refunds) {
        const refLabel = r.status === "SOLICITADO" ? "Reembolso solicitado"
          : r.status === "APROVADO" ? "Reembolso aprovado"
          : r.status === "NEGADO"   ? "Reembolso negado"
          : "Reembolso processado";
        timeline.push({ time: r.createdAt.toISOString(), label: refLabel, detail: r.motivo ?? r.notasAdmin });
      }
      for (const qr of order.qrcodes) {
        timeline.push({ time: qr.createdAt.toISOString(), label: "QRCode gerado", detail: qr.ticketCode });
        if (qr.usedAt) timeline.push({ time: qr.usedAt.toISOString(), label: "Check-in realizado", detail: qr.ticketCode });
      }
      if (order.cancelledAt) {
        timeline.push({ time: order.cancelledAt.toISOString(), label: "Pedido cancelado", detail: order.notas });
      }
      timeline.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

      return NextResponse.json(serializeBigInts({ ...order, timeline }));
    }

    // ── Fallback: tenta na tabela `orders` (Flutter app) ───────────────────
    const flutterOrder = await prisma.order.findUnique({
      where: { id },
      include: {
        event: {
          select: {
            id: true, nome: true, dataInicio: true, dataFim: true,
            local: true, churchId: true, imagemUrl: true, tipoEvento: true,
            gratuito: true, preco: true, descricao: true, localEndereco: true,
            bannerUrl: true,
            participants: {
              select: { id: true, nome: true, papel: true, fotoUrl: true, ordem: true },
              orderBy: { ordem: "asc" },
            },
            sectors: {
              orderBy: { ordem: "asc" as const },
              select: { id: true, nome: true, preco: true, corHex: true, quantidade: true },
            },
          },
        },
        items: {
          include: {
            seat:   { select: { numero: true, status: true, row: { select: { nome: true } } } },
            sector: { select: { nome: true, preco: true, corHex: true } },
          },
        },
        qrcodes: {
          select: { id: true, ticketCode: true, qrPayload: true, isUsed: true, usedAt: true, isCancelled: true, issuedAt: true },
          orderBy: { issuedAt: "asc" },
        },
      },
    });

    if (!flutterOrder) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
    }

    // Normaliza para o mesmo shape esperado pelo frontend
    const FLUTTER_STATUS_LABEL: Record<string, string> = {
      PENDING_PAYMENT:  "AGUARDANDO_PAGAMENTO",
      PAID:             "PAGO",
      CANCELLED:        "CANCELADO",
      EXPIRED:          "EXPIRADO",
      REFUND_REQUESTED:  "SOLICITANDO_REEMBOLSO",
      REQUESTING_REFUND: "SOLICITANDO_REEMBOLSO",
      REFUNDED:          "REEMBOLSADO",
    };

    const normalized = {
      ...flutterOrder,
      numeroPedido: flutterOrder.orderNumber,
      subtotal:     flutterOrder.total,
      desconto:     0,
      notas:        flutterOrder.notes,
      cancelledAt:  null,
      status:       FLUTTER_STATUS_LABEL[flutterOrder.status] ?? flutterOrder.status,
      refunds:      [],
      notifications: [],
      // Normaliza qrcodes para o shape do MRM
      qrcodes: flutterOrder.qrcodes.map(q => ({
        id:          q.id,
        ticketCode:  q.ticketCode,
        qrData:      q.qrPayload,
        isUsed:      q.isUsed,
        usedAt:      q.usedAt,
        isCancelled: q.isCancelled,
        createdAt:   q.issuedAt,
      })),
      // Normaliza items
      items: flutterOrder.items.map(item => ({
        ...item,
        sectorNome: item.sector?.nome ?? null,
        rowNome:    item.seat?.row?.nome ?? null,
        seatNumero: item.seat?.numero ?? null,
      })),
      _flutterSource: true,
    };

    const timeline: { time: string; label: string; detail?: string | null }[] = [];
    timeline.push({ time: flutterOrder.createdAt.toISOString(), label: "Pedido criado", detail: flutterOrder.orderNumber });
    for (const qr of flutterOrder.qrcodes) {
      timeline.push({ time: qr.issuedAt.toISOString(), label: "QRCode gerado", detail: qr.ticketCode });
      if (qr.usedAt) timeline.push({ time: qr.usedAt.toISOString(), label: "Check-in realizado", detail: qr.ticketCode });
    }
    timeline.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    return NextResponse.json(serializeBigInts({ ...normalized, timeline }));
  });
}

/**
 * DELETE /api/events/orders/[id]
 * Exclui permanentemente o pedido e todos os dados relacionados.
 * Também remove o registro da tabela `orders` (app Flutter) se existir.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(req, async () => {
    const { id } = await params;

    // Verifica primeiro em event_orders (legado/MRM)
    const mrmOrder = await prisma.eventOrder.findUnique({
      where: { id },
      select: { id: true, numeroPedido: true },
    });

    if (mrmOrder) {
      // ── Deletar pedido MRM (event_orders) ──────────────────────────────────
      await prisma.$transaction(async (tx) => {
        const items = await tx.eventOrderItem.findMany({
          where: { orderId: id },
          select: { seatId: true },
        });
        const seatIds = items.map(i => i.seatId).filter(Boolean) as string[];

        await tx.eventNotification.deleteMany({ where: { orderId: id } });
        await tx.eventRefund.deleteMany({ where: { orderId: id } });
        await tx.eventQRCode.deleteMany({ where: { orderId: id } });
        await tx.eventOrderItem.deleteMany({ where: { orderId: id } });

        if (seatIds.length > 0) {
          await tx.eventSeat.updateMany({
            where: { id: { in: seatIds } },
            data: { status: "LIVRE", reservadoPor: null, reservadoEm: null, reservaExpira: null, orderItemId: null },
          });
        }

        await tx.eventOrder.delete({ where: { id } });
      });

      // Remove também o registro espelhado em `orders` se existir
      if (mrmOrder.numeroPedido) {
        await prisma.$executeRawUnsafe(
          `DELETE FROM orders WHERE order_number = $1`,
          mrmOrder.numeroPedido,
        ).catch(() => null);
      }

      return NextResponse.json({ ok: true });
    }

    // ── Fallback: tenta na tabela `orders` (Flutter) ───────────────────────
    const flutterOrder = await prisma.order.findUnique({
      where: { id },
      select: { id: true, orderNumber: true },
    });

    if (!flutterOrder) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // Descobre assentos via order_items
      const items = await tx.orderItem.findMany({
        where: { orderId: id },
        select: { seatId: true },
      });
      const seatIds = items.map(i => i.seatId).filter(Boolean) as string[];

      // Deleta filhos em cascata (order_qrcodes, order_status_history, order_items)
      await tx.orderQRCode.deleteMany({ where: { orderId: id } });
      await tx.orderStatusHistory.deleteMany({ where: { orderId: id } });
      await tx.orderItem.deleteMany({ where: { orderId: id } });

      // Libera assentos
      if (seatIds.length > 0) {
        await tx.eventSeat.updateMany({
          where: { id: { in: seatIds } },
          data: { status: "LIVRE", reservadoPor: null, reservadoEm: null, reservaExpira: null, orderItemId: null },
        });
      }

      await tx.order.delete({ where: { id } });
    });

    return NextResponse.json({ ok: true });
  });
}
