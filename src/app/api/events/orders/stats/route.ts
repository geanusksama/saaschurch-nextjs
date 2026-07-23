/**
 * GET /api/events/orders/stats
 * Totalizadores para o dashboard do Kanban de Pedidos.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";
import type { AuthUser } from "@/lib/auth";

async function resolveChurchIds(user: AuthUser): Promise<string[] | null> {
  // master sem campo definido ve tudo; com campo, fica preso ao campo logado
  if (user.profileType === "master" && !user.campoId) return null;
  if (user.campoId) {
    const churches = await prisma.church.findMany({ where: { regional: { campoId: user.campoId }, deletedAt: null }, select: { id: true } });
    return churches.map((c) => c.id);
  }
  if (user.regionalId) {
    const churches = await prisma.church.findMany({ where: { regionalId: user.regionalId, deletedAt: null }, select: { id: true } });
    return churches.map((c) => c.id);
  }
  return user.churchId ? [user.churchId] : [];
}

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const churchIds = await resolveChurchIds(user);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eventFilter: Record<string, any> = churchIds !== null ? { event: { churchId: { in: churchIds } } } : {};

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flutterFilter: Record<string, any> = churchIds !== null ? { event: { churchId: { in: churchIds } } } : {};

    // Conta das duas tabelas em paralelo
    const [
      mrmPending, mrmPaid, mrmRefundReq, mrmRefunded, mrmCancelled, mrmRevenue,
      flPending, flPaid, flCancelled, flExpired, flRevenue,
    ] = await Promise.all([
      // event_orders (legado/MRM)
      prisma.eventOrder.count({ where: { ...eventFilter, status: { in: ["AGUARDANDO_PAGAMENTO","EXPIRADO"] } } }),
      prisma.eventOrder.count({ where: { ...eventFilter, status: "PAGO" } }),
      prisma.eventOrder.count({ where: { ...eventFilter, status: "SOLICITANDO_REEMBOLSO" } }),
      prisma.eventOrder.count({ where: { ...eventFilter, status: "REEMBOLSADO" } }),
      prisma.eventOrder.count({ where: { ...eventFilter, status: "CANCELADO" } }),
      prisma.eventOrder.aggregate({ where: { ...eventFilter, status: "PAGO" }, _sum: { total: true } }),
      // orders (Flutter)
      prisma.order.count({ where: { ...flutterFilter, status: { in: ["PENDING_PAYMENT"] } } }),
      prisma.order.count({ where: { ...flutterFilter, status: "PAID" } }),
      prisma.order.count({ where: { ...flutterFilter, status: "CANCELLED" } }),
      prisma.order.count({ where: { ...flutterFilter, status: "EXPIRED" } }),
      prisma.order.aggregate({ where: { ...flutterFilter, status: "PAID" }, _sum: { total: true } }),
    ]);

    return NextResponse.json(serializeBigInts({
      pendingCount:   mrmPending  + flPending + flExpired,
      paidCount:      mrmPaid     + flPaid,
      refundReqCount: mrmRefundReq,
      refundedCount:  mrmRefunded,
      cancelledCount: mrmCancelled + flCancelled,
      totalRevenue:   Number(mrmRevenue._sum.total ?? 0) + Number(flRevenue._sum.total ?? 0),
    }));
  });
}
