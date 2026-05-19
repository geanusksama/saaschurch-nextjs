/**
 * PedidosKanban — Pipeline administrativo de pedidos de ingressos do APP.
 *
 * MRM NÃO cria pedidos. Apenas consulta, acompanha, move e executa ações.
 */
"use client";
import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShoppingCart, Search, RefreshCw, LayoutGrid, List,
  MessageCircle, Copy, Send, XCircle, Eye,
  QrCode, CheckCircle2, Clock, AlertTriangle,
  Banknote, Ticket, TrendingUp, MoreVertical,
} from "lucide-react";
import { toast } from "sonner";
import { PedidoDetailPanel } from "./PedidoDetailPanel";

// ── Types ─────────────────────────────────────────────────────────────────────

type OrderItem = {
  id: string; qty: number; unitPrice: number; subtotal: number; status: string;
  seat?: { numero: number; row?: { nome: string } | null } | null;
  sector?: { nome: string; corHex: string | null } | null;
};

type Order = {
  id: string; numeroPedido: string | null; buyerName: string | null;
  buyerEmail: string | null; buyerPhone: string | null;
  subtotal: number; desconto: number; total: number;
  paymentMethod: string | null; paymentAttempts: number;
  status: string; notas: string | null; cancelledAt: string | null; createdAt: string;
  event?: { id: string; nome: string; dataInicio: string; churchId: string } | null;
  items: OrderItem[];
  _count: { items: number; qrcodes: number };
};

type KanbanColumn = {
  columnIndex: number; name: string; color: string;
  statuses: string[]; orders: Order[];
};

// ── Color maps (SecretariatPipeline style) ────────────────────────────────────

const COL_BORDER: Record<string, string> = {
  yellow: "border-t-amber-400",
  green:  "border-t-emerald-500",
  orange: "border-t-orange-500",
  purple: "border-t-violet-500",
  red:    "border-t-rose-500",
};

const COL_BADGE: Record<string, string> = {
  yellow: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  green:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  purple: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  red:    "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
};

const PM_LABELS: Record<string, string> = {
  pix:         "PIX",
  credit_card: "Crédito",
  debit_card:  "Débito",
  free:        "Gratuito",
  boleto:      "Boleto",
};

// ── API helpers ───────────────────────────────────────────────────────────────

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = localStorage.getItem("mrm_token");
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
}

async function fetchKanban(search: string, eventId: string, dateFrom: string, dateTo: string): Promise<{ columns: KanbanColumn[] }> {
  const p = new URLSearchParams({ view: "kanban" });
  if (search)   p.set("search",   search);
  if (eventId)  p.set("eventId",  eventId);
  if (dateFrom) p.set("dateFrom", dateFrom);
  if (dateTo)   p.set("dateTo",   dateTo);
  const r = await fetch(`/api/events/orders?${p}`, { headers: authHeaders() });
  if (!r.ok) throw new Error("Erro ao carregar pedidos");
  return r.json();
}

async function fetchStats() {
  const r = await fetch("/api/events/orders/stats", { headers: authHeaders() });
  if (!r.ok) throw new Error("Erro ao carregar estatísticas");
  return r.json();
}

async function moveStatus(id: string, status: string) {
  const r = await fetch(`/api/events/orders/${id}/status`, {
    method: "PATCH", headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ status }),
  });
  if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "Erro ao mover pedido"); }
  return r.json();
}

async function cancelOrder(id: string, motivo?: string) {
  const r = await fetch(`/api/events/orders/${id}/cancel`, {
    method: "POST", headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ motivo }),
  });
  if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "Erro ao cancelar"); }
  return r.json();
}

async function resendCharge(id: string) {
  const r = await fetch(`/api/events/orders/${id}/resend`, { method: "POST", headers: authHeaders() });
  if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "Erro ao reenviar"); }
  return r.json();
}

async function generateQRCode(id: string) {
  const r = await fetch(`/api/events/orders/${id}/qrcode`, { method: "POST", headers: authHeaders() });
  if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "Erro ao gerar QR Code"); }
  return r.json();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

// ── Stats Row ─────────────────────────────────────────────────────────────────

function StatsRow() {
  const { data: stats } = useQuery({ queryKey: ["orders-stats"], queryFn: fetchStats, refetchInterval: 30_000 });

  const items = [
    { label: "Pendentes",    value: stats?.pendingCount   ?? "–", icon: <Clock         className="w-4 h-4 text-amber-500" />,   color: "text-amber-600"   },
    { label: "Pagos",        value: stats?.paidCount      ?? "–", icon: <CheckCircle2  className="w-4 h-4 text-emerald-500" />, color: "text-emerald-600" },
    { label: "Reemb. Req.",  value: stats?.refundReqCount ?? "–", icon: <AlertTriangle className="w-4 h-4 text-orange-500" />, color: "text-orange-600"  },
    { label: "Reembolsados", value: stats?.refundedCount  ?? "–", icon: <Banknote      className="w-4 h-4 text-violet-500" />,  color: "text-violet-600"  },
    { label: "Cancelados",   value: stats?.cancelledCount ?? "–", icon: <XCircle       className="w-4 h-4 text-rose-500" />,    color: "text-rose-600"    },
    { label: "Receita",      value: stats?.totalRevenue !== undefined ? fmtBRL(stats.totalRevenue) : "–",
      icon: <TrendingUp className="w-4 h-4 text-blue-500" />, color: "text-blue-700 font-semibold" },
  ];

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-5">
      {items.map((s) => (
        <div key={s.label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2.5 flex items-center gap-2.5">
          {s.icon}
          <div>
            <p className={`text-base font-bold leading-none ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{s.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Order Card ────────────────────────────────────────────────────────────────

function OrderCard({
  order, colColor, onDragStart, onOpen, onResend, onCancel, onGenerateQR,
}: {
  order: Order; colColor: string;
  onDragStart: (e: React.DragEvent, order: Order) => void;
  onOpen: (order: Order) => void;
  onResend: (order: Order) => void;
  onCancel: (order: Order) => void;
  onGenerateQR: (order: Order) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isPaid    = order.status === "PAGO";
  const isWaiting = ["AGUARDANDO_PAGAMENTO", "EXPIRADO"].includes(order.status);
  const pm        = PM_LABELS[order.paymentMethod ?? ""] ?? order.paymentMethod ?? "–";

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(`${window.location.origin}/checkin?order=${order.id}`);
    toast.success("Link copiado!");
    setMenuOpen(false);
  }, [order.id]);

  const whatsapp = useCallback(() => {
    if (!order.buyerPhone) return;
    const phone = order.buyerPhone.replace(/\D/g, "");
    const msg = encodeURIComponent(`Olá${order.buyerName ? ` ${order.buyerName}` : ""}, seu pedido *${order.numeroPedido}* aguarda pagamento. Acesse: ${window.location.origin}/checkin?order=${order.id}`);
    window.open(`https://wa.me/55${phone}?text=${msg}`, "_blank");
    setMenuOpen(false);
  }, [order]);

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, order)}
      className={`relative bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing border-t-4 ${COL_BORDER[colColor] ?? "border-t-slate-300"}`}
    >
      <div className="p-3.5">
        {/* Badges */}
        <div className="flex items-center gap-1.5 mb-3 flex-wrap pr-6">
          <StatusBadge status={order.status} />
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            {pm}
          </span>
          {order.paymentAttempts > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400">
              {order.paymentAttempts}× tent.
            </span>
          )}
        </div>

        {/* Type label */}
        <p className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-0.5">Ingresso</p>

        {/* Buyer */}
        <p className="font-bold text-slate-900 dark:text-white text-sm leading-tight truncate">
          {order.buyerName ?? "Sem nome"}
        </p>
        {order.event?.nome && (
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{order.event.nome}</p>
        )}

        {/* Amount + items */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
            <Ticket className="w-3 h-3" />
            <span>{order._count.items} {order._count.items === 1 ? "item" : "itens"}</span>
            {order._count.qrcodes > 0 && (
              <span className="text-emerald-600 dark:text-emerald-400 ml-1">· {order._count.qrcodes} QR</span>
            )}
          </div>
          <span className="text-sm font-bold text-slate-900 dark:text-white">{fmtBRL(order.total)}</span>
        </div>

        {/* Seat labels (max 3) */}
        {order.items.some(i => i.seat) && (() => {
          const labels = order.items
            .filter(i => i.seat)
            .map(i => `${i.seat!.row?.nome ?? ""}${i.seat!.numero}`)
            .slice(0, 3);
          const extra = order.items.filter(i => i.seat).length - 3;
          return (
            <div className="flex flex-wrap gap-1 mt-2">
              {labels.map((l, i) => (
                <span key={i} className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">{l}</span>
              ))}
              {extra > 0 && <span className="px-1.5 py-0.5 text-[10px] text-slate-400">+{extra}</span>}
            </div>
          );
        })()}

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700">
          <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500 truncate max-w-[120px]">
            {order.numeroPedido ?? "–"}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">{fmtDate(order.createdAt)}</p>
        </div>
      </div>

      {/* Actions menu */}
      <div className="absolute top-2.5 right-2.5">
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
          className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </button>
        {menuOpen && (
          <div
            className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 z-50 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => { onOpen(order); setMenuOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
              <Eye className="w-3.5 h-3.5" /> Ver detalhes
            </button>
            {isPaid && (
              <button onClick={() => { onGenerateQR(order); setMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20">
                <QrCode className="w-3.5 h-3.5" /> Gerar QR Code
              </button>
            )}
            {isWaiting && (
              <button onClick={() => { onResend(order); setMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                <Send className="w-3.5 h-3.5" /> Reenviar cobrança
              </button>
            )}
            {order.buyerPhone && (
              <button onClick={whatsapp}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20">
                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
              </button>
            )}
            <button onClick={copyLink}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
              <Copy className="w-3.5 h-3.5" /> Copiar link
            </button>
            <div className="border-t border-slate-100 dark:border-slate-700" />
            <button onClick={() => { if (confirm(`Cancelar pedido ${order.numeroPedido}?`)) { onCancel(order); setMenuOpen(false); } }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20">
              <XCircle className="w-3.5 h-3.5" /> Cancelar pedido
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Kanban Column ─────────────────────────────────────────────────────────────

function KanbanCol({
  col, onDrop, onOpen, onResend, onCancel, onGenerateQR,
}: {
  col: KanbanColumn;
  onDrop: (order: Order, colIdx: number) => void;
  onOpen: (order: Order) => void;
  onResend: (order: Order) => void;
  onCancel: (order: Order) => void;
  onGenerateQR: (order: Order) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const dragRef = useRef<Order | null>(null);

  const handleDragStart = (e: React.DragEvent, order: Order) => {
    dragRef.current = order;
    e.dataTransfer.effectAllowed = "move";
  };

  const badgeCls = COL_BADGE[col.color] ?? "bg-slate-100 text-slate-600";

  return (
    <div
      className={`flex flex-col h-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm border-t-4 ${COL_BORDER[col.color] ?? "border-t-slate-300"} transition-all ${isDragOver ? "ring-2 ring-blue-400 scale-[1.01]" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragOver(false); if (dragRef.current) onDrop(dragRef.current, col.columnIndex); }}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{col.name}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badgeCls}`}>{col.orders.length}</span>
      </div>

      {/* Cards */}
      <div className="flex-1 min-h-0 p-3 space-y-2.5 overflow-y-auto">
        {col.orders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-slate-400 dark:text-slate-600">
            <ShoppingCart className="w-7 h-7 mb-2 opacity-30" />
            <p className="text-xs">Sem dados</p>
          </div>
        )}
        {col.orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            colColor={col.color}
            onDragStart={handleDragStart}
            onOpen={onOpen}
            onResend={onResend}
            onCancel={onCancel}
            onGenerateQR={onGenerateQR}
          />
        ))}
      </div>
    </div>
  );
}
// ── Main Component ────────────────────────────────────────────────────────────

function currentMonthRange() {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const from = new Date(y, m, 1);
  const to   = new Date(y, m + 1, 0);
  const fmt  = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

export default function PedidosKanban() {
  const [search, setSearch]   = useState("");
  const [eventId, setEventId] = useState("");
  const [view, setView]       = useState<"kanban" | "list">("kanban");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const initRange = currentMonthRange();
  const [dateFrom, setDateFrom] = useState(initRange.from);
  const [dateTo,   setDateTo]   = useState(initRange.to);
  const qc = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["orders-kanban", search, eventId, dateFrom, dateTo],
    queryFn: () => fetchKanban(search, eventId, dateFrom, dateTo),
    refetchInterval: 60_000,
  });

  const moveMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => moveStatus(id, status),
    onSuccess: () => { toast.success("Pedido movido!"); qc.invalidateQueries({ queryKey: ["orders-kanban"] }); qc.invalidateQueries({ queryKey: ["orders-stats"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMut = useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo?: string }) => cancelOrder(id, motivo),
    onSuccess: () => { toast.success("Pedido cancelado."); qc.invalidateQueries({ queryKey: ["orders-kanban"] }); qc.invalidateQueries({ queryKey: ["orders-stats"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const resendMut = useMutation({
    mutationFn: (id: string) => resendCharge(id),
    onSuccess: () => { toast.success("Cobrança reenviada!"); qc.invalidateQueries({ queryKey: ["orders-kanban"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const qrMut = useMutation({
    mutationFn: (id: string) => generateQRCode(id),
    onSuccess: (d) => { toast.success(`${d.generated} QR Code(s) gerado(s)!`); qc.invalidateQueries({ queryKey: ["orders-kanban"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Status mapping para drag-drop ───────────────────────────────────────────
  const COLUMN_TARGET_STATUS: Record<number, string> = {
    1: "AGUARDANDO_PAGAMENTO",
    2: "PAGO",
    3: "SOLICITANDO_REEMBOLSO",
    4: "REEMBOLSADO",
    5: "CANCELADO",
  };

  const handleDrop = useCallback((order: Order, targetColIndex: number) => {
    const newStatus = COLUMN_TARGET_STATUS[targetColIndex];
    if (!newStatus || order.status === newStatus) return;
    moveMut.mutate({ id: order.id, status: newStatus });
  }, [moveMut]);

  const cols = data?.columns ?? [];
  const allOrders = cols.flatMap((c) => c.orders);
  const isProcessing = moveMut.isPending || cancelMut.isPending || resendMut.isPending || qrMut.isPending;
  const totalReg = allOrders.length;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] p-4 sm:p-6 overflow-hidden">
      {/* ── Header ── */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center">
            <ShoppingCart className="w-6 h-6 text-blue-600 dark:text-blue-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Pipeline · Pedidos</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Gestão operacional dos pedidos do APP
              {totalReg > 0 && <span className="ml-2 text-xs font-medium text-slate-400">· {totalReg} reg.</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isProcessing && (
            <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <RefreshCw className="w-3 h-3 animate-spin" /> Processando…
            </span>
          )}
          <button
            onClick={() => setView((v) => v === "kanban" ? "list" : "kanban")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            {view === "kanban" ? <><List className="w-4 h-4" /> Lista</> : <><LayoutGrid className="w-4 h-4" /> Kanban</>}
          </button>
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} /> Atualizar
          </button>
        </div>
      </div>

      {/* ── Search + Date filter ── */}
      <div className="flex flex-wrap gap-2 mb-5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por número, nome, email ou telefone..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 dark:text-slate-400 shrink-0">De</label>
          <input
            type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="py-2 px-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
          />
          <label className="text-xs text-slate-500 dark:text-slate-400 shrink-0">Até</label>
          <input
            type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="py-2 px-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* ── Stats ── */}
      <StatsRow />

      {/* ── Error ── */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {(error as Error).message}
        </div>
      )}

      {/* ── Kanban ── */}
      {view === "kanban" && (
        isLoading ? (
          <div className="flex-1 grid grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {cols.map((col) => (
              <KanbanCol
                key={col.columnIndex} col={col}
                onDrop={handleDrop}
                onOpen={setSelectedOrder}
                onResend={(o) => resendMut.mutate(o.id)}
                onCancel={(o) => cancelMut.mutate({ id: o.id })}
                onGenerateQR={(o) => qrMut.mutate(o.id)}
              />
            ))}
          </div>
        )
      )}

      {/* ── List View ── */}
      {view === "list" && (
        <div className="flex-1 min-h-0 overflow-auto bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">
              <tr>
                {["Pedido", "Comprador", "Evento", "Total", "Método", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {allOrders
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{order.numeroPedido ?? "–"}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900 dark:text-white">{order.buyerName ?? "–"}</p>
                      <p className="text-xs text-slate-500">{order.buyerPhone ?? order.buyerEmail ?? "–"}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{order.event?.nome ?? "–"}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{fmtBRL(order.total)}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{PM_LABELS[order.paymentMethod ?? ""] ?? order.paymentMethod ?? "–"}</td>
                    <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                    <td className="px-4 py-3">
                      <button onClick={() => setSelectedOrder(order)} className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          {allOrders.length === 0 && !isLoading && (
            <div className="py-16 text-center text-slate-400 dark:text-slate-600">
              <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum pedido encontrado</p>
            </div>
          )}
        </div>
      )}
      {/* ── Detail Panel ── */}
      {selectedOrder && (
        <PedidoDetailPanel
          orderId={selectedOrder.id}
          onClose={() => setSelectedOrder(null)}
          onStatusChange={() => {
            qc.invalidateQueries({ queryKey: ["orders-kanban"] });
            qc.invalidateQueries({ queryKey: ["orders-stats"] });
          }}
        />
      )}
    </div>
  );
}

// ── Status Badge (shared with PedidoDetailPanel) ──────────────────────────────

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    AGUARDANDO_PAGAMENTO:  { label: "Aguardando",  cls: "bg-amber-100   text-amber-700   dark:bg-amber-900/30   dark:text-amber-400"   },
    EXPIRADO:              { label: "Expirado",    cls: "bg-slate-100   text-slate-600   dark:bg-slate-700      dark:text-slate-400"   },
    PAGO:                  { label: "Pago",        cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    SOLICITANDO_REEMBOLSO: { label: "Reemb. Req.", cls: "bg-orange-100  text-orange-700  dark:bg-orange-900/30  dark:text-orange-400"  },
    REEMBOLSADO:           { label: "Reembolsado", cls: "bg-violet-100  text-violet-700  dark:bg-violet-900/30  dark:text-violet-400"  },
    CANCELADO:             { label: "Cancelado",   cls: "bg-rose-100    text-rose-700    dark:bg-rose-900/30    dark:text-rose-400"    },
  };
  const s = map[status] ?? { label: status, cls: "bg-slate-100 text-slate-600" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${s.cls}`}>{s.label}</span>;
}
