import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '../../lib/queryClient';
import { ArrowUpDown, AlertTriangle, CheckCircle, CheckCircle2, Clock3, CreditCard, Eye, Loader2, Pencil, Plus, Printer, Search, Trash2, UserRound, X, XCircle } from 'lucide-react';
import { apiBase } from '../../lib/apiBase';
import { PrintModal } from './shared/PrintModal';
import { printReport } from '../../lib/printReport';

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
  const storedUser = useMemo(parseStoredUser, []);
  const defaultDateRange = useMemo(() => getMonthDateRange(), []);
  const activeFieldId = localStorage.getItem('mrm_active_field_id') || storedUser.campoId || '';
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

  return (
    <div className="p-6 space-y-6">
      {/* Toast */}
      {toastMsg && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${toastMsg.ok ? 'bg-green-600' : 'bg-red-600'}`}>
          {toastMsg.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {toastMsg.msg}
          <button onClick={() => setToastMsg(null)}><X size={14} /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between text-slate-900 dark:text-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Credenciais</h1>
            <p className="text-slate-500 text-sm">Gerencie carteirinhas de membros e obreiros</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setPrintModalOpen(true)} className="flex items-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 rounded-lg text-sm">
            <Printer size={16} /> Imprimir
          </button>
          <button onClick={() => setModalOpen(true)} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
            <Plus size={16} /> Nova Credencial
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Total de Credenciais', value: stats.total, icon: <CreditCard className="h-5 w-5 text-slate-500" /> },
          { label: 'Pendentes', value: stats.pendente, icon: <Clock3 className="h-5 w-5 text-amber-500" /> },
          { label: 'Aprovadas', value: stats.aprovado, icon: <CheckCircle2 className="h-5 w-5 text-blue-500" /> },
          { label: 'Entregues / Ativas', value: stats.entregue, icon: <CheckCircle className="h-5 w-5 text-green-500" /> },
        ].map(({ label, value, icon }) => (
          <div key={label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 flex items-start gap-4">
            <div className="p-2 rounded-lg bg-slate-50">{icon}</div>
            <div>
              <p className="text-sm text-slate-500">{label}</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{loading ? '—' : value.toLocaleString('pt-BR')}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(200px,1.1fr)_minmax(150px,0.8fr)_minmax(150px,0.8fr)_minmax(170px,0.9fr)_minmax(120px,0.65fr)_minmax(120px,0.65fr)_minmax(120px,0.65fr)] xl:items-end">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Busca</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input type="text" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                placeholder="Nome, número, tipo, protocolo..."
                className="w-full rounded-lg border border-slate-200 py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Campo</label>
            <select value={selectedFieldId} onChange={(e) => { setSelectedFieldId(e.target.value); setSelectedRegionalId(''); setSelectedChurchId(''); setPage(1); }}
              disabled={!canChooseField || loadingFilters}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100 disabled:text-slate-500">
              <option value="">Todos os campos</option>
              {fields.map((f) => <option key={f.id} value={f.id}>{f.code ? `${f.code} - ` : ''}{f.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Regional</label>
            <select value={selectedRegionalId} onChange={(e) => { setSelectedRegionalId(e.target.value); setSelectedChurchId(''); setPage(1); }}
              disabled={!canChooseRegional || loadingFilters}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100 disabled:text-slate-500">
              <option value="">Todas as regionais</option>
              {filteredRegionais.map((r) => <option key={r.id} value={r.id}>{r.code ? `${r.code} - ` : ''}{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Igreja</label>
            <select value={selectedChurchId} onChange={(e) => { setSelectedChurchId(e.target.value); setPage(1); }}
              disabled={!canChooseChurch || loadingFilters}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100 disabled:text-slate-500">
              <option value="">Todas as igrejas</option>
              {filteredChurchOptions.map((c) => <option key={c.id} value={c.id}>{c.code ? `${c.code} - ` : ''}{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Status</label>
            <select value={selectedStatus} onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
              <option value="">Todos</option>
              <option value="Pendente">Pendente</option>
              <option value="Aprovado">Aprovado</option>
              <option value="Entregue">Entregue</option>
              <option value="Ativa">Ativa</option>
              <option value="Inativa">Inativa</option>
              <option value="Cancelado">Cancelado</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Data inicial</label>
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Data final</label>
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
        </div>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

      {/* Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                {([['nome', 'Membro'], ['tipo', 'Tipo'], ['igrejasolicitante', 'Igreja'], ['situacao', 'Status'], ['dataemissao', 'Emissão'], ['created_at', 'Solicitado em']] as [SortKey, string][]).map(([key, label]) => (
                  <th key={key} className="px-4 py-3 text-left text-sm font-semibold text-slate-900">
                    <button type="button" onClick={() => handleSort(key)} className="inline-flex items-center gap-1.5">
                      {label} <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                    </button>
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Validade</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Protocolo</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-slate-900">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse border-b border-slate-100">
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} className="px-4 py-4"><div className="h-4 rounded bg-slate-100" /></td>
                    ))}
                  </tr>
                ))
                : paginatedRows.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-4 align-top">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-xs font-semibold text-green-700 shrink-0">
                          {(c.nome || 'MB').split(' ').map((p) => p[0]).slice(0, 2).join('')}
                        </div>
                        <span className="font-medium text-slate-900 text-sm">{c.nome || '—'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600 align-top">{c.tipo || '—'}</td>
                    <td className="px-4 py-4 text-sm text-slate-600 align-top">{c.igrejasolicitante || '—'}</td>
                    <td className="px-4 py-4 align-top"><StatusBadge s={c.situacao} /></td>
                    <td className="px-4 py-4 text-sm text-slate-600 align-top">{fmtDate(c.dataemissao)}</td>
                    <td className="px-4 py-4 text-sm text-slate-600 align-top">{fmtDate(c.created_at)}</td>
                    <td className="px-4 py-4 text-sm align-top">
                      {c.datavalidade
                        ? <span className={isExpiringSoon(c.datavalidade) ? 'text-amber-600 font-medium' : 'text-slate-600'}>{fmtDate(c.datavalidade)}</span>
                        : '—'}
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-500 font-mono align-top">{c.card_protocol || c.numero || '—'}</td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" onClick={() => setViewTarget(c)}
                          className="rounded-lg p-1.5 transition-colors hover:bg-blue-50" title="Ver detalhes">
                          <Eye className="h-4 w-4 text-blue-500" />
                        </button>
                        <button type="button" onClick={() => setDeleteTarget(c)}
                          className="rounded-lg p-1.5 transition-colors hover:bg-rose-50" title="Excluir">
                          <Trash2 className="h-4 w-4 text-rose-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
        {!loading && paginatedRows.length === 0 && (
          <div className="px-6 py-10 text-center text-sm text-slate-500">
            {credentials.length === 0 ? 'Nenhuma credencial cadastrada.' : 'Nenhum resultado encontrado para os filtros selecionados.'}
          </div>
        )}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <span>Linhas:</span>
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="border border-slate-200 rounded px-2 py-1 text-sm">
                {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <span>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, visibleRows.length)} de {visibleRows.length}</span>
            </div>
            <div className="flex items-center gap-1">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50">‹</button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)} className={`px-3 py-1 rounded border ${p === page ? 'bg-purple-600 text-white border-purple-600' : 'border-slate-200 hover:bg-slate-50'}`}>{p}</button>
              ))}
              <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50">›</button>
            </div>
          </div>
        )}
      </div>

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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 space-y-4">
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
                className="px-4 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-60">Cancelar</button>
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 my-auto">
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
          <button onClick={onClose} className="px-5 py-2 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50">Fechar</button>
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 my-auto">
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
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white"
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
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
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
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
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
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm text-slate-700 mb-1">Status</label>
              <select value={situacao} onChange={(e) => setSituacao(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white">
                <option value="Pendente">Pendente</option>
                <option value="Ativa">Ativa</option>
                <option value="Inativa">Inativa</option>
              </select>
            </div>

            {/* Observações */}
            <div>
              <label className="block text-sm text-slate-700 mb-1">Observações</label>
              <textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Informações adicionais..."
                rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none" />
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
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60">
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

