import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileText,
  MessageSquare,
  Loader2,
  MoreVertical,
  Pencil,
  Paperclip,
  Plus,
  Printer,
  Search,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";
import { apiBase } from "../../lib/apiBase";
import { PrintModal } from "../../components/app-ui/shared/PrintModal";
import { printReport } from "../../lib/printReport";

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function authFetch(url: string, init: RequestInit = {}) {
  const token = localStorage.getItem("mrm_token");
  return fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("pt-BR");
  } catch {
    return d;
  }
}

function normalizeText(value: string | number | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getMonthDateRange(baseDate = new Date()) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

const REQUIREMENT_SIGLAS = new Set([
  "ADMINM", "ADMINOB", "CDM", "DESCR", "DESCRH", "DESCRPH",
  "DESLMEM", "DESLMIN", "DESLOBRE", "EXCL", "FALE",
  "READMEM", "READOBR", "READOMN", "RECEV", "RECMS", "RECONPB", "RECPR",
]);

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type KanService = {
  id: number;
  sigla: string;
  description: string;
  serviceGroup?: string | null;
  stages?: Array<{
    id: number;
    name: string;
    pipeline?: { id: number; name: string } | null;
    columns?: Array<{ id: number; name: string; columnIndex: number }>;
  }>;
  rules?: Array<{
    id: number;
    columnIndex: number;
    stage?: {
      id: number;
      name: string;
      pipeline?: { id: number; name: string } | null;
    } | null;
  }>;
};

type KanCard = {
  id: string;
  protocol: string;
  candidateName?: string | null;
  status: string;
  statusLabel?: string | null;
  columnIndex: number;
  openedAt?: string | null;
  closedAt?: string | null;
  createdAt?: string | null;
  church?: { id: string; name: string; code?: string | null } | null;
  member?: { id: string; fullName: string; rol?: number | null } | null;
  service?: { sigla: string; description: string } | null;
  column?: { id: number; name: string; columnIndex: number; color?: string | null } | null;
  attachments?: Array<{ type?: string; url?: string; name?: string; filename?: string }> | null;
  metadata?: Record<string, unknown> | null;
};

type CardDetail = KanCard & {
  subject?: string | null;
  justification?: string | null;
  observations?: string | null;
  description?: string | null;
  requesterName?: string | null;
  destinationChurch?: { id: string; name: string; code?: string | null } | null;
  createdByUser?: { id: string; fullName: string; email: string } | null;
  updatedByUser?: { id: string; fullName: string; email: string } | null;
  eventHistory?: Array<{
    id: string;
    action: string | null;
    notes: string | null;
    serviceName: string | null;
    createdAt: string;
    createdByUser?: { id: string; fullName: string; email: string } | null;
  }>;
};

type ChatMessageItem = {
  id: string;
  text: string;
  createdAt: string;
  senderId?: string | null;
  senderName: string;
  senderChurchId?: string | null;
  senderChurchName?: string | null;
  attachment?: {
    type?: string;
    url: string;
    name: string;
    filename?: string;
  } | null;
};

type ColumnWithCards = {
  id: number;
  name: string;
  columnIndex: number;
  color?: string | null;
  cards: KanCard[];
};

type MemberHit = {
  id: string;
  fullName: string;
  church?: { id?: string; name: string; code?: string | null } | null;
  rol?: number | null;
  membershipStatus?: string | null;
  ecclesiasticalTitle?: string | null;
};
type Church = { id: string; name: string; code?: string | null };

const DOCUMENT_TYPES = [
  "CPF",
  "Documentos diversos",
  "Ficha cadastral assinada",
  "Recibo de pagamento - Credencial",
  "Requerimento de Admissão de Membro",
  "Requerimento de Admissão de Ministro",
  "Requerimento de Admissão de Obreiro",
  "Requerimento de Desligamento de Membros",
  "Requerimento de Desligamento de Ministros",
  "Requerimento de Desligamento de Obreiros",
  "Requerimento de Indicação consagração",
  "Requerimento de Readmissão",
  "Requerimento de Readmissão de Membro",
  "Requerimento de Readmissão de Ministro",
  "Requerimento de Readmissão de Obreiro",
  "Requerimento de Reconhecimento de Cargo Ministerial",
  "Transferência de membro",
] as const;

type Attachment = { type: string; file: File; name: string };

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pendente:      { label: "Pendente",      cls: "bg-amber-100 text-amber-700" },
  em_andamento:  { label: "Em andamento",  cls: "bg-blue-100 text-blue-700" },
  aprovado:      { label: "Aprovado",      cls: "bg-emerald-100 text-emerald-700" },
  finalizado:    { label: "Finalizado",    cls: "bg-emerald-100 text-emerald-700" },
  rejeitado:     { label: "Rejeitado",     cls: "bg-rose-100 text-rose-700" },
  cancelado:     { label: "Cancelado",     cls: "bg-slate-100 text-slate-600" },
  arquivado:     { label: "Arquivado",     cls: "bg-slate-200 text-slate-500" },
};

function StatusBadge({ status, label }: { status?: string | null; label?: string | null }) {
  const key = (status || "").toLowerCase();
  const meta = STATUS_LABELS[key];
  const displayLabel = label || meta?.label || status || "—";
  const cls = meta?.cls || "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {displayLabel}
    </span>
  );
}


const PAGE_SIZE = 15;

// â”€â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function Requerimentos() {
  // Services / folders
  const [services, setServices] = useState<KanService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [activeServiceId, setActiveServiceId] = useState<number | null>(null);

  // Cards
  const [columns, setColumns] = useState<ColumnWithCards[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);

  // Filters
  const [q, setQ] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const { start: defaultFrom, end: defaultTo } = getMonthDateRange();
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [page, setPage] = useState(1);

  // Modal
  const [showNew, setShowNew] = useState(false);
  const [detailCard, setDetailCard] = useState<KanCard | null>(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  function showToast(ok: boolean, msg: string) {
    setToast({ ok, msg });
    setTimeout(() => setToast(null), 4000);
  }

  // Load REQUERIMENTO services
  useEffect(() => {
    setServicesLoading(true);
    authFetch(`${apiBase}/kan/services`)
      .then((r) => r.json())
      .then((data: KanService[]) => {
        if (!Array.isArray(data)) return;
        const filtered = data.filter(
          (s) =>
            REQUIREMENT_SIGLAS.has(s.sigla.toUpperCase()) ||
            (s.serviceGroup || "").toUpperCase() === "REQUERIMENTO",
        );
        setServices(filtered);
        if (filtered.length) setActiveServiceId(filtered[0].id);
      })
      .catch(() => setServices([]))
      .finally(() => setServicesLoading(false));
  }, []);

  // Derive active stage
  const activeService = useMemo(
    () => services.find((s) => s.id === activeServiceId) ?? null,
    [services, activeServiceId],
  );
  const activeRuleStage = useMemo(
    () => activeService?.rules?.find((rule) => rule.columnIndex === 1)?.stage ?? null,
    [activeService],
  );
  const activeStageId = useMemo(
    () => activeRuleStage?.id ?? activeService?.stages?.[0]?.id ?? null,
    [activeRuleStage, activeService],
  );
  const allStageIds = useMemo(
    () =>
      Array.from(
        new Set(
          services
            .map((service) => service.rules?.find((rule) => rule.columnIndex === 1)?.stage?.id ?? service.stages?.[0]?.id ?? null)
            .filter((id): id is number => typeof id === "number"),
        ),
      ),
    [services],
  );

  // Load cards for selected stage
  const loadCards = () => {
    const stageIds = activeServiceId == null ? allStageIds : activeStageId ? [activeStageId] : [];
    if (!stageIds.length) {
      setColumns([]);
      return;
    }
    setCardsLoading(true);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to + "T23:59:59");
    if (q) params.set("q", q);
    Promise.all(
      stageIds.map((stageId) =>
        authFetch(`${apiBase}/kan/stages/${stageId}/board?${params}`)
          .then((r) => r.json())
          .then((data) => (Array.isArray(data?.columns) ? data.columns : [])),
      ),
    )
      .then((results) => {
        const mergedColumns = new Map<number, ColumnWithCards>();

        results.flat().forEach((column: ColumnWithCards) => {
          const existing = mergedColumns.get(column.id);
          if (!existing) {
            mergedColumns.set(column.id, {
              ...column,
              cards: Array.isArray(column.cards) ? [...column.cards] : [],
            });
            return;
          }

          const seenCardIds = new Set(existing.cards.map((card) => card.id));
          const nextCards = Array.isArray(column.cards)
            ? column.cards.filter((card) => !seenCardIds.has(card.id))
            : [];

          existing.cards.push(...nextCards);
        });

        setColumns(Array.from(mergedColumns.values()));
      })
      .catch(() => setColumns([]))
      .finally(() => setCardsLoading(false));
  };

  useEffect(() => {
    setPage(1);
    loadCards();
  }, [activeStageId, activeServiceId, allStageIds, from, to, q]);

  // Flatten cards from all columns
  const allCards = useMemo(
    () => {
      const seen = new Set<string>();
      return columns.flatMap((col) =>
        col.cards
          .filter((card) => {
            if (seen.has(card.id)) return false;
            seen.add(card.id);
            return true;
          })
          .map((card) => ({
            ...card,
            columnName: col.name,
            columnColor: col.color,
          })),
      );
    },
    [columns],
  );

  // Helper: effective status key — prefer statusLabel over raw status
  function effectiveStatusKey(c: { status?: string | null; statusLabel?: string | null }) {
    const sl = (c.statusLabel || "").trim().toLowerCase();
    if (sl) return sl;
    return (c.status || "outro").toLowerCase();
  }

  // Filter + paginate
  const filteredCards = useMemo(() => {
    if (!filterStatus) return allCards;
    const target = filterStatus.toLowerCase();
    const targetLabel = (STATUS_LABELS[target]?.label || target).toLowerCase();
    return allCards.filter((c) => {
      const eff = effectiveStatusKey(c);
      return eff === target || eff === targetLabel;
    });
  }, [allCards, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filteredCards.length / PAGE_SIZE));
  const pageCards = filteredCards.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Stats — use effective status so cards moved to Finalizado aren't counted as Pendente
  const statsMap = useMemo(() => {
    const m: Record<string, number> = {};
    allCards.forEach((c) => {
      const k = effectiveStatusKey(c);
      m[k] = (m[k] || 0) + 1;
    });
    return m;
  }, [allCards]);

  const pendentes = (statsMap["pendente"] || 0) + (statsMap["em_andamento"] || 0);
  const aprovados = (statsMap["aprovado"] || 0) + (statsMap["finalizado"] || 0);
  const cancelados = (statsMap["cancelado"] || 0) + (statsMap["rejeitado"] || 0) + (statsMap["arquivado"] || 0);

  return (
    <div className="p-6 space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${toast.ok ? "bg-green-600" : "bg-red-600"}`}
        >
          {toast.ok ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          {toast.msg}
          <button onClick={() => setToast(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
            <FileText className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Requerimentos</h1>
            <p className="text-slate-500 text-sm">Processos administrativos eclesiásticos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
            <Download size={15} />
            Exportar
          </button>
          <button
            onClick={() => setPrintModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Printer size={15} />
            Imprimir
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
          >
            <Plus size={15} />
            Novo Requerimento
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total", value: allCards.length, icon: FileText, color: "indigo" },
          { label: "Pendentes", value: pendentes, icon: Clock, color: "amber" },
          { label: "Aprovados", value: aprovados, icon: CheckCircle, color: "emerald" },
          { label: "Cancelados", value: cancelados, icon: AlertTriangle, color: "rose" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3"
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center bg-${color}-100 flex-shrink-0`}>
              <Icon size={18} className={`text-${color}-600`} />
            </div>
            <div>
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-xl font-bold text-slate-800">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Buscar por protocolo, membro..."
            className="w-full border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          {q && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              onClick={() => { setQ(""); setPage(1); }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="text-sm bg-transparent focus:outline-none w-[110px] [color-scheme:light]"
          />
          <span className="text-slate-400 text-sm">→</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="text-sm bg-transparent focus:outline-none w-[110px] [color-scheme:light]"
          />
        </div>

        <div className="relative">
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
            className="appearance-none border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
          >
            <option value="">Todos os status</option>
            {Object.entries(STATUS_LABELS).map(([val, { label }]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>

        {/* Service type inline */}
        <div className="relative">
          {servicesLoading ? (
            <Loader2 size={14} className="animate-spin text-slate-400" />
          ) : (
            <>
              <select
                value={activeServiceId ?? ""}
                onChange={(e) => {
                  const next = e.target.value;
                  setActiveServiceId(next ? Number(next) : null);
                  setPage(1);
                }}
                className="appearance-none border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
              >
                <option value="">Todos os tipos</option>
                {services.map((svc) => (
                  <option key={svc.id} value={svc.id}>
                    {svc.sigla} — {svc.description}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
            </>
          )}
        </div>

        <div className="ml-auto text-xs text-slate-400">
          {filteredCards.length} registro{filteredCards.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {cardsLoading ? (
          <div className="flex justify-center py-14">
            <Loader2 size={24} className="animate-spin text-indigo-500" />
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="py-14 text-center text-slate-400">
            <FileText size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum requerimento encontrado para este período.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Protocolo</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Membro / Candidato</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Serviço</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Igreja</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Etapa</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Situação</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Abertura</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pageCards.map((card) => (
                    <tr key={card.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <a
                          href={`/app-ui/secretariat/pipeline?q=${encodeURIComponent(card.protocol)}`}
                          className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 font-mono text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                          title="Ver no pipeline"
                        >
                          {card.protocol}
                          <ExternalLink size={11} />
                        </a>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800 truncate max-w-[180px]">
                          {card.candidateName || card.member?.fullName || "—"}
                        </p>
                        {card.member?.rol != null && (
                          <p className="text-xs text-slate-400">ROL {card.member.rol}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {card.service?.sigla ? (
                          <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-bold text-indigo-700">
                            {card.service.sigla}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-[160px] truncate">
                        {card.church?.name || "—"}
                      </td>
                      <td className="px-4 py-3">
                        {(card as any).columnName ? (
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                            {(card as any).columnName}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={effectiveStatusKey(card)} label={card.statusLabel || card.status} />
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {fmtDate(card.openedAt || card.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <a
                            href={`/app-ui/secretariat/pipeline?q=${encodeURIComponent(card.protocol)}`}
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-indigo-600"
                            title="Ver no pipeline"
                          >
                            <Eye size={14} />
                          </a>
                          <button
                            onClick={() => setDetailCard(card)}
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                            title="Ver detalhes"
                          >
                            <MoreVertical size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                <span className="text-xs text-slate-400">
                  PÃ¡gina {page} de {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  >
                    PrÃ³xima
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* New Requirement Modal */}
      {showNew && (
        <NovoRequerimentoModal
          services={services}
          defaultServiceId={activeServiceId}
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            loadCards();
            showToast(true, "Requerimento criado com sucesso!");
          }}
        />
      )}

      {detailCard && (
        <RequerimentoDetalheModal
          card={detailCard}
          onClose={() => setDetailCard(null)}
          onUpdated={loadCards}
        />
      )}

      <PrintModal
        open={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        defaultSort="openedAt"
        sortOptions={[
          { value: "openedAt", label: "Data de abertura" },
          { value: "candidateName", label: "Membro / Candidato" },
          { value: "protocol", label: "Protocolo" },
          { value: "service", label: "Serviço" },
          { value: "church", label: "Igreja" },
          { value: "status", label: "Situação" },
        ]}
        columnOptions={[
          { value: "protocol", label: "Protocolo" },
          { value: "candidate", label: "Membro / Candidato" },
          { value: "service", label: "Serviço" },
          { value: "church", label: "Igreja" },
          { value: "stage", label: "Etapa" },
          { value: "status", label: "Situação" },
          { value: "openedAt", label: "Abertura" },
        ]}
        onPrint={(orientation, sortBy, selectedColumns) => {
          const sorted = [...filteredCards].sort((a, b) => {
            if (sortBy === "candidateName") return (a.candidateName || a.member?.fullName || "").localeCompare(b.candidateName || b.member?.fullName || "", "pt-BR");
            if (sortBy === "protocol") return (a.protocol || "").localeCompare(b.protocol || "", "pt-BR");
            if (sortBy === "service") return (a.service?.sigla || "").localeCompare(b.service?.sigla || "", "pt-BR");
            if (sortBy === "church") return (a.church?.name || "").localeCompare(b.church?.name || "", "pt-BR");
            if (sortBy === "status") return (a.status || "").localeCompare(b.status || "", "pt-BR");
            return new Date(a.openedAt || a.createdAt || "").getTime() - new Date(b.openedAt || b.createdAt || "").getTime();
          });
          const allCols = [
            { key: "protocol", header: "Protocolo", render: (c: typeof sorted[0]) => c.protocol || "—" },
            { key: "candidate", header: "Membro / Candidato", render: (c: typeof sorted[0]) => c.candidateName || c.member?.fullName || "—" },
            { key: "service", header: "Serviço", render: (c: typeof sorted[0]) => c.service ? `${c.service.sigla} — ${c.service.description}` : "—" },
            { key: "church", header: "Igreja", render: (c: typeof sorted[0]) => c.church?.name || "—" },
            { key: "stage", header: "Etapa", render: (c: typeof sorted[0]) => (c as any).columnName || "—" },
            { key: "status", header: "Situação", render: (c: typeof sorted[0]) => { const eff = effectiveStatusKey(c); return STATUS_LABELS[eff]?.label || c.statusLabel || c.status || "—"; } },
            { key: "openedAt", header: "Abertura", render: (c: typeof sorted[0]) => fmtDate(c.openedAt || c.createdAt) },
          ];
          printReport({
            title: "Requerimentos",
            subtitle: activeService ? `${activeService.sigla} — ${activeService.description}` : "Todos os tipos",
            orientation,
            columns: allCols.filter((c) => selectedColumns.includes(c.key)),
            rows: sorted.map((card) => {
              const row: Record<string, string> = {};
              allCols.forEach((col) => { row[col.key] = col.render(card); });
              return row;
            }),
          });
        }}
      />
    </div>
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getCurrentUserMeta() {
  try {
    const user = JSON.parse(localStorage.getItem("mrm_user") || "{}");
    return {
      id: user.id || null,
      fullName: user.fullName || user.name || "Usuário atual",
      email: user.email || "",
      churchId: user.churchId || null,
      churchName: user.churchName || null,
    };
  } catch {
    return { id: null, fullName: "Usuário atual", email: "", churchId: null, churchName: null };
  }
}

async function uploadFileToBucket(file: File) {
  const token = localStorage.getItem("mrm_token");
  const form = new FormData();
  form.append("file", file);
  const uploadRes = await fetch(`${apiBase}/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!uploadRes.ok) {
    throw new Error("Falha no upload do arquivo.");
  }
  return uploadRes.json() as Promise<{ url: string }>;
}

function actionLabel(action: string | null) {
  if (!action) return "Movimentação";
  if (action.includes("STATUS→")) return `Status atualizado: ${action.replace("STATUS→", "")}`;
  if (action.includes("TITULO→")) return `Título atualizado: ${action.replace("TITULO→", "")}`;
  if (action.includes("OCORRENCIA→")) return `Ocorrência: ${action.replace("OCORRENCIA→", "")}`;
  return action;
}

function RequerimentoDetalheModal({
  card: initialCard,
  onClose,
  onUpdated,
}: {
  card: KanCard;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"detalhes" | "arquivos" | "chat">("detalhes");
  const [detail, setDetail] = useState<CardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingFile, setSavingFile] = useState(false);
  const [savingMessage, setSavingMessage] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [chatText, setChatText] = useState("");
  const [attachType, setAttachType] = useState<string>(DOCUMENT_TYPES[2]);
  const [chatAttachment, setChatAttachment] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);

  function loadDetail() {
    setLoading(true);
    authFetch(`${apiBase}/kan/cards/${initialCard.id}`)
      .then((r) => r.json())
      .then((data) => setDetail(data))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadDetail();
  }, [initialCard.id]);

  const card = detail || initialCard;
  const currentUser = getCurrentUserMeta();
  const attachments = Array.isArray(card.attachments) ? card.attachments : [];
  const chatMessages = Array.isArray((card.metadata as Record<string, unknown> | null)?.chatMessages)
    ? ((card.metadata as Record<string, unknown>).chatMessages as ChatMessageItem[])
    : [];

  async function patchCard(next: { attachments?: unknown; metadata?: unknown }) {
    const res = await authFetch(`${apiBase}/kan/cards/${card.id}`, {
      method: "PATCH",
      body: JSON.stringify(next),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || "Falha ao atualizar registro.");
    }
  }

  async function handleAddAttachment(file: File) {
    setSavingFile(true);
    setDetailError("");
    try {
      const uploadData = await uploadFileToBucket(file);
      await patchCard({
        attachments: [
          ...attachments,
          { type: attachType, url: uploadData.url, name: file.name, filename: file.name },
        ],
      });
      loadDetail();
      onUpdated();
    } catch (ex) {
      setDetailError(ex instanceof Error ? ex.message : "Falha ao anexar arquivo.");
    } finally {
      setSavingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSendMessage() {
    if (!chatText.trim() && !chatAttachment) return;
    setSavingMessage(true);
    setDetailError("");
    try {
      const uploadedAttachment = chatAttachment ? await uploadFileToBucket(chatAttachment) : null;
      const nextMessages: ChatMessageItem[] = [
        ...chatMessages,
        {
          id: `${Date.now()}`,
          text: chatText.trim(),
          createdAt: new Date().toISOString(),
          senderId: currentUser.id,
          senderName: currentUser.fullName,
          senderChurchId: currentUser.churchId,
          senderChurchName: currentUser.churchName,
          attachment: uploadedAttachment
            ? {
                type: "Arquivo do chat",
                url: uploadedAttachment.url,
                name: chatAttachment?.name || "Arquivo",
                filename: chatAttachment?.name || "Arquivo",
              }
            : null,
        },
      ];
      await patchCard({
        metadata: {
          ...((card.metadata as Record<string, unknown> | null) || {}),
          chatMessages: nextMessages,
        },
      });
      setChatText("");
      setChatAttachment(null);
      loadDetail();
      onUpdated();
    } catch (ex) {
      setDetailError(ex instanceof Error ? ex.message : "Falha ao enviar mensagem.");
    } finally {
      setSavingMessage(false);
    }
  }

  const tabs = [
    { key: "detalhes", label: "Detalhes", icon: FileText },
    { key: "arquivos", label: "Arquivos", icon: Paperclip },
    { key: "chat", label: "Chat", icon: MessageSquare },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex w-full max-w-4xl flex-col rounded-3xl bg-white shadow-2xl" style={{ maxHeight: "92vh" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-slate-100 px-6 pt-5 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Detalhes do requerimento</h2>
            <p className="mt-0.5 text-xs font-mono text-slate-400">{card.protocol}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-slate-100 px-6 pt-3">
          <div className="flex items-center gap-2 overflow-x-auto">
            {tabs.map(({ key, label, icon: Icon }) => {
              const active = activeTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`inline-flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition-colors ${active ? "border-indigo-500 text-slate-900" : "border-transparent text-slate-400 hover:text-slate-700"}`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="flex-1 py-20 text-center text-slate-400"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {detailError && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                {detailError}
              </div>
            )}

            {activeTab === "detalhes" && (
              <div className="space-y-5">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${(STATUS_LABELS[(card.status || "").toLowerCase()]?.cls) || "bg-slate-100 text-slate-600"}`}>
                    {card.statusLabel || card.status}
                  </span>
                  <span className="text-xs text-slate-400">Aberto em {fmtDate(card.openedAt || card.createdAt)}</span>
                </div>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <InfoBlock label="Membro / Candidato" value={card.candidateName || card.member?.fullName || "—"} meta={card.member?.rol != null ? `ROL ${card.member.rol}` : undefined} />
                  <InfoBlock label="Serviço" value={card.service?.description || "—"} meta={card.service?.sigla || undefined} />
                  <InfoBlock label="Igreja de origem" value={card.church?.code ? `${card.church.code} - ${card.church.name}` : card.church?.name || "—"} />
                  <InfoBlock label="Aberto por" value={card.createdByUser?.fullName || card.requesterName || "Sistema"} meta={card.createdByUser?.email || undefined} />
                </div>

                {((card as CardDetail).description || (card as CardDetail).observations || (card as CardDetail).justification || (card as CardDetail).subject) && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-4">
                    {(card as CardDetail).subject && <TextBlock label="Assunto" value={(card as CardDetail).subject!} />}
                    {(card as CardDetail).justification && <TextBlock label="Justificativa" value={(card as CardDetail).justification!} />}
                    {(card as CardDetail).description && <TextBlock label="Descrição" value={(card as CardDetail).description!} />}
                    {(card as CardDetail).observations && <TextBlock label="Observações" value={(card as CardDetail).observations!} />}
                  </div>
                )}

                {(card as CardDetail).eventHistory && (card as CardDetail).eventHistory!.length > 0 && (
                  <div>
                    <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Histórico de ações</p>
                    <div className="space-y-0 rounded-2xl border border-slate-200 bg-white p-4">
                      {(card as CardDetail).eventHistory!.map((evt, index) => (
                        <div key={evt.id} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className="mt-1 h-2.5 w-2.5 rounded-full bg-indigo-400" />
                            {index < (card as CardDetail).eventHistory!.length - 1 && <div className="my-1 w-px flex-1 bg-slate-200" />}
                          </div>
                          <div className="pb-4">
                            <p className="text-sm font-semibold text-slate-900">{actionLabel(evt.action)}</p>
                            {evt.notes && <p className="mt-0.5 text-xs text-slate-500">{evt.notes}</p>}
                            <p className="mt-1 text-[11px] text-slate-400">{formatDateTime(evt.createdAt)}{evt.createdByUser ? ` · ${evt.createdByUser.fullName}` : ""}{evt.serviceName ? ` · ${evt.serviceName}` : ""}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "arquivos" && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="mb-3 text-sm font-semibold text-slate-900">Adicionar novo arquivo</p>
                  <div className="flex flex-col gap-3 md:flex-row">
                    <div className="relative flex-1">
                      <select
                        value={attachType}
                        onChange={(e) => setAttachType(e.target.value)}
                        className="w-full appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 py-2.5 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none"
                      >
                        {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={savingFile}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      {savingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      Anexar arquivo
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleAddAttachment(file);
                      }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-400">Envio de um arquivo por vez.</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">Arquivos enviados</div>
                  {attachments.length === 0 ? (
                    <div className="px-4 py-12 text-center text-sm text-slate-400">Nenhum arquivo anexado.</div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {attachments.map((file, index) => (
                        <a key={`${file.url || file.name}-${index}`} href={file.url || "#"} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Paperclip className="h-4 w-4" /></span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-900">{file.filename || file.name || `Arquivo ${index + 1}`}</p>
                            <p className="truncate text-xs text-slate-400">{file.type || "Documento"}</p>
                          </div>
                          <ExternalLink className="h-4 w-4 text-slate-400" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "chat" && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                  Conversa entre a secretaria solicitante e a secretaria da sede sobre este requerimento.
                </div>
                <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4">
                  {chatMessages.length === 0 ? (
                    <div className="py-10 text-center text-sm text-slate-400">Nenhuma mensagem ainda.</div>
                  ) : (
                    chatMessages.map((msg) => {
                      const mine = msg.senderId && currentUser.id ? msg.senderId === currentUser.id : msg.senderChurchId === currentUser.churchId;
                      return (
                        <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[78%] rounded-2xl px-4 py-3 ${mine ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-800"}`}>
                            <p className={`mb-1 text-[11px] font-semibold ${mine ? "text-indigo-100" : "text-slate-500"}`}>{msg.senderName}{msg.senderChurchName ? ` · ${msg.senderChurchName}` : ""}</p>
                            {msg.text ? <p className="whitespace-pre-wrap text-sm leading-6">{msg.text}</p> : null}
                            {msg.attachment?.url && (
                              <a
                                href={msg.attachment.url}
                                target="_blank"
                                rel="noreferrer"
                                className={`mt-2 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium ${mine ? "bg-white/15 text-white hover:bg-white/20" : "bg-white text-slate-700 hover:bg-slate-50"}`}
                              >
                                <Paperclip className="h-3.5 w-3.5" />
                                {msg.attachment.filename || msg.attachment.name || "Arquivo anexado"}
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                            <p className={`mt-2 text-[10px] ${mine ? "text-indigo-100/80" : "text-slate-400"}`}>{formatDateTime(msg.createdAt)}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <textarea
                    value={chatText}
                    onChange={(e) => setChatText(e.target.value)}
                    rows={3}
                    placeholder="Escreva uma mensagem para a outra secretaria..."
                    className="w-full resize-none rounded-xl border border-slate-200 px-3 py-3 text-sm focus:border-indigo-500 focus:outline-none"
                  />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        ref={chatFileInputRef}
                        type="file"
                        className="hidden"
                        onChange={(e) => setChatAttachment(e.target.files?.[0] || null)}
                      />
                      <button
                        type="button"
                        onClick={() => chatFileInputRef.current?.click()}
                        disabled={savingMessage}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        <Paperclip className="h-4 w-4" />
                        Anexar arquivo
                      </button>
                      {chatAttachment && (
                        <div className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600">
                          <Paperclip className="h-3.5 w-3.5" />
                          <span className="max-w-[220px] truncate">{chatAttachment.name}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setChatAttachment(null);
                              if (chatFileInputRef.current) chatFileInputRef.current.value = "";
                            }}
                            className="text-slate-400 hover:text-slate-700"
                            title="Remover arquivo"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                      <p className="text-xs text-slate-400">O arquivo sobe para o bucket e a conversa guarda só a URL.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleSendMessage()}
                      disabled={savingMessage || (!chatText.trim() && !chatAttachment)}
                      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                    >
                      {savingMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                      Enviar mensagem
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="border-t border-slate-100 px-6 py-4 text-right">
          <button onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Fechar</button>
        </div>
      </div>
    </div>
  );
}

function InfoBlock({ label, value, meta }: { label: string; value: string; meta?: string }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="font-semibold text-slate-900">{value}</p>
      {meta ? <p className="text-xs text-slate-400">{meta}</p> : null}
    </div>
  );
}

function TextBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="whitespace-pre-wrap text-sm text-slate-700">{value}</p>
    </div>
  );
}

// â”€â”€â”€ Modal: Novo Requerimento â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function memberStatusCls(s?: string | null) {
  const v = (s || "").toUpperCase();
  if (v.includes("ATIVO") || v === "ACTIVE") return "bg-emerald-100 text-emerald-700";
  if (v.includes("INATIVO") || v === "INACTIVE") return "bg-red-100 text-red-700";
  if (v.includes("EXCLU")) return "bg-red-100 text-red-700";
  if (v.includes("TRANSFER")) return "bg-blue-100 text-blue-700";
  return "bg-slate-100 text-slate-600";
}

function NovoRequerimentoModal({
  services,
  defaultServiceId,
  onClose,
  onCreated,
}: {
  services: KanService[];
  defaultServiceId: number | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [serviceId, setServiceId] = useState<string>(defaultServiceId ? String(defaultServiceId) : "");
  const [observations, setObservations] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // â”€â”€ Member search â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [selectedMember, setSelectedMember] = useState<MemberHit | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberHits, setMemberHits] = useState<MemberHit[]>([]);
  const [memberLoading, setMemberLoading] = useState(false);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const memberRef = useRef<HTMLDivElement>(null);
  const memberDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const memberRequestSeq = useRef(0);

  async function runMemberSearch(rawSearch: string) {
    const trimmedSearch = rawSearch.trim();
    const isNumericSearch = /^\d+$/.test(trimmedSearch);

    if (!trimmedSearch || (!isNumericSearch && trimmedSearch.length < 2)) {
      setMemberHits([]);
      setShowMemberDropdown(false);
      setMemberLoading(false);
      return;
    }

    setMemberLoading(true);
    const requestId = ++memberRequestSeq.current;
    const campoId = localStorage.getItem("mrm_active_field_id") || "";
    const params = new URLSearchParams({ query: trimmedSearch, limit: "10" });

    if (campoId) params.set("campoId", campoId);

    try {
      const response = await authFetch(`${apiBase}/members?${params}`);
      const data = await response.json();
      if (requestId !== memberRequestSeq.current) return;

      const list: MemberHit[] = Array.isArray(data) ? data : data?.items || [];
      setMemberHits(list.slice(0, 10));
      setShowMemberDropdown(list.length > 0);
    } catch {
      if (requestId !== memberRequestSeq.current) return;
      setMemberHits([]);
      setShowMemberDropdown(false);
    } finally {
      if (requestId !== memberRequestSeq.current) return;
      setMemberLoading(false);
    }
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (memberRef.current && !memberRef.current.contains(e.target as Node))
        setShowMemberDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (memberDebounce.current) clearTimeout(memberDebounce.current);
    const trimmedSearch = memberSearch.trim();
    const isNumericSearch = /^\d+$/.test(trimmedSearch);

    if (!trimmedSearch || (!isNumericSearch && trimmedSearch.length < 2)) {
      setMemberHits([]);
      setShowMemberDropdown(false);
      return;
    }
    memberDebounce.current = setTimeout(() => {
      runMemberSearch(memberSearch);
    }, 300);

    return () => {
      if (memberDebounce.current) clearTimeout(memberDebounce.current);
    };
  }, [memberSearch]);

  function pickMember(m: MemberHit) {
    setSelectedMember(m);
    setMemberSearch("");
    setMemberHits([]);
    setShowMemberDropdown(false);
  }

  // â”€â”€ Attachments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [attachDocType, setAttachDocType] = useState<string>(DOCUMENT_TYPES[2]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setAttachments((prev) => [
      ...prev,
      ...files.map((f) => ({ type: attachDocType, file: f, name: f.name })),
    ]);
    e.target.value = "";
  }

  function removeAttachment(idx: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  // â”€â”€ Service / stage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const selectedService = useMemo(
    () => services.find((s) => s.id === Number(serviceId)) ?? null,
    [services, serviceId],
  );
  const selectedRuleStage = useMemo(
    () => selectedService?.rules?.find((rule) => rule.columnIndex === 1)?.stage ?? null,
    [selectedService],
  );
  const stageId = selectedRuleStage?.id ?? selectedService?.stages?.[0]?.id ?? null;
  // â”€â”€ Submit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!selectedMember) { setError("Selecione o membro."); return; }
    if (!serviceId) { setError("Selecione o tipo de requerimento."); return; }
    if (!stageId) { setError("Serviço selecionado não possui etapa configurada na matriz."); return; }
    const churchId = selectedMember.church?.id || "";
    if (!churchId) { setError("Membro selecionado não possui igreja vinculada."); return; }
    setSaving(true);
    try {
      // Upload attachments first
      let attachmentPayload: Array<{ type: string; url: string; name: string }> | null = null;
      if (attachments.length > 0) {
        const token = localStorage.getItem("mrm_token");
        const uploaded = await Promise.all(
          attachments.map(async (a) => {
            const form = new FormData();
            form.append("file", a.file);
            const res = await fetch(`${apiBase}/upload`, {
              method: "POST",
              headers: token ? { Authorization: `Bearer ${token}` } : {},
              body: form,
            });
            if (!res.ok) throw new Error(`Falha ao enviar "${a.name}"`);
            const data = await res.json();
            return { type: a.type, url: data.url as string, name: a.name };
          }),
        );
        attachmentPayload = uploaded;
      }
      const body: Record<string, unknown> = {
        stageId,
        serviceId: Number(serviceId),
        churchId,
        memberId: selectedMember.id,
        candidateName: selectedMember.fullName,
        description: observations || null,
        attachments: attachmentPayload,
      };
      const res = await authFetch(`${apiBase}/kan/cards`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err?.error || "Erro ao criar requerimento.");
        return;
      }
      onCreated();
    } catch (ex: unknown) {
      setError(ex instanceof Error ? ex.message : "Erro de conexão.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[480px] rounded-2xl bg-white shadow-2xl flex flex-col"
        style={{ maxHeight: "92vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-700" />
            <h2 className="text-base font-bold text-slate-900">Requerimento</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          {/* â”€â”€ Member card / search â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className="px-5 pt-4 pb-3 border-b border-slate-100">
            {selectedMember ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0">
                  <User size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 leading-tight">{selectedMember.fullName}</p>
                  {selectedMember.church && (
                    <p className="text-xs text-slate-500 truncate">
                      {selectedMember.church.code
                        ? `${selectedMember.church.code} - ${selectedMember.church.name}`
                        : selectedMember.church.name}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {selectedMember.rol != null && (
                    <span className="text-xs text-slate-500 font-medium">ROL: {selectedMember.rol}</span>
                  )}
                  {selectedMember.membershipStatus && (
                    <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${memberStatusCls(selectedMember.membershipStatus)}`}>
                      {selectedMember.membershipStatus}
                    </span>
                  )}
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">Membro</span>
                  <button
                    type="button"
                    onClick={() => setSelectedMember(null)}
                    className="ml-1 text-slate-400 hover:text-slate-600"
                    title="Trocar membro"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <div ref={memberRef} className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={memberSearch}
                    autoFocus
                    onChange={(e) => {
                      const value = e.target.value;
                      setMemberSearch(value);
                      if (value.trim().length >= 2 || /^\d+$/.test(value.trim())) setShowMemberDropdown(true);
                    }}
                    onFocus={() => { if (memberHits.length > 0) setShowMemberDropdown(true); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void runMemberSearch(memberSearch);
                      }
                    }}
                    placeholder="Buscar por nome ou ROL..."
                    className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => void runMemberSearch(memberSearch)}
                    disabled={memberLoading || !memberSearch.trim()}
                    className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Buscar membro"
                  >
                    <Search className="h-4 w-4" />
                  </button>
                </div>
                {memberLoading && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />
                )}
                {showMemberDropdown && memberHits.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-20 rounded-xl border border-slate-200 bg-white shadow-xl max-h-52 overflow-y-auto">
                    {memberHits.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => pickMember(m)}
                        className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2.5"
                      >
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold flex-shrink-0">
                          {m.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{m.fullName}</p>
                          <p className="text-[11px] text-slate-400 truncate">
                            {m.church?.code ? `${m.church.code} – ` : ""}{m.church?.name || ""}
                            {m.rol != null ? ` · ROL ${m.rol}` : ""}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="px-5 py-4 space-y-5">
            {/* â”€â”€ Step 1: Tipo de Requerimento â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex w-5 h-5 rounded-full bg-slate-800 text-white text-[11px] font-bold items-center justify-center flex-shrink-0">1</span>
                <span className="text-sm font-semibold text-slate-800">Selecione o requerimento</span>
              </div>

              <div className="relative">
                <select
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  className="w-full appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 py-2.5 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">Selecione o tipo de requerimento...</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.description}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
              {selectedService && !stageId && (
                <p className="mt-1 text-[11px] text-amber-600">Este serviço não possui etapa na matriz.</p>
              )}

              <div className="mt-3">
                <label className="block text-xs text-slate-500 mb-1.5">Detalhes / Observações</label>
                <textarea
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  rows={3}
                  placeholder="Descreva detalhes sobre o requerimento..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none resize-none"
                />
              </div>
            </div>

            {/* â”€â”€ Step 2: Anexar Documentos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex w-5 h-5 rounded-full bg-slate-800 text-white text-[11px] font-bold items-center justify-center flex-shrink-0">2</span>
                  <span className="text-sm font-semibold text-slate-800">Anexar Documentos</span>
                </div>
                <span className="text-xs text-slate-400">Opcional</span>
              </div>

              {/* Type + file button row */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <select
                    value={attachDocType}
                    onChange={(e) => setAttachDocType(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 py-2.5 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none"
                  >
                    {DOCUMENT_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-700 text-white px-4 py-2.5 text-sm font-semibold flex-shrink-0"
                >
                  <Upload size={14} />
                  Escolher arquivo
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>

              {/* Attached files list */}
              <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 min-h-[64px]">
                {attachments.length === 0 ? (
                  <div className="flex items-center justify-center py-5 text-sm text-slate-400">
                    Nenhum arquivo anexado.
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {attachments.map((a, i) => (
                      <li key={i} className="flex items-center gap-2 px-3 py-2.5">
                        <Paperclip size={13} className="text-slate-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-700 truncate">{a.name}</p>
                          <p className="text-[11px] text-slate-400 truncate">{a.type}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAttachment(i)}
                          className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 flex-shrink-0"
                          title="Remover"
                        >
                          <Trash2 size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                <AlertTriangle size={14} className="flex-shrink-0" />
                {error}
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit as any}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? (
              <><Loader2 size={14} className="animate-spin" /> Criando...</>
            ) : (
              "Incluir requerimento"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
