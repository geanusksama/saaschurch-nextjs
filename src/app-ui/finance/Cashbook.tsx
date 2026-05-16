import { useState, useEffect, useRef, useMemo, useCallback, KeyboardEvent } from 'react';
import {
  DollarSign, Plus, Search, Download, Printer, Eye, AlertCircle,
  TrendingDown, TrendingUp, Building2, X, ChevronUp, ChevronDown,
  ChevronsUpDown, ChevronLeft, ChevronRight, MapPin, Users,
  Pencil, Trash2, Filter, Save, Loader2, FileSpreadsheet
} from 'lucide-react';
import { Link } from 'react-router';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabaseClient';
import { apiBase } from '../../lib/apiBase';
import { ReciboModal, printRecibo } from './ReciboModal';
import type { ReciboRow } from './ReciboModal';
import { RelatorioModal } from './RelatorioModal';

// ─── helpers ────────────────────────────────────────────────────────────────
function firstDayOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
}
function lastDayOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
}
function fmt(v: number) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function normalizeText(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function exportToExcel(rows: import('./ReciboModal').ReciboRow[], dateFrom: string, dateTo: string) {
  const data = rows.map((r, i) => ({
    '#': i + 1,
    'Data': r.data_lancamento ? new Date(r.data_lancamento + 'T00:00:00').toLocaleDateString('pt-BR') : '',
    'Tipo': r.tipo,
    'Favorecido': r.favorecido ?? '',
    'Plano de Conta': r.plano_de_conta ?? '',
    'Categoria': r.categoria ?? '',
    'Forma Pgto': r.forma_pg ?? '',
    'Nº Doc': r.num_doc ?? '',
    'Referência': r.referencia ?? '',
    'Valor (R$)': Number(r.valor),
    'Igreja': r.churches?.name ?? '',
    'Observação': r.obs ?? '',
    'Operador': r.operador ?? '',
  }));

  const ws = XLSX.utils.json_to_sheet(data);

  // Column widths
  ws['!cols'] = [
    { wch: 4 }, { wch: 12 }, { wch: 10 }, { wch: 30 }, { wch: 25 },
    { wch: 20 }, { wch: 16 }, { wch: 12 }, { wch: 16 }, { wch: 14 },
    { wch: 28 }, { wch: 30 }, { wch: 20 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Livro Caixa');

  const fileName = `livro-caixa_${dateFrom}_${dateTo}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

function matchesStoredValue(currentValue: string | null | undefined, ...candidates: Array<string | null | undefined>) {
  const normalizedCurrent = normalizeText((currentValue || '').trim());
  if (!normalizedCurrent) return false;
  return candidates.some(candidate => normalizeText((candidate || '').trim()) === normalizedCurrent);
}

function filterTipoDocumentoOptions(
  docs: { id: string; nome: string; sigla: string | null }[],
  tipo: 'RECEITA' | 'DESPESA'
) {
  return docs.filter(doc => {
    const nome = doc.nome.toUpperCase();
    const temReceita = nome.includes('RECEITA');
    const temDespesa = nome.includes('DESPESA');
    if (tipo === 'RECEITA') return temReceita;
    return temDespesa || (!temReceita && !temDespesa);
  });
}

function resolveTipoDocumentoValue(
  currentValue: string,
  docs: { id: string; nome: string; sigla: string | null }[]
) {
  const match = docs.find(doc => matchesStoredValue(
    currentValue,
    doc.nome,
    doc.sigla,
    doc.sigla ? `${doc.sigla} - ${doc.nome}` : null,
  ));
  return match?.nome ?? currentValue;
}

function getReceitaTipoDocumentoFallback(
  planoDeContas: string,
  docs: { id: string; nome: string; sigla: string | null }[]
) {
  const planoNormalizado = normalizeText(planoDeContas || '');
  const isDizimoOuOferta = planoNormalizado.includes('dizimo') || planoNormalizado.includes('oferta');
  if (!isDizimoOuOferta) return '';

  const reciboReceita = docs.find(doc => normalizeText(doc.nome).includes('recibo receita'));
  if (reciboReceita) return reciboReceita.nome;

  const outrosReceita = docs.find(doc => normalizeText(doc.nome).includes('outros receita'));
  if (outrosReceita) return outrosReceita.nome;

  const primeiraReceita = docs[0];
  return primeiraReceita?.nome ?? '';
}

function resolveNamedValue<T extends { nome: string }>(currentValue: string, options: T[]) {
  const match = options.find(option => matchesStoredValue(currentValue, option.nome));
  return match?.nome ?? currentValue;
}

function readStoredUser() {
  try { return JSON.parse(localStorage.getItem('mrm_user') || '{}'); } catch { return {}; }
}

function RibbonGroup({
  label,
  children,
  className = '',
  bodyClassName = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={`flex flex-col items-center min-w-fit ${className}`.trim()}>
      <div className={`flex w-full items-end gap-1 px-1 ${bodyClassName}`.trim()}>{children}</div>
      <div className="mt-1 text-[9px] uppercase tracking-[0.18em] text-slate-600 whitespace-nowrap">{label}</div>
    </div>
  );
}

function RibbonDivider() {
  return <div className="hidden md:block w-px self-stretch bg-slate-200 mx-1" />;
}

function RibbonField({
  label,
  icon,
  children,
  className = '',
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 px-1 py-1 ${className}`.trim()}>
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-[0.18em] text-slate-600">
        {icon ? <span className="text-slate-500">{icon}</span> : null}
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}

function RibbonButton({
  icon,
  label,
  title,
  onClick,
  disabled,
  tone = 'default',
  size = 'sm',
  className = '',
}: {
  icon?: React.ReactNode;
  label?: string;
  title: string;
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  tone?: 'default' | 'primary' | 'danger' | 'blue';
  size?: 'sm' | 'lg';
  className?: string;
}) {
  const baseTone = activeTone(tone);

  if (size === 'lg') {
    return (
      <button
        type="button"
        title={title}
        onClick={onClick}
        disabled={disabled}
        className={`flex min-h-[52px] min-w-[44px] shrink-0 flex-col items-center justify-center gap-0.5 rounded px-2 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${baseTone} ${className}`.trim()}
      >
        {icon ? <span className="flex items-center justify-center">{icon}</span> : null}
        {label ? <span className="mt-0.5 max-w-[60px] text-center text-[10px] leading-tight">{label}</span> : null}
      </button>
    );
  }

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-7 shrink-0 items-center justify-center gap-1 rounded px-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${baseTone} ${className}`.trim()}
    >
      {icon ? <span className="flex items-center justify-center">{icon}</span> : null}
      {label ? <span className="whitespace-nowrap">{label}</span> : null}
    </button>
  );
}

function activeTone(tone: 'default' | 'primary' | 'danger' | 'blue') {
  if (tone === 'primary') return 'text-slate-700 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700';
  if (tone === 'danger') return 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30';
  if (tone === 'blue') return 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50';
  return 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700';
}

function SummaryPanel({
  label,
  value,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  tone?: 'neutral' | 'positive' | 'negative';
}) {
  const toneClass = tone === 'positive'
    ? 'border-slate-200 bg-white text-slate-700'
    : tone === 'negative'
      ? 'border-slate-200 bg-white text-slate-700'
      : 'border-slate-200 bg-white text-slate-700';

  return (
    <div className={`rounded-md border px-3 py-2 ${toneClass}`}>
      <div className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-700">
        {icon ? <span className="text-slate-600">{icon}</span> : null}
        <span>{label}</span>
      </div>
      <div className="mt-1 text-sm font-semibold leading-none text-slate-800">{value}</div>
    </div>
  );
}

// ─── types ───────────────────────────────────────────────────────────────────
type Row = ReciboRow;
type SortKey = 'data_lancamento' | 'valor' | 'tipo' | 'favorecido' | 'church' | 'plano_tipo';

function planoPriority(r: Row): number {
  const p = (r.plano_de_conta || r.categoria || '').toLowerCase();
  if (r.tipo === 'RECEITA') {
    if (p.includes('dizimo') || p.includes('d\u00edizimo') || p.includes('d\u00edzimo')) return 0;
    if (p.includes('oferta')) return 1;
    return 2;
  }
  return 3; // DESPESA
}
type SortDir = 'asc' | 'desc';

type ChurchOption = {
  id: string;
  name: string;
  code?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  regionalId?: string | null;
  regional?: { id: string; name: string; campoId?: string } | null;
};
type RegionalOption = { id: string; name: string; campoId?: string };

// ─── Church Picker Modal ──────────────────────────────────────────────────────
function ChurchPickerModal({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (church: ChurchOption | null) => void;
  initialRegionalId?: string;
}) {
  const storedUser = readStoredUser();
  const token = localStorage.getItem('mrm_token') || '';
  const isMasterOrAdmin = storedUser.profileType === 'master' || storedUser.profileType === 'admin';
  const userCampoId = storedUser.campoId || '';

  const [search, setSearch] = useState('');
  const [results, setResults] = useState<ChurchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (activeIndex >= 0) optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  async function doSearch() {
    setSearched(true);
    setActiveIndex(0);
    if (!search.trim()) { setResults([]); return; }
    setLoading(true);
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const params = new URLSearchParams({ q: search.trim() });
    if (userCampoId && !isMasterOrAdmin) params.set('campoId', userCampoId);
    try {
      const res = await fetch(`${apiBase}/churches/search?${params}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setResults(Array.isArray(data) ? data.slice(0, 60) : []);
      } else {
        // fallback: busca local com supabase se endpoint não existir
        const { data } = await (await import('../../lib/supabaseClient')).supabase
          .from('churches')
          .select('id, name, code:slug, addressCity:address_city, addressState:address_state')
          .ilike('name', `%${search.trim()}%`)
          .limit(40);
        setResults(data ?? []);
      }
    } catch {
      setResults([]);
    }
    setLoading(false);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (results[activeIndex]) onSelect(results[activeIndex]); else doSearch(); }
    else if (e.key === 'Escape') onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg font-bold text-slate-900">Buscar Igreja</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 flex-shrink-0 space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                ref={inputRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Nome, codigo ou regional da igreja..."
                className="w-full rounded-lg border border-emerald-400 py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              onClick={doSearch}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-700 text-white text-sm hover:bg-violet-800 disabled:opacity-60 transition-colors"
            >
              <Search className="w-4 h-4" />
              {loading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>Use ↑↓ para navegar</span>
            <span>Enter para selecionar</span>
          </div>
        </div>

        {/* Church list */}
        <div className="overflow-y-auto px-5 pb-5 flex-1 space-y-2 min-h-[120px]">
          {loading && (
            <div className="py-8 text-center">
              <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-slate-400">Buscando igrejas...</p>
            </div>
          )}
          {!loading && !searched && (
            <div className="py-10 text-center">
              <Search className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Digite o nome da igreja ou ID para buscar</p>
            </div>
          )}
          {!loading && searched && results.length === 0 && (
            <div className="py-8 text-center">
              <Building2 className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Nenhuma igreja encontrada.</p>
            </div>
          )}
          {!loading && results.map((church, idx) => (
            <button
              key={church.id}
              type="button"
              ref={el => { optionRefs.current[idx] = el; }}
              onClick={() => onSelect(church)}
              onMouseEnter={() => setActiveIndex(idx)}
              className={`block w-full rounded-xl border p-3.5 text-left transition-all ${activeIndex === idx ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50'}`}
            >
              <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${activeIndex === idx ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                  <Building2 className={`w-4 h-4 ${activeIndex === idx ? 'text-emerald-600' : 'text-slate-500'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-900 text-sm truncate">{church.name}</p>
                    {church.code && (
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-mono rounded flex-shrink-0">
                        {church.code}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                    {church.addressCity && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />{church.addressCity}
                      </span>
                    )}
                    {church.regional?.name && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />{church.regional.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-5 py-3 flex-shrink-0 flex justify-end items-center">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sort helper ─────────────────────────────────────────────────────────────
function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="w-3 h-3 text-slate-300 inline ml-1" />;
  return sortDir === 'asc'
    ? <ChevronUp className="w-3 h-3 text-slate-600 inline ml-1" />
    : <ChevronDown className="w-3 h-3 text-slate-600 inline ml-1" />;
}

// ─── Pagination helper ───────────────────────────────────────────────────────
function Pagination({
  page, totalPages, total, pageSize, onPage
}: { page: number; totalPages: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const pages: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-500">
      <span>Exibindo {start}–{end} de {total} registros</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onPage(page - 1)} disabled={page === 1}
          className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-40">
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        {pages.map((p, i) => p === '...'
          ? <span key={i} className="px-1">…</span>
          : <button key={p} onClick={() => onPage(p as number)}
              className={`px-2.5 py-1 rounded font-medium transition-all ${
                page === p
                  ? 'bg-violet-500 text-white shadow-md shadow-violet-200 ring-2 ring-violet-300'
                  : 'hover:bg-slate-200 text-slate-600'
              }`}>
              {p}
            </button>
        )}
        <button onClick={() => onPage(page + 1)} disabled={page === totalPages}
          className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-40">
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Edit Drawer ──────────────────────────────────────────────────────────────
function EditDrawer({
  row, onClose, onSaved,
}: {
  row: Row;
  onClose: () => void;
  onSaved: (id: string, changes: Partial<Row>) => void;
}) {
  const [planos, setPlanos] = useState<{ id: string; nome: string; codigo: string | null }[]>([]);
  const [formas, setFormas] = useState<{ id: string; nome: string }[]>([]);
  const [tiposDocs, setTiposDocs] = useState<{ id: string; nome: string; sigla: string | null }[]>([]);

  const [dataLancamento, setDataLancamento] = useState(row.data_lancamento);
  const [planoDeContas, setPlanoDeContas] = useState(row.plano_de_conta || '');
  const [tipoDocumento, setTipoDocumento] = useState(row.tipo_documento || '');
  const [numDoc, setNumDoc] = useState(row.num_doc || '');
  const [formaPg, setFormaPg] = useState(row.forma_pg || '');
  const [referencia, setReferencia] = useState(row.referencia || '');
  const [obs, setObs] = useState(row.obs || '');
  const [valor, setValor] = useState(
    Number(row.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setDataLancamento(row.data_lancamento);
    setPlanoDeContas(row.plano_de_conta || '');
    setTipoDocumento(row.tipo_documento || '');
    setNumDoc(row.num_doc || '');
    setFormaPg(row.forma_pg || '');
    setReferencia(row.referencia || '');
    setObs(row.obs || '');
    setValor(Number(row.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setError('');
  }, [row]);

  useEffect(() => {
    (async () => {
      const tipo = row.tipo;
      const [p, f, t] = await Promise.all([
        supabase.from('plano_de_contas').select('id, nome, codigo').eq('tipo', tipo).eq('ativo', true).order('nome'),
        supabase.from('forma_pagamento').select('id, nome').eq('mostrar', true).order('nome'),
        supabase.from('tipo_documento').select('id, nome, sigla')
          .eq(tipo === 'RECEITA' ? 'disponivel_receita' : 'disponivel_despesa', true)
          .eq('ativo', true)
          .order('nome'),
      ]);
      if (p.data) setPlanos(p.data);
      if (f.data) setFormas(f.data);
      if (t.data) setTiposDocs(filterTipoDocumentoOptions(t.data, tipo));
    })();
  }, [row.tipo]);

  useEffect(() => {
    if (planos.length > 0) {
      setPlanoDeContas(current => resolveNamedValue(current, planos));
    }
  }, [planos]);

  useEffect(() => {
    if (formas.length > 0) {
      setFormaPg(current => resolveNamedValue(current, formas));
    }
  }, [formas]);

  useEffect(() => {
    if (tiposDocs.length > 0) {
      setTipoDocumento(current => {
        const resolved = resolveTipoDocumentoValue(current, tiposDocs);
        const hasResolvedMatch = tiposDocs.some(doc => matchesStoredValue(resolved, doc.nome, doc.sigla, doc.sigla ? `${doc.sigla} - ${doc.nome}` : null));
        if (hasResolvedMatch) return resolved;
        if (row.tipo === 'RECEITA') {
          return getReceitaTipoDocumentoFallback(row.plano_de_conta || '', tiposDocs);
        }
        return resolved;
      });
      return;
    }
    if (row.tipo === 'RECEITA') {
      setTipoDocumento('');
    }
  }, [tiposDocs, row.id, row.tipo, row.tipo_documento, row.plano_de_conta]);

  function handleValorChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) { setValor(''); return; }
    const num = parseInt(raw, 10) / 100;
    setValor(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  }

  async function handleSave() {
    setError('');
    const valorNum = Number(valor.replace(/\./g, '').replace(',', '.'));
    if (!valor || isNaN(valorNum) || valorNum <= 0) { setError('Valor inválido.'); return; }

    setSaving(true);
    const { error: err } = await supabase.from('livro_caixa').update({
      data_lancamento: dataLancamento,
      plano_de_conta: planoDeContas || null,
      tipo_documento: tipoDocumento || null,
      num_doc: numDoc || null,
      forma_pg: formaPg || null,
      referencia: referencia || null,
      obs: obs || null,
      valor: valorNum,
    }).eq('id', row.id);
    setSaving(false);

    if (err) { setError('Erro ao salvar: ' + err.message); return; }

    onSaved(row.id, {
      data_lancamento: dataLancamento,
      plano_de_conta: planoDeContas || null,
      tipo_documento: tipoDocumento || null,
      num_doc: numDoc || null,
      forma_pg: formaPg || null,
      referencia: referencia || null,
      obs: obs || null,
      valor: valorNum,
    });
    onClose();
  }

  const isReceita = row.tipo === 'RECEITA';
  const accent = isReceita ? 'emerald' : 'rose';

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-${accent}-50`}>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Editar Lançamento</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {row.favorecido || '—'} • <span className={`font-semibold ${isReceita ? 'text-emerald-600' : 'text-rose-600'}`}>{row.tipo}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Favorecido (read-only) */}
        <div className="px-5 pt-4 pb-2">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Favorecido / Contribuinte</p>
            <p className="text-sm font-semibold text-slate-700">{row.favorecido || '—'}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {(row.churches as any)?.name || '—'} • Doc: {row.legacy_id || row.num_doc || row.id}
            </p>
          </div>
        </div>

        {/* Editable fields */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Data Lançamento</label>
            <input type="date" value={dataLancamento} onChange={e => setDataLancamento(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Plano de Contas</label>
            <select value={planoDeContas} onChange={e => setPlanoDeContas(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white">
              <option value="">Selecione...</option>
              {planos.map(p => <option key={p.id} value={p.nome}>{p.codigo ? `${p.codigo} - ` : ''}{p.nome}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Tipo Documento</label>
              <select value={tipoDocumento} onChange={e => setTipoDocumento(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white">
                <option value="">Tipo...</option>
                {tiposDocs.map(t => <option key={t.id} value={t.nome}>{t.sigla ? `${t.sigla} - ` : ''}{t.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Nº Doc</label>
              <input type="text" value={numDoc} onChange={e => setNumDoc(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Forma de Pagamento</label>
            <select value={formaPg} onChange={e => setFormaPg(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white">
              <option value="">Selecione...</option>
              {formas.map(f => <option key={f.id} value={f.nome}>{f.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Referência (Mês/Ano)</label>
            <input type="text" value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="MM/AAAA"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Observações</label>
            <textarea rows={2} value={obs} onChange={e => setObs(e.target.value)} placeholder="Detalhes adicionais..."
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Valor (R$)</label>
            <input type="text" inputMode="numeric" value={valor} onChange={handleValorChange} placeholder="0,00"
              className={`w-full px-3 py-2.5 border-2 rounded-lg text-sm font-bold text-right focus:outline-none focus:ring-2 focus:ring-violet-500 ${isReceita ? 'border-emerald-400' : 'border-rose-400'}`} />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-200 flex gap-3 flex-shrink-0">
          <button onClick={onClose}
            className="flex-1 py-2.5 border border-slate-300 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : <><Save className="w-4 h-4" /> Salvar</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Cashbook ────────────────────────────────────────────────────────────
export default function Cashbook() {
  const storedUser = readStoredUser();
  const profileType: string = storedUser.profileType || 'church';
  const isChurchProfile = profileType === 'church';
  const canChooseChurch = profileType === 'master' || profileType === 'admin' || profileType === 'campo';

  // Filters
  const [dataInicio, setDataInicio] = useState(firstDayOfMonth());
  const [dataFim, setDataFim]       = useState(lastDayOfMonth());
  const [selectedChurch, setSelectedChurch] = useState<ChurchOption | null>(null);
  const [churchPickerOpen, setChurchPickerOpen] = useState(false);

  // Results
  const [rows, setRows]             = useState<Row[]>([]);
  const [loading, setLoading]       = useState(false);
  const [searched, setSearched]     = useState(false);
  const [error, setError]           = useState('');
  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const [showRelatorio, setShowRelatorio] = useState(false);

  // Table state
  const [filterType, setFilterType] = useState<'all' | 'RECEITA' | 'DESPESA'>('all');
  const [sortKey, setSortKey]       = useState<SortKey>('plano_tipo');
  const [sortDir, setSortDir]       = useState<SortDir>('asc');
  const [page, setPage]             = useState(1);
  const [pageSize, setPageSize]     = useState(100);
  const [editRow, setEditRow]       = useState<Row | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [deleting, setDeleting]     = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Auto-select church for church-profile users
  useEffect(() => {
    if (isChurchProfile && storedUser.churchId && !selectedChurch) {
      setSelectedChurch({ id: storedUser.churchId, name: storedUser.churchName || 'Minha Igreja' });
    }
  }, []);

  async function buscar() {
    setError('');
    if (dataFim < dataInicio) { setError('A data final deve ser maior ou igual a data inicial.'); return; }
    setLoading(true);
    setSearched(true);
    setPage(1);

    let query = supabase
      .from('livro_caixa')
      .select(`id, data_lancamento, tipo, valor, favorecido, plano_de_conta,
               categoria, forma_pg, referencia, obs, foto, legacy_id,
               num_doc, tipo_documento, member_id, church_id, operador, churches(name)`)
      .gte('data_lancamento', dataInicio)
      .lte('data_lancamento', dataFim)
      .order('data_lancamento', { ascending: false })
      .limit(5000);

    if (selectedChurch?.id) {
      query = query.eq('church_id', selectedChurch.id);
    } else if (isChurchProfile && storedUser.churchId) {
      query = query.eq('church_id', storedUser.churchId);
    }

    const { data, error: err } = await query;
    setLoading(false);
    if (err) { setError('Erro ao buscar dados: ' + err.message); return; }
    setRows((data as unknown as Row[]) || []);
  }

  function handleRowUpdated(id: string, changes: Partial<Row>) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...changes } : r));
    if (selectedRow?.id === id) setSelectedRow(prev => prev ? { ...prev, ...changes } : prev);
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'data_lancamento' || key === 'valor' ? 'desc' : 'asc'); }
    setPage(1);
  }

  // Computed values
  const typeFiltered = filterType === 'all' ? rows : rows.filter(r => r.tipo === filterType);

  const sorted = useMemo(() => {
    return [...typeFiltered].sort((a, b) => {
      if (sortKey === 'plano_tipo') {
        const pa = planoPriority(a), pb = planoPriority(b);
        if (pa !== pb) return pa - pb;
        return b.data_lancamento.localeCompare(a.data_lancamento);
      }
      let av: string | number = '', bv: string | number = '';
      if (sortKey === 'data_lancamento') { av = a.data_lancamento; bv = b.data_lancamento; }
      else if (sortKey === 'valor') { av = Number(a.valor); bv = Number(b.valor); }
      else if (sortKey === 'tipo') { av = a.tipo; bv = b.tipo; }
      else if (sortKey === 'favorecido') { av = a.favorecido || ''; bv = b.favorecido || ''; }
      else if (sortKey === 'church') { av = (a.churches as any)?.name || ''; bv = (b.churches as any)?.name || ''; }
      if (typeof av === 'number') return sortDir === 'asc' ? av - bv : (bv as number) - av;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv), 'pt-BR') : String(bv).localeCompare(String(av), 'pt-BR');
    });
  }, [typeFiltered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated  = useMemo(() => {
    const s = (page - 1) * pageSize;
    return sorted.slice(s, s + pageSize);
  }, [sorted, page, pageSize]);

  const totalReceita = rows.filter(r => r.tipo === 'RECEITA').reduce((s, r) => s + Number(r.valor), 0);
  const totalDespesa = rows.filter(r => r.tipo === 'DESPESA').reduce((s, r) => s + Number(r.valor), 0);
  const totalDizimos = rows.filter(r => r.tipo === 'RECEITA' && (r.plano_de_conta || '').toLowerCase().includes('dizimo')).reduce((s, r) => s + Number(r.valor), 0);
  const totalOfertas = rows.filter(r => r.tipo === 'RECEITA' && (r.plano_de_conta || '').toLowerCase().includes('oferta')).reduce((s, r) => s + Number(r.valor), 0);
  const qtdReceitas  = rows.filter(r => r.tipo === 'RECEITA').length;
  const qtdDespesas  = rows.filter(r => r.tipo === 'DESPESA').length;
  const qtdDizimos   = rows.filter(r => r.tipo === 'RECEITA' && (r.plano_de_conta || '').toLowerCase().includes('dizimo')).length;
  const qtdOfertas   = rows.filter(r => r.tipo === 'RECEITA' && (r.plano_de_conta || '').toLowerCase().includes('oferta')).length;
  const liquido      = totalReceita - totalDespesa;

  function Th({ col, label }: { col: SortKey; label: string }) {
    return (
      <th
        className="px-4 py-3 text-left text-xs font-semibold text-slate-500 cursor-pointer select-none hover:text-slate-700 whitespace-nowrap"
        onClick={() => handleSort(col)}
      >
        {label}<SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
      </th>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="px-4 pt-3 sm:px-6">
          <div className="flex items-center justify-between gap-3 overflow-x-auto text-sm text-slate-500 dark:text-slate-400">
            <div className="flex min-w-max items-end gap-1">
              <span className="px-4 py-2 font-semibold text-slate-700 dark:text-slate-200">Livro Caixa</span>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 px-3 py-3 sm:px-4">
          <div className="flex flex-wrap items-stretch gap-x-2 gap-y-3 md:items-center md:overflow-x-auto">
            <RibbonGroup label="Escopo" className="flex-1">
              {canChooseChurch ? (
                <RibbonField label="Igreja" icon={<Building2 className="h-3 w-3" />} className="flex-1 min-w-[260px] w-full">
                  <button
                    type="button"
                    onClick={() => setChurchPickerOpen(true)}
                    className="flex h-8 w-full items-center gap-2 rounded border border-slate-300 bg-white px-2 text-left text-xs text-slate-700 outline-none transition-colors hover:border-blue-300"
                  >
                    <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className={`truncate ${selectedChurch ? 'font-medium text-slate-800' : 'text-slate-500'}`}>
                      {selectedChurch ? selectedChurch.name : 'Todas as igrejas'}
                    </span>
                    {selectedChurch ? (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={e => { e.stopPropagation(); setSelectedChurch(null); }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedChurch(null);
                          }
                        }}
                        className="ml-auto flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      >
                        <X className="h-3.5 w-3.5" />
                      </span>
                    ) : <Search className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-300" />}
                  </button>
                </RibbonField>
              ) : null}
              <RibbonButton
                size="lg"
                title="Consultar lançamentos"
                icon={loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                label={loading ? 'Consultando' : 'Consultar'}
                onClick={() => { void buscar(); }}
                disabled={loading}
                tone="blue"
              />

              {isChurchProfile && selectedChurch ? (
                <RibbonField label="Igreja" icon={<Building2 className="h-3 w-3" />} className="min-w-[220px]">
                  <div className="flex h-8 items-center gap-2 rounded border border-slate-200 bg-white px-2 text-xs text-slate-700">
                    <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate font-medium">{selectedChurch.name}</span>
                  </div>
                </RibbonField>
              ) : null}
            </RibbonGroup>

            <RibbonDivider />

            <RibbonGroup label="Período">
              <RibbonField label="Data inicial" className="min-w-[140px]">
                <input
                  type="date"
                  value={dataInicio}
                  onChange={e => setDataInicio(e.target.value)}
                  className="h-8 rounded border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none focus:border-blue-400"
                />
              </RibbonField>
              <RibbonField label="Data final" className="min-w-[140px]">
                <input
                  type="date"
                  value={dataFim}
                  onChange={e => setDataFim(e.target.value)}
                  className="h-8 rounded border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none focus:border-blue-400"
                />
              </RibbonField>
            </RibbonGroup>

            <RibbonDivider />

            <RibbonGroup
              label="Relatórios"
              className="w-full md:w-auto"
              bodyClassName="grid w-full grid-cols-2 gap-2 px-0 md:flex md:w-auto md:gap-1 md:px-1"
            >
              <RibbonButton
                size="lg"
                title="Imprimir relatório"
                icon={<Printer className="h-4 w-4" />}
                label="Imprimir"
                onClick={() => { if (searched && rows.length > 0) setShowRelatorio(true); }}
                disabled={!searched || rows.length === 0}
                className="min-w-[88px] w-full md:w-auto bg-slate-900 text-white hover:!bg-slate-700 shadow-md"
              />
              <RibbonButton
                size="lg"
                title="Exportar para Excel"
                icon={
                  <span className="relative flex items-center justify-center">
                    <FileSpreadsheet className="h-4 w-4" />
                    <span className="absolute -bottom-1 -right-1 rounded-[2px] bg-emerald-500 px-[2px] text-[6px] font-bold leading-none text-white">XLS</span>
                  </span>
                }
                label="Exportar"
                onClick={() => exportToExcel(sorted, dataInicio, dataFim)}
                disabled={!searched || sorted.length === 0}
                className="min-w-[88px] w-full md:w-auto bg-slate-900 text-white hover:!bg-slate-700 shadow-md"
              />
            </RibbonGroup>

            <RibbonDivider />

            <RibbonGroup
              label="Lançamentos"
              className="w-full md:w-auto"
              bodyClassName="grid w-full grid-cols-2 gap-2 px-0 md:flex md:w-auto md:gap-1 md:px-1"
            >
              <Link to="/app-ui/finance/income/new" className="w-full shrink-0 md:w-auto">
                <span className="flex min-h-[52px] min-w-[80px] w-full flex-col items-center justify-center gap-0.5 rounded px-3 py-1 text-xs text-white bg-[#059669] hover:bg-[#047857] shadow-sm transition-colors md:w-auto">
                  <TrendingUp className="h-4 w-4" />
                  <span className="mt-0.5 text-center text-[10px] leading-tight font-semibold">Nova Receita</span>
                </span>
              </Link>
              <Link to="/app-ui/finance/expense/new" className="w-full shrink-0 md:w-auto">
                <span className="flex min-h-[52px] min-w-[80px] w-full flex-col items-center justify-center gap-0.5 rounded px-3 py-1 text-xs text-white bg-red-600 hover:bg-red-700 shadow-sm transition-colors md:w-auto">
                  <TrendingDown className="h-4 w-4" />
                  <span className="mt-0.5 text-center text-[10px] leading-tight font-semibold">Nova Despesa</span>
                </span>
              </Link>
            </RibbonGroup>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5 2xl:grid-cols-10">
            <SummaryPanel
              label="Líquido"
              value={`R$ ${fmt(liquido)}`}
              icon={<TrendingDown className="h-3 w-3" />}
              tone={liquido >= 0 ? 'positive' : 'negative'}
            />
            <SummaryPanel
              label="Receitas"
              value={`R$ ${fmt(totalReceita)}`}
              icon={<TrendingUp className="h-3 w-3" />}
              tone="positive"
            />
            <SummaryPanel
              label="Despesas"
              value={`R$ ${fmt(totalDespesa)}`}
              icon={<TrendingDown className="h-3 w-3" />}
              tone="negative"
            />
            <SummaryPanel
              label="Movimentos"
              value={`${rows.length}`}
              icon={<DollarSign className="h-3 w-3" />}
            />
            <SummaryPanel
              label="Total dízimos"
              value={`R$ ${fmt(totalDizimos)}`}
              tone="neutral"
            />
            <SummaryPanel
              label="Total ofertas"
              value={`R$ ${fmt(totalOfertas)}`}
              tone="neutral"
            />
            <SummaryPanel
              label="Qtd. receitas"
              value={`${qtdReceitas}`}
              tone="neutral"
            />
            <SummaryPanel
              label="Qtd. despesas"
              value={`${qtdDespesas}`}
              tone="neutral"
            />
            <SummaryPanel
              label="Qtd. dízimos"
              value={`${qtdDizimos}`}
              tone="neutral"
            />
            <SummaryPanel
              label="Qtd. ofertas"
              value={`${qtdOfertas}`}
              tone="neutral"
            />
          </div>

          {error ? (
            <div className="mt-3 flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-1 flex-col px-4 py-4 sm:px-6">
      {!searched && (
        <div className="flex flex-1 flex-col justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm dark:shadow-none">
          <div className="mx-auto flex max-w-xl flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
              <Search className="h-7 w-7 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">Nenhum lançamento exibido</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Use a faixa superior para definir igreja e período, depois execute a consulta para carregar os lançamentos.
            </p>
            <p className="mt-3 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
              Período preparado: {new Date(dataInicio + 'T12:00:00').toLocaleDateString('pt-BR')} até {new Date(dataFim + 'T12:00:00').toLocaleDateString('pt-BR')}
            </p>
            <button
              type="button"
              onClick={() => { void buscar(); }}
              disabled={loading}
              className="mt-5 inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-60"
            >
              <Search className="h-4 w-4" />
              Consultar agora
            </button>
          </div>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-16 text-center shadow-sm dark:shadow-none">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">Consultando lancamentos...</p>
        </div>
      )}

      {/* ── Sem resultados ── */}
      {searched && !loading && rows.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center shadow-sm dark:shadow-none">
          <DollarSign className="w-10 h-10 text-slate-200 dark:text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">Nenhum lancamento encontrado no periodo selecionado.</p>
        </div>
      )}

      {/* ── Tabela ── */}
      {searched && !loading && rows.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/70 flex-wrap gap-2">
            {/* Left: type filter */}
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              {(['all', 'RECEITA', 'DESPESA'] as const).map(t => (
                <button key={t} onClick={() => { setFilterType(t); setPage(1); }}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                    filterType === t
                      ? t === 'RECEITA' ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200'
                        : t === 'DESPESA' ? 'bg-rose-100 text-rose-700 ring-1 ring-rose-200'
                        : 'bg-slate-800 text-white'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}>
                  {t === 'all' ? `Todos (${rows.length})` : t === 'RECEITA' ? `Receitas (${qtdReceitas})` : `Despesas (${qtdDespesas})`}
                </button>
              ))}
            </div>

            {/* Right: per-page + info */}
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>Exibir</span>
              <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="px-2 py-1 border border-slate-200 rounded text-sm bg-white">
                {[25, 50, 100, 200, 500].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <span>por pagina</span>
              <span className="text-slate-400 ml-2">
                {sorted.length} lancamento{sorted.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Top pagination */}
          <Pagination page={page} totalPages={totalPages} total={sorted.length} pageSize={pageSize} onPage={setPage} />

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <Th col="data_lancamento" label="Ref / Data" />
                  <Th col="church" label="Igreja / Caixa" />
                  <Th col="favorecido" label="Descricao / Favorecido" />
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Plano / Categoria</th>
                  <Th col="valor" label="Valor" />
                  <Th col="tipo" label="Tipo" />
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.map(row => (
                  <tr key={row.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/60 transition-colors group border-b border-slate-100 dark:border-slate-800/60">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="font-mono text-[11px] font-semibold text-slate-600">{row.legacy_id ?? '—'}</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {new Date(row.data_lancamento + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </p>
                      {row.num_doc && <p className="text-[9px] text-slate-400">DOC: {row.num_doc}</p>}
                    </td>
                    <td className="px-4 py-3 max-w-[160px]">
                      <p className="text-[11px] text-slate-700 truncate font-medium">{(row.churches as any)?.name ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 max-w-[220px]">
                      <p className="text-[12px] font-semibold text-slate-800 truncate">{row.favorecido || '—'}</p>
                      {row.obs && <p className="text-[11px] text-slate-400 truncate">{row.obs}</p>}
                      {row.forma_pg && <p className="text-[9px] text-slate-400">{row.forma_pg}</p>}
                    </td>
                    <td className="px-4 py-3 max-w-[180px]">
                      <p className="text-[11px] text-slate-600 truncate">{row.plano_de_conta || row.categoria || '—'}</p>
                      {row.referencia && <p className="text-[9px] text-slate-400 truncate">{row.referencia}</p>}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className={`font-semibold text-[11px] px-2 py-0.5 rounded ${
                        row.tipo === 'RECEITA'
                          ? 'text-green-700 bg-green-50'
                          : 'text-red-500 bg-red-50'
                      }`}>
                        R$ {fmt(Number(row.valor))}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${
                        row.tipo === 'RECEITA' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                      }`}>
                        {row.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => printRecibo(row, !!row.foto, row.foto)} title="Imprimir recibo"
                          className="p-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-500 hover:text-sky-700 border border-sky-200 transition-all">
                          <Printer className="w-4 h-4" />
                        </button>
                        <button onClick={() => setSelectedRow(row)} title="Visualizar detalhes"
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-500 hover:text-blue-600">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditRow(row)} title="Editar lançamento"
                          className="p-1.5 rounded-lg hover:bg-amber-50 text-slate-400 hover:text-amber-600">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={async () => {
                          setDeleteTarget(row);
                        }} title="Excluir"
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom pagination */}
          <Pagination page={page} totalPages={totalPages} total={sorted.length} pageSize={pageSize} onPage={setPage} />
        </div>
      )}
      </div>

      {/* ── Modals ── */}
      {showRelatorio && (
        <RelatorioModal
          rows={rows}
          churchName={selectedChurch?.name || 'Todas as Igrejas'}
          dataInicio={dataInicio}
          dataFim={dataFim}
          onClose={() => setShowRelatorio(false)}
        />
      )}

      {churchPickerOpen && (
        <ChurchPickerModal
          onClose={() => setChurchPickerOpen(false)}
          onSelect={church => { setSelectedChurch(church); setChurchPickerOpen(false); }}
        />
      )}

      {selectedRow && (
        <ReciboModal
          row={selectedRow}
          onClose={() => setSelectedRow(null)}
          onUpdated={handleRowUpdated}
        />
      )}

      {editRow && (
        <EditDrawer
          row={editRow}
          onClose={() => setEditRow(null)}
          onSaved={(id, changes) => {
            handleRowUpdated(id, changes);
            setEditRow(null);
          }}
        />
      )}

      {/* ── Modal de confirmação de exclusão ─────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { if (!deleting) setDeleteTarget(null); }} />
          <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center gap-3 px-6 pt-6 pb-4">
              <div className="w-11 h-11 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white text-sm">Excluir lançamento?</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            {deleteTarget.favorecido && (
              <div className="px-6 pb-4">
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-medium">{deleteTarget.favorecido}</span>
                  {deleteTarget.valor && <span className="ml-2 text-slate-400">R$ {Number(deleteTarget.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>}
                </div>
              </div>
            )}
            {deleteError && (
              <p className="px-6 pb-3 text-xs text-red-500">{deleteError}</p>
            )}
            <div className="flex gap-2 px-6 pb-6">
              <button
                onClick={() => { setDeleteTarget(null); setDeleteError(''); }}
                disabled={deleting}
                className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  setDeleting(true);
                  setDeleteError('');
                  const { error: delErr } = await supabase.from('livro_caixa').delete().eq('id', deleteTarget.id);
                  setDeleting(false);
                  if (delErr) { setDeleteError('Erro: ' + delErr.message); return; }
                  setRows(prev => prev.filter(r => r.id !== deleteTarget.id));
                  setDeleteTarget(null);
                }}
                disabled={deleting}
                className="flex-1 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
