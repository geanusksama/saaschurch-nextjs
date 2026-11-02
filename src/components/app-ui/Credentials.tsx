import { useEffect, useMemo, useState } from 'react';
import { CartoesTotais } from './CartoesTotais';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '../../lib/queryClient';
import { ArrowUpDown, AlertTriangle, CheckCircle, CheckCircle2, ChevronDown, Clock3, CreditCard, Eye, FileSpreadsheet, Loader2, Pencil, Plus, Printer, Search, SlidersHorizontal, Trash2, UserRound, X, XCircle } from 'lucide-react';
import { FONTE_MODELO_FAMILIA, useFonteModelo } from '../../lib/fonteModelo';
import { apiBase } from '../../lib/apiBase';
import { useCampoVisible } from '../../lib/campoVisibility';
import { PrintModal } from './shared/PrintModal';
import { printReport } from '../../lib/printReport';
import * as XLSX from 'xlsx';
import { Permissao } from '../../lib/permissoes/Permissao';

// ─── Types ────────────────────────────────────────────────────────────────────
type CampoOption = { id: string; name: string; code?: string | null };
type RegionalOption = { id: string; name: string; code?: string | null; campoId: string };
type ChurchOption = {
  id: string; name: string; code?: string | null; regionalId?: string | null;
  regional?: { id?: string; name?: string; campoId?: string; campo?: { id?: string; name?: string } | null } | null;
};

interface Credential {
  id: number;
  nome?: string | null;
  numero?: string | null;
  tipo?: string | null;
  dataemissao?: string | null;
  datavalidade?: string | null;
  igrejasolicitante?: string | null;
  situacao?: string | null;
  obs?: string | null;
  idtbmembro?: number | null;
  church_id?: string | null;
  kan_card_id?: string | null;
  card_protocol?: string | null;
  created_at?: string | null;
}

interface Member {
  id: number | string;
  name?: string;
  nome?: string;
  fullName?: string;
  church?: { code?: string | null; name?: string | null } | null;
}

interface ReportRow {
  id: number;
  nome?: string | null;
  tipo?: string | null;
  numero?: string | null;
  situacao?: string | null;
  obs?: string | null;
  dataemissao?: string | null;
  datavalidade?: string | null;
  dataaprovacao?: string | null;
  aprovadopor?: string | null;
  igrejasolicitante?: string | null;
  card_protocol?: string | null;
  church_id?: string | null;
  created_at?: string | null;
  modelo?: string | null;
  churchName?: string | null;
  regionalName?: string | null;
  fieldName?: string | null;
  modelLargura?: number | null;
  modelAltura?: number | null;
  modelLargurapg?: number | null;
  modelAlturapg?: number | null;
  modelLinhaporpg?: number | null;
  modelColunaporpg?: number | null;
  modelValidademeses?: number | null;
  member?: {
    cpf?: string; rg?: string; birthDate?: string; naturalityCity?: string;
    naturalityState?: string; maritalStatus?: string; fatherName?: string;
    motherName?: string; spouseName?: string; ecclesiasticalTitle?: string;
    memberType?: string; rol?: string; photoUrl?: string;
  } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('mrm_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function authFetch(url: string, init: RequestInit = {}) {
  const token = localStorage.getItem('mrm_token');
  return fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) },
  });
}

function parseStoredUser() {
  try { return JSON.parse(localStorage.getItem('mrm_user') || '{}'); } catch { return {}; }
}

function normalizeText(value: string) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function memberMatchesQuery(member: { fullName?: string | null; rol?: number | null }, query: string) {
  const normalizedQuery = normalizeText(query).trim();
  if (!normalizedQuery) return true;
  if (/^\d+$/.test(normalizedQuery)) return String(member.rol || '') === normalizedQuery;
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  const parts = normalizeText(member.fullName || '').split(/\s+/).filter(Boolean);
  return terms.every((term) => parts.some((part) => part.startsWith(term)));
}

function getDateOnly(value?: string | null) {
  if (!value) return '';
  const raw = String(value);
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  return [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, '0'), String(date.getUTCDate()).padStart(2, '0')].join('-');
}

function fmtDate(v?: string | null) {
  const d = getDateOnly(v);
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function getMonthDateRange(baseDate = new Date()) {
  const year = baseDate.getFullYear(); const month = baseDate.getMonth();
  return { start: new Date(year, month, 1).toISOString().slice(0, 10), end: new Date(year, month + 1, 0).toISOString().slice(0, 10) };
}

function dateInRange(value: string | null | undefined, from: string, to: string) {
  const current = getDateOnly(value);
  if (!current) return !from && !to;
  if (from && current < from) return false;
  if (to && current > to) return false;
  return true;
}

function isExpiringSoon(d?: string | null) {
  if (!d) return false;
  const diff = new Date(d).getTime() - Date.now();
  return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
}

const TIPOS = [
  'Credencial de Membro',
  'Credencial de Cooperador',
  'Credencial de Cooperadora',
  'Credencial de Diacono',
  'Credencial de Diaconisa',
  'Credencial de Presbitero',
  'Credencial de Evangelista',
  'Credencial de Pastor',
  'Credencial de Pastora',
  'Credencial de Missionário',
  'Credencial de Missionária',
  'Carteirinha de Membro',
];

function StatusBadge({ s }: { s?: string | null }) {
  const label = s ?? '—';
  const cls =
    label === 'Ativa' ? 'bg-green-100 text-green-700' :
    label === 'Inativa' ? 'bg-slate-100 text-slate-500' :
    label === 'Aprovado' ? 'bg-blue-100 text-blue-700' :
    label === 'Entregue' ? 'bg-green-100 text-green-700' :
    label === 'Pendente' ? 'bg-amber-100 text-amber-700' :
    label === 'Cancelado' ? 'bg-red-100 text-red-700' :
    'bg-slate-100 text-slate-500';
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}

type SortKey = 'nome' | 'tipo' | 'igrejasolicitante' | 'situacao' | 'dataemissao' | 'created_at';
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

// ─── Main Component ───────────────────────────────────────────────────────────
export function Credentials() {
  useFonteModelo();
  const storedUser = useMemo(parseStoredUser, []);
  const defaultDateRange = useMemo(() => getMonthDateRange(), []);
  const activeFieldId = localStorage.getItem('mrm_active_field_id') || storedUser.campoId || '';
  // Campo não aparece na interface (só master, e só depois de destravar).
  const campoVisible = useCampoVisible();
  const normalizedRole = normalizeText(storedUser.roleName || '');
  const isSecretaryOrTreasurer = normalizedRole.includes('secret') || normalizedRole.includes('tesour');
  const isAdminOrMaster = ['master', 'admin'].includes(storedUser.profileType || '');
  const hasFixedChurchScope = (storedUser.profileType === 'church') || isSecretaryOrTreasurer;
  const canChooseField = isAdminOrMaster;
  const canChooseRegional = !hasFixedChurchScope;
  const canChooseChurch = !hasFixedChurchScope;

  const qc = useQueryClient();

  const credQuery = useQuery<Credential[]>({
    queryKey: qk.credentials({}),
    queryFn: async () => {
      const res = await authFetch(`${apiBase}/credential-requests`);
      if (!res.ok) throw new Error('Falha ao carregar credenciais.');
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  });

  const credentials = credQuery.data ?? [];
  const loading = credQuery.isLoading;

  const [fields, setFields] = useState<CampoOption[]>([]);
  const [regionais, setRegionais] = useState<RegionalOption[]>([]);
  const [churches, setChurches] = useState<ChurchOption[]>([]);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [error, setError] = useState(credQuery.error instanceof Error ? credQuery.error.message : '');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFieldId, setSelectedFieldId] = useState(activeFieldId);
  const [selectedRegionalId, setSelectedRegionalId] = useState(storedUser.regionalId || '');
  const [selectedChurchId, setSelectedChurchId] = useState(hasFixedChurchScope ? (storedUser.churchId || '') : '');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [dateFrom, setDateFrom] = useState(defaultDateRange.start);
  const [dateTo, setDateTo] = useState(defaultDateRange.end);
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<Credential | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Credential | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ ok: boolean; msg: string } | null>(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  function showToast(ok: boolean, msg: string) {
    setToastMsg({ ok, msg });
    setTimeout(() => setToastMsg(null), 4000);
  }

  async function loadFilters() {
    setLoadingFilters(true);
    try {
      const fieldQuery = selectedFieldId ? `?fieldId=${encodeURIComponent(selectedFieldId)}` : '';
      const [fr, rr, cr] = await Promise.all([
        authFetch(`${apiBase}/campos`),
        authFetch(`${apiBase}/regionais${fieldQuery}`),
        authFetch(`${apiBase}/churches${fieldQuery}`),
      ]);
      setFields(fr.ok ? await fr.json() : []);
      setRegionais(rr.ok ? await rr.json() : []);
      setChurches(cr.ok ? await cr.json() : []);
    } catch { setFields([]); setRegionais([]); setChurches([]); }
    finally { setLoadingFilters(false); }
  }

  useEffect(() => { loadFilters(); }, []);

  const filteredRegionais = useMemo(() => {
    if (!selectedFieldId) return regionais;
    return regionais.filter((r) => r.campoId === selectedFieldId);
  }, [regionais, selectedFieldId]);

  const filteredChurchOptions = useMemo(() => {
    const inField = churches.filter((c) => {
      if (!selectedFieldId) return true;
      return c.regional?.campoId === selectedFieldId || c.regional?.campo?.id === selectedFieldId;
    });
    if (!selectedRegionalId) return inField;
    return inField.filter((c) => c.regional?.id === selectedRegionalId || c.regionalId === selectedRegionalId);
  }, [churches, selectedFieldId, selectedRegionalId]);

  const visibleRows = useMemo(() => {
    const churchMap = new Map(churches.map((c) => [c.id, c]));
    let filtered = credentials.filter((cred) => {
      if (!dateInRange(cred.created_at, dateFrom, dateTo)) return false;
      if (selectedStatus && cred.situacao !== selectedStatus) return false;
      if (selectedChurchId && cred.church_id !== selectedChurchId) return false;
      if (selectedRegionalId && !selectedChurchId) {
        const ch = churchMap.get(cred.church_id || '');
        if (!ch) return false;
        const rId = ch.regional?.id || ch.regionalId;
        if (rId !== selectedRegionalId) return false;
      }
      if (selectedFieldId && !selectedRegionalId && !selectedChurchId) {
        const ch = churchMap.get(cred.church_id || '');
        if (!ch) return false;
        const cId = ch.regional?.campoId || ch.regional?.campo?.id;
        if (cId !== selectedFieldId) return false;
      }
      if (searchTerm) {
        const q = normalizeText(searchTerm);
        const parts = [cred.nome, cred.numero, cred.tipo, cred.igrejasolicitante, cred.situacao, cred.card_protocol];
        if (!parts.some((v) => normalizeText(v || '').includes(q))) return false;
      }
      return true;
    });
    filtered = [...filtered].sort((a, b) => {
      const av = String(a[sortKey] || '');
      const bv = String(b[sortKey] || '');
      const cmp = av.localeCompare(bv, 'pt-BR');
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return filtered;
  }, [credentials, churches, dateFrom, dateTo, selectedStatus, selectedChurchId, selectedRegionalId, selectedFieldId, searchTerm, sortKey, sortDirection]);

  const stats = useMemo(() => ({
    total: credentials.length,
    pendente: credentials.filter((c) => c.situacao === 'Pendente').length,
    aprovado: credentials.filter((c) => c.situacao === 'Aprovado').length,
    entregue: credentials.filter((c) => c.situacao === 'Entregue' || c.situacao === 'Ativa').length,
    aVencer: credentials.filter((c) => isExpiringSoon(c.datavalidade)).length,
  }), [credentials]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(visibleRows.length / pageSize)), [visibleRows.length, pageSize]);
  const paginatedRows = useMemo(() => visibleRows.slice((page - 1) * pageSize, page * pageSize), [visibleRows, page, pageSize]);

  function handleSort(key: SortKey) {
    if (sortKey === key) { setSortDirection((d) => d === 'asc' ? 'desc' : 'asc'); return; }
    setSortKey(key);
    setSortDirection(key === 'nome' || key === 'tipo' || key === 'igrejasolicitante' ? 'asc' : 'desc');
  }

  const [exportingExcel, setExportingExcel] = useState(false);

  async function exportToExcel() {
    setExportingExcel(true);
    try {
      // Busca dados enriquecidos (com membro + modelo) do endpoint de relatório
      const params = new URLSearchParams();
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      if (selectedStatus) params.set('situacao', selectedStatus);
      if (selectedChurchId) params.set('church_id', selectedChurchId);
      if (selectedRegionalId) params.set('regional_id', selectedRegionalId);
      if (selectedFieldId) params.set('campo_id', selectedFieldId);
      const res = await authFetch(`${apiBase}/credential-requests/report?${params}`);
      const allData: ReportRow[] = res.ok ? await res.json() : [];

      // Aplica os mesmos filtros visíveis
      const churchMap = new Map(churches.map((c) => [c.id, c]));
      const filtered = allData.filter((r) => {
        if (!dateInRange(r.created_at, dateFrom, dateTo)) return false;
        if (selectedStatus && r.situacao !== selectedStatus) return false;
        if (selectedChurchId && r.church_id !== selectedChurchId) return false;
        if (selectedRegionalId && !selectedChurchId) {
          const ch = churchMap.get(r.church_id || '');
          if (!ch) return false;
          const rId = (ch as { regional?: { id?: string }; regionalId?: string }).regional?.id || (ch as { regionalId?: string }).regionalId;
          if (rId !== selectedRegionalId) return false;
        }
        if (selectedFieldId && !selectedRegionalId && !selectedChurchId) {
          const ch = churchMap.get(r.church_id || '');
          if (!ch) return false;
          const cId = (ch as { regional?: { campoId?: string; campo?: { id?: string } } }).regional?.campoId || (ch as { regional?: { campo?: { id?: string } } }).regional?.campo?.id;
          if (cId !== selectedFieldId) return false;
        }
        if (searchTerm) {
          const q = normalizeText(searchTerm);
          const parts = [r.nome, r.numero, r.tipo, r.igrejasolicitante, r.situacao, r.card_protocol];
          if (!parts.some((v) => normalizeText(v || '').includes(q))) return false;
        }
        return true;
      });

      const fmtD = (v?: string | null) => v ? new Date(v).toLocaleDateString('pt-BR') : '';

      const headers = [
        'Membro', 'Tipo', 'Número', 'Igreja', 'Regional', 'Campo',
        'Status', 'Emissão', 'Validade', 'Solicitado em', 'Protocolo',
        // Dados extras da credencial
        'Modelo', 'Observação', 'Data aprovação', 'Aprovado por',
        // Dados pessoais do membro
        'CPF', 'RG', 'Nascimento', 'Naturalidade', 'Estado civil',
        'Pai', 'Mãe', 'Cônjuge', 'Título eclesiástico', 'Tipo membro', 'ROL', 'Foto (link)',
        // Medidas do modelo
        'Largura (mm)', 'Altura (mm)', 'Larg. página (mm)', 'Alt. página (mm)',
        'Linhas/pág.', 'Colunas/pág.', 'Validade modelo (meses)',
      ];

      const dataRows = filtered.map((r) => [
        r.nome || '', r.tipo || '', r.numero || '',
        r.churchName || r.igrejasolicitante || '',
        r.regionalName || '',
        r.fieldName || '',
        r.situacao || '',
        fmtD(r.dataemissao || r.created_at),
        fmtD(r.datavalidade),
        fmtD(r.created_at),
        r.card_protocol || r.numero || '',
        // Extras credencial
        r.modelo || '',
        r.obs || '',
        fmtD(r.dataaprovacao),
        r.aprovadopor || '',
        // Membro
        r.member?.cpf || '',
        r.member?.rg || '',
        fmtD(r.member?.birthDate),
        [r.member?.naturalityCity, r.member?.naturalityState].filter(Boolean).join(' - '),
        r.member?.maritalStatus || '',
        r.member?.fatherName || '',
        r.member?.motherName || '',
        r.member?.spouseName || '',
        r.member?.ecclesiasticalTitle || '',
        r.member?.memberType || '',
        r.member?.rol || '',
        r.member?.photoUrl || '',
        // Modelo
        r.modelLargura ?? '',
        r.modelAltura ?? '',
        r.modelLargurapg ?? '',
        r.modelAlturapg ?? '',
        r.modelLinhaporpg ?? '',
        r.modelColunaporpg ?? '',
        r.modelValidademeses ?? '',
      ]);

      const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Credenciais');
      XLSX.writeFile(wb, `credenciais_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      // silencioso — botão volta ao normal
    } finally {
      setExportingExcel(false);
    }
  }

  // Apenas visual: quantos filtros da gaveta estão diferentes do valor com que a tela abre.
  const filtrosAtivosCount = [
    selectedFieldId !== activeFieldId,
    selectedRegionalId !== (storedUser.regionalId || ''),
    selectedChurchId !== (hasFixedChurchScope ? (storedUser.churchId || '') : ''),
    selectedStatus !== '',
    dateFrom !== defaultDateRange.start,
    dateTo !== defaultDateRange.end,
  ].filter(Boolean).length;
  const campoFiltroClasse = 'h-[50px] w-full appearance-none rounded-[14px] border-[1.5px] border-slate-200 bg-white pl-3.5 pr-10 text-[15px] font-medium tracking-normal text-slate-900 outline-none focus:border-slate-900 disabled:bg-slate-50 disabled:text-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white';
  const rotuloFiltroClasse = 'flex flex-col gap-2.5 text-xs font-bold tracking-[.06em] text-slate-500 dark:text-slate-400';

  return (
    <div
      className="flex min-h-full flex-col bg-[#f4f6f8] text-slate-900 antialiased dark:bg-slate-900 dark:text-slate-100"
      style={{ fontFamily: FONTE_MODELO_FAMILIA }}
    >
      <style>{'@keyframes nmDrawerIn{from{transform:translateX(40px);opacity:0}to{transform:none;opacity:1}}'}</style>

      {/* Toast */}
      {toastMsg && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${toastMsg.ok ? 'bg-green-600' : 'bg-red-600'}`}>
          {toastMsg.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {toastMsg.msg}
          <button onClick={() => setToastMsg(null)}><X size={14} /></button>
        </div>
      )}

      {/* Cabeçalho */}
      <header className="flex items-center justify-between gap-3 border-b border-[#e8ecf1] bg-white px-4 py-3 md:px-7 md:py-3.5 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-slate-100 text-slate-700 md:h-10 md:w-10 dark:bg-slate-700 dark:text-slate-200">
            <CreditCard className="h-5 w-5" strokeWidth={1.8} />
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="hidden whitespace-nowrap text-xs text-slate-500 md:block dark:text-slate-400">Secretaria</span>
            <span className="whitespace-nowrap text-[17px] font-bold">Credenciais</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Permissao chave="credentials.credentials.excel" rotulo="Excel — Credentials" herda="credentials.view">
            <button onClick={exportToExcel} disabled={exportingExcel} title="Excel"
              className="flex h-10 items-center gap-2 whitespace-nowrap rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 md:px-3.5 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 disabled:opacity-60 disabled:cursor-not-allowed">
              {exportingExcel ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 text-green-600" strokeWidth={2} />}
              <span className="hidden md:inline">{exportingExcel ? 'Gerando...' : 'Excel'}</span>
            </button>
          </Permissao>
          <Permissao chave="credentials.credentials.imprimir" rotulo="Imprimir — Credentials" herda="credentials.view">
            <button onClick={() => setPrintModalOpen(true)} title="Imprimir"
              className="flex h-10 items-center gap-2 whitespace-nowrap rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 md:px-3.5 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
              <Printer className="h-4 w-4" strokeWidth={2} />
              <span className="hidden md:inline">Imprimir</span>
            </button>
          </Permissao>
          <Permissao chave="credentials.credentials.nova_credencial" rotulo="Nova Credencial — Credentials" herda="credentials.view">
            <button onClick={() => setModalOpen(true)}
              className="flex h-10 items-center gap-2 whitespace-nowrap rounded-[10px] bg-slate-900 pl-3 pr-3.5 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">
              <Plus className="h-4 w-4" strokeWidth={2.2} />
              <span className="md:hidden">Nova</span>
              <span className="hidden md:inline">Nova Credencial</span>
            </button>
          </Permissao>
        </div>
      </header>

      <div className="box-border flex w-full flex-1 flex-col gap-3 px-3 pb-10 pt-3 md:px-7 md:pt-4">
        {/* Busca + números (a lista filtra ao digitar, como antes) */}
        <div className="flex flex-wrap items-stretch gap-3">
          <div className="flex min-w-0 flex-[1_1_380px] gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" strokeWidth={2} />
              <input type="text" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                placeholder="Nome, número, tipo, protocolo..."
                className="h-full min-h-[52px] w-full rounded-2xl border-[1.5px] border-slate-200 bg-white pl-12 pr-3.5 text-[15px] text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-900 focus:shadow-[0_0_0_4px_rgba(15,23,42,.08)] dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:focus:border-slate-300" />
            </div>
            <button
              type="button"
              onClick={() => setFiltrosAbertos(true)}
              title="Filtros"
              className={`flex min-h-[52px] flex-none items-center gap-2 rounded-2xl border-[1.5px] bg-white px-[15px] text-sm font-semibold text-slate-900 hover:border-slate-900 md:px-[18px] dark:bg-slate-800 dark:text-white ${
                filtrosAtivosCount ? 'border-slate-900 dark:border-slate-300' : 'border-slate-200 dark:border-slate-600'
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
          </div>
          <CartoesTotais>
            {[
              { label: 'Total de Credenciais', value: stats.total, icon: <CreditCard className="h-[19px] w-[19px]" strokeWidth={1.8} />, tone: 'bg-[#ede9fe] text-[#5b21b6]' },
              { label: 'Pendentes', value: stats.pendente, icon: <Clock3 className="h-[19px] w-[19px]" strokeWidth={1.8} />, tone: 'bg-[#fef3c7] text-[#92400e]' },
              { label: 'Aprovadas', value: stats.aprovado, icon: <CheckCircle2 className="h-[19px] w-[19px]" strokeWidth={1.8} />, tone: 'bg-[#e0f2fe] text-[#075985]' },
              { label: 'Entregues / Ativas', value: stats.entregue, icon: <CheckCircle className="h-[19px] w-[19px]" strokeWidth={1.8} />, tone: 'bg-[#dcfce7] text-[#166534]' },
            ].map(({ label, value, icon, tone }) => (
              <div key={label} className="flex flex-[1_0_auto] items-center gap-2.5 rounded-2xl border-[1.5px] border-[#e8ecf1] bg-white py-2 pl-2 pr-3.5 dark:border-slate-700 dark:bg-slate-800">
                <span className={`grid h-[38px] w-[38px] flex-none place-items-center rounded-xl ${tone}`}>
                  {icon}
                </span>
                <span className="flex flex-col">
                  <span className="text-[19px] font-extrabold leading-[1.15] tracking-[-.02em] tabular-nums">{loading ? '—' : value.toLocaleString('pt-BR')}</span>
                  <span className="whitespace-nowrap text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</span>
                </span>
              </div>
            ))}
          </CartoesTotais>
        </div>

        {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</div>}

        {/* Tabela */}
        <section className="relative overflow-hidden rounded-[18px] border border-[#e8ecf1] bg-white md:rounded-[22px] dark:border-slate-700 dark:bg-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="border-b border-[#eef2f6] bg-[#f8fafc] dark:border-slate-700 dark:bg-slate-800/60">
                <tr>
                  {([['nome', 'Membro'], ['tipo', 'Tipo'], ['igrejasolicitante', 'Igreja'], ['situacao', 'Status'], ['dataemissao', 'Emissão'], ['created_at', 'Solicitado em']] as [SortKey, string][]).map(([key, label]) => (
                    <th key={key} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[.06em] text-slate-500 dark:text-slate-400">
                      <button type="button" onClick={() => handleSort(key)} className="inline-flex items-center gap-1.5">
                        {label} <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                      </button>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[.06em] text-slate-500 dark:text-slate-400">Validade</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[.06em] text-slate-500 dark:text-slate-400">Protocolo</th>
                  <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-[.06em] text-slate-500 dark:text-slate-400">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9] dark:divide-slate-700">
                {loading
                  ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {Array.from({ length: 8 }).map((__, j) => (
                        <td key={j} className="px-4 py-4"><div className="h-4 rounded bg-slate-100 dark:bg-slate-700" /></td>
                      ))}
                    </tr>
                  ))
                  : paginatedRows.map((c) => (
                    <tr key={c.id} className="transition-colors hover:bg-[#fafbfc] dark:hover:bg-slate-700/40">
                      <td className="px-4 py-4 align-top">
                        <div className="flex items-center gap-3">
                          <div className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                            {(c.nome || 'MB').split(' ').map((p) => p[0]).slice(0, 2).join('')}
                          </div>
                          <span className="text-[15px] font-bold uppercase text-slate-900 dark:text-white">{c.nome || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-600 align-top dark:text-slate-300">{c.tipo || '—'}</td>
                      <td className="px-4 py-4 text-sm text-slate-600 align-top dark:text-slate-300">{c.igrejasolicitante || '—'}</td>
                      <td className="px-4 py-4 align-top"><StatusBadge s={c.situacao} /></td>
                      <td className="px-4 py-4 text-sm text-slate-600 align-top dark:text-slate-300">{fmtDate(c.dataemissao)}</td>
                      <td className="px-4 py-4 text-sm text-slate-600 align-top dark:text-slate-300">{fmtDate(c.created_at)}</td>
                      <td className="px-4 py-4 text-sm align-top">
                        {c.datavalidade
                          ? <span className={isExpiringSoon(c.datavalidade) ? 'text-amber-600 font-medium' : 'text-slate-600 dark:text-slate-300'}>{fmtDate(c.datavalidade)}</span>
                          : '—'}
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-500 font-mono align-top dark:text-slate-400">{c.card_protocol || c.numero || '—'}</td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" onClick={() => setViewTarget(c)}
                            className="grid h-9 w-9 place-items-center rounded-[10px] transition-colors hover:bg-slate-100 dark:hover:bg-slate-700" title="Ver detalhes">
                            <Eye className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                          </button>
                          <Permissao chave="credentials.credentials.excluir" rotulo="Excluir — Credentials" herda="credentials.view">
                            <button type="button" onClick={() => setDeleteTarget(c)}
                              className="grid h-9 w-9 place-items-center rounded-[10px] transition-colors hover:bg-[#fee2e2] dark:hover:bg-red-950/40" title="Excluir">
                              <Trash2 className="h-4 w-4 text-rose-600" />
                            </button>
                          </Permissao>
                        </div>
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
          {!loading && paginatedRows.length === 0 && (
            <div className="flex flex-col items-center gap-1.5 px-6 py-14 text-center">
              <span className="mb-2 grid h-12 w-12 place-items-center rounded-2xl bg-[#f1f5f9] text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                <CreditCard className="h-6 w-6" strokeWidth={1.8} />
              </span>
              <span className="text-base font-bold">
                {credentials.length === 0 ? 'Nenhuma credencial cadastrada.' : 'Nenhum resultado encontrado para os filtros selecionados.'}
              </span>
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex flex-col gap-3 border-t border-[#eef2f6] px-4 py-4 text-sm text-slate-600 md:flex-row md:items-center md:justify-between dark:border-slate-700 dark:text-slate-300">
              <div className="flex flex-wrap items-center gap-2">
                <span>Linhas:</span>
                <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                  className="h-[34px] rounded-[10px] border border-slate-200 bg-white px-2.5 text-sm focus:outline-none focus:border-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white">
                  {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                <span className="text-slate-500 dark:text-slate-400">{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, visibleRows.length)} de {visibleRows.length}</span>
              </div>
              <div className="flex items-center gap-1">
                <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="h-[34px] min-w-[34px] rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-slate-900 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">‹</button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
                  <button key={p} onClick={() => setPage(p)} className={`h-[34px] min-w-[34px] rounded-[10px] border px-3 text-sm font-semibold ${p === page ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'}`}>{p}</button>
                ))}
                <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="h-[34px] min-w-[34px] rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-slate-900 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">›</button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Painel de filtros — os mesmos controles de antes; aplicam na hora, como antes. */}
      {filtrosAbertos && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setFiltrosAbertos(false)} />
          <aside className="relative flex h-full w-[min(440px,100%)] animate-[nmDrawerIn_.25s_ease] flex-col bg-white shadow-[-20px_0_50px_-20px_rgba(15,23,42,.35)] dark:bg-slate-800">
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
                    <select value={selectedFieldId} onChange={(e) => { setSelectedFieldId(e.target.value); setSelectedRegionalId(''); setSelectedChurchId(''); setPage(1); }}
                      disabled={!canChooseField || loadingFilters} className={campoFiltroClasse}>
                      <option value="">Todos os campos</option>
                      {fields.map((f) => <option key={f.id} value={f.id}>{f.code ? `${f.code} - ` : ''}{f.name}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  </span>
                </label>
              )}

              <label className={rotuloFiltroClasse}>
                REGIONAL
                <span className="relative min-w-0">
                  <select value={selectedRegionalId} onChange={(e) => { setSelectedRegionalId(e.target.value); setSelectedChurchId(''); setPage(1); }}
                    disabled={!canChooseRegional || loadingFilters} className={campoFiltroClasse}>
                    <option value="">Todas as regionais</option>
                    {filteredRegionais.map((r) => <option key={r.id} value={r.id}>{r.code ? `${r.code} - ` : ''}{r.name}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </span>
              </label>

              <label className={rotuloFiltroClasse}>
                IGREJA
                <span className="relative min-w-0">
                  <select value={selectedChurchId} onChange={(e) => { setSelectedChurchId(e.target.value); setPage(1); }}
                    disabled={!canChooseChurch || loadingFilters} className={campoFiltroClasse}>
                    <option value="">Todas as igrejas</option>
                    {filteredChurchOptions.map((c) => <option key={c.id} value={c.id}>{c.code ? `${c.code} - ` : ''}{c.name}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </span>
              </label>

              <label className={rotuloFiltroClasse}>
                STATUS
                <span className="relative min-w-0">
                  <select value={selectedStatus} onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }} className={campoFiltroClasse}>
                    <option value="">Todos</option>
                    <option value="Pendente">Pendente</option>
                    <option value="Aprovado">Aprovado</option>
                    <option value="Entregue">Entregue</option>
                    <option value="Ativa">Ativa</option>
                    <option value="Inativa">Inativa</option>
                    <option value="Cancelado">Cancelado</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </span>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className={rotuloFiltroClasse}>
                  DATA INICIAL
                  <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                    className="h-[50px] w-full rounded-[14px] border-[1.5px] border-slate-200 bg-white px-3 text-[15px] font-medium tracking-normal text-slate-900 outline-none focus:border-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
                </label>
                <label className={rotuloFiltroClasse}>
                  DATA FINAL
                  <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                    className="h-[50px] w-full rounded-[14px] border-[1.5px] border-slate-200 bg-white px-3 text-[15px] font-medium tracking-normal text-slate-900 outline-none focus:border-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
                </label>
              </div>
            </div>

            <div className="flex gap-2.5 border-t border-[#eef2f6] px-[22px] py-4 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setFiltrosAbertos(false)}
                className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-[14px] bg-slate-900 text-[15px] font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                Ver resultados
              </button>
            </div>
          </aside>
        </div>
      )}

      {modalOpen && (
        <NovaCredencialModal
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); void qc.invalidateQueries({ queryKey: qk.credentials({}) }); showToast(true, 'Credencial solicitada com sucesso!'); }}
        />
      )}

      {viewTarget && (
        <ViewCredentialModal credential={viewTarget} onClose={() => setViewTarget(null)} />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-[22px] shadow-[0_30px_70px_-20px_rgba(15,23,42,.45)] w-full max-w-sm mx-4 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">Excluir credencial?</p>
                <p className="text-sm text-slate-500">{deleteTarget.nome || 'Credencial'} — {deleteTarget.tipo || ''}</p>
              </div>
            </div>
            <p className="text-sm text-slate-600">Esta ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={deleteLoading}
                className="h-10 rounded-[10px] border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 disabled:opacity-60">Cancelar</button>
              <Permissao chave="credentials.credentials.excluir" rotulo="Excluir — Credentials" herda="credentials.view">
                <button disabled={deleteLoading} onClick={async () => {
                  // Optimistic: remove do cache imediatamente
                  const queryKey = qk.credentials({});
                  const snapshot = qc.getQueryData<Credential[]>(queryKey);
                  if (snapshot) {
                    qc.setQueryData<Credential[]>(queryKey, snapshot.filter((c) => c.id !== deleteTarget.id));
                  }
                  setDeleteTarget(null);
                  setDeleteLoading(true);
                  try {
                    const res = await authFetch(`${apiBase}/credential-requests/${deleteTarget.id}`, { method: 'DELETE' });
                    if (res.ok || res.status === 204) {
                      showToast(true, 'Credencial excluída.');
                      void qc.invalidateQueries({ queryKey }); // refetch silencioso
                    } else {
                      if (snapshot) qc.setQueryData<Credential[]>(queryKey, snapshot); // rollback
                      const d = await res.json().catch(() => ({}));
                      showToast(false, d.error || 'Erro ao excluir.');
                    }
                  } catch {
                    if (snapshot) qc.setQueryData<Credential[]>(queryKey, snapshot); // rollback
                    showToast(false, 'Erro de conexão.');
                  } finally { setDeleteLoading(false); }
                }} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60">
                  {deleteLoading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  {deleteLoading ? 'Excluindo...' : 'Excluir'}
                </button>
              </Permissao>
            </div>
          </div>
        </div>
      )}

      <PrintModal
        open={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        sortOptions={[
          { value: 'nome', label: 'Membro' },
          { value: 'tipo', label: 'Tipo' },
          { value: 'igrejasolicitante', label: 'Igreja' },
          { value: 'situacao', label: 'Status' },
          { value: 'dataemissao', label: 'Emissão' },
          { value: 'created_at', label: 'Solicitado em' },
        ]}
        columnOptions={[
          { value: 'nome', label: 'Membro' },
          { value: 'tipo', label: 'Tipo' },
          { value: 'igreja', label: 'Igreja' },
          { value: 'situacao', label: 'Status' },
          { value: 'dataemissao', label: 'Emissão' },
          { value: 'created_at', label: 'Solicitado em' },
          { value: 'datavalidade', label: 'Validade' },
        ]}
        defaultSort="nome"
        onPrint={(orientation, sortBy, selectedColumns) => {
          const sorted = [...visibleRows].sort((a, b) =>
            String(a[sortBy as keyof typeof a] ?? '').localeCompare(String(b[sortBy as keyof typeof b] ?? ''), 'pt-BR')
          );
          const allCols = [
            { label: 'Membro', key: 'nome' },
            { label: 'Tipo', key: 'tipo', width: '90px' },
            { label: 'Igreja', key: 'igreja' },
            { label: 'Status', key: 'situacao', width: '80px' },
            { label: 'Emissão', key: 'dataemissao', width: '80px' },
            { label: 'Solicitado em', key: 'created_at', width: '90px' },
            { label: 'Validade', key: 'datavalidade', width: '80px' },
          ];
          printReport({
            title: 'Credenciais',
            orientation,
            columns: allCols.filter((c) => selectedColumns.includes(c.key)),
            rows: sorted.map((c) => ({
              nome: c.nome || '—',
              tipo: c.tipo || '—',
              igreja: c.igrejasolicitante || '—',
              situacao: c.situacao || '—',
              dataemissao: c.dataemissao ? new Date(c.dataemissao).toLocaleDateString('pt-BR') : '—',
              created_at: c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : '—',
              datavalidade: c.datavalidade ? new Date(c.datavalidade).toLocaleDateString('pt-BR') : '—',
            })),
          });
        }}
      />
    </div>
  );
}

// ─── View Credential Modal ─────────────────────────────────────────────────────
function ViewCredentialModal({ credential: c, onClose }: { credential: Credential; onClose: () => void }) {
  const rows: [string, string][] = [
    ['Membro', c.nome || '—'],
    ['Tipo', c.tipo || '—'],
    ['Número', c.numero || '—'],
    ['Igreja Solicitante', c.igrejasolicitante || '—'],
    ['Status', c.situacao || '—'],
    ['Data de Emissão', fmtDate(c.dataemissao)],
    ['Data de Validade', fmtDate(c.datavalidade)],
    ['Protocolo Pipeline', c.card_protocol || '—'],
    ['Solicitado em', fmtDate(c.created_at)],
    ['Observações', c.obs || '—'],
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto py-8">
      <div className="bg-white rounded-[22px] shadow-[0_30px_70px_-20px_rgba(15,23,42,.45)] w-full max-w-lg mx-4 my-auto">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
          <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
            <CreditCard size={18} className="text-green-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900">Detalhes da Credencial</h3>
            <p className="text-xs text-slate-500">{c.card_protocol || `ID #${c.id}`}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-1">
          {rows.map(([label, value]) => (
            <div key={label} className="flex gap-3 py-2.5 border-b border-slate-50 last:border-0">
              <span className="w-44 shrink-0 text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
              <span className={`text-sm flex-1 ${label === 'Status' ? '' : 'text-slate-800'}`}>
                {label === 'Status' ? <StatusBadge s={value === '—' ? null : value} /> : value}
              </span>
            </div>
          ))}
        </div>
        <div className="px-6 pb-5 flex justify-end">
          <button onClick={onClose} className="h-10 rounded-[10px] border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">Fechar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Nova Credencial Modal ─────────────────────────────────────────────────────
function NovaCredencialModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = new Date().toISOString().split('T')[0];
  const _storedUser = (() => { try { return JSON.parse(localStorage.getItem('mrm_user') || '{}'); } catch { return {}; } })();
  const _activeCampo: string = localStorage.getItem('mrm_active_field_id') || _storedUser.campoId || '';
  const [tipo, setTipo] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [memberSearchOpen, setMemberSearchOpen] = useState(false);
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState<Member[]>([]);
  const [memberSearching, setMemberSearching] = useState(false);
  const [memberSearched, setMemberSearched] = useState(false);
  const [dataEmissao, setDataEmissao] = useState(today);
  const [dataValidade, setDataValidade] = useState('');
  const [validadeAnos, setValidadeAnos] = useState('');
  const [numero, setNumero] = useState('');
  const [situacao, setSituacao] = useState('Pendente');
  const [obs, setObs] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function runMemberSearch() {
    const q = memberQuery.trim();
    if (!q) return;
    setMemberSearching(true);
    setMemberSearched(true);
    try {
      const params = new URLSearchParams({ query: q, limit: '30' });
      if (_activeCampo) params.set('campoId', _activeCampo);
      const res = await fetch(`${apiBase}/members?${params.toString()}`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (Array.isArray(data?.members) ? data.members : []);
        setMemberResults(list.filter((member) => memberMatchesQuery(member, q)));
      }
    } catch { setMemberResults([]); }
    finally { setMemberSearching(false); }
  }

  function memberDisplayName(m: Member) {
    return m.fullName || m.name || m.nome || '';
  }

  function memberLegacyId(m: Member | null) {
    if (!m?.id) return undefined;
    const parsed = Number(m.id);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  async function handleSubmit() {
    if (!tipo) { setError('Selecione o tipo de credencial.'); return; }
    if (!selectedMember) { setError('Selecione o membro.'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${apiBase}/credential-requests`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          nome: memberDisplayName(selectedMember),
          memberId: selectedMember.id ? String(selectedMember.id) : undefined,
          idtbmembro: memberLegacyId(selectedMember),
          dataemissao: dataEmissao || undefined,
          datavalidade: dataValidade || undefined,
          numero: numero || undefined,
          situacao,
          obs: obs || undefined,
        }),
      });
      if (res.ok) onSaved();
      else { const d = await res.json(); setError(d.error || 'Erro ao solicitar credencial.'); }
    } catch {
      setError('Erro de conexão.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto py-8">
      <div className="bg-white rounded-[22px] shadow-[0_30px_70px_-20px_rgba(15,23,42,.45)] w-full max-w-lg mx-4 my-auto">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
          <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center">
            <CreditCard size={18} className="text-purple-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900">Nova Credencial</h3>
            <p className="text-xs text-slate-500">Solicitar nova credencial ministerial</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
          <div className="border border-slate-200 rounded-xl p-4 space-y-4">
            <p className="font-medium text-slate-900 text-sm">Dados da Credencial</p>

            {/* Tipo */}
            <div>
              <label className="block text-sm text-slate-700 mb-1">Tipo de Credencial <span className="text-red-500">*</span></label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border-[1.5px] border-slate-200 bg-white text-sm font-medium focus:outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="">Selecione o tipo</option>
                {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* Membro — busca */}
            <div>
              <label className="block text-sm text-slate-700 mb-1">Membro <span className="text-red-500">*</span></label>
              <button
                type="button"
                onClick={() => { setMemberQuery(''); setMemberResults([]); setMemberSearched(false); setMemberSearchOpen(true); }}
                className="flex w-full min-h-[46px] items-center justify-between rounded-xl border-[1.5px] border-slate-200 bg-white px-3.5 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <span className={selectedMember ? 'text-slate-900' : 'text-slate-400'}>
                  {selectedMember ? memberDisplayName(selectedMember) : 'Buscar membro...'}
                </span>
                <UserRound size={15} className="text-slate-400" />
              </button>
            </div>

            {/* Datas */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-700 mb-1">Data de Emissão <span className="text-red-500">*</span></label>
                <input type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)}
                  className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border-[1.5px] border-slate-200 bg-white text-sm font-medium focus:outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
              </div>
              <div>
                <label className="block text-sm text-slate-700 mb-1">Data de Validade</label>
                <div className="flex gap-2">
                  <select
                    value={validadeAnos}
                    onChange={(e) => {
                      const anos = e.target.value;
                      setValidadeAnos(anos);
                      if (anos && dataEmissao) {
                        const base = new Date(dataEmissao);
                        base.setFullYear(base.getFullYear() + Number(anos));
                        setDataValidade(base.toISOString().split('T')[0]);
                      } else if (!anos) {
                        setDataValidade('');
                      }
                    }}
                    className="w-32 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white"
                  >
                    <option value="">Anos</option>
                    {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n} {n === 1 ? 'ano' : 'anos'}</option>)}
                  </select>
                  <input type="date" value={dataValidade}
                    onChange={(e) => { setDataValidade(e.target.value); setValidadeAnos(''); }}
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
                </div>
                <p className="mt-1 text-xs text-slate-400">Selecione os anos ou defina a data manualmente</p>
              </div>
            </div>

            {/* Número */}
            <div>
              <label className="block text-sm text-slate-700 mb-1">Número da Credencial</label>
              <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ex: CRED-2025-001"
                className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border-[1.5px] border-slate-200 bg-white text-sm font-medium focus:outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm text-slate-700 mb-1">Status</label>
              <select value={situacao} onChange={(e) => setSituacao(e.target.value)}
                className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border-[1.5px] border-slate-200 bg-white text-sm font-medium focus:outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                <option value="Pendente">Pendente</option>
                <option value="Ativa">Ativa</option>
                <option value="Inativa">Inativa</option>
              </select>
            </div>

            {/* Observações */}
            <div>
              <label className="block text-sm text-slate-700 mb-1">Observações</label>
              <textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Informações adicionais..."
                rows={3} className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl border-[1.5px] border-slate-200 bg-white text-sm font-medium focus:outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 resize-none" />
            </div>
          </div>

          {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-lg border border-slate-200">Cancelar</button>
            <button onClick={handleSubmit} disabled={saving}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-60">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
              {saving ? 'Salvando...' : 'Solicitar'}
            </button>
          </div>
        </div>
      </div>
    </div>

    {/* Member search modal */}
    {memberSearchOpen && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 py-8">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-900">Buscar Membro</h3>
            <button onClick={() => setMemberSearchOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  autoFocus
                  value={memberQuery}
                  onChange={(e) => setMemberQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && runMemberSearch()}
                  placeholder="Digite o nome ou ROL do membro..."
                  className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>
              <button onClick={runMemberSearch} disabled={memberSearching}
                className="h-10 rounded-[10px] bg-slate-900 px-3.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 disabled:opacity-60">
                {memberSearching ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {!memberSearched && (
                <p className="text-sm text-slate-400 text-center py-6">Digite o nome e clique em Buscar</p>
              )}
              {memberSearched && !memberSearching && memberResults.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-6">Nenhum membro encontrado.</p>
              )}
              {memberResults.map((m) => (
                <button key={m.id} type="button"
                  onClick={() => { setSelectedMember(m); setMemberSearchOpen(false); }}
                  className="block w-full rounded-xl border border-slate-200 p-4 text-left hover:border-purple-300 hover:bg-purple-50 transition-colors">
                  <p className="font-semibold text-slate-900 text-sm">{memberDisplayName(m)}</p>
                  {m.church?.name && (
                    <p className="mt-0.5 text-xs text-slate-500">{m.church.code ? `${m.church.code} - ` : ''}{m.church.name}</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

