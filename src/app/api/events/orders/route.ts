/**
 * GET /api/events/orders
 * Lista pedidos agrupados por status para o Kanban PEDIDOS.
 *
 * Query params:
 *   view=kanban (default) | list
 *   search=<string>
 *   eventId=<uuid>
 *   status=<string>   (filtra coluna específica)
 *   page=<n>          (usado no modo list)
 *   limit=<n>
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";
import type { AuthUser } from "@/lib/auth";

// Status → coluna do Kanban
export const STATUS_TO_COLUMN: Record<string, number> = {
  AGUARDANDO_PAGAMENTO:  1,
  EXPIRADO:              1,
  PAGO:                  2,
  SOLICITANDO_REEMBOLSO: 3,
  REEMBOLSADO:           4,
  CANCELADO:             5,
};

/** Retorna a lista de churchIds visíveis para o usuário */
async function resolveChurchIds(user: AuthUser): Promise<string[] | null> {
  if (user.profileType === "master") return null; // sem filtro

  if (user.profileType === "church" || user.roleName) {
    if (user.churchId) return [user.churchId];
  }
  if (user.campoId) {
    const churches = await prisma.church.findMany({
      where: { regional: { campoId: user.campoId }, deletedAt: null },
      select: { id: true },
    });
    return churches.map((c) => c.id);
  }
  if (user.regionalId) {
    const churches = await prisma.church.findMany({
      where: { regionalId: user.regionalId, deletedAt: null },
      select: { id: true },
    });
    return churches.map((c) => c.id);
  }
  return user.churchId ? [user.churchId] : [];
}

function buildWhere(
  churchIds: string[] | null,
  search: string,
  eventId: string,
  status: string,
  dateFrom: string,
  dateTo: string,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};

  if (churchIds !== null) {
    where.event = { churchId: { in: churchIds } };
  }
  if (eventId) {
    where.eventId = eventId;
  }
  if (status) {
    where.status = status;
  }
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(`${dateFrom}T00:00:00.000Z`);
    if (dateTo)   where.createdAt.lte = new Date(`${dateTo}T23:59:59.999Z`);
  }
  if (search) {
    where.OR = [
      { numeroPedido: { contains: search, mode: "insensitive" } },
      { buyerName:    { contains: search, mode: "insensitive" } },
      { buyerEmail:   { contains: search, mode: "insensitive" } },
      { buyerPhone:   { contains: search, mode: "insensitive" } },
    ];
  }
  return where;
}

const ORDER_SELECT = {
  id: true,
  numeroPedido: true,
  buyerName: true,
  buyerEmail: true,
  buyerPhone: true,
  subtotal: true,
  desconto: true,
  total: true,
  paymentMethod: true,
  paymentAttempts: true,
  status: true,
  notas: true,
  cancelledAt: true,
  createdAt: true,
  event: { select: { id: true, nome: true, dataInicio: true, churchId: true } },
  items: {
    select: {
      id: true, qty: true, unitPrice: true, subtotal: true, status: true,
      seat: { select: { numero: true, row: { select: { nome: true } } } },
      sector: { select: { nome: true, corHex: true } },
    },
  },
  _count: { select: { items: true, qrcodes: true } },
};

// Mapeamento de status do Flutter app → formato MRM
const FLUTTER_STATUS_MAP: Record<string, string> = {
  PENDING_PAYMENT:   "AGUARDANDO_PAGAMENTO",
  PAID:              "PAGO",
  CANCELLED:         "CANCELADO",
  EXPIRED:           "EXPIRADO",
  REFUND_REQUESTED:  "SOLICITANDO_REEMBOLSO",
  REFUNDED:          "REEMBOLSADO",
};

/** Normaliza um pedido da tabela `orders` (Flutter) para o shape do MRM */
function normalizeFlutterOrder(o: {
  id: string;
  orderNumber: string;
  buyerName: string | null;
  buyerEmail: string | null;
  buyerPhone: string | null;
  total: unknown;
  paymentMethod: string | null;
  paymentAttempts: number;
  status: string;
  notes: string | null;
  createdAt: Date;
  event: { id: string; nome: string; dataInicio: Date; churchId: string } | null;
  items: {
    id: string; qty: number; unitPrice: unknown; subtotal: unknown; status: string;
    seat: { numero: number; row: { nome: string } | null; sector: { nome: string; corHex: string | null } | null } | null;
    sector: { nome: string; corHex: string | null } | null;
  }[];
  _count: { items: number; qrcodes: number };
}) {
  return {
    ...o,
    numeroPedido:   o.orderNumber,
    subtotal:       o.total,
    desconto:       0,
    notas:          o.notes,
    cancelledAt:    null as Date | null,
    status:         FLUTTER_STATUS_MAP[o.status] ?? o.status,
    _flutterSource: true,
    // Normaliza items: se sector_id é null, usa o setor do assento
    items: o.items.map(item => ({
      ...item,
      sector: item.sector ?? item.seat?.sector ?? null,
    })),
  };
}

const FLUTTER_ORDER_SELECT = {
  id: true,
  orderNumber: true,
  buyerName: true,
  buyerEmail: true,
  buyerPhone: true,
  total: true,
  paymentMethod: true,
  paymentAttempts: true,
  status: true,
  notes: true,
  createdAt: true,
  event: { select: { id: true, nome: true, dataInicio: true, churchId: true } },
  items: {
    select: {
      id: true, qty: true, unitPrice: true, subtotal: true, status: true,
      // sector_id pode ser null no Flutter — resolve via seat.sector como fallback
      seat:   { select: { numero: true, row: { select: { nome: true } }, sector: { select: { nome: true, corHex: true } } } },
      sector: { select: { nome: true, corHex: true } },
    },
  },
  _count: { select: { items: true, qrcodes: true } },
};

/** Monta where para a tabela `orders` (Flutter) */
function buildFlutterWhere(
  churchIds: string[] | null,
  search: string,
  eventId: string,
  status: string,
  dateFrom: string,
  dateTo: string,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};
  if (churchIds !== null) {
    where.event = { churchId: { in: churchIds } };
  }
  if (eventId) where.eventId = eventId;
  // Converte status MRM → Flutter para filtrar na tabela orders
  const reverseMap: Record<string, string> = {
    AGUARDANDO_PAGAMENTO: "PENDING_PAYMENT",
    PAGO:                 "PAID",
    CANCELADO:            "CANCELLED",
    EXPIRADO:             "EXPIRED",
    SOLICITANDO_REEMBOLSO: "REFUND_REQUESTED",
    REEMBOLSADO:          "REFUNDED",
  };
  if (status) where.status = reverseMap[status] ?? status;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(`${dateFrom}T00:00:00.000Z`);
    if (dateTo)   where.createdAt.lte = new Date(`${dateTo}T23:59:59.999Z`);
  }
  if (search) {
    where.OR = [
      { orderNumber: { contains: search, mode: "insensitive" } },
      { buyerName:   { contains: search, mode: "insensitive" } },
      { buyerEmail:  { contains: search, mode: "insensitive" } },
      { buyerPhone:  { contains: search, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const { searchParams } = new URL(req.url);
    const view     = searchParams.get("view") ?? "kanban";
    const search   = searchParams.get("search") ?? "";
    const eventId  = searchParams.get("eventId") ?? "";
    const status   = searchParams.get("status") ?? "";
    const dateFrom = searchParams.get("dateFrom") ?? "";
    const dateTo   = searchParams.get("dateTo") ?? "";
    const page     = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit    = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "50")));

    const churchIds = await resolveChurchIds(user);
    const mrmWhere     = buildWhere(churchIds, search, eventId, status, dateFrom, dateTo);
    const flutterWhere = buildFlutterWhere(churchIds, search, eventId, status, dateFrom, dateTo);

    // Busca das duas fontes em paralelo
    const [mrmOrders, flutterOrders] = await Promise.all([
      prisma.eventOrder.findMany({ where: mrmWhere, select: ORDER_SELECT, orderBy: { createdAt: "desc" }, take: 500 }),
      prisma.order.findMany({ where: flutterWhere, select: FLUTTER_ORDER_SELECT, orderBy: { createdAt: "desc" }, take: 500 }),
    ]);

    // Evita duplicatas: se um pedido Flutter tem o mesmo order_number que um MRM, o MRM prevalece
    const mrmNumbers = new Set(mrmOrders.map(o => o.numeroPedido).filter(Boolean));
    const uniqueFlutter = flutterOrders.filter(o => !mrmNumbers.has(o.orderNumber));
    const normalized = uniqueFlutter.map(normalizeFlutterOrder);

    // Merge e re-ordena por data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allOrders: any[] = [...mrmOrders, ...normalized].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    if (view === "list") {
      const paginated = allOrders.slice((page - 1) * limit, page * limit);
      return NextResponse.json(serializeBigInts({ total: allOrders.length, page, limit, orders: paginated }));
    }

    // ── Kanban view ────────────────────────────────────────────────────────
    const columns: Record<number, { columnIndex: number; name: string; color: string; statuses: string[]; orders: typeof allOrders }> = {
      1: { columnIndex: 1, name: "Aguardando Pagamento",     color: "yellow", statuses: ["AGUARDANDO_PAGAMENTO","EXPIRADO"], orders: [] },
      2: { columnIndex: 2, name: "Pagamento Realizado",       color: "green",  statuses: ["PAGO"],                           orders: [] },
      3: { columnIndex: 3, name: "Solicitação de Reembolso",  color: "orange", statuses: ["SOLICITANDO_REEMBOLSO"],           orders: [] },
      4: { columnIndex: 4, name: "Reembolsado",               color: "purple", statuses: ["REEMBOLSADO"],                    orders: [] },
      5: { columnIndex: 5, name: "Cancelado",                 color: "red",    statuses: ["CANCELADO"],                     orders: [] },
    };

    for (const order of allOrders) {
      const col = STATUS_TO_COLUMN[order.status] ?? 1;
      columns[col].orders.push(order);
    }

    return NextResponse.json(serializeBigInts({ columns: Object.values(columns) }));
  });
}
