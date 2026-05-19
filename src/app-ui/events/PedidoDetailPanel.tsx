/**
 * PedidoDetailPanel — Painel lateral com detalhes completos do pedido.
 * Inclui: informações, itens/assentos, QR Codes (com gerar/compartilhar/imprimir),
 * timeline, transferência por CPF e ações rápidas.
 */
"use client";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  X, ShoppingCart, User, Phone, Mail, CreditCard, Ticket,
  QrCode, Clock, CheckCircle2, XCircle, AlertTriangle,
  RefreshCw, Send, MessageCircle,
  CheckCheck, Ban, RotateCcw, Copy, ChevronDown,
  Printer, Share2, ArrowRightLeft, Search, CalendarDays,
  MapPin, Hash, Armchair, Trash2, Mic2,
} from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "./PedidosKanban";

// ── Types ─────────────────────────────────────────────────────────────────────

type TimelineEntry = { time: string; label: string; detail?: string | null };

type OrderItem = {
  id: string; qty: number; unitPrice: number; subtotal: number; status: string;
  // FK-joined (available when seat was reserved via map)
  seat?: { numero: number; status: string; row?: { nome: string } | null } | null;
  sector?: { nome: string; preco: number; corHex: string | null } | null;
  // Snapshot fields written directly by Flutter app
  sectorNome?: string | null;
  rowNome?: string | null;
  seatNumero?: number | null;
};

type QRCode = {
  id: string; ticketCode: string; qrData?: string | null;
  isUsed: boolean; isCancelled: boolean; createdAt: string; usedAt?: string | null;
};

type OrderDetail = {
  id: string; numeroPedido: string | null; buyerName: string | null;
  buyerEmail: string | null; buyerPhone: string | null;
  subtotal: number; desconto: number; total: number;
  paymentMethod: string | null; paymentAttempts: number;
  status: string; createdAt: string; cancelledAt: string | null; notas: string | null;
  event?: {
    id: string; nome: string; dataInicio: string; dataFim?: string;
    local: string | null; localEndereco?: string | null;
    churchId: string; imagemUrl?: string | null; bannerUrl?: string | null;
    tipoEvento?: string; descricao?: string | null;
    participants?: { id: string; nome: string; papel: string | null; fotoUrl: string | null; ordem: number }[];
  } | null;
  items: OrderItem[];
  qrcodes: QRCode[];
  refunds: { id: string; motivo: string | null; valorSolicitado: number; status: string; notasAdmin: string | null; createdAt: string }[];
  timeline: TimelineEntry[];
};

type MemberPreview = {
  id: string; fullName: string; email: string | null; phone: string | null;
  cpf: string; photoUrl: string | null; userId: string | null; title?: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const PM_LABELS: Record<string, string> = {
  pix: "PIX", credit_card: "Cartão de Crédito", debit_card: "Cartão de Débito",
  free: "Gratuito", boleto: "Boleto",
};

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

function fmtTime(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function seatLabel(item: OrderItem): string | null {
  // Prefer FK-joined data; fallback to Flutter snapshot fields
  if (item.seat) {
    const row = item.seat.row?.nome ?? item.rowNome ?? "";
    return `${row}${item.seat.numero}`;
  }
  if (item.rowNome && item.seatNumero != null) return `${item.rowNome}${item.seatNumero}`;
  return null;
}

// ── Timeline Item ─────────────────────────────────────────────────────────────

function TimelineItem({ entry, isLast }: { entry: TimelineEntry; isLast: boolean }) {
  const iconMap: Record<string, React.ReactNode> = {
    "Pedido criado":          <ShoppingCart  className="w-3.5 h-3.5 text-blue-500"    />,
    "Pagamento aprovado":     <CheckCircle2  className="w-3.5 h-3.5 text-green-500"   />,
    "Tentativa de pagamento": <RefreshCw     className="w-3.5 h-3.5 text-yellow-500"  />,
    "QRCode gerado":          <QrCode        className="w-3.5 h-3.5 text-purple-500"  />,
    "Check-in realizado":     <CheckCheck    className="w-3.5 h-3.5 text-green-600"   />,
    "Pedido cancelado":       <XCircle       className="w-3.5 h-3.5 text-red-500"     />,
    "Reembolso solicitado":   <AlertTriangle className="w-3.5 h-3.5 text-orange-500"  />,
    "Reembolso aprovado":     <CheckCircle2  className="w-3.5 h-3.5 text-purple-500"  />,
    "Reembolso negado":       <XCircle       className="w-3.5 h-3.5 text-red-400"     />,
    "Transferência":          <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-500" />,
  };
  const icon = iconMap[entry.label] ?? <Clock className="w-3.5 h-3.5 text-slate-400" />;
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="w-7 h-7 rounded-full bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-600 flex items-center justify-center shrink-0">
          {icon}
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-slate-200 dark:bg-slate-700 mt-1" />}
      </div>
      <div className="pb-4 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-900 dark:text-white">{entry.label}</span>
          <span className="text-xs text-slate-400">{fmtTime(entry.time)}</span>
        </div>
        {entry.detail && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{entry.detail}</p>
        )}
      </div>
    </div>
  );
}

// ── QR Print popup ────────────────────────────────────────────────────────────

function printQR(qr: QRCode, eventName: string, orderNum: string) {
  const win = window.open("", "_blank", "width=400,height=520");
  if (!win) return;
  const url = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr.ticketCode)}&size=200x200`;
  win.document.write(`
    <html><head><title>Ingresso - ${qr.ticketCode}</title>
    <style>
      body{font-family:sans-serif;text-align:center;padding:20px;background:#fff}
      img{border:1px solid #ddd;border-radius:8px;margin:16px 0}
      h2{font-size:16px;margin:0;color:#111}
      p{font-size:12px;color:#555;margin:4px 0}
      .code{font-family:monospace;font-size:11px;background:#f4f4f4;padding:6px 10px;border-radius:4px;margin-top:8px;display:inline-block}
      .btn{margin-top:16px;padding:8px 20px;cursor:pointer;background:#6d28d9;color:#fff;border:none;border-radius:8px;font-size:13px}
      @media print{.btn{display:none}}
    </style></head>
    <body>
      <h2>${eventName}</h2>
      <p>${orderNum}</p>
      <img src="${url}" width="200" height="200" />
      <br/><span class="code">${qr.ticketCode}</span>
      <p style="margin-top:12px;color:#aaa;font-size:11px">Apresente este QR Code na entrada</p>
      <button class="btn" onclick="window.print()">🖨 Imprimir</button>
    </body></html>
  `);
  win.document.close();
}

// ── Transfer Section ──────────────────────────────────────────────────────────

function TransferSection({ orderId, onSuccess }: { orderId: string; onSuccess: () => void }) {
  const [cpf, setCpf]               = useState("");
  const [preview, setPreview]       = useState<MemberPreview | null>(null);
  const [notFound, setNotFound]     = useState(false);
  const [searching, setSearching]   = useState(false);
  const [confirmed, setConfirmed]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const authH = () => {
    const token = localStorage.getItem("mrm_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const searchMember = async () => {
    const clean = cpf.replace(/\D/g, "");
    if (clean.length < 11) { toast.error("Digite um CPF válido com 11 dígitos."); return; }
    setSearching(true); setPreview(null); setNotFound(false);
    try {
      const r = await fetch(`/api/events/orders/${orderId}/transfer?cpf=${clean}`, { headers: authH() });
      const d = await r.json();
      if (d.member) { setPreview(d.member); setConfirmed(false); }
      else { setNotFound(true); }
    } catch { toast.error("Erro ao buscar membro."); }
    finally { setSearching(false); }
  };

  const transferMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/events/orders/${orderId}/transfer`, {
        method: "POST",
        headers: { ...authH(), "Content-Type": "application/json" },
        body: JSON.stringify({ cpf }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "Erro ao transferir."); }
      return r.json();
    },
    onSuccess: (d) => {
      toast.success(`Ingresso transferido para ${d.member.fullName}!`);
      setCpf(""); setPreview(null); setConfirmed(false);
      onSuccess();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ArrowRightLeft className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        <h3 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Transferir Ingresso</h3>
      </div>
      <p className="text-xs text-indigo-600 dark:text-indigo-400">
        Digite o CPF do novo titular. O sistema buscará o membro cadastrado.
      </p>

      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={cpf}
          onChange={e => setCpf(e.target.value)}
          onKeyDown={e => e.key === "Enter" && searchMember()}
          placeholder="000.000.000-00"
          maxLength={14}
          className="flex-1 px-3 py-2 text-sm border border-indigo-300 dark:border-indigo-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button
          onClick={searchMember} disabled={searching}
          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 disabled:opacity-50 transition-colors"
        >
          {searching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          Buscar
        </button>
      </div>

      {notFound && <p className="text-xs text-red-500">Nenhum membro encontrado com este CPF.</p>}

      {preview && (
        <div className="bg-white dark:bg-slate-800 rounded-lg p-3 border border-indigo-200 dark:border-indigo-700 space-y-2">
          <div className="flex items-center gap-3">
            {preview.photoUrl ? (
              <img src={preview.photoUrl} alt={preview.fullName} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-800 flex items-center justify-center">
                <User className="w-5 h-5 text-indigo-500" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{preview.fullName}</p>
              {preview.title && <p className="text-xs text-slate-400">{preview.title}</p>}
              {preview.email && <p className="text-xs text-slate-400 truncate">{preview.email}</p>}
            </div>
          </div>
          {!confirmed ? (
            <button
              onClick={() => setConfirmed(true)}
              className="w-full py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
            >
              Confirmar transferência para esta pessoa
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                ⚠ QR Codes ativos serão cancelados. O novo titular precisará abrir o app.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => transferMut.mutate()} disabled={transferMut.isPending}
                  className="flex-1 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50 transition-colors"
                >
                  {transferMut.isPending ? "Transferindo..." : "✓ Confirmar"}
                </button>
                <button onClick={() => setConfirmed(false)} className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Seat Grid ─────────────────────────────────────────────────────────────────

function SeatGrid({ items }: { items: OrderItem[] }) {
  const bySector: Record<string, { sectorName: string; color: string; seats: string[] }> = {};
  for (const item of items) {
    // Use FK name → snapshot fallback
    const key = item.sector?.nome ?? item.sectorNome ?? "Geral";
    if (!bySector[key]) {
      bySector[key] = { sectorName: key, color: item.sector?.corHex ?? "#8b5cf6", seats: [] };
    }
    const label = seatLabel(item);
    bySector[key].seats.push(label ?? `${item.qty}× ingresso`);
  }

  return (
    <div className="space-y-3">
      {Object.values(bySector).map(({ sectorName, color, seats }) => (
        <div key={sectorName}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">{sectorName}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {seats.map((s, i) => (
              <span key={i}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border-2"
                style={{ borderColor: color, color, backgroundColor: `${color}18` }}>
                <Armchair className="w-3 h-3" />
                {s}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function PedidoDetailPanel({
  orderId,
  onClose,
  onStatusChange,
}: {
  orderId: string;
  onClose: () => void;
  onStatusChange?: () => void;
}) {
  const [activeTab, setActiveTab]       = useState<"info" | "items" | "timeline" | "qrcodes">("info");
  const [refundNotes, setRefundNotes]   = useState("");
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showDeleteZone, setShowDeleteZone] = useState(false);
  const qc = useQueryClient();

  const authH = (extra?: Record<string, string>) => {
    const token = localStorage.getItem("mrm_token");
    return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
  };

  const { data: order, isLoading } = useQuery<OrderDetail>({
    queryKey: ["order-detail", orderId],
    queryFn: async () => {
      const r = await fetch(`/api/events/orders/${orderId}`, { headers: authH() });
      if (!r.ok) throw new Error("Erro ao carregar pedido");
      return r.json();
    },
    enabled: Boolean(orderId),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["order-detail", orderId] });
    qc.invalidateQueries({ queryKey: ["orders-kanban"] });
    qc.invalidateQueries({ queryKey: ["orders-stats"] });
    onStatusChange?.();
  };

  const resendMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/events/orders/${orderId}/resend`, { method: "POST", headers: authH() });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
      return r.json();
    },
    onSuccess: () => { toast.success("Cobrança reenviada!"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMut = useMutation({
    mutationFn: async (motivo: string) => {
      const r = await fetch(`/api/events/orders/${orderId}/cancel`, {
        method: "POST", headers: authH({ "Content-Type": "application/json" }),
        body: JSON.stringify({ motivo }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
      return r.json();
    },
    onSuccess: () => { toast.success("Pedido cancelado."); invalidate(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const qrMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/events/orders/${orderId}/qrcode`, { method: "POST", headers: authH() });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
      return r.json();
    },
    onSuccess: (d) => {
      toast.success(`${d.generated} QR Code(s) gerado(s)!`);
      invalidate(); setActiveTab("qrcodes");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/events/orders/${orderId}`, { method: "DELETE", headers: authH() });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "Erro ao excluir."); }
      return r.json();
    },
    onSuccess: () => {
      toast.success("Pedido excluído permanentemente.");
      qc.invalidateQueries({ queryKey: ["orders-kanban"] });
      qc.invalidateQueries({ queryKey: ["orders-stats"] });
      onStatusChange?.();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const refundMut = useMutation({
    mutationFn: async (action: "approve" | "deny") => {
      const r = await fetch(`/api/events/orders/${orderId}/refund`, {
        method: "PATCH", headers: authH({ "Content-Type": "application/json" }),
        body: JSON.stringify({ action, notes: refundNotes }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
      return r.json();
    },
    onSuccess: (_, action) => {
      toast.success(action === "approve" ? "Reembolso aprovado!" : "Reembolso negado.");
      invalidate(); setShowRefundForm(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const whatsapp = (msg?: string) => {
    if (!order?.buyerPhone) return;
    const phone = order.buyerPhone.replace(/\D/g, "");
    const text = msg ?? `Olá${order.buyerName ? ` ${order.buyerName}` : ""}, aqui é do suporte. Seu pedido *${order.numeroPedido}* está confirmado.`;
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(text)}`, "_blank");
  };

  const shareQR = (qr: QRCode) => {
    if (!order) return;
    const link = `${window.location.origin}/checkin?order=${orderId}`;
    whatsapp(`Olá${order.buyerName ? ` ${order.buyerName}` : ""}! Seu ingresso para *${order.event?.nome ?? "evento"}*:\nCódigo: *${qr.ticketCode}*\nLink: ${link}`);
  };

  const copyOrderNumber = () => {
    navigator.clipboard.writeText(order?.numeroPedido ?? "");
    toast.success("Número copiado!");
  };

  const isProcessing = resendMut.isPending || cancelMut.isPending || qrMut.isPending || refundMut.isPending || deleteMut.isPending;
  const activeQRs = order?.qrcodes.filter(q => !q.isCancelled) ?? [];
  const hasSeats  = order?.items.some(i => i.seat || (i.rowNome && i.seatNumero != null)) ?? false;

  const tabs = [
    { key: "info",     label: "Informações" },
    { key: "items",    label: `Itens (${order?.items.length ?? 0})` },
    { key: "timeline", label: "Timeline" },
    { key: "qrcodes",  label: `QR Codes (${activeQRs.length})` },
  ] as const;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full sm:w-[500px] lg:w-[580px] bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col">

        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center shrink-0">
              <ShoppingCart className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono font-semibold text-slate-700 dark:text-slate-300 truncate">{order?.numeroPedido ?? "..."}</span>
                {order && <button onClick={copyOrderNumber} className="text-slate-400 hover:text-slate-600 transition-colors"><Copy className="w-3.5 h-3.5" /></button>}
              </div>
              {order && <StatusBadge status={order.status} />}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {isLoading && <div className="flex-1 flex items-center justify-center"><RefreshCw className="w-6 h-6 text-slate-400 animate-spin" /></div>}

        {order && (
          <>
            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 shrink-0 px-4 overflow-x-auto">
              {tabs.map(({ key, label }) => (
                <button key={key} onClick={() => setActiveTab(key)}
                  className={`px-3 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                    activeTab === key ? "border-blue-500 text-blue-600 dark:text-blue-400"
                                     : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}>
                  {label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">

              {/* ═══ INFO ═══ */}
              {activeTab === "info" && (
                <>
                  {order.event && (
                    <section>
                      <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">Evento</h3>
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 space-y-1.5">
                        {(order.event.bannerUrl ?? order.event.imagemUrl) && (
                          <img src={order.event.bannerUrl ?? order.event.imagemUrl!} alt={order.event.nome} className="w-full h-28 object-cover rounded-lg mb-2" />
                        )}
                        <p className="font-semibold text-slate-900 dark:text-white text-sm">{order.event.nome}</p>
                        {order.event.descricao && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{order.event.descricao}</p>
                        )}
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <CalendarDays className="w-3.5 h-3.5 shrink-0" /><span>{fmtDate(order.event.dataInicio)}</span>
                        </div>
                        {order.event.local && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                            <span>{order.event.local}{order.event.localEndereco ? ` — ${order.event.localEndereco}` : ""}</span>
                          </div>
                        )}
                        {order.event.tipoEvento && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                            {order.event.tipoEvento === "COM_ASSENTO" ? "Com mapa de assentos" : "Ingresso livre"}
                          </span>
                        )}
                      </div>
                    </section>
                  )}

                  {/* Participantes (cantores, pregadores, etc.) */}
                  {(order.event?.participants?.length ?? 0) > 0 && (
                    <section>
                      <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <Mic2 className="w-3.5 h-3.5" /> Participantes
                      </h3>
                      <div className="flex gap-3 overflow-x-auto pb-1">
                        {order.event!.participants!.map(p => (
                          <div key={p.id} className="flex flex-col items-center gap-1.5 shrink-0 w-16">
                            {p.fotoUrl ? (
                              <img src={p.fotoUrl} alt={p.nome}
                                className="w-12 h-12 rounded-full object-cover border-2 border-white dark:border-slate-700 shadow-sm" />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-indigo-600 flex items-center justify-center shadow-sm">
                                <span className="text-white font-bold text-sm">{p.nome.charAt(0).toUpperCase()}</span>
                              </div>
                            )}
                            <p className="text-[10px] font-medium text-slate-800 dark:text-slate-200 text-center leading-tight line-clamp-2">{p.nome}</p>
                            {p.papel && <p className="text-[10px] text-slate-400 text-center">{p.papel}</p>}
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  <section>
                    <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">Comprador</h3>
                    <div className="space-y-2">
                      <InfoRow icon={<User className="w-4 h-4" />}    label="Nome"     value={order.buyerName  ?? "—"} />
                      <InfoRow icon={<Phone className="w-4 h-4" />}   label="Telefone" value={order.buyerPhone ?? "—"} />
                      <InfoRow icon={<Mail className="w-4 h-4" />}    label="Email"    value={order.buyerEmail ?? "—"} />
                    </div>
                  </section>

                  <section>
                    <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">Pagamento</h3>
                    <div className="space-y-2">
                      <InfoRow icon={<Hash className="w-4 h-4" />}         label="Pedido"   value={order.numeroPedido ?? "—"} />
                      <InfoRow icon={<CreditCard className="w-4 h-4" />}   label="Método"   value={PM_LABELS[order.paymentMethod ?? ""] ?? order.paymentMethod ?? "—"} />
                      <InfoRow icon={<ShoppingCart className="w-4 h-4" />} label="Subtotal" value={fmt(order.subtotal)} />
                      {order.desconto > 0 && <InfoRow icon={<ChevronDown className="w-4 h-4 text-green-500" />} label="Desconto" value={`-${fmt(order.desconto)}`} />}
                      <div className="flex items-center justify-between py-2 border-t border-slate-200 dark:border-slate-700">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">Total</span>
                        <span className="text-lg font-bold text-slate-900 dark:text-white">{fmt(order.total)}</span>
                      </div>
                      {order.paymentAttempts > 0 && <p className="text-xs text-orange-500">⚡ {order.paymentAttempts} tentativa{order.paymentAttempts !== 1 ? "s" : ""} de pagamento</p>}
                      <p className="text-xs text-slate-400">Criado em {fmtDate(order.createdAt)}</p>
                      {order.cancelledAt && <p className="text-xs text-red-400">Cancelado em {fmtDate(order.cancelledAt)}</p>}
                    </div>
                  </section>

                  {order.notas && (
                    <section>
                      <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">Notas</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-xl p-3">{order.notas}</p>
                    </section>
                  )}

                  {order.status === "SOLICITANDO_REEMBOLSO" && (
                    <section className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
                      <h3 className="text-sm font-semibold text-orange-700 dark:text-orange-400 mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Reembolso solicitado</h3>
                      {order.refunds.filter(r => r.status === "SOLICITADO").map(r => (
                        <div key={r.id} className="text-xs text-orange-600 dark:text-orange-400 space-y-1">
                          <p>Valor: <strong>{fmt(r.valorSolicitado)}</strong></p>
                          {r.motivo && <p>Motivo: {r.motivo}</p>}
                        </div>
                      ))}
                      {!showRefundForm ? (
                        <button onClick={() => setShowRefundForm(true)} className="mt-3 text-xs text-orange-700 dark:text-orange-400 underline">Processar reembolso</button>
                      ) : (
                        <div className="mt-3 space-y-2">
                          <textarea value={refundNotes} onChange={e => setRefundNotes(e.target.value)} placeholder="Observações (opcional)" rows={2}
                            className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-orange-400" />
                          <div className="flex gap-2">
                            <button onClick={() => refundMut.mutate("approve")} disabled={isProcessing}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50">
                              <CheckCheck className="w-3.5 h-3.5" /> Aprovar
                            </button>
                            <button onClick={() => refundMut.mutate("deny")} disabled={isProcessing}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50">
                              <Ban className="w-3.5 h-3.5" /> Negar
                            </button>
                          </div>
                        </div>
                      )}
                    </section>
                  )}

                  {["AGUARDANDO_PAGAMENTO", "PAGO"].includes(order.status) && (
                    <section>
                      {!showTransfer ? (
                        <button onClick={() => setShowTransfer(true)}
                          className="w-full flex items-center gap-2 px-4 py-2.5 border border-indigo-300 dark:border-indigo-600 rounded-xl text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
                          <ArrowRightLeft className="w-4 h-4" /> Transferir ingresso para outro membro
                        </button>
                      ) : (
                        <div>
                          <div className="flex justify-end mb-2">
                            <button onClick={() => setShowTransfer(false)} className="text-xs text-slate-400 hover:text-slate-600">fechar</button>
                          </div>
                          <TransferSection orderId={orderId} onSuccess={invalidate} />
                        </div>
                      )}
                    </section>
                  )}

                  {/* Zona de perigo — exclusão permanente */}
                  <section className="pt-2">
                    {!showDeleteZone ? (
                      <button
                        onClick={() => setShowDeleteZone(true)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs text-red-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl border border-dashed border-red-200 dark:border-red-800 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Excluir pedido permanentemente
                      </button>
                    ) : (
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-xl p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                          <h3 className="text-sm font-bold text-red-700 dark:text-red-400">Excluir pedido</h3>
                        </div>
                        <p className="text-xs text-red-600 dark:text-red-400">
                          Esta ação é <strong>irreversível</strong>. O pedido, todos os QR Codes, itens, reembolsos e
                          notificações serão excluídos permanentemente do sistema, incluindo o registro do app.
                          O cliente poderá refazer a compra normalmente.
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              if (confirm(`Excluir PERMANENTEMENTE o pedido ${order.numeroPedido ?? orderId}?\n\nEsta ação não pode ser desfeita.`)) {
                                deleteMut.mutate();
                              }
                            }}
                            disabled={deleteMut.isPending}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                          >
                            {deleteMut.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            {deleteMut.isPending ? "Excluindo..." : "Excluir definitivamente"}
                          </button>
                          <button
                            onClick={() => setShowDeleteZone(false)}
                            className="px-3 py-2 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </section>
                </>
              )}

              {/* ═══ ITEMS ═══ */}
              {activeTab === "items" && (
                <div className="space-y-4">
                  {order.event && (
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 flex items-start gap-3">
                      <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center shrink-0">
                        <Ticket className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{order.event.nome}</p>
                        <p className="text-xs text-slate-500">{fmtDate(order.event.dataInicio)}</p>
                        {order.event.local && <p className="text-xs text-slate-400 flex items-center gap-1"><MapPin className="w-3 h-3" />{order.event.local}</p>}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{fmt(order.total)}</p>
                        <p className="text-xs text-slate-400">total pago</p>
                      </div>
                    </div>
                  )}

                  {order.items.length > 0 ? (
                    <>
                      {hasSeats ? (
                        <section>
                          <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                            <Armchair className="w-3.5 h-3.5" /> Assentos adquiridos
                          </h3>
                          <SeatGrid items={order.items} />
                        </section>
                      ) : (
                        <section>
                          <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                            <Ticket className="w-3.5 h-3.5" /> Ingressos
                          </h3>
                          <div className="space-y-2">
                            {order.items.map((item, i) => (
                              <div key={item.id} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                    style={{ backgroundColor: (item.sector?.corHex ?? "#8b5cf6") + "33" }}>
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{i + 1}</span>
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{item.sector?.nome ?? item.sectorNome ?? "Ingresso geral"}</p>
                                    <p className="text-xs text-slate-500">{item.qty}× {fmt(item.unitPrice)}</p>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-sm font-bold text-slate-900 dark:text-white">{fmt(item.subtotal)}</p>
                                  <span className={`text-xs ${item.status === "ATIVO" ? "text-green-500" : "text-red-400"}`}>{item.status}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </section>
                      )}
                    </>
                  ) : (
                    <section className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 text-center space-y-2">
                      <Ticket className="w-8 h-8 text-amber-400 mx-auto" />
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-300">Detalhes de assentos não disponíveis</p>
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Pedido realizado pelo app.{order.status === "PAGO" && " Gere o QR Code para o comprador apresentar na entrada."}
                      </p>
                      {order.status === "PAGO" && activeQRs.length === 0 && (
                        <button onClick={() => qrMut.mutate()} disabled={qrMut.isPending}
                          className="mt-1 px-4 py-2 text-xs bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-1.5 mx-auto">
                          {qrMut.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <QrCode className="w-3.5 h-3.5" />}
                          Gerar QR Code
                        </button>
                      )}
                      {activeQRs.length > 0 && (
                        <button onClick={() => setActiveTab("qrcodes")}
                          className="mt-1 px-4 py-2 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors flex items-center gap-1.5 mx-auto">
                          <QrCode className="w-3.5 h-3.5" /> Ver QR Codes ({activeQRs.length})
                        </button>
                      )}
                    </section>
                  )}

                  {/* Data e método de compra */}
                  <section>
                    <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5" /> Data da compra
                    </h3>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 space-y-1.5 text-sm">
                      <div className="flex justify-between"><span className="text-slate-500">Realizado em</span><span className="font-medium text-slate-900 dark:text-white">{fmtDate(order.createdAt)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Método</span><span className="font-medium text-slate-900 dark:text-white">{PM_LABELS[order.paymentMethod ?? ""] ?? "—"}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Comprador</span><span className="font-medium text-slate-900 dark:text-white truncate ml-4">{order.buyerName ?? "—"}</span></div>
                      {order.cancelledAt && <div className="flex justify-between text-red-500"><span>Cancelado em</span><span className="font-medium">{fmtDate(order.cancelledAt)}</span></div>}
                    </div>
                  </section>

                  {["AGUARDANDO_PAGAMENTO", "EXPIRADO"].includes(order.status) && (
                    <section>
                      <button
                        onClick={() => { if (confirm(`Cancelar pedido ${order.numeroPedido}?`)) cancelMut.mutate("Cancelado pelo administrativo."); }}
                        disabled={cancelMut.isPending}
                        className="w-full flex items-center justify-center gap-2 py-2.5 border border-red-300 dark:border-red-700 rounded-xl text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" />
                        {cancelMut.isPending ? "Cancelando..." : "Cancelar este pedido"}
                      </button>
                    </section>
                  )}
                </div>
              )}

              {/* ═══ TIMELINE ═══ */}
              {activeTab === "timeline" && (
                <div className="space-y-0">
                  {order.timeline.length === 0 && <p className="text-sm text-slate-400 text-center py-8">Sem histórico registrado.</p>}
                  {order.timeline.map((entry, i) => <TimelineItem key={i} entry={entry} isLast={i === order.timeline.length - 1} />)}
                </div>
              )}

              {/* ═══ QR CODES ═══ */}
              {activeTab === "qrcodes" && (
                <div className="space-y-3">
                  {activeQRs.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 space-y-3">
                      <QrCode className="w-10 h-10 mx-auto opacity-30" />
                      <p className="text-sm">Nenhum QR Code gerado</p>
                      {order.status === "PAGO" && (
                        <button onClick={() => qrMut.mutate()} disabled={qrMut.isPending}
                          className="px-5 py-2.5 text-sm bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center gap-2 mx-auto">
                          {qrMut.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                          Gerar QR Codes
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      {order.status === "PAGO" && (
                        <div className="flex justify-end">
                          <button onClick={() => { if (confirm("Regenerar cancela os QR Codes atuais. Continuar?")) qrMut.mutate(); }}
                            disabled={qrMut.isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50">
                            <RefreshCw className={`w-3 h-3 ${qrMut.isPending ? "animate-spin" : ""}`} /> Regenerar
                          </button>
                        </div>
                      )}
                      {activeQRs.map((qr) => (
                        <div key={qr.id} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-3">
                          <div className="flex items-start gap-4">
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(qr.ticketCode)}&size=80x80`}
                              alt="QR Code" className="w-20 h-20 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0"
                            />
                            <div className="min-w-0 flex-1 space-y-1">
                              <p className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300 break-all">{qr.ticketCode}</p>
                              <p className="text-xs text-slate-400">Gerado {fmtDate(qr.createdAt)}</p>
                              {qr.usedAt && <p className="text-xs text-green-600 font-medium">✓ Check-in {fmtDate(qr.usedAt)}</p>}
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${qr.isUsed ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"}`}>
                                {qr.isUsed ? "Usado" : "Válido"}
                              </span>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <button onClick={() => printQR(qr, order.event?.nome ?? "Evento", order.numeroPedido ?? "")}
                              className="flex items-center justify-center gap-1.5 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                              <Printer className="w-3.5 h-3.5" /> Imprimir
                            </button>
                            {order.buyerPhone ? (
                              <button onClick={() => shareQR(qr)}
                                className="flex items-center justify-center gap-1.5 py-2 text-xs border border-green-300 dark:border-green-700 rounded-lg text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors">
                                <Share2 className="w-3.5 h-3.5" /> Enviar
                              </button>
                            ) : (
                              <div />
                            )}
                            <button onClick={() => { navigator.clipboard.writeText(qr.ticketCode); toast.success("Código copiado!"); }}
                              className="flex items-center justify-center gap-1.5 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                              <Copy className="w-3.5 h-3.5" /> Copiar
                            </button>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Ações Rápidas */}
            <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 p-4">
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-3">Ações Rápidas</p>
              <div className="grid grid-cols-3 gap-2">
                {order.buyerPhone && <ActionBtn icon={<Phone className="w-4 h-4" />}          label="Ligar"     onClick={() => window.open(`tel:${order.buyerPhone}`)} color="text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20" />}
                {order.buyerEmail && <ActionBtn icon={<Mail className="w-4 h-4" />}           label="Email"     onClick={() => window.open(`mailto:${order.buyerEmail}`)} color="text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700" />}
                {order.buyerPhone && <ActionBtn icon={<MessageCircle className="w-4 h-4" />}  label="WhatsApp"  onClick={() => whatsapp()} color="text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20" />}
                {order.status === "PAGO" && <ActionBtn icon={<QrCode className="w-4 h-4" />} label="QR Code"  onClick={() => qrMut.mutate()} disabled={qrMut.isPending} color="text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20" />}
                {["AGUARDANDO_PAGAMENTO","EXPIRADO"].includes(order.status) && <ActionBtn icon={<Send className="w-4 h-4" />} label="Reenviar" onClick={() => resendMut.mutate()} disabled={resendMut.isPending} color="text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20" />}
                {["AGUARDANDO_PAGAMENTO","EXPIRADO","SOLICITANDO_REEMBOLSO"].includes(order.status) && (
                  <ActionBtn icon={<XCircle className="w-4 h-4" />} label="Cancelar"
                    onClick={() => { if (confirm(`Cancelar pedido ${order.numeroPedido}?`)) cancelMut.mutate("Cancelado pelo administrativo."); }}
                    disabled={cancelMut.isPending} color="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" />
                )}
                {order.status === "SOLICITANDO_REEMBOLSO" && <ActionBtn icon={<RotateCcw className="w-4 h-4" />} label="Processar" onClick={() => { setActiveTab("info"); setShowRefundForm(true); }} color="text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20" />}
                {["AGUARDANDO_PAGAMENTO","PAGO"].includes(order.status) && (
                  <ActionBtn icon={<ArrowRightLeft className="w-4 h-4" />} label="Transferir"
                    onClick={() => { setActiveTab("info"); setShowTransfer(true); }} color="text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20" />
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-slate-400 shrink-0">{icon}</span>
      <span className="text-slate-500 dark:text-slate-400 w-20 shrink-0">{label}</span>
      <span className="text-slate-900 dark:text-white font-medium truncate">{value}</span>
    </div>
  );
}

function ActionBtn({ icon, label, onClick, disabled, color }: {
  icon: React.ReactNode; label: string; onClick: () => void;
  disabled?: boolean; color: string;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium transition-colors disabled:opacity-40 ${color}`}>
      {icon}
      <span>{label}</span>
    </button>
  );
}
