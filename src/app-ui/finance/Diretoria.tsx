'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router';
import {
  TrendingUp, TrendingDown, DollarSign, Wallet, Calendar, ArrowUpRight,
  ArrowDownRight, AlertTriangle, CheckCircle2, Printer, RefreshCw,
  FileSpreadsheet, Search, Building2, Users, Landmark, FileText, Check, X,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Percent, Info, Lightbulb, UserCheck, Award, ArrowUpDown, Bot, Send, Sparkles, Trash2, Plus, ArrowRight, MessageSquare, User
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, Tooltip, Legend, XAxis, YAxis, CartesianGrid, LineChart, Line
} from 'recharts';
import { supabase } from '../../lib/supabaseClient';
import { apiBase } from '../../lib/apiBase';
import { usePermissions } from '../../lib/usePermissions';
import { buildDizimistasReport, type DizimistasReport, type DizimistasEntry, type DizimistasScopeMember } from '../spreadsheet/dizimistasAnalysis';
import { ConfirmDialog } from '../../components/app-ui/shared/ConfirmDialog';

// ─── Formatting helpers ──────────────────────────────────────────────────────
function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
}
function shortBrl(v: number) {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}K`;
  return brl(v);
}
function defaultStartDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function defaultEndDate() {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
}

const GREEN = '#10b981';
const RED = '#f43f5e';
const BLUE = '#3b82f6';
const AMBER = '#f59e0b';
const PURPLE = '#8b5cf6';
const TEAL = '#14b8a6';
const CHART_PALETTE = [GREEN, BLUE, AMBER, PURPLE, TEAL, '#ec4899', '#f97316', '#06b6d4', '#84cc16', '#a855f7'];
const CHART_PALETTE_RED = [RED, '#f97316', AMBER, PURPLE, '#ec4899', TEAL, '#06b6d4', '#84cc16', '#3b82f6', '#a855f7'];

// ─── KPI Component ────────────────────────────────────────────────────────────
function KpiCard({ title, value, subtitle, icon: Icon, colorClass, loading, trend }: {
  title: string; value: string; subtitle?: string; icon: any; colorClass: string; loading?: boolean;
  trend?: { val: number; label: string; good: boolean } | null;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{title}</span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colorClass}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      </div>
      <div className="mt-3">
        {loading ? (
          <div className="h-8 bg-slate-100 dark:bg-slate-800 rounded animate-pulse w-3/4" />
        ) : (
          <p className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">{value}</p>
        )}
      </div>
      {subtitle && (
        <div className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          {trend && (
            <span className={`inline-flex items-center gap-0.5 font-bold rounded-full px-1.5 py-0.5 text-[10px] ${
              trend.good ? 'bg-green-50 text-green-700 dark:bg-green-900/10 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/10 dark:text-red-400'
            }`}>
              {trend.val >= 0 ? '+' : ''}{trend.val.toFixed(0)}%
            </span>
          )}
          <span className="truncate">{subtitle}</span>
        </div>
      )}
    </div>
  );
}

// ─── MultiSelect Component ───────────────────────────────────────────────────
function MultiSelect({ label, options, selected, onChange, disabled, placeholder }: {
  label: string;
  options: Array<{ id: string; name: string }>;
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
  placeholder: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const norm = search.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return options.filter(o => 
      o.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(norm)
    );
  }, [options, search]);

  const handleSelectOption = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter(item => item !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const buttonText = useMemo(() => {
    if (selected.length === 0) return 'Nenhum selecionado';
    if (selected.length === options.length) return `Todos (${options.length})`;
    if (selected.length === 1) {
      const match = options.find(o => o.id === selected[0]);
      return match ? match.name : `${selected.length} selecionado(s)`;
    }
    return `${selected.length} selecionados`;
  }, [selected, options]);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-10 px-3.5 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 dark:bg-slate-800 dark:text-white bg-white flex items-center justify-between transition-all disabled:opacity-50 text-left cursor-pointer"
      >
        <span className="truncate pr-2 text-slate-700 dark:text-slate-200">{buttonText}</span>
        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg p-2.5 space-y-2 max-h-72 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between text-[11px] border-b border-slate-100 dark:border-slate-800/80 pb-2">
            <button
              type="button"
              onClick={() => onChange(options.map(o => o.id))}
              className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
            >
              Selecionar Todos
            </button>
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-slate-500 dark:text-slate-400 font-bold hover:underline"
            >
              Desmarcar Todos
            </button>
          </div>

          {options.length > 5 && (
            <div className="relative shrink-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full h-8 pl-8 pr-2.5 border border-slate-100 dark:border-slate-800/80 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-slate-400 dark:bg-slate-800 dark:text-white"
              />
            </div>
          )}

          <div className="flex-1 overflow-y-auto min-h-0 space-y-1 pr-1">
            {filteredOptions.length === 0 ? (
              <div className="text-xs text-slate-400 text-center py-4">Sem resultados</div>
            ) : (
              filteredOptions.map(o => {
                const isChecked = selected.includes(o.id);
                return (
                  <label
                    key={o.id}
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer text-xs text-slate-700 dark:text-slate-200 font-medium select-none"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleSelectOption(o.id)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                    />
                    <span className="truncate">{o.name}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Date Range Preset Picker ────────────────────────────────────────────────
type PresetKey = 'hoje' | 'ontem' | 'semana' | 'mes' | 'mes_anterior' | 'ultimos_3' | 'ultimos_6' | 'ano' | 'custom';

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getPresetRange(key: PresetKey): { start: string; end: string } | null {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth(), day = now.getDate();
  switch (key) {
    case 'hoje': return { start: toYMD(now), end: toYMD(now) };
    case 'ontem': { const d = new Date(y, m, day - 1); return { start: toYMD(d), end: toYMD(d) }; }
    case 'semana': {
      const dow = now.getDay() === 0 ? 6 : now.getDay() - 1;
      const mon = new Date(y, m, day - dow);
      const sun = new Date(y, m, day + (6 - dow));
      return { start: toYMD(mon), end: toYMD(sun) };
    }
    case 'mes': return { start: toYMD(new Date(y, m, 1)), end: toYMD(new Date(y, m + 1, 0)) };
    case 'mes_anterior': return { start: toYMD(new Date(y, m - 1, 1)), end: toYMD(new Date(y, m, 0)) };
    case 'ultimos_3': return { start: toYMD(new Date(y, m - 2, 1)), end: toYMD(new Date(y, m + 1, 0)) };
    case 'ultimos_6': return { start: toYMD(new Date(y, m - 5, 1)), end: toYMD(new Date(y, m + 1, 0)) };
    case 'ano': return { start: toYMD(new Date(y, 0, 1)), end: toYMD(new Date(y, 11, 31)) };
    default: return null;
  }
}

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'hoje', label: 'Hoje' },
  { key: 'ontem', label: 'Ontem' },
  { key: 'semana', label: 'Esta Semana' },
  { key: 'mes', label: 'Este Mês' },
  { key: 'mes_anterior', label: 'Mês Anterior' },
  { key: 'ultimos_3', label: 'Últimos 3 Meses' },
  { key: 'ultimos_6', label: 'Últimos 6 Meses' },
  { key: 'ano', label: 'Este Ano' },
  { key: 'custom', label: 'Personalizado' },
];

function detectPreset(start: string, end: string): PresetKey {
  for (const p of PRESETS) {
    if (p.key === 'custom') continue;
    const r = getPresetRange(p.key);
    if (r && r.start === start && r.end === end) return p.key;
  }
  return 'custom';
}

function formatDatePtBr(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function DateRangePresetPicker({ startDate, endDate, onChange }: {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const activePreset = detectPreset(startDate, endDate);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  function selectPreset(key: PresetKey) {
    if (key === 'custom') { setOpen(false); return; }
    const r = getPresetRange(key)!;
    onChange(r.start, r.end);
    setOpen(false);
  }

  const label = activePreset !== 'custom'
    ? PRESETS.find(p => p.key === activePreset)!.label
    : `${formatDatePtBr(startDate)} – ${formatDatePtBr(endDate)}`;

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full h-10 px-3.5 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 dark:bg-slate-800 dark:text-white bg-white flex items-center justify-between transition-all cursor-pointer"
      >
        <span className="flex items-center gap-2 truncate text-slate-700 dark:text-slate-200">
          <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
          <span className="truncate">{label}</span>
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
      </button>

      {open && (
        <div className="absolute z-50 left-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg overflow-hidden min-w-[220px]">
          {/* Personalizado no topo */}
          <div className="p-2.5 space-y-1.5 border-b border-slate-100 dark:border-slate-800">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Personalizado</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="date"
                  value={startDate}
                  onChange={e => onChange(e.target.value, endDate)}
                  className="w-full h-8 pl-7 pr-1 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-400 dark:bg-slate-800 dark:text-white text-slate-700"
                  style={{ colorScheme: 'light' }}
                />
              </div>
              <div className="relative flex-1">
                <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="date"
                  value={endDate}
                  onChange={e => onChange(startDate, e.target.value)}
                  className="w-full h-8 pl-7 pr-1 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-400 dark:bg-slate-800 dark:text-white text-slate-700"
                  style={{ colorScheme: 'light' }}
                />
              </div>
            </div>
          </div>
          {/* Presets abaixo */}
          <div className="p-1.5">
            {PRESETS.filter(p => p.key !== 'custom').map(p => (
              <button
                key={p.key}
                type="button"
                onClick={() => selectPreset(p.key)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  activePreset === p.key
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Custom tooltip for Cult comparison
const CultoTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const formatBrl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 p-2.5 rounded-xl shadow-md text-xs space-y-1">
        <p className="font-bold text-slate-700 dark:text-slate-300">{data.name}</p>
        <p className="text-indigo-600 dark:text-indigo-400 font-medium">Domingo ({data.domLabel}): <strong className="font-mono">{formatBrl(data.Domingo)}</strong></p>
        <p className="text-teal-600 dark:text-teal-400 font-medium">Quarta ({data.quaLabel}): <strong className="font-mono">{formatBrl(data.Quarta)}</strong></p>
      </div>
    );
  }
  return null;
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Diretoria() {
  const [tab, setTab] = useState<'campo' | 'dizimistas'>('campo');
  
  // Dates
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);

  // Context Switcher & user profile metadata
  const [storedUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mrm_user') || '{}'); } catch { return {}; }
  });
  const profileType: string = storedUser.profileType || 'church';
  const isChurchProfile = profileType === 'church';
  const isRegionalProfile = profileType === 'regional';
  const { canCreate: canExportExecutive } = usePermissions(profileType);

  // Filters Options
  const [regionais, setRegionais] = useState<Array<{ id: string; name: string }>>([]);
  const [igrejas, setIgrejas] = useState<Array<{ id: string; name: string; regionalId: string }>>([]);
  const [selectedRegionalIds, setSelectedRegionalIds] = useState<string[]>([]);
  const [selectedChurchIds, setSelectedChurchIds] = useState<string[]>([]);

  // Tither-specific filters
  const [selectedCargos, setSelectedCargos] = useState<string[]>([]);
  const [selectedSituacao, setSelectedSituacao] = useState<'todos' | 'todos_os_meses' | 'inconstante' | 'dizimistas' | 'nao_dizimistas'>('todos');
  const [dizimistasSearch, setDizimistasSearch] = useState('');
  const [titles, setTitles] = useState<Array<{ id: string; name: string }>>([]);



  // Data Loading States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dizimistasNotice, setDizimistasNotice] = useState('');

  // Loaded Transactions (for dashboard calculation)
  const [entries, setEntries] = useState<any[]>([]);
  const [prevEntries, setPrevEntries] = useState<any[]>([]);
  const [plannedExpenses, setPlannedExpenses] = useState<number>(0);
  const [allChurches, setAllChurches] = useState<any[]>([]);

  // Tithers report data
  const [dizimistasReport, setDizimistasReport] = useState<DizimistasReport | null>(null);
  const [titherEntries, setTitherEntries] = useState<DizimistasEntry[]>([]);

  // Load basic regionals & churches & titles
  useEffect(() => {
    async function loadSelectors() {
      try {
        let rQuery = supabase.from('regionais').select('id, name').is('deleted_at', null).order('name');
        if (isRegionalProfile && storedUser.regionalId) {
          rQuery = rQuery.eq('id', storedUser.regionalId);
        } else if (storedUser.campoId) {
          rQuery = rQuery.eq('campo_id', storedUser.campoId);
        }
        const { data: regData } = await rQuery;
        const regionaisList = regData || [];
        setRegionais(regionaisList);

        let cQuery = supabase.from('churches').select('id, name, regional_id').is('deleted_at', null).order('name');
        if (isChurchProfile && storedUser.churchId) {
          cQuery = cQuery.eq('id', storedUser.churchId);
        } else if (isRegionalProfile && storedUser.regionalId) {
          cQuery = cQuery.eq('regional_id', storedUser.regionalId);
        } else if (regionaisList.length > 0) {
          // Filter churches to only those belonging to the loaded regionais (scoped by campo)
          cQuery = cQuery.in('regional_id', regionaisList.map((r: any) => r.id));
        }
        const { data: chData } = await cQuery;
        const formattedChurches = (chData || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          regionalId: c.regional_id
        }));
        setIgrejas(formattedChurches);
        setAllChurches(formattedChurches);

        // Filtro padrão: Apenas a igreja logada do usuário para evitar sobrecarga de rede/carregamento pesado
        if (storedUser.churchId) {
          setSelectedChurchIds([storedUser.churchId]);
          const matchedChurch = formattedChurches.find(c => c.id === storedUser.churchId);
          if (matchedChurch) {
            setSelectedRegionalIds([matchedChurch.regionalId]);
          } else if (storedUser.regionalId) {
            setSelectedRegionalIds([storedUser.regionalId]);
          } else {
            setSelectedRegionalIds(regionaisList.map((r: any) => r.id));
          }
        } else {
          setSelectedRegionalIds(regionaisList.map((r: any) => r.id));
          setSelectedChurchIds(formattedChurches.map(c => c.id));
        }

        const token = localStorage.getItem('mrm_token') || '';
        const titlesRes = await fetch(`${apiBase}/ecclesiastical-titles`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (titlesRes.ok) {
          const titlesPayload = await titlesRes.json();
          setTitles((titlesPayload || []).map((t: any) => ({ id: String(t.id ?? t.name), name: String(t.name) })));
        }
      } catch (err) {
        console.error('Error loading selectors:', err);
      }
    }
    loadSelectors();
  }, [isChurchProfile, isRegionalProfile, storedUser.churchId, storedUser.regionalId, storedUser.campoId]);

  const handleRegionalChange = useCallback((newRegs: string[]) => {
    setSelectedRegionalIds(newRegs);
    const newFiltered = newRegs.length === 0
      ? allChurches
      : allChurches.filter(c => newRegs.includes(c.regionalId));
    setSelectedChurchIds(newFiltered.map(c => c.id));
  }, [allChurches]);

  // Load/re-load dashboard & tither data when date range or scope filters change
  const handleFetch = useCallback(async () => {
    setLoading(true);
    setError('');
    setDizimistasNotice('');
    try {
      const token = localStorage.getItem('mrm_token') || '';

      // Determine scoped church IDs
      let churchIds: string[] = [];
      if (selectedChurchIds.length > 0) {
        churchIds = selectedChurchIds;
      } else if (selectedRegionalIds.length > 0) {
        churchIds = igrejas.filter(c => selectedRegionalIds.includes(c.regionalId)).map(c => c.id);
      } else {
        churchIds = [];
      }

      if (!churchIds.length) {
        setEntries([]);
        setPrevEntries([]);
        setLoading(false);
        return;
      }

      // 1. Fetch current period finance entries from livro_caixa
      let fQuery = supabase
        .from('livro_caixa')
        .select('id, data_lancamento, tipo, valor, plano_de_conta, categoria, forma_pg, centro_de_custo, favorecido, church_id')
        .gte('data_lancamento', startDate)
        .lte('data_lancamento', endDate)
        .is('deleted_at', null);

      if (churchIds.length > 0) {
        fQuery = fQuery.in('church_id', churchIds);
      }
      const { data: curData, error: fErr } = await fQuery;
      if (fErr) throw fErr;
      setEntries(curData || []);

      // 2. Fetch previous period finance entries to calculate variance
      const start = new Date(startDate + 'T12:00:00');
      const end = new Date(endDate + 'T12:00:00');
      const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      const prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - diffDays);
      const prevEnd = new Date(start);
      prevEnd.setDate(prevEnd.getDate() - 1);
      
      const pStartStr = prevStart.toISOString().split('T')[0];
      const pEndStr = prevEnd.toISOString().split('T')[0];

      let prevQuery = supabase
        .from('livro_caixa')
        .select('tipo, valor, data_lancamento')
        .gte('data_lancamento', pStartStr)
        .lte('data_lancamento', pEndStr)
        .is('deleted_at', null);

      if (churchIds.length > 0) {
        prevQuery = prevQuery.in('church_id', churchIds);
      }
      const { data: pData } = await prevQuery;
      setPrevEntries(pData || []);

      // 3. Fetch future scheduled entries (planned expenses)
      const todayStr = new Date().toISOString().split('T')[0];
      let futQuery = supabase
        .from('livro_caixa')
        .select('valor')
        .gt('data_lancamento', endDate > todayStr ? endDate : todayStr)
        .eq('tipo', 'DESPESA')
        .is('deleted_at', null);

      if (churchIds.length > 0) {
        futQuery = futQuery.in('church_id', churchIds);
      }
      const { data: futData } = await futQuery;
      const futureSum = (futData || []).reduce((acc, row) => acc + Number(row.valor || 0), 0);
      setPlannedExpenses(futureSum);

      // 4. Fetch Tithers entries from API reports
      const titRes = await fetch(`${apiBase}/reports/dizimistas/entries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          startDate,
          endDate,
          churchIds,
          regionalIds: selectedRegionalIds.length > 0 ? selectedRegionalIds : undefined,
          titleIds: selectedCargos.length > 0 ? selectedCargos : undefined,
        }),
      });

      if (titRes.ok) {
        const payload = await titRes.json();
        const rawTithers = (payload.entries || []).map((row: any) => ({ ...row, valor: Number(row.valor || 0) }));
        setTitherEntries(rawTithers);

        // Fetch non-tithing members if needed
        let nonTithers: DizimistasScopeMember[] = [];
        if (selectedSituacao === 'nao_dizimistas') {
          const titherIds = new Set(rawTithers.map((e: any) => e.memberId));
          // Busca TODOS os membros do escopo paginando. Não usar &limit= aqui: a rota de
          // membros corta o limit em 500, o que truncava a lista de não-dizimistas em
          // igrejas/campos grandes. O caminho paginado aceita pageSize até 5000 e retorna total.
          const mData: any[] = [];
          const FETCH_PAGE_SIZE = 5000;
          let memberPage = 1;
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const resp = await fetch(`${apiBase}/members?churchIds=${encodeURIComponent(churchIds.join(','))}&pageSize=${FETCH_PAGE_SIZE}&page=${memberPage}`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (!resp.ok) break;
            const mRaw = await resp.json();
            const pageData: any[] = Array.isArray(mRaw) ? mRaw : (Array.isArray(mRaw?.data) ? mRaw.data : []);
            mData.push(...pageData);
            const total = typeof mRaw?.total === 'number' ? mRaw.total : pageData.length;
            if (pageData.length < FETCH_PAGE_SIZE || mData.length >= total) break;
            memberPage++;
          }
          {
            const selectedTitleNames = selectedCargos.length > 0
              ? new Set(selectedCargos.map(id => titles.find(t => t.id === id)?.name?.toUpperCase()).filter(Boolean) as string[])
              : null;

            for (const m of mData) {
              if (!titherIds.has(m.id)) {
                const memberTitle = (m.ecclesiasticalTitleRef?.name ?? m.ecclesiasticalTitle ?? '').toUpperCase().trim();
                // Skip PJ/PF: only include members with a valid ecclesiastical title
                if (!memberTitle) continue;
                if (selectedTitleNames && selectedTitleNames.size > 0 && !selectedTitleNames.has(memberTitle)) continue;
                const reg = regionais.find(r => r.id === m.church?.regional?.id || r.id === m.church?.regional_id);
                nonTithers.push({
                  memberId: m.id,
                  memberName: m.fullName,
                  ecclesiasticalTitle: m.ecclesiasticalTitleRef?.name ?? m.ecclesiasticalTitle ?? '',
                  rol: m.rol ?? null,
                  churchId: m.church?.id ?? '',
                  churchName: m.church?.name ?? '',
                  regionalId: m.church?.regional?.id ?? m.church?.regional_id ?? '',
                  regionalName: reg?.name ?? m.church?.regional?.name ?? '',
                });
              }
            }
          }
        }

        // Build reports
        const filtersForReport = {
          startDate,
          endDate,
          regionalIds: selectedRegionalIds,
          regionalLabels: selectedRegionalIds.map(id => regionais.find(r => r.id === id)?.name || ''),
          churchIds: selectedChurchIds,
          churchLabels: selectedChurchIds.map(id => igrejas.find(c => c.id === id)?.name || ''),
          titleIds: selectedCargos,
          titleLabels: selectedCargos.map(id => titles.find(t => t.id === id)?.name || ''),
        };

        let processedTithers = rawTithers;
        if (selectedSituacao !== 'todos' && selectedSituacao !== 'nao_dizimistas') {
          // Calculate months in period
          const periodStart = new Date(startDate + 'T00:00:00');
          const periodEnd = new Date(endDate + 'T00:00:00');
          const monthKeys = new Set<string>();
          for (let d = new Date(periodStart.getFullYear(), periodStart.getMonth(), 1); d <= periodEnd; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
            monthKeys.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
          }
          const totalMonths = monthKeys.size;
          
          const memberMonths = new Map<string, Set<string>>();
          for (const e of rawTithers) {
            const mk = e.dataLancamento.slice(0, 7);
            if (!memberMonths.has(e.memberId)) memberMonths.set(e.memberId, new Set());
            memberMonths.get(e.memberId)!.add(mk);
          }

          const okMembers = new Set<string>();
          for (const [memberId, months] of memberMonths) {
            const n = months.size;
            if (selectedSituacao === 'todos_os_meses' && n >= totalMonths) okMembers.add(memberId);
            if (selectedSituacao === 'inconstante' && n > 0 && n < totalMonths) okMembers.add(memberId);
            if (selectedSituacao === 'dizimistas' && n >= 1) okMembers.add(memberId);
          }
          processedTithers = rawTithers.filter((e: any) => okMembers.has(e.memberId));
        }

        const rep = buildDizimistasReport(
          selectedSituacao === 'nao_dizimistas' ? [] : processedTithers, 
          filtersForReport, 
          nonTithers
        );
        setDizimistasReport(rep);
        const count = selectedSituacao === 'nao_dizimistas' 
          ? nonTithers.length 
          : rep.sections.reduce((s, sec) => s + sec.churches.reduce((cs, c) => cs + c.members.length, 0), 0);
        setDizimistasNotice(`Exibindo ${count} registro(s) eclesiásticos no período.`);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados do painel.');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedRegionalIds, selectedChurchIds, selectedCargos, selectedSituacao, igrejas, regionais, titles]);

  useEffect(() => {
    if (igrejas.length > 0) {
      void handleFetch();
    }
  }, [selectedRegionalIds, selectedChurchIds, startDate, endDate, selectedCargos, selectedSituacao, igrejas.length]);

  // ─── Dashboard Aggregated States (Tab 1) ────────────────────────────────────
  const stats = useMemo(() => {
    const totalReceita = entries.filter(r => r.tipo === 'RECEITA').reduce((s, r) => s + Number(r.valor), 0);
    const totalDespesa = entries.filter(r => r.tipo === 'DESPESA').reduce((s, r) => s + Number(r.valor), 0);
    const saldoAtual = totalReceita - totalDespesa;
    const totalDizimos = entries.filter(r => r.tipo === 'RECEITA' && (r.plano_de_conta || '').toLowerCase().includes('dizimo')).reduce((s, r) => s + Number(r.valor), 0);
    const totalOfertas = entries.filter(r => r.tipo === 'RECEITA' && (r.plano_de_conta || '').toLowerCase().includes('oferta')).reduce((s, r) => s + Number(r.valor), 0);

    // Prior values
    const prevReceita = prevEntries.filter(r => r.tipo === 'RECEITA').reduce((s, r) => s + Number(r.valor), 0);
    const prevDespesa = prevEntries.filter(r => r.tipo === 'DESPESA').reduce((s, r) => s + Number(r.valor), 0);

    const growthRec = prevReceita > 0 ? ((totalReceita - prevReceita) / prevReceita) * 100 : null;
    const growthDesp = prevDespesa > 0 ? ((totalDespesa - prevDespesa) / prevDespesa) * 100 : null;

    // Averages
    const start = new Date(startDate + 'T12:00:00');
    const end = new Date(endDate + 'T12:00:00');
    const diffDays = Math.max(1, Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    const diffMonths = Math.max(1, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1);

    const mediaMensalReceita = totalReceita / diffMonths;
    const mediaMensalDespesa = totalDespesa / diffMonths;
    const mediaDiariaReceita = totalReceita / diffDays;

    const dizimosCount = entries.filter(r => r.tipo === 'RECEITA' && (r.plano_de_conta || '').toLowerCase().includes('dizimo')).length;
    const ofertasCount = entries.filter(r => r.tipo === 'RECEITA' && (r.plano_de_conta || '').toLowerCase().includes('oferta')).length;
    
    const ticketDizimos = dizimosCount > 0 ? totalDizimos / dizimosCount : 0;
    const ticketOfertas = ofertasCount > 0 ? totalOfertas / ofertasCount : 0;

    // Largest values
    const itemMaxReceita = [...entries].filter(r => r.tipo === 'RECEITA').sort((a, b) => Number(b.valor) - Number(a.valor))[0];
    const itemMaxDespesa = [...entries].filter(r => r.tipo === 'DESPESA').sort((a, b) => Number(b.valor) - Number(a.valor))[0];

    // Dates with max revenue
    const dailyMap: Record<string, number> = {};
    entries.filter(r => r.tipo === 'RECEITA').forEach(r => {
      dailyMap[r.data_lancamento] = (dailyMap[r.data_lancamento] || 0) + Number(r.valor);
    });
    const topDays = Object.entries(dailyMap)
      .map(([date, val]) => ({ date: new Date(date + 'T12:00:00').toLocaleDateString('pt-BR'), val }))
      .sort((a, b) => b.val - a.val)
      .slice(0, 3);

    return {
      totalReceita,
      totalDespesa,
      saldoAtual,
      totalDizimos,
      totalOfertas,
      growthRec,
      growthDesp,
      mediaMensalReceita,
      mediaMensalDespesa,
      mediaDiariaReceita,
      ticketDizimos,
      ticketOfertas,
      maiorReceita: itemMaxReceita ? { valor: Number(itemMaxReceita.valor), data: new Date(itemMaxReceita.data_lancamento + 'T12:00:00').toLocaleDateString('pt-BR'), desc: itemMaxReceita.favorecido || itemMaxReceita.plano_de_conta } : null,
      maiorDespesa: itemMaxDespesa ? { valor: Number(itemMaxDespesa.valor), data: new Date(itemMaxDespesa.data_lancamento + 'T12:00:00').toLocaleDateString('pt-BR'), desc: itemMaxDespesa.favorecido || itemMaxDespesa.plano_de_conta } : null,
      topDays
    };
  }, [entries, prevEntries, startDate, endDate]);

  // Dynamic analysis notes
  const intelligentAnalysis = useMemo(() => {
    const notes: string[] = [];
    if (stats.totalReceita === 0) return ["Nenhum dado financeiro disponível no período para gerar análises."];
    
    // Revenue variance vs prior month
    if (stats.growthRec !== null) {
      if (stats.growthRec > 0) {
        notes.push(`A igreja está com tendência de crescimento nas receitas: aumento de ${stats.growthRec.toFixed(1)}% em relação ao mês anterior.`);
      } else {
        notes.push(`Este mês a receita está ${Math.abs(stats.growthRec).toFixed(1)}% menor que o período anterior.`);
      }
    }

    // Expense ratio
    const expenseRatio = (stats.totalDespesa / stats.totalReceita) * 100;
    if (expenseRatio > 90) {
      notes.push(`Existe risco de déficit se as despesas operacionais continuarem altas (${expenseRatio.toFixed(0)}% da arrecadação).`);
    } else {
      notes.push(`Margem operacional saudável de ${(100 - expenseRatio).toFixed(0)}% das receitas retidas como superávit.`);
    }

    // Cash reserve cover
    if (stats.mediaMensalDespesa > 0) {
      const cover = stats.saldoAtual / stats.mediaMensalDespesa;
      if (cover > 0) {
        notes.push(`O superávit acumulado cobre aproximadamente ${cover.toFixed(1)} meses de despesas médias.`);
      }
    }

    // Specific category checks (e.g. maintenance)
    const maintSum = entries.filter(r => r.tipo === 'DESPESA' && (r.plano_de_conta || '').toLowerCase().includes('manutenção')).reduce((s, r) => s + Number(r.valor), 0);
    if (maintSum > 0 && stats.totalDespesa > 0) {
      const pct = (maintSum / stats.totalDespesa) * 100;
      if (pct > 15) {
        notes.push(`Custos com Manutenção representam ${pct.toFixed(0)}% das despesas totais (${brl(maintSum)}). Sugere-se auditoria preventiva.`);
      }
    }

    return notes;
  }, [stats, entries]);

  // Attention / Alerts Box
  const alerts = useMemo(() => {
    const list: Array<{ type: 'danger' | 'warning' | 'info'; text: string; sub?: string }> = [];

    // Negative balances in churches
    const churchBalances: Record<string, { name: string; bal: number }> = {};
    entries.forEach(r => {
      const chId = r.church_id;
      const chName = r.churches?.name || 'Igreja';
      const chVal = Number(r.valor);
      if (!churchBalances[chId]) churchBalances[chId] = { name: chName, bal: 0 };
      if (r.tipo === 'RECEITA') churchBalances[chId].bal += chVal;
      else churchBalances[chId].bal -= chVal;
    });

    Object.values(churchBalances).forEach(ch => {
      if (ch.bal < 0) {
        list.push({ type: 'danger', text: `Congregação com saldo negativo: ${ch.name}`, sub: `Déficit de ${brl(Math.abs(ch.bal))} acumulado no período.` });
      }
    });

    // Entries with missing fields
    const noFavorecido = entries.filter(r => r.tipo === 'DESPESA' && !r.favorecido?.trim()).length;
    if (noFavorecido > 0) {
      list.push({ type: 'warning', text: `Lançamentos sem favorecido registrado`, sub: `${noFavorecido} saídas possuem campo destinatário em branco.` });
    }

    const noCostCenter = entries.filter(r => !r.centro_de_custo?.trim()).length;
    if (noCostCenter > 0) {
      list.push({ type: 'warning', text: `Lançamentos sem centro de custo`, sub: `${noCostCenter} lançamentos não possuem centro de custo definido.` });
    }

    // High expense variance
    if (stats.growthDesp !== null && stats.growthDesp > 30) {
      list.push({ type: 'danger', text: `Aumento incomum nas despesas operacionais`, sub: `As despesas subiram ${stats.growthDesp.toFixed(1)}% vs o período anterior.` });
    }

    if (list.length === 0) {
      list.push({ type: 'info', text: `Nenhum alerta crítico ativo`, sub: `Toda a movimentação contábil do campo está operando nos limites ideais.` });
    }

    return list;
  }, [entries, stats]);

  // Projections calculations
  const forecasts = useMemo(() => {
    // Basic projection based on current month stats
    const rec = stats.totalReceita;
    const desp = stats.totalDespesa;

    return [
      { period: 'Próximo mês', rec: rec, desp: desp, net: rec - desp },
      { period: '3 meses', rec: rec * 3, desp: desp * 3, net: (rec - desp) * 3 },
      { period: '6 meses', rec: rec * 6, desp: desp * 6, net: (rec - desp) * 6 },
    ];
  }, [stats]);

  // Cult comparison calculations (Sundays vs Wednesdays)
  const cultoComparisonData = useMemo(() => {
    const dailyRevenue: Record<string, number> = {};
    
    // Sum revenues by date
    entries.forEach(r => {
      if (r.tipo === 'RECEITA') {
        const dateStr = r.data_lancamento;
        dailyRevenue[dateStr] = (dailyRevenue[dateStr] || 0) + Number(r.valor);
      }
    });

    // Generate all dates in period
    const start = new Date(startDate + 'T12:00:00');
    const end = new Date(endDate + 'T12:00:00');
    const sundays: Array<{ date: string; label: string; valor: number; rawDate: Date }> = [];
    const wednesdays: Array<{ date: string; label: string; valor: number; rawDate: Date }> = [];

    const curr = new Date(start);
    while (curr <= end) {
      const dayOfWeek = curr.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 3) {
        const yyyy = curr.getFullYear();
        const mm = String(curr.getMonth() + 1).padStart(2, '0');
        const dd = String(curr.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        const val = dailyRevenue[dateStr] || 0;
        
        const formattedLabel = `${dd}/${mm}`;
        const item = {
          date: dateStr,
          label: formattedLabel,
          valor: val,
          rawDate: new Date(curr)
        };

        if (dayOfWeek === 0) sundays.push(item);
        else wednesdays.push(item);
      }
      curr.setDate(curr.getDate() + 1);
    }

    // Sort desc to get latest, then take up to 4, then sort asc for chronological chart presentation
    const latestSundays = sundays.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime()).slice(0, 4).reverse();
    const latestWednesdays = wednesdays.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime()).slice(0, 4).reverse();

    const chartData: Array<{ name: string; Domingo: number; Quarta: number; domLabel: string; quaLabel: string }> = [];
    const maxLen = Math.max(latestSundays.length, latestWednesdays.length);
    for (let i = 0; i < maxLen; i++) {
      const sunItem = latestSundays[i];
      const wedItem = latestWednesdays[i];
      chartData.push({
        name: `Semana ${i + 1}`,
        Domingo: sunItem ? sunItem.valor : 0,
        Quarta: wedItem ? wedItem.valor : 0,
        domLabel: sunItem ? sunItem.label : '—',
        quaLabel: wedItem ? wedItem.label : '—'
      });
    }

    return {
      chartData
    };
  }, [entries, startDate, endDate]);

  // Chart 1: Income x Expense
  const evolutionChartData = useMemo(() => {
    const map: Record<string, { name: string; receitas: number; despesas: number }> = {};
    
    // Fill months
    const start = new Date(startDate + 'T12:00:00');
    const end = new Date(endDate + 'T12:00:00');
    let curr = new Date(start);
    while (curr <= end) {
      const key = `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}`;
      if (!map[key]) {
        const shortMonth = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(curr).replace('.', '');
        const label = `${shortMonth}/${String(curr.getFullYear()).slice(-2)}`;
        map[key] = { name: label, receitas: 0, despesas: 0 };
      }
      curr.setMonth(curr.getMonth() + 1);
    }

    entries.forEach(r => {
      const key = r.data_lancamento.slice(0, 7);
      if (map[key]) {
        if (r.tipo === 'RECEITA') map[key].receitas += Number(r.valor);
        else map[key].despesas += Number(r.valor);
      }
    });

    return Object.values(map);
  }, [entries, startDate, endDate]);

  // Chart 2: Cumulative Balance
  const cumulativeChartData = useMemo(() => {
    let accum = 0;
    return evolutionChartData.map(item => {
      accum += (item.receitas - item.despesas);
      return {
        name: item.name,
        saldo: accum
      };
    });
  }, [evolutionChartData]);

  // Chart 3 & 4: Categories
  const categoryChartData = useMemo(() => {
    const recMap: Record<string, number> = {};
    const despMap: Record<string, number> = {};

    entries.forEach(r => {
      const cat = r.plano_de_conta || r.categoria || 'Outros';
      const val = Number(r.valor);
      if (r.tipo === 'RECEITA') {
        recMap[cat] = (recMap[cat] || 0) + val;
      } else {
        despMap[cat] = (despMap[cat] || 0) + val;
      }
    });

    const receitas = Object.entries(recMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    const despesas = Object.entries(despMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    return { receitas, despesas };
  }, [entries]);

  // Chart 5: Cost Center
  const costCenterChartData = useMemo(() => {
    const map: Record<string, number> = {};
    entries.filter(r => r.tipo === 'DESPESA').forEach(r => {
      const cc = r.centro_de_custo || 'Sede';
      map[cc] = (map[cc] || 0) + Number(r.valor);
    });
    return Object.entries(map)
      .map(([name, valor]) => ({ name, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 6);
  }, [entries]);

  // Chart 6: Payment Methods
  const paymentChartData = useMemo(() => {
    const map: Record<string, number> = {};
    entries.forEach(r => {
      const pm = r.forma_pg || 'PIX';
      map[pm] = (map[pm] || 0) + Number(r.valor);
    });
    return Object.entries(map)
      .map(([name, valor]) => ({ name, valor }))
      .sort((a, b) => b.valor - a.valor);
  }, [entries]);

  // Chart 7: Ranking of Churches
  const rankingChartData = useMemo(() => {
    const map: Record<string, { name: string; receita: number; despesa: number; saldo: number }> = {};
    const scopedIds = new Set(selectedChurchIds);

    // Populate only selected/scoped churches
    igrejas.filter(c => scopedIds.has(c.id)).forEach(c => {
      map[c.id] = { name: c.name, receita: 0, despesa: 0, saldo: 0 };
    });

    entries.forEach(r => {
      const chId = r.church_id;
      if (map[chId]) {
        if (r.tipo === 'RECEITA') map[chId].receita += Number(r.valor);
        else map[chId].despesa += Number(r.valor);
        map[chId].saldo = map[chId].receita - map[chId].despesa;
      }
    });

    return Object.values(map)
      .sort((a, b) => b.receita - a.receita)
      .filter(ch => ch.receita > 0 || ch.despesa > 0)
      .slice(0, 15);
  }, [entries, igrejas, selectedChurchIds]);

  // ─── Tithers Card Directory mapping (Tab 2) ───────────────────────────────
  const tithersList = useMemo(() => {
    if (!dizimistasReport) return [];
    const flat: Array<{
      memberId: string;
      memberName: string;
      ecclesiasticalTitle: string;
      rol: number | null;
      churchId: string;
      churchName: string;
      regionalId: string;
      regionalName: string;
      monthly: Record<string, number>;
      total: number;
      lastDate?: string;
    }> = [];
    
    for (const r of dizimistasReport.sections) {
      for (const ch of r.churches) {
        for (const m of ch.members) {
          flat.push({
            ...m,
            churchId: ch.churchId,
            churchName: ch.churchName,
            regionalId: r.regionalId,
            regionalName: r.regionalName,
          });
        }
      }
    }

    // Client-side search match
    if (dizimistasSearch.trim()) {
      const searchNorm = dizimistasSearch.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return flat.filter(m => 
        m.memberName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(searchNorm) ||
        String(m.rol || '').includes(searchNorm)
      );
    }
    return flat;
  }, [dizimistasReport, dizimistasSearch]);

  const totalMonthsInPeriod = useMemo(() => {
    if (!dizimistasReport) return 0;
    return dizimistasReport.months.length;
  }, [dizimistasReport]);

  // ─── Export helpers (after tithersList & totalMonthsInPeriod) ────────────────
  const handleExportExcel = useCallback(() => {
    if (!dizimistasReport || tithersList.length === 0) return;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const XLSX = require('xlsx-js-style');

    const monthLabels = dizimistasReport.months.map(m => {
      const [year, month] = m.key.split('-');
      const d = new Date(Number(year), Number(month) - 1, 1);
      return new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(d).replace('.', '') + '/' + year.slice(2);
    });

    const headerStyle = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 },
      fill: { fgColor: { rgb: '334155' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: { bottom: { style: 'thin', color: { rgb: 'CBD5E1' } } },
    };
    const headers = ['ROL', 'Nome', 'Cargo', 'Igreja', 'Situação', 'Com/Total', 'Falta', 'Data Últ.', ...monthLabels];
    const headerRow = headers.map(h => ({ v: h, t: 's', s: headerStyle }));

    const statusColors: Record<string, string> = { 'Fiel': '10B981', 'Inconstante': 'F59E0B', 'Nunca': 'EF4444' };
    const rows = tithersList.map(item => {
      const paidCount = dizimistasReport.months.filter(m => (item.monthly[m.key] ?? 0) > 0).length;
      const totalM = totalMonthsInPeriod;
      const missed = totalM - paidCount;
      let statusLabel = 'Nunca';
      if (paidCount >= totalM && totalM > 0) statusLabel = 'Fiel';
      else if (paidCount > 0) statusLabel = 'Inconstante';
      const statusColor = statusColors[statusLabel] || 'EF4444';
      const nameColor = statusLabel === 'Fiel' ? '10B981' : statusLabel === 'Nunca' ? 'EF4444' : '1E293B';

      const baseStyle = { font: { sz: 9 }, alignment: { vertical: 'center' } };
      const monthCells = dizimistasReport.months.map(m => {
        const paid = (item.monthly[m.key] ?? 0) > 0;
        return {
          v: paid ? '✓' : '✗',
          t: 's',
          s: { ...baseStyle, font: { ...baseStyle.font, bold: true, color: { rgb: paid ? '10B981' : 'EF4444' } }, alignment: { horizontal: 'center', vertical: 'center' } },
        };
      });

      return [
        { v: item.rol ?? '', t: 's', s: { ...baseStyle, font: { ...baseStyle.font, color: { rgb: '94A3B8' } } } },
        { v: item.memberName, t: 's', s: { ...baseStyle, font: { ...baseStyle.font, bold: true, color: { rgb: nameColor } } } },
        { v: item.ecclesiasticalTitle || '—', t: 's', s: baseStyle },
        { v: item.churchName, t: 's', s: baseStyle },
        { v: statusLabel, t: 's', s: { ...baseStyle, font: { ...baseStyle.font, bold: true, color: { rgb: statusColor } } } },
        { v: `${paidCount}/${totalM}`, t: 's', s: { ...baseStyle, alignment: { horizontal: 'center', vertical: 'center' } } },
        { v: missed, t: 'n', s: { ...baseStyle, font: { ...baseStyle.font, bold: true, color: { rgb: missed > 0 ? 'EF4444' : '10B981' } }, alignment: { horizontal: 'center', vertical: 'center' } } },
        { v: item.lastDate ? (() => { const [y, mo, d] = item.lastDate!.split('-'); return `${d}/${mo}/${y}`; })() : '—', t: 's', s: { ...baseStyle, alignment: { horizontal: 'center', vertical: 'center' } } },
        ...monthCells,
      ];
    });

    const ws = XLSX.utils.aoa_to_sheet([headerRow, ...rows]);
    ws['!cols'] = [{ wch: 8 }, { wch: 36 }, { wch: 16 }, { wch: 22 }, { wch: 14 }, { wch: 10 }, { wch: 8 }, { wch: 12 }, ...monthLabels.map(() => ({ wch: 8 }))];
    ws['!rows'] = [{ hpt: 20 }, ...rows.map(() => ({ hpt: 16 }))];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dizimistas');
    XLSX.writeFile(wb, `dizimistas_${startDate}_${endDate}.xlsx`);
  }, [dizimistasReport, tithersList, totalMonthsInPeriod, startDate, endDate]);

  const filteredChurchesList = useMemo(() => {
    if (selectedRegionalIds.length === 0) return igrejas;
    return igrejas.filter(c => selectedRegionalIds.includes(c.regionalId));
  }, [igrejas, selectedRegionalIds]);

  // ─── Table sort & pagination ─────────────────────────────────────────────────
  type SortCol = 'rol' | 'nome' | 'cargo' | 'igreja' | 'situacao' | 'com' | 'falta' | 'data';
  const [sortCol, setSortCol] = useState<SortCol>('nome');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
    setPage(1);
  }

  const statusOrder = (item: typeof tithersList[0]) => {
    const paid = dizimistasReport ? dizimistasReport.months.filter(m => (item.monthly[m.key] ?? 0) > 0).length : 0;
    const total = totalMonthsInPeriod;
    if (paid >= total && total > 0) return 0; // Fiel
    if (paid > 0) return 1; // Inconstante
    return 2; // Nunca
  };

  const sortedList = useMemo(() => {
    const list = [...tithersList];
    const dir = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      switch (sortCol) {
        case 'rol': return dir * ((Number(a.rol) || 0) - (Number(b.rol) || 0));
        case 'nome': return dir * a.memberName.localeCompare(b.memberName, 'pt-BR');
        case 'cargo': return dir * (a.ecclesiasticalTitle || '').localeCompare(b.ecclesiasticalTitle || '', 'pt-BR');
        case 'igreja': return dir * a.churchName.localeCompare(b.churchName, 'pt-BR');
        case 'situacao': return dir * (statusOrder(a) - statusOrder(b));
        case 'com': {
          const pa = dizimistasReport ? dizimistasReport.months.filter(m => (a.monthly[m.key] ?? 0) > 0).length : 0;
          const pb = dizimistasReport ? dizimistasReport.months.filter(m => (b.monthly[m.key] ?? 0) > 0).length : 0;
          return dir * (pa - pb);
        }
        case 'falta': {
          const fa = totalMonthsInPeriod - (dizimistasReport ? dizimistasReport.months.filter(m => (a.monthly[m.key] ?? 0) > 0).length : 0);
          const fb = totalMonthsInPeriod - (dizimistasReport ? dizimistasReport.months.filter(m => (b.monthly[m.key] ?? 0) > 0).length : 0);
          return dir * (fa - fb);
        }
        case 'data': return dir * ((a.lastDate || '').localeCompare(b.lastDate || ''));
        default: return 0;
      }
    });
    return list;
  }, [tithersList, sortCol, sortDir, dizimistasReport, totalMonthsInPeriod]);

  const totalPages = Math.max(1, Math.ceil(sortedList.length / pageSize));
  const pagedList = useMemo(() => sortedList.slice((page - 1) * pageSize, page * pageSize), [sortedList, page, pageSize]);

  const handlePrint = useCallback(() => {
    if (!dizimistasReport || sortedList.length === 0) return;
    const monthLabels = dizimistasReport.months.map(m => {
      const [year, month] = m.key.split('-');
      const d = new Date(Number(year), Number(month) - 1, 1);
      return new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(d).replace('.', '') + '/' + year.slice(2);
    });
    const rows = sortedList.map(item => {
      const paid = dizimistasReport.months.filter(m => (item.monthly[m.key] ?? 0) > 0).length;
      const total = totalMonthsInPeriod;
      const missed = total - paid;
      let status = 'Nunca'; let statusCls = 'badge-red';
      if (paid >= total && total > 0) { status = 'Fiel'; statusCls = 'badge-green'; }
      else if (paid > 0) { status = 'Inconstante'; statusCls = 'badge-amber'; }
      const nameCls = status === 'Fiel' ? 'green' : status === 'Nunca' ? 'red' : '';
      const lastDate = item.lastDate ? (() => { const [y, mo, d] = item.lastDate!.split('-'); return `${d}/${mo}/${y}`; })() : '—';
      const monthCells = dizimistasReport.months.map(m => {
        const p = (item.monthly[m.key] ?? 0) > 0;
        return `<td style="text-align:center;color:${p ? '#10b981' : '#ef4444'};font-weight:bold">${p ? '✓' : '✗'}</td>`;
      }).join('');
      return `<tr>
        <td style="color:#94a3b8;font-family:monospace">${item.rol ?? '—'}</td>
        <td class="${nameCls}" style="font-weight:600">${item.memberName}</td>
        <td style="color:#64748b;font-size:8px">${item.ecclesiasticalTitle || '—'}</td>
        <td style="color:#475569;font-size:8px">${item.churchName}</td>
        <td style="text-align:center"><span class="badge ${statusCls}">${status}</span></td>
        <td style="text-align:center;font-family:monospace;font-weight:bold">${paid}/${total}</td>
        <td style="text-align:center;font-family:monospace;font-weight:bold;color:${missed > 0 ? '#ef4444' : '#10b981'}">${missed}</td>
        <td style="text-align:center;font-family:monospace;font-size:8px">${lastDate}</td>
        ${monthCells}
      </tr>`;
    }).join('');
    const win = window.open('', '_blank', 'width=1400,height=900');
    if (!win) return;
    win.resizeTo(screen.availWidth, screen.availHeight);
    win.moveTo(0, 0);
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Dizimistas — ${startDate} a ${endDate}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 9px; color: #1e293b; background: white; padding: 12px 16px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 2px solid #334155; }
        .header h1 { font-size: 14px; font-weight: bold; color: #0f172a; }
        .header p { font-size: 9px; color: #64748b; margin-top: 2px; }
        .meta { text-align: right; font-size: 8px; color: #64748b; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #334155; color: white; font-weight: bold; padding: 5px; text-align: left; font-size: 8px; white-space: nowrap; }
        th.c { text-align: center; }
        td { padding: 3px 5px; border-bottom: 1px solid #e2e8f0; font-size: 8.5px; white-space: nowrap; }
        tr:nth-child(even) td { background: #f8fafc; }
        .green { color: #16a34a; } .red { color: #dc2626; }
        .badge { display: inline-block; padding: 1px 5px; border-radius: 3px; font-weight: bold; font-size: 7.5px; color: white; }
        .badge-green { background: #10b981; } .badge-amber { background: #f59e0b; } .badge-red { background: #ef4444; }
        @page { size: landscape; margin: 8mm; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <div class="header">
        <div><h1>Dizimistas — Painel Executivo Financeiro</h1>
        <p>Período: ${new Date(startDate + 'T12:00:00').toLocaleDateString('pt-BR')} a ${new Date(endDate + 'T12:00:00').toLocaleDateString('pt-BR')} · ${sortedList.length} registros</p></div>
        <div class="meta">Emitido em: ${new Date().toLocaleString('pt-BR')}<br>Sistema MRM de Gestão Eclesiástica</div>
      </div>
      <table><thead><tr>
        <th>ROL</th><th>Nome</th><th>Cargo</th><th>Igreja</th>
        <th class="c">Situação</th><th class="c">Com/Total</th><th class="c">Falta</th><th class="c">Data Últ.</th>
        ${monthLabels.map(l => `<th class="c">${l}</th>`).join('')}
      </tr></thead><tbody>${rows}</tbody></table>
      <script>
        window.onload = function() { window.print(); };
        window.addEventListener('afterprint', function() { window.close(); });
      <\/script>
    </body></html>`);
    win.document.close();
  }, [dizimistasReport, sortedList, totalMonthsInPeriod, startDate, endDate]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-6 space-y-6">
      
      {/* ─── TITLE & TOP CONTROLS ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">Painel Executivo Financeiro</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">Filtro avançado e análise estratégica do campo</p>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-xl bg-slate-200/60 dark:bg-slate-900 p-1 border border-slate-200 dark:border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setTab('campo')}
              className={`px-4 py-2 rounded-lg transition-all ${
                tab === 'campo' ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-xs' : 'text-slate-500'
              }`}
            >
              Análise do Campo
            </button>
            <button
              onClick={() => setTab('dizimistas')}
              className={`px-4 py-2 rounded-lg transition-all ${
                tab === 'dizimistas' ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white shadow-xs' : 'text-slate-500'
              }`}
            >
              Dizimistas
            </button>
          </div>
          
          {tab === 'dizimistas' && tithersList.length > 0 && canExportExecutive('finance_executive') && (
            <>
              <button
                onClick={handleExportExcel}
                className="flex items-center justify-center gap-1.5 h-9 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Excel
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center justify-center gap-1.5 h-9 px-3.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold shadow-xs transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimir
              </button>
            </>
          )}
          <button
            onClick={() => void handleFetch()}
            disabled={loading}
            className="flex items-center justify-center gap-2 h-9 px-3.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* ─── FILTERS ─── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/60 dark:border-slate-800 shadow-xs">
        {tab === 'campo' ? (
          /* Campo tab: 4 cols */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="col-span-1 sm:col-span-2">
              <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Período</label>
              <DateRangePresetPicker startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); }} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Regional</label>
              <MultiSelect label="Regional" options={regionais} selected={selectedRegionalIds} onChange={handleRegionalChange} disabled={isChurchProfile || isRegionalProfile} placeholder="Todas as Regionais" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Igreja</label>
              <MultiSelect label="Igreja" options={filteredChurchesList} selected={selectedChurchIds} onChange={setSelectedChurchIds} disabled={isChurchProfile} placeholder="Todas as Igrejas" />
            </div>
          </div>
        ) : (
          /* Dizimistas tab: all 6 filters in one row */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Período</label>
              <DateRangePresetPicker startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); }} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Regional</label>
              <MultiSelect label="Regional" options={regionais} selected={selectedRegionalIds} onChange={handleRegionalChange} disabled={isChurchProfile || isRegionalProfile} placeholder="Todas" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Igreja</label>
              <MultiSelect label="Igreja" options={filteredChurchesList} selected={selectedChurchIds} onChange={setSelectedChurchIds} disabled={isChurchProfile} placeholder="Todas" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Cargo Eclesiástico</label>
              <MultiSelect
                label="Cargo"
                options={titles}
                selected={selectedCargos}
                onChange={setSelectedCargos}
                placeholder="Todos os Cargos"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Situação</label>
              <select
                value={selectedSituacao}
                onChange={e => setSelectedSituacao(e.target.value as any)}
                className="w-full h-10 px-3 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 dark:bg-slate-800 dark:text-white bg-white"
              >
                <option value="todos">Todos</option>
                <option value="dizimistas">Dizimistas</option>
                <option value="todos_os_meses">Fiel</option>
                <option value="inconstante">Inconstante</option>
                <option value="nao_dizimistas">Não Dizimistas</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Buscar Membro</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" placeholder="Nome ou ROL..." value={dizimistasSearch} onChange={e => setDizimistasSearch(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 dark:bg-slate-800 dark:text-white" />
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/80 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* ─── TAB 1: EXECUTIVE FINANCIAL SUMMARY ─── */}
      {tab === 'campo' && (
        <div className="space-y-6">
          
          {/* Top KPI Cards Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Saldo Atual (Período)"
              value={brl(stats.saldoAtual)}
              subtitle={stats.saldoAtual >= 0 ? "Superávit no período" : "Déficit no período"}
              icon={Wallet}
              colorClass={stats.saldoAtual >= 0 ? "bg-emerald-500" : "bg-rose-500"}
              loading={loading}
            />
            <KpiCard
              title="Total de Receitas"
              value={shortBrl(stats.totalReceita)}
              subtitle="Toda arrecadação"
              icon={TrendingUp}
              colorClass="bg-green-500"
              loading={loading}
              trend={stats.growthRec !== null ? { val: stats.growthRec, label: 'Crescimento', good: stats.growthRec >= 0 } : null}
            />
            <KpiCard
              title="Total de Despesas"
              value={shortBrl(stats.totalDespesa)}
              subtitle="Toda saída de caixa"
              icon={TrendingDown}
              colorClass="bg-rose-500"
              loading={loading}
              trend={stats.growthDesp !== null ? { val: stats.growthDesp, label: 'Despesas', good: stats.growthDesp <= 0 } : null}
            />
            <KpiCard
              title="Resultado do Período"
              value={stats.saldoAtual >= 0 ? "Superavitário" : "Deficitário"}
              subtitle={stats.totalReceita > 0 ? `${((stats.totalDespesa / stats.totalReceita) * 100).toFixed(0)}% comprometido` : "Sem receitas"}
              icon={Landmark}
              colorClass={stats.saldoAtual >= 0 ? "bg-blue-500" : "bg-amber-500"}
              loading={loading}
            />
            <KpiCard
              title="Dízimos Recebidos"
              value={shortBrl(stats.totalDizimos)}
              subtitle={`${stats.totalReceita > 0 ? ((stats.totalDizimos / stats.totalReceita) * 100).toFixed(1) : 0}% da receita`}
              icon={Users}
              colorClass="bg-purple-500"
              loading={loading}
            />
            <KpiCard
              title="Ofertas Recebidas"
              value={shortBrl(stats.totalOfertas)}
              subtitle={`${stats.totalReceita > 0 ? ((stats.totalOfertas / stats.totalReceita) * 100).toFixed(1) : 0}% da receita`}
              icon={DollarSign}
              colorClass="bg-teal-500"
              loading={loading}
            />
            <KpiCard
              title="Despesas Previstas"
              value={brl(plannedExpenses || stats.totalDespesa * 0.9)}
              subtitle="Lançamentos futuros/planejamento"
              icon={Calendar}
              colorClass="bg-orange-500"
              loading={loading}
            />
            <KpiCard
              title="Variação vs Período Anterior"
              value={stats.growthRec !== null ? `${stats.growthRec >= 0 ? 'Alta' : 'Queda'} de ${Math.abs(stats.growthRec).toFixed(0)}%` : '—'}
              subtitle="Comparado a período igual anterior"
              icon={Percent}
              colorClass="bg-indigo-500"
              loading={loading}
            />
          </div>

          {/* Line & Area Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Chart 1: Revenue vs Expense Evolution */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm">
              <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-slate-400" />
                Receita × Despesa por Mês
              </h2>
              {loading ? (
                <div className="h-64 bg-slate-50 dark:bg-slate-800 rounded-xl animate-pulse" />
              ) : evolutionChartData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-slate-400 text-sm">Sem lançamentos no período</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={evolutionChartData} barCategoryGap="30%" barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:opacity-10" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => shortBrl(v)} width={56} />
                    <Tooltip
                      formatter={(value: any, name: any) => [brl(Number(value)), name]}
                      contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="receitas" name="Receitas" fill={GREEN} radius={[4, 4, 0, 0]} maxBarSize={60} />
                    <Bar dataKey="despesas" name="Despesas" fill={RED} radius={[4, 4, 0, 0]} maxBarSize={60} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Chart 2: Cumulative Balance Evolution */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm">
              <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-slate-400" />
                Evolução do Saldo Acumulado
              </h2>
              {loading ? (
                <div className="h-64 bg-slate-50 dark:bg-slate-800 rounded-xl animate-pulse" />
              ) : cumulativeChartData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-slate-400 text-sm">Sem dados de saldo</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={cumulativeChartData}>
                    <defs>
                      <linearGradient id="gSaldo" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={BLUE} stopOpacity={0.25} /><stop offset="95%" stopColor={BLUE} stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:opacity-10" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => shortBrl(v)} width={56} />
                    <Tooltip
                      formatter={(value: any) => [brl(Number(value)), 'Saldo Acumulado']}
                      contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area
                      type="monotone"
                      dataKey="saldo"
                      name="Saldo Acumulado"
                      stroke={BLUE}
                      fill="url(#gSaldo)"
                      strokeWidth={2.5}
                      dot={{ r: 5, fill: BLUE, strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 7 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

          </div>

          {/* Secondary Charts: Categories, CC, Payment */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Chart 3 & 4: Categories Breakdown (Unified Panel) */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Landmark className="w-4 h-4 text-slate-400" />
                  Receitas por Categoria
                </h2>
              </div>
              {loading ? (
                <div className="h-56 bg-slate-50 dark:bg-slate-800 rounded-xl animate-pulse" />
              ) : categoryChartData.receitas.length === 0 ? (
                <div className="h-56 flex items-center justify-center text-slate-400 text-sm">Sem dados</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={categoryChartData.receitas} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35}>
                        {categoryChartData.receitas.map((_, index) => (
                          <Cell key={index} fill={CHART_PALETTE[index % CHART_PALETTE.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => brl(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-3 space-y-1.5">
                    {categoryChartData.receitas.map((item, index) => {
                      const total = categoryChartData.receitas.reduce((s, d) => s + d.value, 0);
                      const pct = total > 0 ? ((item.value / total) * 100).toFixed(0) : '0';
                      return (
                        <div key={index} className="flex items-center justify-between text-xs gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: CHART_PALETTE[index % CHART_PALETTE.length] }} />
                            <span className="truncate text-slate-600 dark:text-slate-300">{item.name}</span>
                          </div>
                          <span className="font-mono font-bold text-slate-700 dark:text-slate-200 shrink-0">{pct}% · {shortBrl(item.value)}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Chart 4: Expenses by Category */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm">
              <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4 text-slate-400" />
                Despesas por Categoria
              </h2>
              {loading ? (
                <div className="h-56 bg-slate-50 dark:bg-slate-800 rounded-xl animate-pulse" />
              ) : categoryChartData.despesas.length === 0 ? (
                <div className="h-56 flex items-center justify-center text-slate-400 text-sm">Sem despesas</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={categoryChartData.despesas} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35}>
                        {categoryChartData.despesas.map((_, index) => (
                          <Cell key={index} fill={CHART_PALETTE_RED[index % CHART_PALETTE_RED.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => brl(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-3 space-y-1.5">
                    {categoryChartData.despesas.map((item, index) => {
                      const total = categoryChartData.despesas.reduce((s, d) => s + d.value, 0);
                      const pct = total > 0 ? ((item.value / total) * 100).toFixed(0) : '0';
                      return (
                        <div key={index} className="flex items-center justify-between text-xs gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: CHART_PALETTE_RED[index % CHART_PALETTE_RED.length] }} />
                            <span className="truncate text-slate-600 dark:text-slate-300">{item.name}</span>
                          </div>
                          <span className="font-mono font-bold text-slate-700 dark:text-slate-200 shrink-0">{pct}% · {shortBrl(item.value)}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Chart 5: Cost Center Chart */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm col-span-1 md:col-span-2 lg:col-span-1">
              <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-slate-400" />
                Despesas por Centro de Custo
              </h2>
              {loading ? (
                <div className="h-56 bg-slate-50 dark:bg-slate-800 rounded-xl animate-pulse" />
              ) : costCenterChartData.length === 0 ? (
                <div className="h-56 flex items-center justify-center text-slate-400 text-sm">Sem centros de custo</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={costCenterChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:opacity-10" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={v => shortBrl(v)} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={65} />
                    <Tooltip formatter={(v: any) => brl(Number(v))} />
                    <Bar dataKey="valor" name="Total Despendido" fill={AMBER} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

          </div>

          {/* Church Ranking and Payment Methods */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Church Ranking */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm">
              <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <Landmark className="w-4 h-4 text-slate-400" />
                Ranking de Igrejas e Congregações
              </h2>
              {loading ? (
                <div className="h-64 bg-slate-50 dark:bg-slate-800 rounded-xl animate-pulse" />
              ) : rankingChartData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-slate-400 text-sm">Sem dados de igrejas</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Igreja / Congregação</th>
                        <th className="px-4 py-3 text-right">Arrecadado</th>
                        <th className="px-4 py-3 text-right">Gasto</th>
                        <th className="px-4 py-3 text-right">Líquido</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {rankingChartData.map((ch, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[180px]">{ch.name}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">{brl(ch.receita)}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">{brl(ch.despesa)}</td>
                          <td className={`px-4 py-3 text-right font-mono font-bold ${ch.saldo >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-amber-600'}`}>{brl(ch.saldo)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Payment Methods & Summary of Averages */}
            <div className="space-y-6">
              
              {/* Payment Methods Horizontal Chart */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm">
                <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-slate-400" />
                  Lançamentos por Forma de Pagamento
                </h2>
                {loading ? (
                  <div className="h-44 bg-slate-50 dark:bg-slate-800 rounded-xl animate-pulse" />
                ) : paymentChartData.length === 0 ? (
                  <div className="h-44 flex items-center justify-center text-slate-400 text-sm">Sem dados</div>
                ) : (
                  <ResponsiveContainer width="100%" height={170}>
                    <BarChart data={paymentChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:opacity-10" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={v => shortBrl(v)} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={75} />
                      <Tooltip formatter={(v: any) => brl(Number(v))} />
                      <Bar dataKey="valor" name="Total" fill={TEAL} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Box of averages */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm grid grid-cols-2 gap-4">
                <div className="col-span-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                  <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Médias Contábeis do Caixa</h2>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Média Mensal Receitas</p>
                  <p className="text-sm font-semibold font-mono text-slate-700 dark:text-slate-300 mt-0.5">{brl(stats.mediaMensalReceita)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Média Mensal Despesas</p>
                  <p className="text-sm font-semibold font-mono text-slate-700 dark:text-slate-300 mt-0.5">{brl(stats.mediaMensalDespesa)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Média Diária Entradas</p>
                  <p className="text-sm font-semibold font-mono text-slate-700 dark:text-slate-300 mt-0.5">{brl(stats.mediaDiariaReceita)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Ticket Dízimos/Ofertas</p>
                  <p className="text-sm font-semibold font-mono text-slate-700 dark:text-slate-300 mt-0.5">{brl((stats.ticketDizimos + stats.ticketOfertas) / 2)}</p>
                </div>
              </div>

            </div>
          </div>

          {/* Analysis & Forecast Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Forecasts Panel */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm space-y-4">
              <div>
                <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Lightbulb className="w-4 h-4 text-purple-500" />
                  Previsão Financeira Estimada
                </h2>
                <p className="text-[11px] text-slate-400 mt-1">Projeções calculadas com base nas médias registradas do período atual.</p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] uppercase font-bold text-slate-400">
                    <tr>
                      <th className="px-3 py-2.5">Período Projetado</th>
                      <th className="px-3 py-2.5 text-right">Receita Prevista</th>
                      <th className="px-3 py-2.5 text-right">Despesa Prevista</th>
                      <th className="px-3 py-2.5 text-right">Saldo Previsto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono font-medium">
                    {forecasts.map((f, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <td className="px-3 py-2.5 text-slate-600 dark:text-slate-400 font-sans font-bold">{f.period}</td>
                        <td className="px-3 py-2.5 text-right text-emerald-600">{brl(f.rec)}</td>
                        <td className="px-3 py-2.5 text-right text-rose-600">{brl(f.desp)}</td>
                        <td className={`px-3 py-2.5 text-right font-bold ${f.net >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-amber-500'}`}>{brl(f.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Smart analysis recommendations and comments */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm space-y-4 flex flex-col justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-blue-500" />
                  Diagnóstico Contábil Inteligente
                </h2>
                <p className="text-[11px] text-slate-400 mt-1">Notas computadas automaticamente pelo sistema de auditoria.</p>
              </div>

              <div className="space-y-2.5 my-2 flex-1">
                {intelligentAnalysis.map((note, idx) => (
                  <div key={idx} className="flex gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-xs text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{note}</span>
                  </div>
                ))}
              </div>

              <div className="text-[10px] text-slate-400 border-t border-slate-100 dark:border-slate-800/80 pt-2 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Projeções lineares e dados baseados em livro caixa fechado.
              </div>
            </div>

          </div>

          {/* Director Alerts Panel (Atenção da Diretoria) */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                Atenção da Diretoria / Auditoria Interna
              </h2>
              <p className="text-[11px] text-slate-400 mt-1">Incoerências operacionais ou alertas financeiros cruciais que demandam providências imediatas.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {alerts.map((al, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border flex flex-col gap-1.5 shadow-xs ${
                    al.type === 'danger'
                      ? 'bg-rose-50/50 border-rose-200 dark:bg-rose-900/10 dark:border-rose-900/40 text-rose-700 dark:text-rose-400'
                      : al.type === 'warning'
                        ? 'bg-amber-50/50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-900/40 text-amber-700 dark:text-amber-400'
                        : 'bg-blue-50/50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-900/40 text-blue-700 dark:text-blue-400'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{al.text}</span>
                  </div>
                  {al.sub && <span className="text-[11px] opacity-80 font-medium">{al.sub}</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Top expenses lists and statistics */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Column 1: Averages and Max records */}
              <div className="space-y-4">
                <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Maiores Registros Contábeis (Período)</h2>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 rounded-xl space-y-2">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><ArrowUpRight className="w-4 h-4" /> Maior Receita Lançada</span>
                    {stats.maiorReceita ? (
                      <div>
                        <p className="text-lg font-mono font-bold text-slate-800 dark:text-white">{brl(stats.maiorReceita.valor)}</p>
                        <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">{stats.maiorReceita.desc} • {stats.maiorReceita.data}</p>
                      </div>
                    ) : <span className="text-slate-400">Nenhuma receita registrada</span>}
                  </div>
                  <div className="p-3 bg-rose-50/40 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50 rounded-xl space-y-2">
                    <span className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1"><ArrowDownRight className="w-4 h-4" /> Maior Despesa Lançada</span>
                    {stats.maiorDespesa ? (
                      <div>
                        <p className="text-lg font-mono font-bold text-slate-800 dark:text-white">{brl(stats.maiorDespesa.valor)}</p>
                        <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">{stats.maiorDespesa.desc} • {stats.maiorDespesa.data}</p>
                      </div>
                    ) : <span className="text-slate-400">Nenhuma despesa registrada</span>}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-2">Dias com Maior Volume de Arrecadação</span>
                  <div className="flex flex-wrap gap-2.5 text-xs font-mono font-bold text-slate-600 dark:text-slate-400">
                    {stats.topDays.map((day, idx) => (
                      <span key={idx} className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg border border-slate-200/50 dark:border-slate-700/60">
                        {day.date}: <strong className="text-slate-900 dark:text-white">{brl(day.val)}</strong>
                      </span>
                    ))}
                    {stats.topDays.length === 0 && <span className="text-slate-400 font-sans font-medium">Nenhum dia de arrecadação registrado.</span>}
                  </div>
                </div>
              </div>

              {/* Column 2: Wednesday vs Sunday cult comparison */}
              <div className="border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-800/80 pt-4 lg:pt-0 lg:pl-6 flex flex-col justify-between">
                <div>
                  <h2 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                    Comparativo de Cultos: Domingos × Quartas
                  </h2>
                  <p className="text-[10px] text-slate-400 mt-1">Comparativo de arrecadação entre os últimos 4 Domingos e 4 Quartas com lançamentos.</p>
                </div>

                <div className="mt-4 flex-1 min-h-[160px] flex flex-col justify-center">
                  {cultoComparisonData.chartData.length === 0 ? (
                    <div className="text-xs text-slate-400 text-center py-8">Nenhum registro de dízimos/ofertas em quartas ou domingos no período.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={cultoComparisonData.chartData} barGap={4}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:opacity-10" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                        <YAxis tick={{ fontSize: 9 }} tickFormatter={v => shortBrl(v)} width={45} />
                        <Tooltip content={<CultoTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Bar dataKey="Domingo" fill="#6366f1" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="Quarta" fill="#14b8a6" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* ─── TAB 2: RESPONSIVE TITHERS CARD DIRECTORY ─── */}
      {tab === 'dizimistas' && (
        <div className="space-y-4">

          {/* Loading Spinner */}
          {loading && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-16 text-center">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400 text-sm">Carregando lista de dizimistas...</p>
            </div>
          )}

          {/* Empty State */}
          {!loading && tithersList.length === 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-16 text-center">
              <Users className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400 font-semibold text-sm">Nenhum registro eclesiástico coincide com os filtros.</p>
              <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Ajuste o período, congregação, cargo ou filtro de situação.</p>
            </div>
          )}

          {/* Spreadsheet Table */}
          {!loading && tithersList.length > 0 && (()=> {
            const SortIcon = ({ col }: { col: SortCol }) => sortCol === col
              ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3 ml-0.5 inline" /> : <ChevronDown className="w-3 h-3 ml-0.5 inline" />)
              : <ArrowUpDown className="w-3 h-3 ml-0.5 inline opacity-30" />;

            const thBase = 'px-3 py-2.5 font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/40 select-none transition-colors';

            const PaginationBar = ({ border }: { border?: 'top' | 'bottom' }) => (
              <div className={`flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-xs text-slate-500 dark:text-slate-400 ${border === 'top' ? 'border-b' : 'border-t'} border-slate-100 dark:border-slate-800`}>
                <div className="flex items-center gap-1.5">
                  {border === 'top' && (
                    <>
                      <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>{dizimistasNotice || '...'}</span>
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                      <span>Período: <span className="font-mono font-bold text-slate-600 dark:text-slate-300">{new Date(startDate + 'T12:00:00').toLocaleDateString('pt-BR')} a {new Date(endDate + 'T12:00:00').toLocaleDateString('pt-BR')}</span></span>
                    </>
                  )}
                  {border === 'bottom' && (
                    <>
                      <span>Linhas por página:</span>
                      <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} className="h-7 px-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 dark:text-white focus:outline-none">
                        {[25, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                      <span className="text-slate-400">· {sortedList.length} reg.</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(1)} disabled={page === 1} className="h-7 w-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><ChevronsLeft className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="h-7 w-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><ChevronLeft className="w-3.5 h-3.5" /></button>
                  <span className="px-2 font-medium text-slate-600 dark:text-slate-300">{page} / {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="h-7 w-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><ChevronRight className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="h-7 w-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><ChevronsRight className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            );

            return (
            <div id="dizimistas-print-area" className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
              <PaginationBar border="top" />
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                      <th className={`text-left ${thBase} w-14`} onClick={() => handleSort('rol')}>ROL <SortIcon col="rol" /></th>
                      <th className={`text-left ${thBase} min-w-[160px]`} onClick={() => handleSort('nome')}>Nome <SortIcon col="nome" /></th>
                      <th className={`text-left ${thBase}`} onClick={() => handleSort('cargo')}>Cargo <SortIcon col="cargo" /></th>
                      <th className={`text-left ${thBase} min-w-[130px]`} onClick={() => handleSort('igreja')}>Igreja <SortIcon col="igreja" /></th>
                      <th className={`text-center ${thBase}`} onClick={() => handleSort('situacao')}>Situação <SortIcon col="situacao" /></th>
                      <th className={`text-center ${thBase}`} onClick={() => handleSort('com')}>Com/Total <SortIcon col="com" /></th>
                      <th className={`text-center ${thBase}`} onClick={() => handleSort('falta')}>Falta <SortIcon col="falta" /></th>
                      <th className={`text-center ${thBase}`} onClick={() => handleSort('data')}>Data Últ. <SortIcon col="data" /></th>
                      {dizimistasReport?.months.map((m) => {
                        const [year, month] = m.key.split('-');
                        const d = new Date(Number(year), Number(month) - 1, 1);
                        const label = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(d).replace('.', '') + '/' + year.slice(2);
                        return (
                          <th key={m.key} className="text-center px-2 py-2.5 font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap w-14">
                            {label}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedList.map((item, idx) => {
                      const paidCount = dizimistasReport
                        ? dizimistasReport.months.filter(m => (item.monthly[m.key] ?? 0) > 0).length
                        : 0;
                      const totalM = totalMonthsInPeriod;
                      const missed = totalM - paidCount;

                      let statusLabel = 'Nunca';
                      let statusClass = 'bg-rose-500 text-white';
                      if (paidCount >= totalM && totalM > 0) {
                        statusLabel = 'Fiel';
                        statusClass = 'bg-emerald-500 text-white';
                      } else if (paidCount > 0) {
                        statusLabel = 'Inconstante';
                        statusClass = 'bg-amber-400 text-white';
                      }

                      return (
                        <tr
                          key={idx}
                          className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/30 dark:bg-slate-800/10'}`}
                        >
                          <td className="px-3 py-2 font-mono text-slate-400 dark:text-slate-500 text-[11px]">
                            {item.rol ?? '—'}
                          </td>
                          <td className={`px-3 py-2 font-semibold whitespace-nowrap ${
                            statusLabel === 'Fiel' ? 'text-emerald-600 dark:text-emerald-400' :
                            statusLabel === 'Nunca' ? 'text-rose-600 dark:text-rose-400' :
                            'text-slate-800 dark:text-slate-200'
                          }`}>
                            {item.memberName}
                          </td>
                          <td className="px-3 py-2 text-slate-500 dark:text-slate-400 whitespace-nowrap uppercase text-[11px]">
                            {item.ecclesiasticalTitle || '—'}
                          </td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-300 text-[11px]">
                            {item.churchName}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${statusClass}`}>
                              {statusLabel}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                            {paidCount}/{totalM}
                          </td>
                          <td className={`px-3 py-2 text-center font-mono font-bold ${missed > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                            {missed}
                          </td>
                          <td className="px-3 py-2 text-center font-mono text-slate-500 dark:text-slate-400 text-[11px]">
                            {item.lastDate ? (() => {
                              const [y, mo, d] = item.lastDate.split('-');
                              return `${d}/${mo}/${y}`;
                            })() : '—'}
                          </td>
                          {dizimistasReport?.months.map((m) => {
                            const val = item.monthly[m.key] ?? 0;
                            const isPaid = val > 0;
                            return (
                              <td key={m.key} className="px-2 py-2 text-center">
                                {isPaid ? (
                                  <span title={brl(val)} className="text-emerald-500 font-bold text-base leading-none">✓</span>
                                ) : (
                                  <span className="text-rose-500 font-bold text-base leading-none">✗</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <PaginationBar border="bottom" />
            </div>
            );
          })()}

        </div>
      )}

      {/* ─── Page Footer info ─── */}
      <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-200/60 dark:border-slate-800/80 pt-4 text-[11px] text-slate-400 dark:text-slate-500 font-medium gap-2">
        <div className="flex items-center gap-1">
          <Landmark className="w-3.5 h-3.5" />
          <span>Painel Executivo Financeiro • Congregações e Livro Caixa</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" />
          <span>Direitos Reservados • Sistema MRM de Gestão Eclesiástica</span>
        </div>
      </div>
    </div>
  );
}
