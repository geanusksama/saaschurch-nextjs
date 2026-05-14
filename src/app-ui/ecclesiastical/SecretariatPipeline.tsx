import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Search,
  Plus,
  Calendar,
  LayoutGrid,
  List as ListIcon,
  TrendingUp,
  MoreVertical,
  Ellipsis,
  Download,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Archive,
  Trash2,
  ArrowRightLeft,
  Droplets,
  Shirt,
  FileText,
  Loader2,
  MessageSquare,
  Paperclip,
  Upload,
  ExternalLink,
  X,
  Check,
  Printer,
} from "lucide-react";
import * as XLSX from "xlsx";

import { apiBase } from "../../lib/apiBase";
import { PrintModal } from "../../components/app-ui/shared/PrintModal";
import { printReport } from "../../lib/printReport";

type Pipeline = { id: number; name: string; type: string | null };
type Service = { id: number; sigla: string; description: string };
type Column = { id: number; name: string; columnIndex: number; color: string | null };
type Stage = {
  id: number;
  name: string;
  description: string | null;
  pipelineId: number;
  serviceId: number | null;
  service?: Service | null;
  columns: Column[];
};
type Card = {
  id: string;
  protocol: string;
  candidateName: string | null;
  currentTitle?: string | null;
  intendedTitle?: string | null;
  status: string;
  statusLabel: string | null;
  columnIndex: number;
  openedAt: string | null;
  closedAt: string | null;
  createdAt?: string | null;
  church?: { id: string; name: string; code: string | null } | null;
  destinationChurch?: { id: string; name: string; code: string | null } | null;
  member?: { id: string; fullName: string; rol?: number | null; ecclesiasticalTitle?: string | null; membershipStatus?: string | null } | null;
  service?: { sigla: string; description: string } | null;
  column?: { id: number; name: string; columnIndex: number; color: string | null } | null;
};
type AttachmentItem = {
  type?: string;
  url?: string;
  name?: string;
  filename?: string;
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
type ColumnWithCards = Column & { cards: Card[] };

function moveCardsBetweenColumns(
  currentBoard: ColumnWithCards[],
  cardIds: string[],
  newColumnIndex: number,
) {
  const targetIds = new Set(cardIds);
  const movedCards: Card[] = [];

  const boardWithoutCards = currentBoard.map((column) => {
    const remainingCards = column.cards.filter((card) => {
      if (!targetIds.has(card.id)) return true;
      movedCards.push({ ...card, columnIndex: newColumnIndex });
      return false;
    });

    return {
      ...column,
      cards: remainingCards,
    };
  });

  if (!movedCards.length) return null;

  return boardWithoutCards.map((column) => {
    if (column.columnIndex !== newColumnIndex) return column;

    return {
      ...column,
      cards: [...movedCards, ...column.cards],
    };
  });
}

const COLOR_BORDER: Record<string, string> = {
  purple: "border-t-purple-500",
  blue: "border-t-blue-500",
  green: "border-t-emerald-500",
  yellow: "border-t-amber-400",
  orange: "border-t-orange-500",
  red: "border-t-rose-500",
};

const COLOR_BADGE: Record<string, string> = {
  purple: "bg-purple-100 text-purple-700",
  blue: "bg-blue-100 text-blue-700",
  green: "bg-emerald-100 text-emerald-700",
  yellow: "bg-amber-100 text-amber-700",
  orange: "bg-orange-100 text-orange-700",
  red: "bg-rose-100 text-rose-700",
};

function authFetch(url: string, init: RequestInit = {}) {
  const token = localStorage.getItem("mrm_token");
  const hasBody = init.body != null;
  return fetch(url, {
    ...init,
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
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

function isConsecrationStage(stageMeta: Stage | null) {
  const haystack = [
    stageMeta?.name || "",
    stageMeta?.description || "",
    stageMeta?.service?.description || "",
    stageMeta?.service?.sigla || "",
  ].join(" ").toLowerCase();

  return haystack.includes("consagra") || haystack.includes("separa");
}

function hasConsecrationTitles(card: Card, stageMeta: Stage | null) {
  return isConsecrationStage(stageMeta) && Boolean(card.currentTitle || card.intendedTitle);
}

function detectServiceKind(card: Card, stageMeta: Stage | null) {
  const haystack = [
    stageMeta?.name || "",
    stageMeta?.description || "",
    stageMeta?.service?.description || "",
    stageMeta?.service?.sigla || "",
    card.service?.description || "",
    card.service?.sigla || "",
    card.protocol || "",
  ]
    .join(" ")
    .toLowerCase();

  if (haystack.includes("batis")) return "baptism";
  if (haystack.includes("consagra") || haystack.includes("separa")) return "consecration";
  if (haystack.includes("transfer") || haystack.includes("transf")) return "transfer";
  return "default";
}

function serviceBadgeMeta(kind: ReturnType<typeof detectServiceKind>) {
  if (kind === "baptism") {
    return {
      label: "Batismo",
      icon: Droplets,
      className: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
    };
  }

  if (kind === "consecration") {
    return {
      label: "Consagracao",
      icon: Shirt,
      className: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
    };
  }

  if (kind === "transfer") {
    return {
      label: "Transferencia",
      icon: ArrowRightLeft,
      className: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    };
  }

  return {
    label: "Servico",
    icon: Calendar,
    className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  };
}

function getMonthDateRange(baseDate = new Date()) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

const SECRETARIA_PIPELINE_ID = 1;

export default function SecretariatPipeline() {
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [stages, setStages] = useState<Stage[]>([]);
  const pipelineId = SECRETARIA_PIPELINE_ID;
  const [stageId, setStageId] = useState<number | null>(null);

  const { start: defaultFrom, end: defaultTo } = getMonthDateRange();
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [q, setQ] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialQuery = params.get("q") || "";
    if (initialQuery) {
      setQ(initialQuery);
    }
  }, []);

  // Filtros adicionais — Campo (apenas master) e Igreja (master/admin/campo)
  const me = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("mrm_user") || "{}"); } catch { return {}; }
  }, []);
  const canFilterCampo = me?.profileType === "master";
  const canFilterChurch = me?.profileType === "master" || me?.profileType === "admin" || me?.profileType === "campo";
  const canMoveCards = me?.profileType === "master" || me?.profileType === "admin";
  const [filterCampoId, setFilterCampoId] = useState<string>("");
  const hasFixedChurchScope = me?.profileType === "church" || (() => {
    const role = String(me?.roleName || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    return role.includes("secret") || role.includes("tesour");
  })();
  const [filterChurchId, setFilterChurchId] = useState<string>(hasFixedChurchScope ? (me?.churchId || "") : "");
  const [campos, setCampos] = useState<Array<{ id: string; name: string; code?: string }>>([]);
  const [churches, setChurches] = useState<Array<{ id: string; name: string; code?: string | null }>>([]);

  // Carrega campos (apenas master) e igrejas filtradas pelo campo
  useEffect(() => {
    if (!canFilterCampo) return;
    authFetch(`${apiBase}/campos`)
      .then((r) => r.json())
      .then((data) => Array.isArray(data) ? setCampos(data) : setCampos([]))
      .catch(() => setCampos([]));
  }, [canFilterCampo]);

  useEffect(() => {
    if (!canFilterChurch) return;
    const params = new URLSearchParams();
    const fieldId = filterCampoId || me?.campoId || "";
    if (fieldId) params.set("fieldId", fieldId);
    authFetch(`${apiBase}/churches?${params}`)
      .then((r) => r.json())
      .then((data) => Array.isArray(data) ? setChurches(data) : setChurches([]))
      .catch(() => setChurches([]));
    // Quando muda o campo, limpa a igreja selecionada
    setFilterChurchId("");
  }, [canFilterChurch, filterCampoId, me?.campoId]);

  const [board, setBoard] = useState<ColumnWithCards[]>([]);
  const [stageMeta, setStageMeta] = useState<Stage | null>(null);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [refreshingBoard, setRefreshingBoard] = useState(false);
  const [showNewCard, setShowNewCard] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [detailCard, setDetailCard] = useState<Card | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Card | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Card | null>(null);
  const [cardActionLoading, setCardActionLoading] = useState(false);
  const [cardActionError, setCardActionError] = useState('');
  const [movingCardIds, setMovingCardIds] = useState<Set<string>>(new Set());
  const [moveError, setMoveError] = useState("");
  const [printModalOpen, setPrintModalOpen] = useState(false);

  const exportExcel = () => {
    const rows = allCards.map((c) => ({
      Protocolo: c.protocol || "",
      "Membro / Candidato": c.candidateName || c.member?.fullName || "",
      Serviço: c.service ? `${c.service.sigla} — ${c.service.description}` : "",
      Igreja: c.church?.name || "",
      "Igreja Destino": c.destinationChurch?.name || "",
      Etapa: stageMeta?.name || "",
      Situação: c.statusLabel || c.status || "",
      Abertura: c.openedAt ? new Date(c.openedAt).toLocaleDateString("pt-BR") : "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pipeline");
    XLSX.writeFile(wb, `pipeline-${stageMeta?.name || "secretaria"}.xlsx`);
  };

  const handleArchiveCard = async () => {
    if (!archiveTarget) return;
    setCardActionLoading(true);
    setCardActionError('');
    try {
      const r = await authFetch(`${apiBase}/kan/cards/${archiveTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'ARQUIVADO' }),
      });
      if (!r.ok) throw new Error('Falha ao arquivar registro.');
      setArchiveTarget(null);
      loadBoard();
    } catch (e: unknown) {
      setCardActionError(e instanceof Error ? e.message : 'Erro ao arquivar.');
    } finally {
      setCardActionLoading(false);
    }
  };

  const handleDeleteCard = async () => {
    if (!deleteTarget) return;
    setCardActionLoading(true);
    setCardActionError('');
    try {
      await authFetch(`${apiBase}/kan/cards/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      loadBoard();
    } catch (e: unknown) {
      setCardActionError(e instanceof Error ? e.message : 'Erro ao excluir.');
    } finally {
      setCardActionLoading(false);
    }
  };

  // ── Load stages whenever pipeline changes ────────────────────────────────
  useEffect(() => {
    if (!pipelineId) return;
    authFetch(`${apiBase}/kan/pipelines/${pipelineId}/stages`)
      .then((r) => r.json())
      .then((data: Stage[]) => {
        setStages(data);
        if (data.length) setStageId((curr) => (data.some((s) => s.id === curr) ? curr : data[0].id));
      })
      .catch(() => setStages([]));
  }, [pipelineId]);

  // ── Load board cards ─────────────────────────────────────────────────────
  const loadBoard = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!stageId) return;
    if (silent) setRefreshingBoard(true);
    else setLoadingBoard(true);

    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to + "T23:59:59");
    if (q) params.set("q", q);
    if (filterChurchId) params.set("churchId", filterChurchId);
    if (filterCampoId) params.set("campoId", filterCampoId);

    try {
      const response = await authFetch(`${apiBase}/kan/stages/${stageId}/board?${params}`);
      const data: { stage: Stage; columns: ColumnWithCards[] } = await response.json();
      setStageMeta(data.stage);
      setBoard(data.columns || []);
      setMoveError("");
    } catch {
      if (!silent) setBoard([]);
    } finally {
      if (silent) setRefreshingBoard(false);
      else setLoadingBoard(false);
    }
  };

  const handleCardMove = async (cardIds: string[], newColumnIndex: number) => {
    const previousBoard = board;
    const optimisticBoard = moveCardsBetweenColumns(previousBoard, cardIds, newColumnIndex);

    if (!optimisticBoard) return;

    setMoveError("");
    setMovingCardIds((prev) => new Set([...prev, ...cardIds]));
    setBoard(optimisticBoard);

    try {
      await Promise.all(
        cardIds.map(async (cardId) => {
          const response = await authFetch(`${apiBase}/kan/cards/${cardId}`, {
            method: "PATCH",
            body: JSON.stringify({ columnIndex: newColumnIndex }),
          });

          if (!response.ok) {
            throw new Error("Falha ao mover o card.");
          }
        }),
      );

      await loadBoard({ silent: true });
    } catch (error: unknown) {
      setBoard(previousBoard);
      setMoveError(error instanceof Error ? error.message : "Erro ao mover o card.");
    } finally {
      setMovingCardIds((prev) => {
        const next = new Set(prev);
        cardIds.forEach((cardId) => next.delete(cardId));
        return next;
      });
    }
  };

  useEffect(() => {
    void loadBoard();
  }, [stageId, from, to, q, filterCampoId, filterChurchId]);

  const allCards = useMemo(() => board.flatMap((c) => c.cards), [board]);

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-indigo-600 dark:text-indigo-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Pipeline – Secretaria
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Gestão de processos eclesiásticos
            </p>
          </div>
        </div>
      </div>

      {/* Pasta de trabalho — Folder cards for service selection */}
      {stages.length > 0 && (
        <div className="mb-4 -mx-6 px-6 overflow-x-auto">
          <div className="flex gap-2 pb-1" style={{ minWidth: "max-content" }}>
            {stages.map((stage, i) => {
              const isActive = stageId === stage.id;
              const palette = [
                { activeBg: "bg-indigo-100 dark:bg-indigo-950/60", activeBorder: "border-indigo-300 dark:border-indigo-700", activeText: "text-indigo-700 dark:text-indigo-300", activeIcon: "bg-indigo-200 dark:bg-indigo-800", iconColor: "text-indigo-600 dark:text-indigo-300", tab: "bg-indigo-200 dark:bg-indigo-800", tabActive: "bg-indigo-300 dark:bg-indigo-700" },
                { activeBg: "bg-sky-100 dark:bg-sky-950/60",       activeBorder: "border-sky-300 dark:border-sky-700",     activeText: "text-sky-700 dark:text-sky-300",     activeIcon: "bg-sky-200 dark:bg-sky-800",     iconColor: "text-sky-600 dark:text-sky-300",     tab: "bg-sky-200 dark:bg-sky-800",     tabActive: "bg-sky-300 dark:bg-sky-700" },
                { activeBg: "bg-violet-100 dark:bg-violet-950/60", activeBorder: "border-violet-300 dark:border-violet-700",activeText: "text-violet-700 dark:text-violet-300",activeIcon: "bg-violet-200 dark:bg-violet-800",iconColor: "text-violet-600 dark:text-violet-300",tab: "bg-violet-200 dark:bg-violet-800",tabActive: "bg-violet-300 dark:bg-violet-700" },
                { activeBg: "bg-amber-100 dark:bg-amber-950/60",   activeBorder: "border-amber-300 dark:border-amber-700",  activeText: "text-amber-700 dark:text-amber-300",  activeIcon: "bg-amber-200 dark:bg-amber-800",  iconColor: "text-amber-600 dark:text-amber-300",  tab: "bg-amber-200 dark:bg-amber-800",  tabActive: "bg-amber-300 dark:bg-amber-700" },
                { activeBg: "bg-emerald-100 dark:bg-emerald-950/60",activeBorder: "border-emerald-300 dark:border-emerald-700",activeText: "text-emerald-700 dark:text-emerald-300",activeIcon: "bg-emerald-200 dark:bg-emerald-800",iconColor: "text-emerald-600 dark:text-emerald-300",tab: "bg-emerald-200 dark:bg-emerald-800",tabActive: "bg-emerald-300 dark:bg-emerald-700" },
              ][i % 5];
              const haystack = [stage.name, stage.description || "", stage.service?.sigla || "", stage.service?.description || ""].join(" ").toLowerCase();
              const kind = haystack.includes("batis") ? "baptism" : haystack.includes("consagra") ? "consecration" : haystack.includes("transf") ? "transfer" : "default";
              const ServiceIcon = kind === "baptism" ? Droplets : kind === "consecration" ? Shirt : kind === "transfer" ? ArrowRightLeft : TrendingUp;
              return (
                <button
                  key={stage.id}
                  onClick={() => setStageId(stage.id)}
                  className={`group relative min-w-[140px] max-w-[200px] rounded-b-lg rounded-tr-lg text-left transition-all duration-150 overflow-visible
                    ${isActive
                      ? `${palette.activeBg} border ${palette.activeBorder} shadow-sm`
                      : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                    }`}
                  title={stage.description || stage.name}
                >
                  {/* folder ear tab */}
                  <span
                    className={`absolute -top-[8px] left-0 h-[8px] w-[44px] rounded-t-md
                      ${isActive ? palette.tabActive : "bg-slate-200 dark:bg-slate-700 group-hover:bg-slate-300 dark:group-hover:bg-slate-600"}`}
                  />
                  <div className="flex items-center gap-2.5 px-3 py-2.5">
                    <span className={`inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md ${isActive ? palette.activeIcon : "bg-slate-100 dark:bg-slate-700"}`}>
                      <ServiceIcon className={`h-3.5 w-3.5 ${isActive ? palette.iconColor : "text-slate-500 dark:text-slate-400"}`} />
                    </span>
                    <div className="min-w-0">
                      <p className={`text-[10px] font-semibold uppercase tracking-wider leading-none mb-0.5 ${isActive ? palette.activeText : "text-slate-400 dark:text-slate-500"}`}>
                        Pasta de trabalho
                      </p>
                      <p className={`text-xs font-bold leading-tight truncate ${isActive ? palette.activeText : "text-slate-700 dark:text-slate-200"}`}>
                        {stage.name}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="mb-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 sm:p-4">
        {/* Single row on desktop, stacked on mobile */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative w-full sm:w-auto sm:flex-1 sm:min-w-[200px] sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar..."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 pl-9 pr-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Date range */}
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 w-full sm:w-auto">
            <Calendar className="w-4 h-4 flex-shrink-0 text-slate-400" />
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="flex-1 min-w-0 sm:w-[116px] text-sm bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none [color-scheme:light] dark:[color-scheme:dark]"
            />
            <span className="text-slate-400 flex-shrink-0">→</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="flex-1 min-w-0 sm:w-[116px] text-sm bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none [color-scheme:light] dark:[color-scheme:dark]"
            />
          </div>

          {/* Campo select */}
          {canFilterCampo && (
            <SelectField
              value={filterCampoId}
              onChange={(v) => setFilterCampoId(v ? String(v) : "")}
              options={[
                { value: "", label: "Todos os campos" },
                ...campos.map((c) => ({ value: c.id, label: c.name })),
              ]}
              placeholder="Campo"
            />
          )}

          {/* Igreja select */}
          {canFilterChurch && (
            <div className="relative w-full sm:w-48">
              <select
                value={filterChurchId}
                onChange={(e) => setFilterChurchId(e.target.value)}
                className="w-full appearance-none rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 pl-3 pr-8 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              >
                <option value="">Todas as igrejas</option>
                {churches.map((c) => (
                  <option key={c.id} value={c.id}>{c.code ? `${c.code} – ${c.name}` : c.name}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
          )}

          {/* Actions */}
          <div className="ml-auto flex items-center gap-3">
            {stageMeta && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
                <span>{stageMeta.description} · {allCards.length} reg.</span>
                {refreshingBoard && (
                  <span className="h-2.5 w-2.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-500 dark:border-slate-600 dark:border-t-slate-300" />
                )}
              </div>
            )}

            <button
              onClick={exportExcel}
              title="Exportar Excel"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Exportar</span>
            </button>
            <button
              onClick={() => setPrintModalOpen(true)}
              title="Imprimir relatório"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>

            <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 p-1">
              <button
                title="Kanban"
                onClick={() => setView("kanban")}
                className={`rounded-md p-1.5 ${view === "kanban" ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300" : "text-slate-400"}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                title="Lista"
                onClick={() => setView("list")}
                className={`rounded-md p-1.5 ${view === "list" ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300" : "text-slate-400"}`}
              >
                <ListIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {moveError && (
          <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {moveError}
          </p>
        )}
      </div>

      {loadingBoard ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-12 text-center text-slate-400 dark:text-slate-500">
          Carregando...
        </div>
      ) : view === "kanban" ? (
        <KanbanView
          columns={board}
          stageMeta={stageMeta}
          canMoveCards={canMoveCards}
          movingCardIds={movingCardIds}
          onRefresh={loadBoard}
          onCardMove={(cardId, newColumnIndex) => handleCardMove([cardId], newColumnIndex)}
          onBulkMove={(cardIds, newColumnIndex) => handleCardMove(cardIds, newColumnIndex)}
          onAction={(action, card) => {
            if (action === "edit") setEditingCard(card);
            if (action === "details") setDetailCard(card);
            if (action === "archive") { setCardActionError(''); setArchiveTarget(card); }
            if (action === "delete") { setCardActionError(''); setDeleteTarget(card); }
          }}
        />
      ) : (
        <ListView columns={board} />
      )}

      {showNewCard && stageId && stageMeta && (
        <NewCardModal
          stage={stageMeta}
          onClose={() => setShowNewCard(false)}
          onCreated={() => {
            setShowNewCard(false);
            loadBoard();
          }}
        />
      )}

      {editingCard && (
        <EditCardModal
          card={editingCard}
          columns={board}
          onClose={() => setEditingCard(null)}
          onSaved={() => {
            setEditingCard(null);
            loadBoard();
          }}
        />
      )}

      {detailCard && (
        <CardDetailModal
          card={detailCard}
          onClose={() => setDetailCard(null)}
          onEdit={() => { setDetailCard(null); setEditingCard(detailCard); }}
        />
      )}

      {/* ── Archive confirm modal ─────────────────────────────────── */}
      {archiveTarget && (
        <>
          <div className="fixed inset-0 z-40 bg-slate-900/50" onClick={() => !cardActionLoading && setArchiveTarget(null)} />
          <div className="fixed left-1/2 top-1/2 z-50 w-[92%] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white shadow-2xl">
            <div className="p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
                  <Archive className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-slate-900">Arquivar registro</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    O registro <span className="font-semibold">{archiveTarget.protocol}</span> de{' '}
                    <span className="font-semibold uppercase">{archiveTarget.candidateName || archiveTarget.member?.fullName || '—'}</span>{' '}
                    será arquivado e removido do board. O histórico será preservado.
                  </p>
                  {cardActionError && <p className="mt-2 text-sm text-red-600">{cardActionError}</p>}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 rounded-b-xl border-t border-slate-200 bg-slate-50 px-6 py-3">
              <button type="button" onClick={() => setArchiveTarget(null)} disabled={cardActionLoading}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60">
                Cancelar
              </button>
              <button type="button" onClick={handleArchiveCard} disabled={cardActionLoading}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60">
                {cardActionLoading ? 'Arquivando...' : 'Arquivar'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Delete confirm modal ──────────────────────────────────── */}
      {deleteTarget && (
        <>
          <div className="fixed inset-0 z-40 bg-slate-900/50" onClick={() => !cardActionLoading && setDeleteTarget(null)} />
          <div className="fixed left-1/2 top-1/2 z-50 w-[92%] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white shadow-2xl">
            <div className="p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                  <Trash2 className="h-5 w-5 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-slate-900">Excluir registro</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Tem certeza que deseja excluir o registro <span className="font-semibold">{deleteTarget.protocol}</span> de{' '}
                    <span className="font-semibold uppercase">{deleteTarget.candidateName || deleteTarget.member?.fullName || '—'}</span>?
                    Esta ação não poderá ser desfeita.
                  </p>
                  {cardActionError && <p className="mt-2 text-sm text-red-600">{cardActionError}</p>}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 rounded-b-xl border-t border-slate-200 bg-slate-50 px-6 py-3">
              <button type="button" onClick={() => setDeleteTarget(null)} disabled={cardActionLoading}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60">
                Cancelar
              </button>
              <button type="button" onClick={handleDeleteCard} disabled={cardActionLoading}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                {cardActionLoading ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Print modal ───────────────────────────────────────────── */}
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
          const sorted = [...allCards].sort((a, b) => {
            if (sortBy === "candidateName") return (a.candidateName || a.member?.fullName || "").localeCompare(b.candidateName || b.member?.fullName || "", "pt-BR");
            if (sortBy === "protocol") return (a.protocol || "").localeCompare(b.protocol || "", "pt-BR");
            if (sortBy === "service") return (a.service?.sigla || "").localeCompare(b.service?.sigla || "", "pt-BR");
            if (sortBy === "church") return (a.church?.name || "").localeCompare(b.church?.name || "", "pt-BR");
            if (sortBy === "status") return (a.status || "").localeCompare(b.status || "", "pt-BR");
            return new Date(a.openedAt || a.createdAt || "").getTime() - new Date(b.openedAt || b.createdAt || "").getTime();
          });
          const allCols = [
            { key: "protocol",  header: "Protocolo",          render: (c: Card) => c.protocol || "—" },
            { key: "candidate", header: "Membro / Candidato", render: (c: Card) => c.candidateName || c.member?.fullName || "—" },
            { key: "service",   header: "Serviço",            render: (c: Card) => c.service ? `${c.service.sigla} — ${c.service.description}` : "—" },
            { key: "church",    header: "Igreja",             render: (c: Card) => c.church?.name || "—" },
            { key: "stage",     header: "Etapa",              render: (c: Card) => c.column?.name || stageMeta?.name || "—" },
            { key: "status",    header: "Situação",           render: (c: Card) => c.statusLabel || c.status || "—" },
            { key: "openedAt",  header: "Abertura",           render: (c: Card) => c.openedAt ? new Date(c.openedAt).toLocaleDateString("pt-BR") : "—" },
          ];
          printReport({
            title: "Pipeline — Secretaria",
            subtitle: stageMeta ? stageMeta.name : "",
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

// ── Sub-components ──────────────────────────────────────────────────────────

function SelectField({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string | number;
  onChange: (v: string) => void;
  options: { value: string | number; label: string }[];
  placeholder: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 pl-3 pr-8 py-2 text-sm focus:border-indigo-500 focus:outline-none"
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
    </div>
  );
}

function KanbanView({
  columns,
  stageMeta,
  canMoveCards,
  movingCardIds,
  onCardMove,
  onBulkMove,
  onAction,
  onRefresh,
}: {
  columns: ColumnWithCards[];
  stageMeta: Stage | null;
  canMoveCards: boolean;
  movingCardIds: Set<string>;
  onCardMove: (cardId: string, newColumnIndex: number) => Promise<void>;
  onBulkMove: (cardIds: string[], newColumnIndex: number) => Promise<void>;
  onAction: (action: "details" | "edit" | "archive" | "delete", card: Card) => void;
  onRefresh: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [colSearches, setColSearches] = useState<Record<number, string>>({});
  const [colSearchOpen, setColSearchOpen] = useState<Record<number, boolean>>({});
  const [colMenuOpen, setColMenuOpen] = useState<Record<number, boolean>>({});
  const [colEditing, setColEditing] = useState<Record<number, string | null>>({});
  const [showSelDropdown, setShowSelDropdown] = useState(false);
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const selRef = useRef<HTMLDivElement>(null);
  const actRef = useRef<HTMLDivElement>(null);

  // close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (selRef.current && !selRef.current.contains(e.target as Node)) setShowSelDropdown(false);
      if (actRef.current && !actRef.current.contains(e.target as Node)) setShowActionsDropdown(false);
      // close all col menus on outside click
      setColMenuOpen({});
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const moveColumn = async (col: ColumnWithCards, dir: "left" | "right") => {
    const sorted = [...columns].sort((a, b) => a.columnIndex - b.columnIndex);
    const idx = sorted.findIndex((c) => c.id === col.id);
    const swapWith = dir === "left" ? sorted[idx - 1] : sorted[idx + 1];
    if (!swapWith) return;
    await authFetch(`${apiBase}/kan/columns/${col.id}/move`, {
      method: "POST",
      body: JSON.stringify({ swapWithId: swapWith.id }),
    });
    onRefresh();
  };

  const renameColumn = async (col: ColumnWithCards, newName: string) => {
    if (!newName.trim() || newName === col.name) {
      setColEditing((p) => ({ ...p, [col.id]: null }));
      return;
    }
    await authFetch(`${apiBase}/kan/columns/${col.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: newName.trim() }),
    });
    setColEditing((p) => ({ ...p, [col.id]: null }));
    onRefresh();
  };

  const allCards = columns.flatMap((c) => c.cards);
  const totalCards = allCards.length;
  const selectedCount = selectedIds.size;

  const toggleCard = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleColumn = (col: ColumnWithCards) => {
    const ids = col.cards.map((c) => c.id);
    const allSel = ids.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSel) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const handleDragStart = (e: React.DragEvent, cardId: string) => {
    if (!canMoveCards) { e.preventDefault(); return; }
    e.dataTransfer.setData("text/cardId", cardId);
  };
  const handleDrop = (e: React.DragEvent, columnIndex: number) => {
    e.preventDefault();
    if (!canMoveCards) return;
    const id = e.dataTransfer.getData("text/cardId");
    if (id) void onCardMove(id, columnIndex);
  };

  const exportCSV = () => {
    const rows = allCards
      .filter((c) => selectedIds.has(c.id))
      .map((c) => [
        c.protocol,
        c.candidateName || c.member?.fullName || "",
        c.church?.name || "",
        c.service?.sigla || "",
        formatDate(c.openedAt),
        c.status,
      ]);
    const header = ["Protocolo", "Candidato", "Igreja", "Serviço", "Abertura", "Situação"];
    const csv = [header, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cards-selecionados.csv";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!columns.length) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-12 text-center text-slate-400 dark:text-slate-500">
        Selecione um pipeline e serviço para visualizar.
      </div>
    );
  }

  return (
    <div>
      {/* ── Barra de seleção ─────────────────────────────────────────────── */}
      {selectedCount > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
          {/* Selecionados dropdown */}
          <div className="relative" ref={selRef}>
            <button
              onClick={() => setShowSelDropdown((v) => !v)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              ({selectedCount}) Selecionados <ChevronDown className="w-4 h-4" />
            </button>
            {showSelDropdown && (
              <div className="absolute left-0 top-10 z-30 w-60 rounded-xl border border-slate-200 bg-white shadow-xl py-1">
                <button
                  onClick={() => { setSelectedIds(new Set(allCards.map((c) => c.id))); setShowSelDropdown(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Selecionar tudo no Kanban ({totalCards})
                </button>
                <button
                  onClick={() => { setSelectedIds(new Set()); setShowSelDropdown(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Limpar seleção
                </button>
              </div>
            )}
          </div>

          {/* Exportar CSV */}
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>

          {/* Ações dropdown */}
          <div className="relative" ref={actRef}>
            <button
              onClick={() => setShowActionsDropdown((v) => !v)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Ações <ChevronDown className="w-4 h-4" />
            </button>
            {showActionsDropdown && (
              <div className="absolute left-0 top-10 z-30 w-60 rounded-xl border border-slate-200 bg-white shadow-xl py-1">
                <p className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Ações na etapa
                </p>
                <button
                  onClick={() => { setShowActionsDropdown(false); if (canMoveCards) setShowMoveModal(true); }}
                  disabled={!canMoveCards}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  title={!canMoveCards ? "Apenas administradores podem mover cards" : undefined}
                >
                  <ArrowRightLeft className="w-4 h-4 text-slate-400" /> Mover de etapa ({selectedCount})
                </button>
                <div className="my-1 border-t border-slate-100" />
                <button className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50">
                  <Trash2 className="w-4 h-4" /> Excluir registros ({selectedCount})
                </button>
              </div>
            )}
          </div>

          {/* Limpar rápido */}
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            title="Limpar seleção"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Colunas ──────────────────────────────────────────────────────── */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
        {columns.map((col) => {
          const colorBadge = COLOR_BADGE[col.color || "blue"] || COLOR_BADGE.blue;
          const colorBorder = COLOR_BORDER[col.color || "blue"] || COLOR_BORDER.blue;
          const colIds = col.cards.map((c) => c.id);
          const colSelCount = colIds.filter((id) => selectedIds.has(id)).length;
          const allColSel = colIds.length > 0 && colSelCount === colIds.length;
          const someColSel = colSelCount > 0 && !allColSel;
          const searchVal = colSearches[col.columnIndex] || "";
          const isSearchOpen = colSearchOpen[col.columnIndex] || false;
          const filteredCards = searchVal
            ? col.cards.filter((c) =>
                (c.candidateName || c.member?.fullName || "").toLowerCase().includes(searchVal.toLowerCase())
              )
            : col.cards;

          return (
            <div
              key={col.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, col.columnIndex)}
              className={`flex flex-col rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 border-t-4 ${colorBorder}`}
              style={{ height: '70vh', minHeight: '400px' }}
            >
              {/* Cabeçalho da coluna */}
              <div className="flex items-center justify-between px-3 pt-3 pb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <input
                    type="checkbox"
                    ref={(el) => { if (el) el.indeterminate = someColSel; }}
                    checked={allColSel}
                    onChange={() => toggleColumn(col)}
                    className="w-4 h-4 rounded accent-indigo-600 cursor-pointer flex-shrink-0"
                  />
                  {colEditing[col.id] != null ? (
                    <form
                      className="flex items-center gap-1 min-w-0"
                      onSubmit={(e) => { e.preventDefault(); renameColumn(col, colEditing[col.id]!); }}
                    >
                      <input
                        autoFocus
                        value={colEditing[col.id]!}
                        onChange={(e) => setColEditing((p) => ({ ...p, [col.id]: e.target.value }))}
                        onBlur={() => renameColumn(col, colEditing[col.id]!)}
                        onKeyDown={(e) => e.key === "Escape" && setColEditing((p) => ({ ...p, [col.id]: null }))}
                        className="min-w-0 w-32 rounded border border-indigo-400 bg-white px-2 py-0.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                      <button type="submit" className="p-1 text-emerald-600 hover:text-emerald-700">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  ) : (
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{col.name}</span>
                  )}
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold flex-shrink-0 ${colorBadge}`}>
                    {col.cards.length}
                  </span>
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <button
                    onClick={() =>
                      setColSearchOpen((prev) => ({ ...prev, [col.columnIndex]: !prev[col.columnIndex] }))
                    }
                    className={`p-1.5 rounded-lg transition ${isSearchOpen ? "bg-indigo-100 text-indigo-600" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"}`}
                    title="Buscar na coluna"
                  >
                    <Search className="w-3.5 h-3.5" />
                  </button>
                  {/* Menu da coluna */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setColMenuOpen((prev) => ({ ...Object.fromEntries(Object.keys(prev).map((k) => [k, false])), [col.id]: !prev[col.id] }));
                      }}
                      className={`p-1.5 rounded-lg transition ${colMenuOpen[col.id] ? "bg-slate-200 text-slate-700" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"}`}
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                    {colMenuOpen[col.id] && (
                      <div
                        className="absolute right-0 top-8 z-30 w-52 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl py-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Coluna</p>
                        <button
                          onClick={() => { setColMenuOpen({}); setColEditing((p) => ({ ...p, [col.id]: col.name })); }}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60"
                        >
                          <Pencil className="w-4 h-4 text-slate-400" /> Editar nome
                        </button>
                        <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
                        <button
                          disabled={columns.findIndex((c) => c.id === col.id) === 0}
                          onClick={() => { setColMenuOpen({}); moveColumn(col, "left"); }}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="w-4 h-4 text-slate-400" /> Mover para esquerda
                        </button>
                        <button
                          disabled={columns.findIndex((c) => c.id === col.id) === columns.length - 1}
                          onClick={() => { setColMenuOpen({}); moveColumn(col, "right"); }}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="w-4 h-4 text-slate-400" /> Mover para direita
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Campo de busca da coluna */}
              {isSearchOpen && (
                <div className="px-3 pb-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                    <input
                      autoFocus
                      type="text"
                      value={searchVal}
                      onChange={(e) =>
                        setColSearches((prev) => ({ ...prev, [col.columnIndex]: e.target.value }))
                      }
                      placeholder="Buscar na coluna..."
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 pl-7 pr-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Cards */}
              <div
                className="flex-1 overflow-y-auto space-y-2 p-3"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.stopPropagation(); handleDrop(e, col.columnIndex); }}
              >
                {filteredCards.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 dark:border-slate-700 py-8 text-xs text-slate-400 dark:text-slate-500">
                    <ListIcon className="w-5 h-5 mb-1" />
                    {searchVal ? "Nenhum resultado" : "Sem dados"}
                  </div>
                ) : (
                  filteredCards.map((card) => (
                    <CardItem
                      key={card.id}
                      card={card}
                      stageMeta={stageMeta}
                      onDragStart={handleDragStart}
                      onAction={onAction}
                      isMoving={movingCardIds.has(card.id)}
                      isSelected={selectedIds.has(card.id)}
                      onToggleSelect={toggleCard}
                      anySelected={selectedCount > 0}
                      canDrag={canMoveCards}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Modal Mover de Etapa ─────────────────────────────────────────── */}
      {showMoveModal && (
        <BulkMoveModal
          selectedCount={selectedCount}
          stageMeta={stageMeta}
          columns={columns}
          onClose={() => setShowMoveModal(false)}
          onApply={async (destColumnIndex) => {
            setShowMoveModal(false);
            await onBulkMove(Array.from(selectedIds), destColumnIndex);
            setSelectedIds(new Set());
          }}
        />
      )}
    </div>
  );
}

function BulkMoveModal({
  selectedCount,
  stageMeta,
  columns,
  onClose,
  onApply,
}: {
  selectedCount: number;
  stageMeta: Stage | null;
  columns: ColumnWithCards[];
  onClose: () => void;
  onApply: (destColumnIndex: number) => Promise<void>;
}) {
  const [destColumnIndex, setDestColumnIndex] = useState<number | "">(
    columns.length ? columns[0].columnIndex : ""
  );
  const [applying, setApplying] = useState(false);

  const handleApply = async () => {
    if (destColumnIndex === "") return;
    setApplying(true);
    await onApply(Number(destColumnIndex));
    setApplying(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">
            Mover de etapa ({selectedCount})
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Pipeline — fixo */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Pipeline</label>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 cursor-not-allowed">
              Secretaria
            </div>
          </div>

          {/* Etapa — fixo */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Etapa</label>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 cursor-not-allowed">
              {stageMeta?.name || "—"}
            </div>
          </div>
        </div>

        {/* Coluna de destino — editável */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Coluna de destino <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <select
              value={destColumnIndex}
              onChange={(e) => setDestColumnIndex(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full appearance-none rounded-lg border border-slate-300 bg-white pl-3 pr-8 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
            >
              {columns.map((col) => (
                <option key={col.id} value={col.columnIndex}>
                  {col.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-5 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleApply}
            disabled={applying || destColumnIndex === ""}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {applying ? "Aplicando..." : `Aplicar em massa (${selectedCount})`}
          </button>
        </div>
      </div>
    </div>
  );
}

function CardItem({
  card,
  stageMeta,
  onDragStart,
  onAction,
  isMoving,
  isSelected,
  onToggleSelect,
  anySelected,
  canDrag,
}: {
  card: Card;
  stageMeta: Stage | null;
  onDragStart: (e: React.DragEvent, cardId: string) => void;
  onAction: (action: "details" | "edit" | "archive" | "delete", card: Card) => void;
  isMoving: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  anySelected: boolean;
  canDrag: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const sigla = card.service?.sigla || card.protocol.split("-")[1] || "";
  const churchDisplay = card.church?.name || "";
  const rol = card.member?.rol;
  const showCheckbox = isSelected || hovered || anySelected;
  const showConsecrationTitles = hasConsecrationTitles(card, stageMeta);
  const serviceKind = detectServiceKind(card, stageMeta);
  const serviceMeta = serviceBadgeMeta(serviceKind);
  const ServiceIcon = serviceMeta.icon;
  const showTransferChurches = serviceKind === "transfer" && (card.church?.name || card.destinationChurch?.name);

  return (
    <div
      draggable={canDrag && !isSelected && !isMoving}
      onDragStart={(e) => onDragStart(e, card.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => { if (anySelected) onToggleSelect(card.id); }}
      className={`relative rounded-lg border bg-white dark:bg-slate-800 p-3 shadow-sm transition
        ${isSelected
          ? "border-emerald-400 ring-2 ring-emerald-300/50 cursor-pointer"
          : anySelected
          ? "border-slate-200 dark:border-slate-700 hover:border-emerald-300 cursor-pointer"
          : canDrag && !isMoving
          ? "border-slate-200 dark:border-slate-700 cursor-grab hover:shadow-md active:cursor-grabbing"
          : "border-slate-200 dark:border-slate-700 hover:shadow-md"
        } ${isMoving ? "opacity-70" : ""}`}
    >
      {isMoving && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-slate-900/10 backdrop-blur-[1px]">
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-lg">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/35 border-t-white" />
            Movendo...
          </div>
        </div>
      )}
      <div className="flex items-start justify-between mb-1">
        {/* Checkbox + sigla */}
        <div className="flex items-center gap-1.5">
          <div
            className={`transition-all duration-150 ${showCheckbox ? "w-4 opacity-100" : "w-0 opacity-0 overflow-hidden"}`}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => { e.stopPropagation(); onToggleSelect(card.id); }}
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
            />
          </div>
          <span className="rounded-md bg-indigo-50 dark:bg-indigo-900/40 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 tracking-wide">
            {sigla}
          </span>
          <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide ${serviceMeta.className}`}>
            <ServiceIcon className="h-3 w-3" />
            {serviceMeta.label}
          </span>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
            className="-mr-1 rounded-md p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <Ellipsis className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-6 z-20 w-44 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg py-1">
              <button onClick={() => { setMenuOpen(false); onAction("details", card); }}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60">
                <Eye className="w-4 h-4 text-slate-400" /> Ver detalhes
              </button>
              <button onClick={() => { setMenuOpen(false); onAction("edit", card); }}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60">
                <Pencil className="w-4 h-4 text-slate-400" /> Editar
              </button>
              <button onClick={() => { setMenuOpen(false); onAction("archive", card); }}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60">
                <Archive className="w-4 h-4 text-slate-400" /> Arquivar
              </button>
              <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
              <button onClick={() => { setMenuOpen(false); onAction("delete", card); }}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40">
                <Trash2 className="w-4 h-4" /> Excluir
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500 mt-1">
        {card.statusLabel || card.status}
      </p>
      <p className="mt-1 text-sm font-bold uppercase text-slate-900 dark:text-slate-100 leading-tight">
        {card.candidateName || card.member?.fullName || "—"}
      </p>

      {rol != null && (
        <span className="mt-1 inline-block rounded bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
          ROL {rol}
        </span>
      )}

      {showConsecrationTitles && (
        <div className="mt-2 rounded-md border border-violet-200 bg-violet-50/80 px-2 py-1.5 dark:border-violet-900/50 dark:bg-violet-950/30">
          <div className="flex items-center justify-between gap-2 text-[10px]">
            <span className="font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Atual</span>
            <span className="font-semibold uppercase text-slate-800 dark:text-slate-100">{card.currentTitle || "Nao informado"}</span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 text-[10px]">
            <span className="font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Pretendido</span>
            <span className="font-semibold uppercase text-violet-700 dark:text-violet-300">{card.intendedTitle || "Nao definido"}</span>
          </div>
        </div>
      )}

      {showTransferChurches && (
        <div className="mt-2 rounded-md border border-amber-200 bg-amber-50/80 px-2 py-1.5 dark:border-amber-900/50 dark:bg-amber-950/30">
          <div className="flex items-center justify-between gap-2 text-[10px]">
            <span className="font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Origem</span>
            <span className="truncate font-semibold uppercase text-slate-800 dark:text-slate-100">{card.church?.name || "Nao informada"}</span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 text-[10px]">
            <span className="font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Destino</span>
            <span className="truncate font-semibold uppercase text-amber-700 dark:text-amber-300">{card.destinationChurch?.name || "Nao informado"}</span>
          </div>
        </div>
      )}

      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">{showTransferChurches ? `${card.church?.code ? `${card.church.code} - ` : ""}${card.church?.name || churchDisplay} -> ${card.destinationChurch?.code ? `${card.destinationChurch.code} - ` : ""}${card.destinationChurch?.name || ""}` : churchDisplay}</p>

      <div className="mt-2 border-t border-slate-100 dark:border-slate-700 pt-2 flex items-center justify-between">
        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{card.protocol}</span>
        <span className="text-[10px] text-slate-400 dark:text-slate-500">{formatDate(card.openedAt || card.createdAt)}</span>
      </div>
    </div>
  );
}

function ListView({ columns }: { columns: ColumnWithCards[] }) {
  const cards = columns.flatMap((c) => c.cards.map((card) => ({ ...card, columnName: c.name, columnColor: c.color })));
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Membro</th>
            <th className="px-4 py-3">Serviço</th>
            <th className="px-4 py-3">Igreja</th>
            <th className="px-4 py-3">Abertura</th>
            <th className="px-4 py-3">Fechamento</th>
            <th className="px-4 py-3">Situação</th>
            <th className="px-4 py-3">Etapa</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {cards.length === 0 ? (
            <tr>
              <td colSpan={8} className="py-12 text-center text-slate-400">
                Sem dados
              </td>
            </tr>
          ) : (
            cards.map((card) => (
              <tr key={card.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-semibold text-slate-900">
                  {card.candidateName || card.member?.fullName || "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">{card.service?.description}</td>
                <td className="px-4 py-3 text-slate-600">{card.church?.name}</td>
                <td className="px-4 py-3 text-slate-600">{formatDate(card.openedAt)}</td>
                <td className="px-4 py-3 text-slate-600">{card.closedAt ? formatDate(card.closedAt) : "—"}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                    {card.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      COLOR_BADGE[card.columnColor || "blue"] || COLOR_BADGE.blue
                    }`}
                  >
                    {card.columnName}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button className="text-slate-400 hover:text-slate-700">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

type CardDetail = Card & {
  subject?: string | null;
  justification?: string | null;
  observations?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  attachments?: AttachmentItem[] | null;
  requesterName?: string | null;
  originRegional?: { name: string; code: string | null } | null;
  destinationRegional?: { name: string; code: string | null } | null;
  createdByUser?: { id: string; fullName: string; email: string } | null;
  updatedByUser?: { id: string; fullName: string; email: string } | null;
  eventHistory?: {
    id: string;
    action: string | null;
    notes: string | null;
    columnIndex: number | null;
    serviceGroup: string | null;
    serviceName: string | null;
    createdAt: string;
    createdByUser?: { id: string; fullName: string; email: string } | null;
  }[];
};

function CardDetailModal({
  card: initialCard,
  onClose,
  onEdit,
}: {
  card: Card;
  onClose: () => void;
  onEdit: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"detalhes" | "arquivos" | "chat">("detalhes");
  const [detail, setDetail] = useState<CardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingFile, setSavingFile] = useState(false);
  const [savingMessage, setSavingMessage] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [chatText, setChatText] = useState("");
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

  const statusColors: Record<string, string> = {
    pendente: "bg-amber-100 text-amber-700",
    em_andamento: "bg-blue-100 text-blue-700",
    aprovado: "bg-emerald-100 text-emerald-700",
    rejeitado: "bg-rose-100 text-rose-700",
    cancelado: "bg-slate-100 text-slate-600",
  };

  const actionLabel = (action: string | null) => {
    if (!action) return "Movimentação";
    if (action.includes("STATUS→")) return `Status atualizado: ${action.replace("STATUS→", "")}`;
    if (action.includes("TRANSFERENCIA")) return "Transferência processada";
    if (action.includes("TITULO→")) return `Título atualizado: ${action.replace("TITULO→", "")}`;
    if (action.includes("OCORRENCIA→")) return `Ocorrência: ${action.replace("OCORRENCIA→", "")}`;
    if (action === "MOVIMENTACAO") return "Movimentação de etapa";
    if (action === "OCORRENCIA") return "Ocorrência registrada";
    return action;
  };

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
          { type: "Arquivo do processo", url: uploadData.url, name: file.name, filename: file.name },
        ],
      });
      loadDetail();
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
      <div
        className="flex w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-6 pt-5 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Detalhes do registro</h2>
            <p className="mt-0.5 text-xs text-slate-400 font-mono">{card.protocol}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <Pencil className="w-3.5 h-3.5" /> Editar
            </button>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="border-b border-slate-100 px-6 pt-2">
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
          <div className="flex-1 flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
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
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColors[card.status] || "bg-slate-100 text-slate-600"}`}>
                    {card.statusLabel || card.status}
                  </span>
                  <span className="text-xs text-slate-400">
                    Aberto em {formatDate(card.openedAt || card.createdAt)}
                    {card.closedAt && ` · Fechado em ${formatDate(card.closedAt)}`}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Membro / Candidato</p>
                    <p className="font-semibold text-slate-900">{card.candidateName || card.member?.fullName || "—"}</p>
                    {card.member?.rol != null && <p className="text-xs text-slate-400">ROL {card.member.rol}</p>}
                    {card.member?.ecclesiasticalTitle && <p className="text-xs text-slate-500">{card.member.ecclesiasticalTitle}</p>}
                  </div>

                  <div>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Serviço</p>
                    <p className="font-semibold text-slate-900">{(card as CardDetail).service?.description || card.service?.sigla || "—"}</p>
                    <p className="text-xs text-slate-400">{card.service?.sigla}</p>
                  </div>

                  <div>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Igreja de origem</p>
                    <p className="text-slate-700">{card.church?.code ? `${card.church.code} - ${card.church.name}` : card.church?.name || "—"}</p>
                  </div>

                  {card.destinationChurch && (
                    <div>
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Igreja de destino</p>
                      <p className="text-slate-700">{card.destinationChurch.code ? `${card.destinationChurch.code} - ${card.destinationChurch.name}` : card.destinationChurch.name}</p>
                    </div>
                  )}

                  <div>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Aberto por</p>
                    {(card as CardDetail).createdByUser ? (
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                          {(card as CardDetail).createdByUser!.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{(card as CardDetail).createdByUser!.fullName}</p>
                          <p className="text-[10px] text-slate-400">{(card as CardDetail).createdByUser!.email}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">Sistema</p>
                    )}
                  </div>

                  {(card as CardDetail).updatedByUser && (
                    <div>
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Atualizado por</p>
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                          {(card as CardDetail).updatedByUser!.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{(card as CardDetail).updatedByUser!.fullName}</p>
                          <p className="text-[10px] text-slate-400">{(card as CardDetail).updatedByUser!.email}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {((card as CardDetail).justification || (card as CardDetail).subject || (card as CardDetail).observations || (card as CardDetail).description) && (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-3">
                    {(card as CardDetail).subject && (
                      <div>
                        <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Assunto</p>
                        <p className="text-sm text-slate-700">{(card as CardDetail).subject}</p>
                      </div>
                    )}
                    {(card as CardDetail).justification && (
                      <div>
                        <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Justificativa</p>
                        <p className="whitespace-pre-wrap text-sm text-slate-700">{(card as CardDetail).justification}</p>
                      </div>
                    )}
                    {(card as CardDetail).description && (
                      <div>
                        <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Descrição</p>
                        <p className="whitespace-pre-wrap text-sm text-slate-700">{(card as CardDetail).description}</p>
                      </div>
                    )}
                    {(card as CardDetail).observations && (
                      <div>
                        <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Observações</p>
                        <p className="whitespace-pre-wrap text-sm text-slate-700">{(card as CardDetail).observations}</p>
                      </div>
                    )}
                  </div>
                )}

                {(card as CardDetail).eventHistory && (card as CardDetail).eventHistory!.length > 0 && (
                  <div>
                    <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Histórico de ações</p>
                    <div className="space-y-0 rounded-2xl border border-slate-200 bg-white p-4">
                      {(card as CardDetail).eventHistory!.map((evt, i) => (
                        <div key={evt.id} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className="mt-1 h-2.5 w-2.5 rounded-full bg-indigo-400" />
                            {i < (card as CardDetail).eventHistory!.length - 1 && <div className="my-1 w-px flex-1 bg-slate-200" />}
                          </div>
                          <div className="flex-1 pb-4 min-w-0">
                            <p className="text-sm font-medium text-slate-800">{actionLabel(evt.action)}</p>
                            {evt.notes && <p className="mt-0.5 break-words text-xs text-slate-500">{evt.notes}</p>}
                            <p className="mt-1 text-[10px] text-slate-400">{formatDateTime(evt.createdAt)}{evt.createdByUser ? ` · ${evt.createdByUser.fullName}` : ""}{evt.serviceName ? ` · ${evt.serviceName}` : ""}</p>
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
                  Conversa entre a congregação solicitante e a sede sobre este processo.
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

        {/* Footer */}
        <div className="border-t border-slate-100 px-6 py-3 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-5 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function EditCardModal({
  card,
  columns,
  onClose,
  onSaved,
}: {
  card: Card;
  columns: ColumnWithCards[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    candidateName: card.candidateName || "",
    subject: (card as any).subject || "",
    justification: (card as any).justification || "",
    observations: (card as any).observations || "",
    description: (card as any).description || "",
    status: card.status || "pendente",
    columnIndex: card.columnIndex,
  });
  const [churches, setChurches] = useState<{ id: string; name: string; code: string | null }[]>([]);
  const [destChurchId, setDestChurchId] = useState<string>((card as any).destinationChurch?.id || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"geral" | "processo" | "etapa">("geral");

  useEffect(() => {
    authFetch(`${apiBase}/churches`)
      .then((r) => r.json())
      .then((data) => setChurches(Array.isArray(data) ? data : data?.items || []))
      .catch(() => setChurches([]));
  }, []);

  const set = (field: keyof typeof form, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        candidateName: form.candidateName || null,
        subject: form.subject || null,
        justification: form.justification || null,
        observations: form.observations || null,
        description: form.description || null,
        status: form.status,
      };
      if (destChurchId) body.destinationChurchId = destChurchId;
      if (form.columnIndex !== card.columnIndex) body.columnIndex = form.columnIndex;

      const res = await authFetch(`${apiBase}/kan/cards/${card.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err?.error || "Erro ao salvar.");
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const statusOptions = [
    { value: "pendente", label: "Pendente" },
    { value: "em_andamento", label: "Em andamento" },
    { value: "aprovado", label: "Aprovado" },
    { value: "rejeitado", label: "Rejeitado" },
    { value: "cancelado", label: "Cancelado" },
  ];

  const tabs = [
    { id: "geral" as const, label: "Geral" },
    { id: "processo" as const, label: "Processo" },
    { id: "etapa" as const, label: "Etapa / Status" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-6 pt-5 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Editar registro</h2>
            <p className="mt-0.5 text-xs text-slate-400 font-mono">{card.protocol}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info banner */}
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-3 grid grid-cols-3 gap-4 text-xs text-slate-500">
          <div>
            <span className="font-semibold text-slate-700">Membro</span>
            <p className="truncate">{card.member?.fullName || card.candidateName || "—"}</p>
          </div>
          <div>
            <span className="font-semibold text-slate-700">Igreja</span>
            <p className="truncate">{card.church?.name || "—"}</p>
          </div>
          <div>
            <span className="font-semibold text-slate-700">Serviço</span>
            <p>{card.service?.description || card.service?.sigla || "—"}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-slate-100 px-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.id
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* ── Aba Geral ───────────────────────────────────────── */}
          {activeTab === "geral" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Nome do candidato
                </label>
                <input
                  value={form.candidateName}
                  onChange={(e) => set("candidateName", e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
                  placeholder="Nome completo"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Igreja de destino
                  <span className="ml-1 font-normal text-slate-400">(transferências)</span>
                </label>
                <div className="relative">
                  <select
                    value={destChurchId}
                    onChange={(e) => setDestChurchId(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="">— Nenhuma —</option>
                    {churches.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Assunto</label>
                <input
                  value={form.subject}
                  onChange={(e) => set("subject", e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
                  placeholder="Assunto do processo"
                />
              </div>
            </>
          )}

          {/* ── Aba Processo ────────────────────────────────────── */}
          {activeTab === "processo" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Justificativa
                </label>
                <textarea
                  rows={4}
                  value={form.justification}
                  onChange={(e) => set("justification", e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none resize-none"
                  placeholder="Descreva a justificativa para este processo..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Descrição
                </label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none resize-none"
                  placeholder="Descrição detalhada..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Observações
                </label>
                <textarea
                  rows={3}
                  value={form.observations}
                  onChange={(e) => set("observations", e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none resize-none"
                  placeholder="Observações internas..."
                />
              </div>
            </>
          )}

          {/* ── Aba Etapa / Status ───────────────────────────────── */}
          {activeTab === "etapa" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Mover para coluna
                </label>
                <div className="relative">
                  <select
                    value={form.columnIndex}
                    onChange={(e) => set("columnIndex", Number(e.target.value))}
                    className="w-full appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
                  >
                    {columns.map((col) => (
                      <option key={col.id} value={col.columnIndex}>
                        {col.name}
                        {col.columnIndex === card.columnIndex ? " (atual)" : ""}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Status</label>
                <div className="relative">
                  <select
                    value={form.status}
                    onChange={(e) => set("status", e.target.value)}
                    className="w-full appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
                  >
                    {statusOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                </div>
              </div>

              {/* Datas — leitura */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Abertura</label>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500 cursor-not-allowed">
                    {formatDate(card.openedAt)}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Fechamento</label>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500 cursor-not-allowed">
                    {card.closedAt ? formatDate(card.closedAt) : "—"}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {error && (
          <p className="mx-6 mb-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>
        )}
        <div className="border-t border-slate-100 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-5 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}

function NewCardModal({
  stage,
  onClose,
  onCreated,
}: {
  stage: Stage;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [memberId, setMemberId] = useState<string>("");
  const [candidateName, setCandidateName] = useState("");
  const [justification, setJustification] = useState("");
  const [churchId, setChurchId] = useState<string>("");
  const [churches, setChurches] = useState<{ id: string; name: string; code: string | null }[]>([]);
  const [members, setMembers] = useState<{ id: string; fullName: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    authFetch(`${apiBase}/churches`)
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.items || [];
        setChurches(list);
        const user = JSON.parse(localStorage.getItem("mrm_user") || "{}");
        const defaultId = user?.churchId || list[0]?.id || "";
        setChurchId(defaultId);
      })
      .catch(() => setChurches([]));
  }, []);

  useEffect(() => {
    if (!churchId) { setMembers([]); return; }
    authFetch(`${apiBase}/churches/${churchId}/members`)
      .then((r) => r.json())
      .then((data) => {
        const list: { id: string; fullName: string }[] = Array.isArray(data) ? data : [];
        setMembers(list.sort((a, b) => a.fullName.localeCompare(b.fullName, "pt-BR")));
      })
      .catch(() => setMembers([]));
  }, [churchId]);

  if (!stage.serviceId) {
    return (
      <Modal onClose={onClose} title="Novo registro">
        <p className="text-sm text-slate-500">
          Este pipeline (<strong>{stage.name}</strong>) não tem um serviço de matriz vinculado. Configure um serviço para
          permitir a criação de cards.
        </p>
      </Modal>
    );
  }

  const submit = async () => {
    if ((!memberId && !candidateName) || !churchId) return;
    setSubmitting(true);
    const res = await authFetch(`${apiBase}/kan/cards`, {
      method: "POST",
      body: JSON.stringify({
        stageId: stage.id,
        serviceId: stage.serviceId,
        churchId,
        memberId: memberId || undefined,
        candidateName: memberId ? undefined : candidateName,
        justification,
      }),
    });
    setSubmitting(false);
    if (res.ok) onCreated();
    else alert("Erro ao criar card");
  };

  return (
    <Modal onClose={onClose} title={`Novo ${stage.name}`}>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Igreja</label>
          <select
            value={churchId}
            onChange={(e) => { setChurchId(e.target.value); setMemberId(""); }}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          >
            {churches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code ? `${c.code} - ` : ""}
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Membro</label>
          <select
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          >
            <option value="">— Selecione um membro —</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.fullName}</option>
            ))}
          </select>
          {!memberId && (
            <input
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="Ou digite o nome do candidato"
            />
          )}
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Mensagem / Justificativa</label>
          <textarea
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={submitting || (!memberId && !candidateName)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? "Criando..." : "Criar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Modal({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
