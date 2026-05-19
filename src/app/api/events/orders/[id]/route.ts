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

    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
    }

    // ── Montar timeline ────────────────────────────────────────────────────────
    const timeline: { time: string; label: string; detail?: string | null }[] = [];

    timeline.push({ time: order.createdAt.toISOString(), label: "Pedido criado", detail: order.numeroPedido });

    const statusLabel: Record<string, string> = {
      AGUARDANDO_PAGAMENTO:  "Aguardando pagamento",
      EXPIRADO:              "Pedido expirado",
      PAGO:                  "Pagamento aprovado",
      SOLICITANDO_REEMBOLSO: "Reembolso solicitado",
      REEMBOLSADO:           "Reembolso aprovado",
      CANCELADO:             "Pedido cancelado",
    };

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
      timeline.push({ time: order.cancelledAt.toISOString(), label: statusLabel["CANCELADO"], detail: order.notas });
    }

    timeline.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    return NextResponse.json(serializeBigInts({ ...order, timeline }));
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

    const order = await prisma.eventOrder.findUnique({
      where: { id },
      select: { id: true, numeroPedido: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
    }

    // Excluir em transação: filhos primeiro, depois o pedido.
    // QR codes ligados a items precisam sair antes dos items.
    await prisma.$transaction(async (tx) => {
      // 1. Notificações
      await tx.eventNotification.deleteMany({ where: { orderId: id } });

      // 2. Reembolsos
      await tx.eventRefund.deleteMany({ where: { orderId: id } });

      // 3. QR codes (podem estar ligados ao pedido ou a items)
      await tx.eventQRCode.deleteMany({ where: { orderId: id } });

      // 4. Items
      await tx.eventOrderItem.deleteMany({ where: { orderId: id } });

      // 5. O pedido em si
      await tx.eventOrder.delete({ where: { id } });
    });

    // Tentar também remover da tabela `orders` (Flutter) pelo numero_pedido.
    // Ignorar se não existir ou se o campo for nulo.
    if (order.numeroPedido) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM orders WHERE order_number = $1`,
        order.numeroPedido,
      ).catch(() => {/* tabela pode não existir ou não ter esse registro */});
    }

    return NextResponse.json({ ok: true });
  });
}
