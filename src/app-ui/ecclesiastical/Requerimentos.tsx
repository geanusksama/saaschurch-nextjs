import { useEffect, useMemo, useRef, useState } from "react";
import { CartoesTotais } from '../../components/app-ui/CartoesTotais';
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
  SlidersHorizontal,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";
import { apiBase } from "../../lib/apiBase";
import { type FiltrosConsulta } from "../../components/app-ui/BotaoBuscar";
import { useCampoVisible } from "../../lib/campoVisibility";
import { PrintModal } from "../../components/app-ui/shared/PrintModal";
import { printReport } from "../../lib/printReport";
import { ConfirmarTituloReadmissao } from "../../components/ecclesiastical/ConfirmarTituloReadmissao";
import { ehServicoDeReadmissao } from "../../lib/readmissaoTitulo";
import { Permissao } from '../../lib/permissoes/Permissao';

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
    changeTitle?: boolean;
    restorePreviousTitle?: boolean;
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
type CampoOption = { id: string; name: string; code?: string | null };
type RegionalOption = { id: string; name: string; code?: string | null; campoId: string };
type ChurchOption = {
  id: string;
  name: string;
  code?: string | null;
  regionalId?: string | null;
  regional?: {
    id?: string;
    name?: string;
    campoId?: string;
    campo?: {
      id?: string;
      name?: string;
      code?: string | null;
    } | null;
  } | null;
};

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
  const storedUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("mrm_user") || "{}");
    } catch {
      return {};
    }
  }, []);

  // Services / folders
  const [services, setServices] = useState<KanService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [activeServiceId, setActiveServiceId] = useState<number | null>(null);

  const activeFieldId = localStorage.getItem("mrm_active_field_id") || storedUser.campoId || "";
  const campoVisible = useCampoVisible();
  const normalizedRole = normalizeText(storedUser.roleName || "");
  const isSecretaryOrTreasurer = normalizedRole.includes("secret") || normalizedRole.includes("tesour");
  const isAdminOrMaster = ["master", "admin"].includes(storedUser.profileType || "");
  const hasFixedChurchScope = storedUser.profileType === "church" || isSecretaryOrTreasurer;
  const canChooseField = isAdminOrMaster;
  const canChooseRegional = !hasFixedChurchScope;
  const canChooseChurch = !hasFixedChurchScope;
  const defaultRegionalFilter = storedUser.regionalId || "";
  const defaultChurchFilter = hasFixedChurchScope ? (storedUser.churchId || "") : "";

  const [fields, setFields] = useState<CampoOption[]>([]);
  const [regionais, setRegionais] = useState<RegionalOption[]>([]);
  const [churches, setChurches] = useState<ChurchOption[]>([]);
  const [loadingFilters, setLoadingFilters] = useState(true);

  // Cards
  const [columns, setColumns] = useState<ColumnWithCards[]>([]);
  const [cardsLoading, setCardsLoading] = useState(false);

  // Filters
  const [selectedFieldId, setSelectedFieldId] = useState(activeFieldId);
  const [selectedRegionalId, setSelectedRegionalId] = useState(defaultRegionalFilter);
  const [selectedChurchId, setSelectedChurchId] = useState(defaultChurchFilter);
  const [q, setQ] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const { start: defaultFrom, end: defaultTo } = getMonthDateRange();
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  // A tela abre vazia: nada é consultado até o clique em Buscar, que congela
  // os filtros daquele momento. Mexer num filtro não consulta sozinho (antes
  // cada tecla na busca disparava uma consulta).
  const [aplicados, setAplicados] = useState<FiltrosConsulta | null>(null);
  const [page, setPage] = useState(1);
  // Só apresentação: abre/fecha a gaveta de filtros.
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

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

  const filteredRegionais = useMemo(() => {
    if (!selectedFieldId) return regionais;
    return regionais.filter((regional) => regional.campoId === selectedFieldId);
  }, [regionais, selectedFieldId]);

  const filteredChurchOptions = useMemo(() => {
    const inField = churches.filter((church) => {
      if (!selectedFieldId) return true;
      return church.regional?.campoId === selectedFieldId || church.regional?.campo?.id === selectedFieldId;
    });
    if (!selectedRegionalId) return inField;
    return inField.filter((church) => church.regional?.id === selectedRegionalId || church.regionalId === selectedRegionalId);
  }, [churches, selectedFieldId, selectedRegionalId]);

  async function loadFilters() {
    setLoadingFilters(true);
    try {
      const fieldQuery = selectedFieldId ? `?fieldId=${encodeURIComponent(selectedFieldId)}` : "";
      const [fieldsResponse, regionaisResponse, churchesResponse] = await Promise.all([
        authFetch(`${apiBase}/campos`),
        authFetch(`${apiBase}/regionais${fieldQuery}`),
        authFetch(`${apiBase}/churches${fieldQuery}`),
      ]);
      if (!fieldsResponse.ok || !regionaisResponse.ok || !churchesResponse.ok) {
        throw new Error("Falha ao carregar filtros de requerimentos.");
      }
      const [fieldsData, regionaisData, churchesData] = await Promise.all([
        fieldsResponse.json(),
        regionaisResponse.json(),
        churchesResponse.json(),
      ]);
      setFields(Array.isArray(fieldsData) ? fieldsData : []);
      setRegionais(Array.isArray(regionaisData) ? regionaisData : []);
      setChurches(Array.isArray(churchesData) ? churchesData : []);
    } catch {
      setFields([]);
      setRegionais([]);
      setChurches([]);
    } finally {
      setLoadingFilters(false);
    }
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
        setActiveServiceId((current) => {
          if (current == null) return null;
          return filtered.some((service) => service.id === current) ? current : null;
        });
      })
      .catch(() => setServices([]))
      .finally(() => setServicesLoading(false));
  }, []);

  useEffect(() => {
    loadFilters();
  }, [selectedFieldId]);

  const activeService = useMemo(
    () => services.find((s) => s.id === activeServiceId) ?? null,
    [services, activeServiceId],
  );

  // Load cards using the same dashboard-style source as the other ecclesiastical modules.
  const loadCards = (filtros: FiltrosConsulta | null = aplicados) => {
    if (!filtros) return;
    setCardsLoading(true);
    const params = new URLSearchParams();
    if (filtros.dateFrom) params.set("from", filtros.dateFrom);
    if (filtros.dateTo) params.set("to", filtros.dateTo);
    if (filtros.searchTerm) params.set("q", filtros.searchTerm);
    if (filtros.fieldId) params.set("campoId", filtros.fieldId);
    if (filtros.regionalId) params.set("regionalId", filtros.regionalId);
    if (filtros.churchId) params.set("churchId", filtros.churchId);
    if (activeServiceId != null) params.set("serviceId", String(activeServiceId));

    authFetch(`${apiBase}/requirements/dashboard?${params}`)
      .then((r) => r.json())
      .then((data) => {
        const queue = Array.isArray(data?.queue) ? data.queue : [];
        setColumns([
          {
            id: 0,
            name: "Resultados",
            columnIndex: 0,
            color: null,
            cards: queue,
          },
        ]);
      })
      .catch(() => setColumns([]))
      .finally(() => setCardsLoading(false));
  };

  // Busca de novo quando os filtros são aplicados (Buscar) ou quando o tipo
  // muda depois de já ter havido uma busca.
  useEffect(() => {
    setPage(1);
    loadCards();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aplicados, activeServiceId]);

  const buscar = () => {
    setAplicados({
      searchTerm: q,
      fieldId: selectedFieldId,
      regionalId: selectedRegionalId,
      churchId: selectedChurchId,
      status: filterStatus,
      dateFrom: from,
      dateTo: to,
    });
  };

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
            columnName: card.column?.name || col.name,
            columnColor: card.column?.color || col.color,
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
    if (!aplicados) return [];
    const target = aplicados.status.toLowerCase();
    const targetLabel = (STATUS_LABELS[target]?.label || target).toLowerCase();
    return allCards.filter((c) => {
      const churchMeta = churches.find((church) => church.id === c.church?.id);
      const fieldMatch = !aplicados.fieldId || churchMeta?.regional?.campoId === aplicados.fieldId || churchMeta?.regional?.campo?.id === aplicados.fieldId;
      const regionalMatch = !aplicados.regionalId || churchMeta?.regional?.id === aplicados.regionalId || churchMeta?.regionalId === aplicados.regionalId;
      const churchMatch = !aplicados.churchId || c.church?.id === aplicados.churchId;
      if (!fieldMatch || !regionalMatch || !churchMatch) return false;
      if (!aplicados.status) return true;
      const eff = effectiveStatusKey(c);
      return eff === target || eff === targetLabel;
    });
  }, [allCards, churches, aplicados]);

  useEffect(() => {
    setPage(1);
  }, [aplicados, activeServiceId]);

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

  // Só apresentação: quantos filtros da gaveta diferem do estado inicial da tela.
  const filtrosAtivosCount = [
    selectedFieldId !== activeFieldId,
    selectedRegionalId !== defaultRegionalFilter,
    selectedChurchId !== defaultChurchFilter,
    filterStatus !== "",
    from !== defaultFrom || to !== defaultTo,
    activeServiceId != null,
  ].filter(Boolean).length;
  const campoFiltroClasse = "h-[50px] w-full appearance-none rounded-[14px] border-[1.5px] border-slate-200 bg-white pl-3.5 pr-10 text-[15px] font-medium tracking-normal text-slate-900 outline-none focus:border-slate-900 disabled:bg-slate-50 disabled:text-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white";
  const dataFiltroClasse = "h-[50px] w-full rounded-[14px] border-[1.5px] border-slate-200 bg-white px-3 text-[15px] font-medium tracking-normal text-slate-900 outline-none focus:border-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white";
  const rotuloFiltroClasse = "flex flex-col gap-2.5 text-xs font-bold tracking-[.06em] text-slate-500 dark:text-slate-400";
  const thClasse = "px-4 py-3 text-left text-xs font-bold uppercase tracking-[.06em] text-slate-500 dark:text-slate-400";

  return (
    <div className="flex min-h-full flex-col bg-[#f4f6f8] text-slate-900 antialiased dark:bg-slate-900 dark:text-slate-100">
      <style>{"@keyframes rqDrawerIn{from{transform:translateX(40px);opacity:0}to{transform:none;opacity:1}}"}</style>

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

      {/* Cabeçalho */}
      <header className="flex items-center justify-between gap-3 border-b border-[#e8ecf1] bg-white px-4 py-3 md:px-7 md:py-3.5 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-slate-100 text-slate-700 md:h-10 md:w-10 dark:bg-slate-700 dark:text-slate-200">
            <FileText className="h-5 w-5" strokeWidth={1.8} />
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="hidden whitespace-nowrap text-xs text-slate-500 md:block dark:text-slate-400">Secretaria</span>
            <h1 className="whitespace-nowrap text-[17px] font-bold">Requerimentos</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Permissao chave="requirements.requerimentos.exportar" rotulo="Exportar — Requerimentos" herda="requirements.view">
            <button
              title="Exportar"
              className="flex h-10 items-center gap-2 whitespace-nowrap rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 md:px-3.5 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Download className="h-4 w-4" strokeWidth={2} />
              <span className="hidden md:inline">Exportar</span>
            </button>
          </Permissao>
          <Permissao chave="requirements.requerimentos.imprimir" rotulo="Imprimir — Requerimentos" herda="requirements.view">
            <button
              onClick={() => setPrintModalOpen(true)}
              title="Imprimir"
              className="flex h-10 items-center gap-2 whitespace-nowrap rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 md:px-3.5 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Printer className="h-4 w-4" strokeWidth={2} />
              <span className="hidden md:inline">Imprimir</span>
            </button>
          </Permissao>
          <Permissao chave="requirements.requerimentos.novo_requerimento" rotulo="Novo Requerimento — Requerimentos" herda="requirements.view">
            <button
              onClick={() => setShowNew(true)}
              className="flex h-10 items-center gap-2 whitespace-nowrap rounded-[10px] bg-slate-900 pl-3 pr-3.5 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              <Plus className="h-4 w-4" strokeWidth={2.2} />
              <span className="md:hidden">Novo</span>
              <span className="hidden md:inline">Novo Requerimento</span>
            </button>
          </Permissao>
        </div>
      </header>

      <div className="box-border flex w-full flex-1 flex-col gap-3 px-3 pb-10 pt-3 md:px-7 md:pt-4">
        {/* Busca + números */}
        <div className="flex flex-wrap items-stretch gap-3">
          <div className="flex min-w-0 flex-[1_1_380px] gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" strokeWidth={2} />
              <input
                value={q}
                onChange={(e) => { setQ(e.target.value); setPage(1); }}
                onKeyDown={(e) => { if (e.key === "Enter") buscar(); }}
                placeholder="Buscar por protocolo, membro, igreja..."
                className="h-full min-h-[52px] w-full rounded-2xl border-[1.5px] border-slate-200 bg-white pl-12 pr-10 text-[15px] text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-900 focus:shadow-[0_0_0_4px_rgba(15,23,42,.08)] dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:focus:border-slate-300"
              />
              {q && (
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  onClick={() => { setQ(""); setPage(1); }}
                >
                  <X size={15} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setFiltrosAbertos(true)}
              title="Filtros"
              className={`flex min-h-[52px] flex-none items-center gap-2 rounded-2xl border-[1.5px] bg-white px-[15px] text-sm font-semibold text-slate-900 hover:border-slate-900 md:px-[18px] dark:bg-slate-800 dark:text-white ${
                filtrosAtivosCount ? "border-slate-900 dark:border-slate-300" : "border-slate-200 dark:border-slate-600"
              }`}
            >
              <SlidersHorizontal className="h-[19px] w-[19px]" strokeWidth={2} />
              <span className="hidden md:inline">Filtros</span>
              {filtrosAtivosCount > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-slate-900 px-1.5 text-[11px] font-bold text-white dark:bg-white dark:text-slate-900">
                  {filtrosAtivosCount}
                </span>
              )}
            </button>
            {/* Consulta explícita: nada é buscado até clicar aqui (ou Enter na busca). */}
            <button
              type="button"
              onClick={buscar}
              disabled={cardsLoading}
              title="Buscar"
              className="flex min-h-[52px] flex-none items-center gap-2 rounded-2xl bg-slate-900 px-[15px] text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 md:px-[18px] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              {cardsLoading ? <Loader2 className="h-[19px] w-[19px] animate-spin" /> : <Search className="h-[19px] w-[19px]" strokeWidth={2.2} />}
              <span className="hidden md:inline">{cardsLoading ? "Buscando..." : "Buscar"}</span>
            </button>
          </div>
          <CartoesTotais>
            {[
              { label: "Total", value: allCards.length, icon: FileText, tone: "bg-[#e0e7ff] text-[#3730a3]" },
              { label: "Pendentes", value: pendentes, icon: Clock, tone: "bg-[#fef3c7] text-[#92400e]" },
              { label: "Aprovados", value: aprovados, icon: CheckCircle, tone: "bg-[#d1fae5] text-[#065f46]" },
              { label: "Cancelados", value: cancelados, icon: AlertTriangle, tone: "bg-[#ffe4e6] text-[#9f1239]" },
            ].map(({ label, value, icon: Icon, tone }) => (
              <div
                key={label}
                className="flex flex-[1_0_auto] items-center gap-2.5 rounded-2xl border-[1.5px] border-[#e8ecf1] bg-white py-2 pl-2 pr-3.5 dark:border-slate-700 dark:bg-slate-800"
              >
                <span className={`grid h-[38px] w-[38px] flex-none place-items-center rounded-xl ${tone}`}>
                  <Icon className="h-[19px] w-[19px]" strokeWidth={1.8} />
                </span>
                <span className="flex flex-col">
                  <span className="text-[19px] font-extrabold leading-[1.15] tracking-[-.02em] tabular-nums">{value}</span>
                  <span className="whitespace-nowrap text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</span>
                </span>
              </div>
            ))}
          </CartoesTotais>
        </div>

        {/* Tabela */}
        {!aplicados ? (
          <section className="overflow-hidden rounded-[18px] border border-[#e8ecf1] bg-white md:rounded-[22px] dark:border-slate-700 dark:bg-slate-800">
            <div className="flex flex-col items-center gap-1.5 px-6 py-14 text-center">
              <span className="mb-2 grid h-12 w-12 place-items-center rounded-2xl bg-[#f1f5f9] text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                <Search className="h-6 w-6" strokeWidth={1.8} />
              </span>
              <span className="text-base font-bold">Defina os filtros e clique em Buscar.</span>
            </div>
          </section>
        ) : (
        <section className="relative overflow-hidden rounded-[18px] border border-[#e8ecf1] bg-white md:rounded-[22px] dark:border-slate-700 dark:bg-slate-800">
        {cardsLoading ? (
          <div className="flex justify-center py-14">
            <Loader2 size={24} className="animate-spin text-slate-500" />
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-6 py-14 text-center text-slate-500 dark:text-slate-400">
            <FileText size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum requerimento encontrado para este período.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-[#eef2f6] bg-[#f8fafc] dark:border-slate-700 dark:bg-slate-800">
                  <tr>
                    <th className={`${thClasse} whitespace-nowrap`}>Protocolo</th>
                    <th className={thClasse}>Membro / Candidato</th>
                    <th className={`${thClasse} whitespace-nowrap`}>Serviço</th>
                    <th className={thClasse}>Igreja</th>
                    <th className={`${thClasse} whitespace-nowrap`}>Etapa</th>
                    <th className={`${thClasse} whitespace-nowrap`}>Situação</th>
                    <th className={`${thClasse} whitespace-nowrap`}>Abertura</th>
                    <th className={`${thClasse} text-right`}>Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9] dark:divide-slate-700">
                  {pageCards.map((card) => (
                    <tr key={card.id} className="transition-colors hover:bg-[#fafbfc] dark:hover:bg-slate-700/40">
                      <td className="px-4 py-3.5">
                        <a
                          href={`/app-ui/secretariat/pipeline?q=${encodeURIComponent(card.protocol)}`}
                          className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-mono text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                          title="Ver no pipeline"
                        >
                          {card.protocol}
                          <ExternalLink size={11} />
                        </a>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="max-w-[220px] truncate text-[15px] font-bold uppercase text-slate-900 dark:text-white">
                          {card.candidateName || card.member?.fullName || "—"}
                        </p>
                        {card.member?.rol != null && (
                          <p className="text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400">ROL {card.member.rol}</p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-slate-600 dark:text-slate-300">
                        {card.service?.sigla ? (
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                            {card.service.sigla}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3.5 text-slate-600 dark:text-slate-300">
                        {card.church?.name || "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        {(card as any).columnName ? (
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                            {(card as any).columnName}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={effectiveStatusKey(card)} label={card.statusLabel || card.status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-slate-600 dark:text-slate-300">
                        {fmtDate(card.openedAt || card.createdAt)}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <a
                            href={`/app-ui/secretariat/pipeline?q=${encodeURIComponent(card.protocol)}`}
                            className="grid h-9 w-9 place-items-center rounded-[10px] text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                            title="Ver no pipeline"
                          >
                            <Eye size={16} />
                          </a>
                          <button
                            onClick={() => setDetailCard(card)}
                            className="grid h-9 w-9 place-items-center rounded-[10px] text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                            title="Ver detalhes"
                          >
                            <MoreVertical size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Rodapé: total + paginação */}
            <div className="flex flex-col gap-3 border-t border-[#eef2f6] px-4 py-4 md:flex-row md:items-center md:justify-between dark:border-slate-700">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {filteredCards.length} registro{filteredCards.length !== 1 ? "s" : ""}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="h-[34px] rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-slate-900 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  >
                    Anterior
                  </button>
                  <span className="text-sm text-slate-600 dark:text-slate-300">
                    Página {page} de {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="h-[34px] rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-slate-900 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  >
                    Próxima
                  </button>
                </div>
              )}
            </div>
          </>
        )}
        </section>
        )}
      </div>

      {/* Painel de filtros — os mesmos campos de antes; só valem no Buscar. */}
      {filtrosAbertos && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setFiltrosAbertos(false)} />
          <aside className="relative flex h-full w-[min(440px,100%)] animate-[rqDrawerIn_.25s_ease] flex-col bg-white shadow-[-20px_0_50px_-20px_rgba(15,23,42,.35)] dark:bg-slate-800">
            <div className="flex items-center gap-3.5 border-b border-[#eef2f6] px-[22px] py-5 dark:border-slate-700">
              <span className="grid h-11 w-11 flex-none place-items-center rounded-[14px] bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                <SlidersHorizontal className="h-[22px] w-[22px]" strokeWidth={2} />
              </span>
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="text-lg font-extrabold">Filtros</span>
                <span className="text-[13px] text-slate-500 dark:text-slate-400">Refine quem aparece na lista</span>
              </div>
              <button
                type="button"
                onClick={() => setFiltrosAbertos(false)}
                aria-label="Fechar"
                className="grid h-10 w-10 place-items-center rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto overflow-x-hidden p-[22px]">
              {campoVisible && (
                <label className={rotuloFiltroClasse}>
                  CAMPO
                  <span className="relative min-w-0">
                    <select
                      value={selectedFieldId}
                      onChange={(e) => { setSelectedFieldId(e.target.value); setSelectedRegionalId(""); setSelectedChurchId(""); }}
                      disabled={!canChooseField || loadingFilters}
                      className={campoFiltroClasse}
                    >
                      <option value="">Todos os campos</option>
                      {fields.map((field) => (
                        <option key={field.id} value={field.id}>{field.code ? `${field.code} - ` : ""}{field.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  </span>
                </label>
              )}

              <label className={rotuloFiltroClasse}>
                REGIONAL
                <span className="relative min-w-0">
                  <select
                    value={selectedRegionalId}
                    onChange={(e) => { setSelectedRegionalId(e.target.value); setSelectedChurchId(""); }}
                    disabled={!canChooseRegional || loadingFilters}
                    className={campoFiltroClasse}
                  >
                    <option value="">Todas as regionais</option>
                    {filteredRegionais.map((regional) => (
                      <option key={regional.id} value={regional.id}>{regional.code ? `${regional.code} - ` : ""}{regional.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </span>
              </label>

              <label className={rotuloFiltroClasse}>
                IGREJA
                <span className="relative min-w-0">
                  <select
                    value={selectedChurchId}
                    onChange={(e) => setSelectedChurchId(e.target.value)}
                    disabled={!canChooseChurch || loadingFilters}
                    className={campoFiltroClasse}
                  >
                    <option value="">Todas as igrejas</option>
                    {filteredChurchOptions.map((church) => (
                      <option key={church.id} value={church.id}>{church.code ? `${church.code} - ` : ""}{church.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </span>
              </label>

              <label className={rotuloFiltroClasse}>
                STATUS
                <span className="relative min-w-0">
                  <select
                    value={filterStatus}
                    onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                    className={campoFiltroClasse}
                  >
                    <option value="">Todos os status</option>
                    {Object.entries(STATUS_LABELS).map(([val, { label }]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </span>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className={rotuloFiltroClasse}>
                  DATA INICIAL
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className={dataFiltroClasse}
                  />
                </label>
                <label className={rotuloFiltroClasse}>
                  DATA FINAL
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className={dataFiltroClasse}
                  />
                </label>
              </div>

              <label className={rotuloFiltroClasse}>
                TIPO
                {servicesLoading ? (
                  <span className="flex h-[50px] items-center px-3.5 text-slate-400">
                    <Loader2 size={16} className="animate-spin text-slate-400" />
                  </span>
                ) : (
                  <span className="relative min-w-0">
                    <select
                      value={activeServiceId ?? ""}
                      onChange={(e) => {
                        const next = e.target.value;
                        setActiveServiceId(next ? Number(next) : null);
                        setPage(1);
                      }}
                      className={campoFiltroClasse}
                    >
                      <option value="">Todos os tipos</option>
                      {services.map((svc) => (
                        <option key={svc.id} value={svc.id}>
                          {svc.sigla} — {svc.description}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  </span>
                )}
              </label>
            </div>

            <div className="flex gap-2.5 border-t border-[#eef2f6] px-[22px] py-4 dark:border-slate-700">
              <button
                type="button"
                onClick={() => { setFiltrosAbertos(false); buscar(); }}
                disabled={cardsLoading}
                className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-[14px] bg-slate-900 text-[15px] font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                <Search className="h-[18px] w-[18px]" strokeWidth={2.2} />
                Buscar
              </button>
            </div>
          </aside>
        </div>
      )}

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
                  <span className={`inline-flex h-[26px] items-center whitespace-nowrap rounded-full px-2.5 text-xs font-bold ${(STATUS_LABELS[(card.status || "").toLowerCase()]?.cls) || "bg-slate-100 text-slate-600"}`}>
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
                        className="w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-8 py-2.5 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none"
                      >
                        {DOCUMENT_TYPES.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={savingFile}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingFile ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                      {savingFile ? "Enviando..." : "Escolher arquivo"}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleAddAttachment(file);
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
                      <Permissao chave="requirements.requerimentos.anexar_arquivo" rotulo="Anexar arquivo — Requerimentos" herda="requirements.view">
                        <button
                          type="button"
                          onClick={() => chatFileInputRef.current?.click()}
                          disabled={savingMessage}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                          <Paperclip className="h-4 w-4" />
                          Anexar arquivo
                        </button>
                      </Permissao>
                      {chatAttachment && (
                        <div className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600">
                          <Paperclip className="h-3.5 w-3.5" />
                          <span className="max-w-[220px] truncate">{chatAttachment.name}</span>
                          <Permissao chave="requirements.requerimentos.remover_arquivo" rotulo="Remover arquivo — Requerimentos" herda="requirements.view">
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
                          </Permissao>
                        </div>
                      )}
                      <p className="text-xs text-slate-400">O arquivo sobe para o bucket e a conversa guarda só a URL.</p>
                    </div>
                    <Permissao chave="requirements.requerimentos.enviar_mensagem" rotulo="Enviar mensagem — Requerimentos" herda="requirements.view">
                      <button
                        type="button"
                        onClick={() => void handleSendMessage()}
                        disabled={savingMessage || (!chatText.trim() && !chatAttachment)}
                        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                      >
                        {savingMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                        Enviar mensagem
                      </button>
                    </Permissao>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="border-t border-slate-100 px-6 py-4 text-right">
          <button onClick={onClose} className="h-10 rounded-[10px] border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">Fechar</button>
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

/** Readmissão cuja matriz restaura o título: é onde a confirmação faz efeito. */
function pedeTituloDeRetorno(service: KanService | null) {
  if (!ehServicoDeReadmissao(service)) return false;
  return (service?.rules || []).some((r) => r.changeTitle && r.restorePreviousTitle);
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
  // Readmissão: a secretaria confirma, no histórico do membro, para qual título
  // ele volta. Fica gravado no card (intended_title) e é o que a matriz aplica
  // quando o card é movido. Ver src/lib/readmissaoTitulo.ts.
  const [confirmedTitle, setConfirmedTitle] = useState("");
  const [titlePickerOpen, setTitlePickerOpen] = useState(false);

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
    // Outro membro, outro histórico: a confirmação anterior não vale mais.
    setConfirmedTitle("");
    const svc = services.find((x) => x.id === Number(serviceId)) || null;
    setTitlePickerOpen(pedeTituloDeRetorno(svc));
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
  const selectedRuleStage = useMemo(() => {
    if (!selectedService) return null;
    // API returns 'rules' (Prisma relation name on KanService)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rules = (selectedService as any).rules as Array<{ columnIndex: number; stage?: { id: string } | null }> | undefined;
    if (rules && rules.length > 0) {
      const rule = rules.find((r) => r.columnIndex === 1) ?? rules[0];
      if (rule?.stage?.id) return rule.stage;
    }
    return null;
  }, [selectedService]);
  const stageId = selectedRuleStage?.id ?? selectedService?.stages?.[0]?.id ?? null;

  // Só pede confirmação onde a matriz de fato restaura o título anterior —
  // é a regra que consome o valor gravado em `intended_title` no card.
  const exigeTitulo =
    ehServicoDeReadmissao(selectedService) &&
    (selectedService?.rules || []).some((r) => r.changeTitle && r.restorePreviousTitle);


  // â”€â”€ Submit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!selectedMember) { setError("Selecione o membro."); return; }
    if (!serviceId) { setError("Selecione o tipo de requerimento."); return; }
    if (!stageId) { setError("Serviço selecionado não possui etapa configurada na matriz."); return; }
    if (exigeTitulo && !confirmedTitle) {
      setError("Confirme o título de retorno da readmissão.");
      setTitlePickerOpen(true);
      return;
    }
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
        churchId,                              // ← obrigatório para validação de escopo
        memberId: selectedMember.id,
        candidateName: selectedMember.fullName,
        description: observations || null,
        attachments: attachmentPayload,
        ...(confirmedTitle ? { intendedTitle: confirmedTitle } : {}),
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
                  onChange={(e) => {
                    const novoId = e.target.value;
                    setServiceId(novoId);
                    // Trocar de serviço invalida a confirmação anterior; sendo
                    // readmissão e com o membro já escolhido, o histórico de
                    // títulos abre na hora.
                    setConfirmedTitle("");
                    const svc = services.find((x) => x.id === Number(novoId)) || null;
                    setTitlePickerOpen(Boolean(selectedMember) && pedeTituloDeRetorno(svc));
                  }}
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

              {/* Readmissão: título de retorno confirmado no histórico do membro */}
              {exigeTitulo && (
                <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700 mb-1">
                    Título de retorno
                  </p>
                  {!selectedMember ? (
                    <p className="text-xs text-violet-700">Selecione o membro para ver o histórico de títulos.</p>
                  ) : confirmedTitle ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-violet-900">{confirmedTitle}</span>
                      <button
                        type="button"
                        onClick={() => setTitlePickerOpen(true)}
                        className="text-xs font-medium text-violet-700 underline hover:text-violet-900"
                      >
                        Trocar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setTitlePickerOpen(true)}
                      className="text-sm font-medium text-violet-700 underline hover:text-violet-900"
                    >
                      Escolher no histórico do membro
                    </button>
                  )}
                  <p className="mt-1 text-[11px] text-violet-600">
                    Fica gravado no requerimento e é o título aplicado quando o card for movido no kanban.
                  </p>
                </div>
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
                        <Permissao chave="requirements.requerimentos.remover" rotulo="Remover — Requerimentos" herda="requirements.view">
                          <button
                            type="button"
                            onClick={() => removeAttachment(i)}
                            className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 flex-shrink-0"
                            title="Remover"
                          >
                            <Trash2 size={13} />
                          </button>
                        </Permissao>
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
          <Permissao chave="requirements.requerimentos.incluir_requerimento" rotulo="Incluir requerimento — Requerimentos" herda="requirements.view">
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
          </Permissao>
        </div>
      </div>

      {/* O backdrop do requerimento fecha no clique; a caixa do picker precisa
          barrar o borbulhamento para o clique dentro dela não fechar os dois. */}
      {titlePickerOpen && selectedMember && serviceId && (
        <div onClick={(e) => e.stopPropagation()}>
        <ConfirmarTituloReadmissao
          memberId={selectedMember.id}
          serviceId={serviceId}
          onCancel={() => setTitlePickerOpen(false)}
          onConfirm={(titulo) => {
            setConfirmedTitle(titulo);
            setTitlePickerOpen(false);
            setError("");
          }}
        />
        </div>
      )}
    </div>
  );
}
