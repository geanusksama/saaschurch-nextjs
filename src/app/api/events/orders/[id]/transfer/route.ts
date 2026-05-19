/**
 * POST /api/events/orders/[id]/transfer
 * Transfere a titularidade de um pedido para outro membro pelo CPF.
 *
 * Body: { cpf: string }
 * Busca o membro na tabela members pelo CPF, atualiza buyer_* e user_id do pedido,
 * cancela QR Codes ativos (precisam ser regerados pelo novo titular),
 * registra notificação de transferência.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

/** Normaliza CPF: remove pontos, traços, espaços */
function cleanCpf(cpf: string) {
  return cpf.replace(/\D/g, "");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const cpf: string | undefined = body?.cpf;

    if (!cpf || cleanCpf(cpf).length < 11) {
      return NextResponse.json({ error: "CPF inválido." }, { status: 400 });
    }

    // Busca o membro pelo CPF (aceita com ou sem formatação)
    const rawCpf = cleanCpf(cpf);
    const formattedCpf = rawCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

    const member = await prisma.member.findFirst({
      where: {
        OR: [
          { cpf: rawCpf },
          { cpf: formattedCpf },
        ],
        deletedAt: null,
      },
      select: {
        id: true,
        fullName: true,
        preferredName: true,
        email: true,
        mobile: true,
        phone: true,
        cpf: true,
        userId: true,
        photoUrl: true,
      },
    });

    if (!member) {
      return NextResponse.json({ error: "Membro não encontrado com este CPF." }, { status: 404 });
    }

    // Busca o pedido
    const order = await prisma.eventOrder.findUnique({
      where: { id },
      select: { id: true, status: true, eventId: true, userId: true, numeroPedido: true, buyerName: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    }

    if (!["AGUARDANDO_PAGAMENTO", "PAGO"].includes(order.status)) {
      return NextResponse.json({ error: "Só é possível transferir pedidos com status Aguardando ou Pago." }, { status: 422 });
    }

    const displayName = member.preferredName ?? member.fullName;
    const phone = member.mobile ?? member.phone ?? null;

    // Atualiza o pedido com os dados do novo titular
    const previousBuyerName = order.buyerName ?? "Desconhecido";

    await prisma.eventOrder.update({
      where: { id },
      data: {
        buyerName:  displayName,
        buyerEmail: member.email ?? null,
        buyerPhone: phone,
        // Atualiza user_id se o membro tiver userId vinculado
        ...(member.userId ? { userId: member.userId } : {}),
        notas: `Transferido para ${displayName} (CPF: ${formattedCpf}) por ${user.fullName ?? "admin"} em ${new Date().toLocaleString("pt-BR")}`,
      },
    });

    // Registra histórico de transferência
    await prisma.$executeRawUnsafe(
      `INSERT INTO event_ticket_transfer (order_id, from_name, from_member_id, to_name, to_member_id, transferred_by, transferred_by_id)
       VALUES ($1::uuid, $2, $3::uuid, $4, $5::uuid, $6, $7::uuid)`,
      id,
      previousBuyerName,
      null,          // from_member_id — não temos o membro origem aqui
      displayName,
      member.id,
      user.fullName ?? "admin",
      user.id ?? null,
    ).catch(() => null); // tabela pode não existir ainda em dev

    // Cancela QR Codes ativos — o novo titular precisa regerar pelo app
    await prisma.eventQRCode.updateMany({
      where: { orderId: id, isUsed: false, isCancelled: false },
      data: { isCancelled: true, cancelledAt: new Date() },
    });

    // Registra notificação (para o novo usuário se tiver userId)
    if (member.userId) {
      await prisma.eventNotification.create({
        data: {
          eventId:  order.eventId,
          userId:   member.userId,
          orderId:  order.id,
          tipo:     "transfer_request",
          titulo:   "Ingresso transferido para você",
          mensagem: `O pedido ${order.numeroPedido} foi transferido para você.`,
          aceita:   true,
        },
      }).catch(() => null);
    }

    return NextResponse.json(serializeBigInts({
      success: true,
      fromName: previousBuyerName,
      member: {
        id:        member.id,
        fullName:  displayName,
        email:     member.email,
        phone,
        cpf:       formattedCpf,
        photoUrl:  member.photoUrl,
        userId:    member.userId,
      },
    }));
  });
}

/**
 * GET /api/events/orders/[id]/transfer?cpf=xxx
 * Busca membro pelo CPF para preview antes de confirmar transferência.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withAuth(req, async () => {
    await params; // consumir
    const cpf = new URL(req.url).searchParams.get("cpf") ?? "";
    if (!cpf || cleanCpf(cpf).length < 11) {
      return NextResponse.json({ member: null });
    }

    const rawCpf = cleanCpf(cpf);
    const formattedCpf = rawCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

    const member = await prisma.member.findFirst({
      where: {
        OR: [{ cpf: rawCpf }, { cpf: formattedCpf }],
        deletedAt: null,
      },
      select: {
        id: true, fullName: true, preferredName: true,
        email: true, mobile: true, phone: true, cpf: true,
        photoUrl: true, userId: true,
        ecclesiasticalTitle: true,
      },
    });

    if (!member) return NextResponse.json({ member: null });

    return NextResponse.json(serializeBigInts({
      member: {
        id:        member.id,
        fullName:  member.preferredName ?? member.fullName,
        email:     member.email,
        phone:     member.mobile ?? member.phone,
        cpf:       formattedCpf,
        photoUrl:  member.photoUrl,
        userId:    member.userId,
        title:     member.ecclesiasticalTitle,
      },
    }));
  });
}
