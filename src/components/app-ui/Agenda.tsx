import {
  Calendar as CalendarIcon, Plus, Clock, MapPin, ChevronLeft, ChevronRight,
  Search, Pencil, Trash2, X, Save, AlertCircle, RefreshCw, Check, Eye, EyeOff,
  Tag, Upload, Download, FileText, CheckCircle, XCircle, ChevronDown,
  Sun, Moon, BookOpen, Zap, Flame, Heart, Users, Star, Globe, Music2, Sparkles, Gift, Cross, CalendarDays,
  type LucideIcon,
} from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';

// --- Constants ---

import { apiBase as API } from '../../lib/apiBase';

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const MONTHS_LABEL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];
const WEEKDAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'];
const getWeekday = (datareal?: string) => {
  if (!datareal) return '';
  const d = new Date(datareal.slice(0, 10) + 'T12:00:00');
  return DIAS_SEMANA[d.getDay()] || '';
};
const parseDateParts = (datareal?: string) => {
  if (!datareal) return { y: 0, m: 0, d: 0 };
  const [y, m, d] = datareal.slice(0, 10).split('-').map(Number);
  return { y, m, d };
};

type IconKey = 'Sun' | 'Moon' | 'BookOpen' | 'Zap' | 'Flame' | 'Heart' | 'Users' | 'Star' | 'Globe' | 'Music2' | 'Sparkles' | 'Gift' | 'Cross' | 'CalendarDays';
const ICON_CFG: Record<IconKey, { Icon: LucideIcon; bg: string; label: string }> = {
  Sun:          { Icon: Sun,          bg: 'bg-orange-400',  label: 'Adoracao'    },
  Moon:         { Icon: Moon,         bg: 'bg-indigo-700',  label: 'Noturno'     },
  BookOpen:     { Icon: BookOpen,     bg: 'bg-yellow-500',  label: 'Biblica'     },
  Zap:          { Icon: Zap,          bg: 'bg-blue-600',    label: 'Evangelico'  },
  Flame:        { Icon: Flame,        bg: 'bg-pink-600',    label: 'Libertacao'  },
  Heart:        { Icon: Heart,        bg: 'bg-purple-700',  label: 'Pastoral'    },
  Users:        { Icon: Users,        bg: 'bg-teal-500',    label: 'Reuniao'     },
  Star:         { Icon: Star,         bg: 'bg-amber-500',   label: 'Especial'    },
  Globe:        { Icon: Globe,        bg: 'bg-cyan-600',    label: 'Missoes'     },
  Music2:       { Icon: Music2,       bg: 'bg-rose-500',    label: 'Louvor'      },
  Sparkles:     { Icon: Sparkles,     bg: 'bg-violet-600',  label: 'Consagracao' },
  Gift:         { Icon: Gift,         bg: 'bg-emerald-600', label: 'Ofertorio'   },
  Cross:        { Icon: Cross,        bg: 'bg-slate-700',   label: 'Santa Ceia'  },
  CalendarDays: { Icon: CalendarDays, bg: 'bg-blue-500',    label: 'Evento'      },
};
const ALL_ICONS = Object.keys(ICON_CFG) as IconKey[];

// CSV columns mapping
const CSV_COLUMNS = [
  { key: 'evento',       required: true,  description: 'Nome do evento' },
  { key: 'datareal',     required: true,  description: 'Data (YYYY-MM-DD)' },
  { key: 'horario',      required: false, description: 'Horario ex: 19h30' },
  { key: 'local',        required: false, description: 'Local do evento' },
  { key: 'ministerio',   required: false, description: 'Ministerio' },
  { key: 'departamento', required: false, description: 'Departamento' },
  { key: 'obs',          required: false, description: 'Observacoes' },
  { key: 'tipo',         required: false, description: 'gratuito ou pago' },
  { key: 'preco',        required: false, description: 'Preco numerico' },
  { key: 'mostrar',      required: false, description: 'true ou false' },
  { key: 'reservar',     required: false, description: 'true ou false' },
  { key: 'iconName',     required: false, description: 'Nome do icone' },
];

// --- Types ---

interface TbEvento {
  id: string;
  evento: string;
  datareal: string;
  dia: number;
  mes: string;
  ano: number;
  diaSemana?: string;
  horario?: string;
  local?: string;
  obs?: string;
  ministerio?: string;
  departamento?: string;
  mostrar: boolean;
  reservar: boolean;
  tipo: string;
  preco: number;
  iconName?: string;
  audienceScope: string;
}

type ImportStep = 'upload' | 'map' | 'import';
interface CsvRow { [key: string]: string }

const EMPTY_FORM = {
  evento: '', datareal: '', horario: '', local: '', obs: '',
  ministerio: '', departamento: '', tipo: 'gratuito', preco: 0,
  mostrar: true, reservar: false, iconName: 'CalendarDays', audienceScope: 'headquarters',
};

const labelCls = 'mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400';
const inputCls = 'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-purple-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:focus:border-purple-400 dark:focus:bg-slate-700';

// --- Sub-components ---

function IconBadge({ name, size = 'md' }: { name?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const k = (name || 'CalendarDays') as IconKey;
  const cfg = ICON_CFG[k] || ICON_CFG.CalendarDays;
  const sz = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-12 w-12' : 'h-10 w-10';
  const iconSz = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-6 w-6' : 'h-5 w-5';
  const IcIcon = cfg.Icon;
  return (
    <div className={`relative flex ${sz} flex-shrink-0 items-center justify-center rounded-xl ${cfg.bg} overflow-hidden shadow-md`}>
      <span className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-black/10 pointer-events-none" />
      <IcIcon className={`${iconSz} text-white relative z-10 drop-shadow`} />
    </div>
  );
}

function IconPicker({ value, onChange, onClose }: { value: string; onChange: (v: string) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900" onClick={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <span className="font-semibold text-slate-800 dark:text-white">Escolher icone</span>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {ALL_ICONS.map(k => {
            const cfg = ICON_CFG[k];
            const IcIcon = cfg.Icon;
            return (
              <button key={k} onClick={() => { onChange(k); onClose(); }} title={cfg.label}
                className={`relative flex h-14 w-full flex-col items-center justify-center gap-1 rounded-xl ${cfg.bg} overflow-hidden shadow transition-transform hover:scale-105 ${value === k ? 'ring-2 ring-white ring-offset-1' : ''}`}>
                <span className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-black/10 pointer-events-none" />
                <IcIcon className="h-5 w-5 text-white relative z-10 drop-shadow" />
                <span className="relative z-10 text-[9px] text-white/90 font-medium leading-none">{cfg.label}</span>
                {value === k && <Check className="absolute top-0.5 right-0.5 h-3 w-3 text-white drop-shadow z-20" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// --- CSV helpers ---

function parseCSV(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row: CsvRow = {};
    headers.forEach((h, i) => { row[h] = vals[i] ?? ''; });
    return row;
  });
}

function downloadCSVTemplate() {
  const headers = CSV_COLUMNS.map(c => c.key).join(',');
  const example = [
    'Culto de Domingo',
    new Date().toISOString().slice(0, 10),
    '18h00', 'Sede Principal', 'Louvor', 'Jovens',
    'Culto especial', 'gratuito', '0', 'true', 'false', 'celebration',
  ].join(',');
  const blob = new Blob([`${headers}\n${example}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'modelo-eventos.csv'; a.click();
  URL.revokeObjectURL(url);
}

// --- Main Component ---

export function Agenda() {
  const now = new Date();
  const [viewMode, setViewMode] = useState<'calendar' | 'ano' | 'list' | 'dia'>('calendar');
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(now.getDate());
  const [search, setSearch] = useState('');

  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);

  const [events, setEvents] = useState<TbEvento[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<TbEvento | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [showIcons, setShowIcons] = useState(false);

  const [delId, setDelId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [previewEvent, setPreviewEvent] = useState<TbEvento | null>(null);
  const [precoBRL, setPrecoBRL] = useState('');
  const [calDay, setCalDay] = useState(now.getDate());
  const [dayModalDay, setDayModalDay] = useState<number | null>(null);

  const [showImport, setShowImport] = useState(false);
  const [importStep, setImportStep] = useState<ImportStep>('upload');
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [importMapping, setImportMapping] = useState<Record<string, string>>({});
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const token = localStorage.getItem('mrm_token') || '';
  const fieldId = localStorage.getItem('mrm_active_field_id') || '';
  const hdrs: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const load = useCallback(async () => {
    setLoading(true); setLoadErr(null);
    try {
      const p = new URLSearchParams();
      if (fieldId) p.set('campoId', fieldId);
      p.set('year', String(calYear));
      const r = await fetch(`${API}/annual-events?${p}`, { headers: hdrs });
      if (!r.ok) throw new Error(`Erro ${r.status}`);
      setEvents(await r.json());
    } catch (e: unknown) {
      setLoadErr(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally { setLoading(false); }
  }, [calYear, fieldId, token]);

  useEffect(() => { load(); }, [load]);

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstWeekDay = new Date(calYear, calMonth, 1).getDay();
  const todayY = now.getFullYear(), todayM = now.getMonth(), todayD = now.getDate();

  const eventsForDay = (day: number) =>
    events.filter(ev => {
      const { y, m, d } = parseDateParts(ev.datareal);
      return y === calYear && (m - 1) === calMonth && d === day;
    });

  const selectedEvents = selectedDay ? eventsForDay(selectedDay) : [];

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1);
    setSelectedDay(null);
  };

  const thisMonthCount = events.filter(ev => {
    const { m } = parseDateParts(ev.datareal);
    return (m - 1) === calMonth;
  }).length;
  const upcoming = events.filter(ev => {
    const { y, m, d } = parseDateParts(ev.datareal);
    return new Date(y, m - 1, d) >= new Date(todayY, todayM, todayD);
  }).length;

  const filtered = events.filter(ev =>
    !search ||
    ev.evento.toLowerCase().includes(search.toLowerCase()) ||
    (ev.local || '').toLowerCase().includes(search.toLowerCase()) ||
    (ev.ministerio || '').toLowerCase().includes(search.toLowerCase())
  );
  const grouped = filtered.reduce<Record<string, TbEvento[]>>((acc, ev) => {
    const k = ev.mes || '?'; if (!acc[k]) acc[k] = []; acc[k].push(ev); return acc;
  }, {});
  const monthOrder = MONTHS_PT.filter(m => grouped[m]);

  function openCreate() {
    setEditing(null);
    const d = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(selectedDay || todayD).padStart(2, '0')}`;
    setForm({ ...EMPTY_FORM, datareal: d });
    setPrecoBRL('');
    setFormErr(null); setShowModal(true);
  }
  function openEdit(ev: TbEvento) {
    setEditing(ev);
    setForm({
      evento: ev.evento, datareal: ev.datareal?.slice(0, 10) || '', horario: ev.horario || '',
      local: ev.local || '', obs: ev.obs || '', ministerio: ev.ministerio || '',
      departamento: ev.departamento || '', tipo: ev.tipo || 'gratuito', preco: ev.preco || 0,
      mostrar: ev.mostrar, reservar: ev.reservar, iconName: ev.iconName || 'CalendarDays',
      audienceScope: ev.audienceScope || 'headquarters',
    });
    setPrecoBRL(ev.preco > 0 ? ev.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');
    setPreviewEvent(null);
    setFormErr(null); setShowModal(true);
  }
  async function handleSave() {
    if (!form.evento.trim()) { setFormErr('Nome do evento e obrigatorio'); return; }
    if (!form.datareal) { setFormErr('Data e obrigatoria'); return; }
    if (!fieldId) { setFormErr('Nenhum campo ativo selecionado'); return; }
    setSaving(true); setFormErr(null);
    try {
      const body = { ...form, campoId: fieldId };
      const r = await fetch(editing ? `${API}/annual-events/${editing.id}` : `${API}/annual-events`, {
        method: editing ? 'PATCH' : 'POST', headers: hdrs, body: JSON.stringify(body),
      });
      if (!r.ok) { const t = await r.text(); throw new Error(t || `Erro ${r.status}`); }
      setShowModal(false); load();
    } catch (e: unknown) { setFormErr(e instanceof Error ? e.message : 'Erro ao salvar'); }
    finally { setSaving(false); }
  }
  async function handleDelete(id: string) {
    setDeleting(true);
    try { await fetch(`${API}/annual-events/${id}`, { method: 'DELETE', headers: hdrs }); setDelId(null); load(); }
    finally { setDeleting(false); }
  }

  function openImport() {
    setImportStep('upload'); setCsvRows([]); setCsvHeaders([]);
    setImportMapping({}); setImportErrors([]); setImportDone(0);
    setShowImport(true);
  }
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      if (rows.length === 0) { setImportErrors(['Arquivo vazio ou formato invalido']); return; }
      const headers = Object.keys(rows[0]);
      setCsvHeaders(headers); setCsvRows(rows);
      const auto: Record<string, string> = {};
      CSV_COLUMNS.forEach(col => {
        const match = headers.find(h => h.toLowerCase() === col.key.toLowerCase());
        if (match) auto[col.key] = match;
      });
      setImportMapping(auto); setImportStep('map');
    };
    reader.readAsText(file, 'utf-8');
  }
  async function handleImport() {
    const errs: string[] = [];
    CSV_COLUMNS.filter(c => c.required).forEach(c => {
      if (!importMapping[c.key]) errs.push(`Coluna obrigatoria "${c.key}" nao mapeada`);
    });
    if (errs.length) { setImportErrors(errs); return; }
    if (!fieldId) { setImportErrors(['Nenhum campo ativo selecionado']); return; }
    setImporting(true); setImportErrors([]);
    let done = 0; const rowErrs: string[] = [];
    for (let i = 0; i < csvRows.length; i++) {
      const row = csvRows[i];
      const body: Record<string, unknown> = { campoId: fieldId };
      CSV_COLUMNS.forEach(col => {
        const src = importMapping[col.key];
        if (src) {
          const val = row[src];
          if (col.key === 'preco') body[col.key] = parseFloat(val) || 0;
          else if (col.key === 'mostrar' || col.key === 'reservar') body[col.key] = val.toLowerCase() !== 'false';
          else body[col.key] = val;
        }
      });
      try {
        const r = await fetch(`${API}/annual-events`, { method: 'POST', headers: hdrs, body: JSON.stringify(body) });
        if (!r.ok) rowErrs.push(`Linha ${i + 2}: ${await r.text()}`);
        else done++;
      } catch { rowErrs.push(`Linha ${i + 2}: erro de rede`); }
    }
    setImportDone(done); if (rowErrs.length) setImportErrors(rowErrs);
    setImporting(false); setImportStep('import'); load();
  }

  const yearRange = Array.from({ length: 10 }, (_, i) => now.getFullYear() - 3 + i);

  return (
    <div className="flex flex-col gap-6 p-6 min-h-0">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
            <CalendarIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Agenda</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Gerencie eventos e compromissos</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
            {(['calendar', 'ano', 'list', 'dia'] as const).map(v => (
              <button key={v} onClick={() => setViewMode(v)}
                className={`rounded px-4 py-1.5 text-sm font-medium transition-colors ${viewMode === v ? 'bg-purple-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}>
                {v === 'calendar' ? 'Mes' : v === 'ano' ? 'Ano' : v === 'list' ? 'Lista' : 'Dia'}
              </button>
            ))}
          </div>
          <button onClick={downloadCSVTemplate}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            <Download className="h-4 w-4" /> Modelo CSV
          </button>
          <button onClick={openImport}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            <Upload className="h-4 w-4" /> Importar CSV
          </button>
          <button onClick={openCreate}
            className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 active:scale-95 transition-all shadow-md">
            <Plus className="h-4 w-4" /> Novo Evento
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: 'Este Ano',  value: events.length },
          { label: 'Este Mes',  value: thisMonthCount },
          { label: 'Proximos',  value: upcoming },
          { label: 'Ocultos',   value: events.filter(e => !e.mostrar).length },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
            <p className="text-xs text-slate-500 dark:text-slate-400">{s.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{loading ? '—' : s.value}</p>
          </div>
        ))}
      </div>

      {/* Error */}
      {loadErr && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          <AlertCircle className="h-4 w-4 flex-shrink-0" /> {loadErr}
          <button onClick={load} className="ml-auto flex items-center gap-1 text-xs underline"><RefreshCw className="h-3 w-3" />Tentar novamente</button>
        </div>
      )}

      {/* ====== CALENDAR VIEW ====== */}
      {viewMode === 'calendar' && (() => {
        const monthEvs = events
          .filter(ev => { const { y, m } = parseDateParts(ev.datareal); return y === calYear && (m - 1) === calMonth; })
          .sort((a, b) => parseDateParts(a.datareal).d - parseDateParts(b.datareal).d);
        const hasPanel = monthEvs.length > 0;
        return (
        <div className={`flex gap-4 ${hasPanel ? 'items-start' : ''}`}>
          {/* Calendar column */}
          <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">

          {/* Calendar top bar */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-1">
              {/* Month picker */}
              <div className="relative">
                <button onClick={() => { setShowMonthPicker(p => !p); setShowYearPicker(false); }}
                  className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-lg font-bold text-slate-900 hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800">
                  {MONTHS_LABEL[calMonth]} <ChevronDown className="h-4 w-4 text-slate-400" />
                </button>
                {showMonthPicker && (
                  <div className="absolute top-10 left-0 z-30 w-44 rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 overflow-hidden">
                    {MONTHS_LABEL.map((m, i) => (
                      <button key={m} onClick={() => { setCalMonth(i); setSelectedDay(null); setShowMonthPicker(false); }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800 ${calMonth === i ? 'bg-purple-50 font-semibold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'text-slate-700 dark:text-slate-300'}`}>
                        {m}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Year picker */}
              <div className="relative">
                <button onClick={() => { setShowYearPicker(p => !p); setShowMonthPicker(false); }}
                  className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-lg font-bold text-slate-900 hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800">
                  {calYear} <ChevronDown className="h-4 w-4 text-slate-400" />
                </button>
                {showYearPicker && (
                  <div className="absolute top-10 left-0 z-30 w-28 rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 overflow-hidden">
                    {yearRange.map(y => (
                      <button key={y} onClick={() => { setCalYear(y); setSelectedDay(null); setShowYearPicker(false); }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800 ${calYear === y ? 'bg-purple-50 font-semibold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'text-slate-700 dark:text-slate-300'}`}>
                        {y}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={load} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800" title="Recarregar">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={prevMonth} className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronLeft className="h-5 w-5" /></button>
              <button onClick={nextMonth} className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronRight className="h-5 w-5" /></button>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="mb-1 grid grid-cols-7 text-center">
            {WEEKDAYS_PT.map(d => (
              <div key={d} className="py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstWeekDay }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayEvs = eventsForDay(day);
              const isSel = selectedDay === day;
              const isToday = calYear === todayY && calMonth === todayM && day === todayD;
              return (
                <button key={day}
                  onClick={() => {
                    setSelectedDay(day);
                    if (dayEvs.length === 1) setPreviewEvent(dayEvs[0]);
                    else if (dayEvs.length > 1) setDayModalDay(day);
                    else openCreate();
                  }}
                  className={`group flex flex-col items-start rounded-lg px-1 py-1.5 transition-all min-h-[72px]
                    ${selectedDay === day
                      ? 'bg-purple-600 text-white shadow-md'
                      : isToday
                        ? 'bg-purple-50 ring-1 ring-purple-300 dark:bg-purple-900/20 dark:ring-purple-700'
                        : dayEvs.length > 0
                          ? 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/10 dark:hover:bg-blue-900/20 cursor-pointer'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                  <span className={`self-center text-sm font-semibold leading-none mb-1 ${selectedDay === day ? 'text-white' : isToday ? 'text-purple-700 dark:text-purple-300' : 'text-slate-800 dark:text-slate-200'}`}>
                    {day}
                  </span>
                  {dayEvs.length > 0 && (
                    <div className="flex w-full flex-col gap-0.5 pointer-events-none">
                      {dayEvs.slice(0, 2).map((ev, idx) => {
                        const k = (ev.iconName || 'CalendarDays') as IconKey;
                        const bg = ICON_CFG[k]?.bg || 'bg-blue-500';
                        return (
                          <div
                            key={idx}
                            className={`flex w-full items-center gap-0.5 rounded px-0.5 py-px ${selectedDay === day ? 'bg-white/20' : 'bg-white/70 dark:bg-slate-800/70'}`}>
                            <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${selectedDay === day ? 'bg-white' : bg}`} />
                            <span className={`truncate text-[9px] font-medium leading-none ${selectedDay === day ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>
                              {ev.evento}
                            </span>
                          </div>
                        );
                      })}
                      {dayEvs.length > 2 && (
                        <span className={`text-center text-[9px] font-medium ${selectedDay === day ? 'text-white/80' : 'text-slate-400'}`}>
                          +{dayEvs.length - 2}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected day strip */}
          {selectedDay && (
            <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
                  {selectedDay} de {MONTHS_LABEL[calMonth]}
                  <span className="ml-2 font-normal text-slate-400">— {selectedEvents.length} evento{selectedEvents.length !== 1 ? 's' : ''}</span>
                </h3>
                <button onClick={openCreate}
                  className="flex items-center gap-1 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700">
                  <Plus className="h-3 w-3" /> Novo
                </button>
              </div>
              {selectedEvents.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-400">Nenhum evento nesta data</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {selectedEvents.map(ev => (
                    <div key={ev.id} className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                      <IconBadge name={ev.iconName} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-semibold text-slate-900 dark:text-white leading-tight ${!ev.mostrar ? 'opacity-50' : ''}`}>{ev.evento}</p>
                        <div className="mt-1 space-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {ev.horario && <p className="flex items-center gap-1"><Clock className="h-3 w-3" />{ev.horario}</p>}
                          {ev.local && <p className="flex items-center gap-1"><MapPin className="h-3 w-3" />{ev.local}</p>}
                          {ev.ministerio && <p className="flex items-center gap-1"><Tag className="h-3 w-3" />{ev.ministerio}</p>}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button onClick={() => openEdit(ev)} className="rounded p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => setDelId(ev.id)} className="rounded p-1 text-slate-400 hover:bg-red-100 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          </div>{/* end calendar column */}

          {/* Right panel — events of the month, only when there are events */}
          {hasPanel && (
            <div className="hidden lg:flex w-64 xl:w-72 flex-shrink-0 flex-col rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  {MONTHS_LABEL[calMonth]}
                </p>
                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                  {monthEvs.length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto">
                {monthEvs.map(ev => {
                  const { d } = parseDateParts(ev.datareal);
                  const k = (ev.iconName || 'CalendarDays') as IconKey;
                  const bg = ICON_CFG[k]?.bg || 'bg-blue-500';
                  return (
                    <button key={ev.id} onClick={() => setPreviewEvent(ev)}
                      className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-slate-50 transition-colors dark:border-slate-800 dark:hover:bg-slate-900/50">
                      <div className={`flex h-9 w-9 flex-shrink-0 flex-col items-center justify-center rounded-lg ${bg} text-white`}>
                        <span className="text-[10px] font-bold leading-none">{String(d).padStart(2, '0')}</span>
                        <span className="text-[8px] leading-none opacity-80">{WEEKDAYS_PT[new Date(calYear, calMonth, d).getDay()]}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-xs font-semibold text-slate-900 dark:text-white ${!ev.mostrar ? 'opacity-50' : ''}`}>{ev.evento}</p>
                        <div className="flex flex-wrap gap-1.5 mt-0.5 text-[10px] text-slate-400">
                          {ev.horario && <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{ev.horario}</span>}
                          {ev.local && <span className="flex items-center gap-0.5 truncate max-w-[100px]"><MapPin className="h-2.5 w-2.5 flex-shrink-0" />{ev.local}</span>}
                        </div>
                      </div>
                      {!ev.mostrar && <EyeOff className="h-3 w-3 flex-shrink-0 text-slate-300" />}
                      {ev.reservar && <span className="rounded-full bg-indigo-100 px-1.5 py-px text-[9px] font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400">R</span>}
                    </button>
                  );
                })}
              </div>
              <div className="border-t border-slate-100 p-3 dark:border-slate-800">
                <button onClick={openCreate}
                  className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 py-2 text-xs font-medium text-slate-500 hover:border-purple-400 hover:text-purple-600 transition-colors dark:border-slate-700 dark:text-slate-400">
                  <Plus className="h-3 w-3" /> Novo evento
                </button>
              </div>
            </div>
          )}
        </div>
        );
      })()}

      {viewMode === 'ano' ? (
        /* ====== ANO VIEW ====== */
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
          {/* Year nav */}
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={() => setCalYear(calYear - 1)} className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronLeft className="h-5 w-5" /></button>
              <span className="text-xl font-bold text-slate-900 dark:text-white">{calYear}</span>
              <button onClick={() => setCalYear(calYear + 1)} className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronRight className="h-5 w-5" /></button>
            </div>
            <button onClick={() => setCalYear(todayY)} className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400">
              Este ano
            </button>
          </div>
          {/* 12 mini calendars */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {MONTHS_LABEL.map((mLabel, mIdx) => {
              const firstWD = new Date(calYear, mIdx, 1).getDay();
              const daysInM = new Date(calYear, mIdx + 1, 0).getDate();
              const mEvs = events.filter(ev => { const { y, m } = parseDateParts(ev.datareal); return y === calYear && (m - 1) === mIdx; });
              const isCurrentM = calYear === todayY && mIdx === todayM;
              return (
                <div key={mIdx} className={`rounded-xl border p-3 transition-colors cursor-pointer hover:border-purple-300 hover:bg-purple-50/50 dark:hover:border-purple-700 dark:hover:bg-purple-900/10 ${
                  isCurrentM ? 'border-purple-300 bg-purple-50 dark:border-purple-700 dark:bg-purple-900/10' : 'border-slate-100 dark:border-slate-800'
                }`} onClick={() => { setCalMonth(mIdx); setSelectedDay(null); setViewMode('calendar'); }}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className={`text-xs font-bold uppercase tracking-wide ${isCurrentM ? 'text-purple-700 dark:text-purple-400' : 'text-slate-600 dark:text-slate-300'}`}>{mLabel}</span>
                    {mEvs.length > 0 && (
                      <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">{mEvs.length}</span>
                    )}
                  </div>
                  {/* Mini grid */}
                  <div className="grid grid-cols-7 gap-px">
                    {['D','S','T','Q','Q','S','S'].map((d, i) => (
                      <div key={i} className="text-center text-[8px] font-medium text-slate-400">{d}</div>
                    ))}
                    {Array.from({ length: firstWD }).map((_, i) => <div key={`e${i}`} />)}
                    {Array.from({ length: daysInM }).map((_, i) => {
                      const d = i + 1;
                      const hasEv = mEvs.some(ev => parseDateParts(ev.datareal).d === d);
                      const isToday2 = isCurrentM && d === todayD;
                      return (
                        <div key={d} className={`flex h-4 w-full items-center justify-center rounded text-[8px] font-medium ${
                          isToday2 ? 'bg-purple-600 text-white' :
                          hasEv ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                          'text-slate-500 dark:text-slate-500'
                        }`}>{d}</div>
                      );
                    })}
                  </div>
                  {/* Event names */}
                  {mEvs.length > 0 && (
                    <div className="mt-2 space-y-0.5">
                      {mEvs.slice(0, 3).map((ev, i) => {
                        const { d } = parseDateParts(ev.datareal);
                        const k = (ev.iconName || 'CalendarDays') as IconKey;
                        const bg = ICON_CFG[k]?.bg || 'bg-blue-500';
                        return (
                          <div key={i} className="flex items-center gap-1 overflow-hidden">
                            <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${bg}`} />
                            <span className="text-[9px] text-slate-500 dark:text-slate-400 truncate">{String(d).padStart(2,'0')} {ev.evento}</span>
                          </div>
                        );
                      })}
                      {mEvs.length > 3 && <p className="text-[9px] text-slate-400">+{mEvs.length - 3} mais</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      ) : viewMode === 'list' ? (
        /* ====== LIST VIEW ====== */
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-center gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
            <Search className="h-4 w-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar eventos..."
              className="flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none dark:text-white" />
            {search && <button onClick={() => setSearch('')}><X className="h-4 w-4 text-slate-400" /></button>}
            <span className="text-xs text-slate-400">{filtered.length} evento{filtered.length !== 1 ? 's' : ''}</span>
          </div>
          {loading && <div className="flex justify-center py-12"><RefreshCw className="h-6 w-6 animate-spin text-purple-500" /></div>}
          {!loading && filtered.length === 0 && (
            <div className="py-16 text-center">
              <CalendarIcon className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
              <p className="text-slate-500 dark:text-slate-400">{search ? `Nenhum resultado para "${search}"` : `Nenhum evento em ${calYear}.`}</p>
              <button onClick={openCreate} className="mt-4 text-sm font-medium text-purple-600 hover:underline dark:text-purple-400">Adicionar primeiro evento</button>
            </div>
          )}
          {!loading && monthOrder.map(month => (
            <div key={month}>
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-bold uppercase tracking-widest text-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500">
                {month} {calYear}
              </div>
              {grouped[month].map(ev => (
                <div key={ev.id} className="flex items-start gap-4 border-b border-slate-100 p-4 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900/50">
                  <div className="pt-0.5"><IconBadge name={ev.iconName} size="md" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className={`font-semibold text-slate-900 dark:text-white ${!ev.mostrar ? 'opacity-50' : ''}`}>{ev.evento}</p>
                      <div className="flex items-center gap-1">
                        {!ev.mostrar && <EyeOff className="h-3.5 w-3.5 text-slate-400" />}
                        {ev.reservar && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400">Reserva</span>}
                        {ev.tipo === 'pago' && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">R${Number(ev.preco).toFixed(0)}</span>}
                      </div>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1"><CalendarIcon className="h-3 w-3" />
                        {getWeekday(ev.datareal) ? `${getWeekday(ev.datareal)}, ` : ''}{ev.dia}/{String(MONTHS_PT.indexOf(ev.mes) + 1).padStart(2, '0')}
                      </span>
                      {ev.horario && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{ev.horario}</span>}
                      {ev.local && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{ev.local}</span>}
                      {ev.ministerio && <span className="flex items-center gap-1"><Tag className="h-3 w-3" />{ev.ministerio}</span>}
                    </div>
                    {ev.obs && <p className="mt-1 line-clamp-1 text-xs text-slate-400">{ev.obs}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1 pt-0.5">
                    <button onClick={() => openEdit(ev)} className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:border-slate-700"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => setDelId(ev.id)} className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:border-slate-700"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : viewMode === 'dia' ? (
        /* ====== DIA (TIMELINE) VIEW ====== */
        (() => {
          const dayEventsAll = events.filter(ev => {
            const { y, m, d } = parseDateParts(ev.datareal);
            return y === calYear && (m - 1) === calMonth && d === calDay;
          });
          const parseHour = (h?: string) => {
            if (!h) return -1;
            const m = h.match(/(\d{1,2})[h:](\d{0,2})/i);
            if (!m) return -1;
            return parseInt(m[1]);
          };
          const hours = Array.from({ length: 18 }, (_, i) => i + 6); // 06 to 23
          const withHour = dayEventsAll.filter(ev => parseHour(ev.horario) >= 0);
          const noHour = dayEventsAll.filter(ev => parseHour(ev.horario) < 0);

          const prevDay = () => {
            const prev = new Date(calYear, calMonth, calDay - 1);
            setCalYear(prev.getFullYear()); setCalMonth(prev.getMonth()); setCalDay(prev.getDate());
          };
          const nextDay = () => {
            const next = new Date(calYear, calMonth, calDay + 1);
            setCalYear(next.getFullYear()); setCalMonth(next.getMonth()); setCalDay(next.getDate());
          };

          return (
            <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
              {/* Day nav */}
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <button onClick={prevDay} className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronLeft className="h-5 w-5" /></button>
                  <h3 className="font-semibold text-slate-900 dark:text-white">
                    {getWeekday(`${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(calDay).padStart(2,'0')}`)}, {calDay} de {MONTHS_LABEL[calMonth]} {calYear}
                  </h3>
                  <button onClick={nextDay} className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronRight className="h-5 w-5" /></button>
                </div>
                <button onClick={() => { setCalYear(todayY); setCalMonth(todayM); setCalDay(todayD); }}
                  className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400">
                  Hoje
                </button>
              </div>
              {/* Timeline */}
              <div className="overflow-y-auto max-h-[60vh] px-5 py-3">
                {noHour.length > 0 && (
                  <div className="mb-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
                    <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Horario a confirmar</p>
                    <div className="space-y-2">
                      {noHour.map(ev => (
                        <button key={ev.id} onClick={() => setPreviewEvent(ev)}
                          className="flex w-full items-center gap-3 rounded-lg bg-white p-2.5 shadow-sm hover:shadow-md transition-shadow dark:bg-slate-800 text-left">
                          <IconBadge name={ev.iconName} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{ev.evento}</p>
                            {ev.local && <p className="truncate text-xs text-slate-400">{ev.local}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-0">
                  {hours.map(hour => {
                    const slotEvs = withHour.filter(ev => parseHour(ev.horario) === hour);
                    const isCurrentHour = calYear === todayY && calMonth === todayM && calDay === todayD && new Date().getHours() === hour;
                    return (
                      <div key={hour} className={`flex gap-3 border-t py-2 ${isCurrentHour ? 'border-purple-300 bg-purple-50/50 dark:border-purple-700 dark:bg-purple-900/10' : 'border-slate-100 dark:border-slate-800/60'}`}>
                        <span className={`w-10 flex-shrink-0 text-right text-xs font-mono tabular-nums ${isCurrentHour ? 'font-bold text-purple-600 dark:text-purple-400' : 'text-slate-400'}`}>
                          {String(hour).padStart(2, '0')}:00
                        </span>
                        <div className="flex flex-1 flex-wrap gap-2 pb-1">
                          {slotEvs.map(ev => (
                            <button key={ev.id} onClick={() => setPreviewEvent(ev)}
                              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-left shadow-sm hover:shadow-md transition-shadow ${ICON_CFG[(ev.iconName || 'CalendarDays') as IconKey]?.bg || 'bg-blue-500'} text-white min-w-[140px]`}>
                              <IconBadge name={ev.iconName} size="sm" />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold leading-tight">{ev.evento}</p>
                                {ev.horario && <p className="text-xs text-white/80">{ev.horario}{ev.local ? ` · ${ev.local}` : ''}</p>}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {dayEventsAll.length === 0 && (
                  <div className="py-16 text-center">
                    <CalendarIcon className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
                    <p className="text-slate-500 dark:text-slate-400">Nenhum evento neste dia</p>
                    <button onClick={openCreate} className="mt-3 text-sm font-medium text-purple-600 hover:underline">Adicionar evento</button>
                  </div>
                )}
              </div>
            </div>
          );
        })()
      ) : null}

      {/* ====== DAY EVENTS MODAL ====== */}
      {dayModalDay !== null && (() => {
        const dayEvs = eventsForDay(dayModalDay);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setDayModalDay(null)}>
            <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">
                    {dayModalDay} de {MONTHS_LABEL[calMonth]}
                  </h3>
                  <p className="text-xs text-slate-400">{getWeekday(`${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(dayModalDay).padStart(2,'0')}`)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setDayModalDay(null); openCreate(); }}
                    className="flex items-center gap-1 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700">
                    <Plus className="h-3 w-3" /> Novo
                  </button>
                  <button onClick={() => setDayModalDay(null)} className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
                    <X className="h-4 w-4 text-slate-400" />
                  </button>
                </div>
              </div>
              <div className="max-h-80 overflow-y-auto p-3 space-y-2">
                {dayEvs.map(ev => (
                  <button key={ev.id} onClick={() => { setDayModalDay(null); setPreviewEvent(ev); }}
                    className="flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-left hover:bg-slate-100 transition-colors dark:border-slate-800 dark:bg-slate-800/50 dark:hover:bg-slate-800">
                    <IconBadge name={ev.iconName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{ev.evento}</p>
                      <div className="flex flex-wrap gap-2 mt-0.5 text-xs text-slate-400">
                        {ev.horario && <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{ev.horario}</span>}
                        {ev.local && <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" />{ev.local}</span>}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ====== PREVIEW MODAL ====== */}
      {previewEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setPreviewEvent(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-4 border-b border-slate-100 p-5 dark:border-slate-800">
              <IconBadge name={previewEvent.iconName} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900 dark:text-white leading-snug">{previewEvent.evento}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {getWeekday(previewEvent.datareal)}, {previewEvent.dia}/{String(MONTHS_PT.indexOf(previewEvent.mes) + 1).padStart(2, '0')}/{previewEvent.ano}
                </p>
              </div>
              <button onClick={() => setPreviewEvent(null)} className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <div className="space-y-2 p-5 text-sm text-slate-600 dark:text-slate-400">
              {previewEvent.horario && (
                <div className="flex items-center gap-2"><Clock className="h-4 w-4 flex-shrink-0 text-slate-400" />{previewEvent.horario}</div>
              )}
              {previewEvent.local && (
                <div className="flex items-center gap-2"><MapPin className="h-4 w-4 flex-shrink-0 text-slate-400" />{previewEvent.local}</div>
              )}
              {previewEvent.ministerio && (
                <div className="flex items-center gap-2"><Tag className="h-4 w-4 flex-shrink-0 text-slate-400" />{previewEvent.ministerio}{previewEvent.departamento ? ` · ${previewEvent.departamento}` : ''}</div>
              )}
              {previewEvent.obs && (
                <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800">{previewEvent.obs}</p>
              )}
              {previewEvent.tipo === 'pago' && previewEvent.preco > 0 && (
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">R$ {Number(previewEvent.preco).toFixed(2).replace('.', ',')}</span>
                </div>
              )}
              {previewEvent.reservar && (
                <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400">Reserva habilitada</span>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
              <button onClick={() => setDelId(previewEvent.id)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm text-slate-500 hover:border-red-200 hover:text-red-600 dark:border-slate-700">
                <Trash2 className="h-4 w-4" />
              </button>
              <button onClick={() => openEdit(previewEvent)}
                className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-purple-700">
                <Pencil className="h-3.5 w-3.5" /> Editar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== CREATE/EDIT MODAL ====== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
              <h2 className="font-semibold text-slate-900 dark:text-white">{editing ? 'Editar Evento' : 'Novo Evento'}</h2>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {formErr && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />{formErr}
                </div>
              )}
              <div>
                <label className={labelCls}>Icone e Nome *</label>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setShowIcons(true)} className="flex-shrink-0 transition-transform hover:scale-110">
                    <IconBadge name={form.iconName} size="lg" />
                  </button>
                  <input className={inputCls} placeholder="Nome do evento" value={form.evento} onChange={e => setForm(p => ({ ...p, evento: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Data *</label>
                  <input type="date" className={inputCls} value={form.datareal} onChange={e => setForm(p => ({ ...p, datareal: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Horario</label>
                  <input className={inputCls} placeholder="ex: 19h30" value={form.horario} onChange={e => setForm(p => ({ ...p, horario: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Local</label>
                <input className={inputCls} placeholder="Local do evento" value={form.local} onChange={e => setForm(p => ({ ...p, local: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Ministerio</label>
                  <input className={inputCls} placeholder="ex: Louvor" value={form.ministerio} onChange={e => setForm(p => ({ ...p, ministerio: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Departamento</label>
                  <input className={inputCls} placeholder="ex: Jovens" value={form.departamento} onChange={e => setForm(p => ({ ...p, departamento: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Observacoes</label>
                <textarea className={inputCls + ' resize-none'} rows={2} placeholder="Detalhes adicionais..." value={form.obs} onChange={e => setForm(p => ({ ...p, obs: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Tipo</label>
                  <select className={inputCls} value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}>
                    <option value="gratuito">Gratuito</option>
                    <option value="pago">Pago</option>
                  </select>
                </div>
                {form.tipo === 'pago' && (
                  <div>
                    <label className={labelCls}>Preco (R$)</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">R$</span>
                      <input
                        type="text" inputMode="decimal" className={inputCls + ' pl-9'}
                        placeholder="0,00"
                        value={precoBRL}
                        onChange={e => {
                          // Keep only digits
                          const digits = e.target.value.replace(/\D/g, '');
                          const cents = parseInt(digits || '0', 10);
                          const num = cents / 100;
                          // Format as BRL: 1.234,56
                          const formatted = num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                          setPrecoBRL(digits === '0' || digits === '' ? '' : formatted);
                          setForm(p => ({ ...p, preco: num }));
                        }}
                        onBlur={() => {
                          if (form.preco > 0)
                            setPrecoBRL(form.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-6">
                {([
                  { key: 'mostrar' as const, label: form.mostrar ? 'Visivel' : 'Oculto', icon: form.mostrar ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" /> },
                  { key: 'reservar' as const, label: 'Permite Reserva', icon: null },
                ]).map(({ key, label, icon }) => (
                  <label key={key} className="flex cursor-pointer items-center gap-2 select-none">
                    <div onClick={() => setForm(p => ({ ...p, [key]: !p[key] }))}
                      className={`relative h-5 w-9 rounded-full transition-colors ${form[key] ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                      <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form[key] ? 'translate-x-4' : ''}`} />
                    </div>
                    <span className="flex items-center gap-1 text-sm text-slate-700 dark:text-slate-300">{icon}{label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4 dark:border-slate-700">
              <button onClick={() => setShowModal(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60 shadow">
                {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== DELETE CONFIRM ====== */}
      {delId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-80 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <h3 className="mb-2 font-semibold text-slate-900 dark:text-white">Excluir evento?</h3>
            <p className="mb-5 text-sm text-slate-500">Esta acao nao pode ser desfeita.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDelId(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">Cancelar</button>
              <button onClick={() => handleDelete(delId)} disabled={deleting} className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                {deleting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== ICON PICKER ====== */}
      {showIcons && <IconPicker value={form.iconName || 'CalendarDays'} onChange={v => setForm(p => ({ ...p, iconName: v }))} onClose={() => setShowIcons(false)} />}

      {/* ====== CSV IMPORT MODAL ====== */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-purple-600" />
                <h2 className="font-semibold text-slate-900 dark:text-white">Importar CSV</h2>
              </div>
              <button onClick={() => setShowImport(false)} className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
            </div>

            {/* Steps */}
            <div className="flex items-center gap-0 border-b border-slate-100 px-6 py-3 dark:border-slate-800">
              {([
                { key: 'upload', label: '1. Arquivo' },
                { key: 'map',    label: '2. Mapeamento' },
                { key: 'import', label: '3. Resultado' },
              ] as const).map((s, i) => (
                <div key={s.key} className="flex items-center">
                  {i > 0 && <div className="mx-2 h-px w-8 bg-slate-200 dark:bg-slate-700" />}
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${importStep === s.key ? 'bg-purple-600 text-white' : 'text-slate-400'}`}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6">

              {/* STEP 1 */}
              {importStep === 'upload' && (
                <div className="flex flex-col gap-6">
                  <div className="w-full rounded-xl border-2 border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
                    <Upload className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                    <p className="mb-1 font-medium text-slate-700 dark:text-slate-300">Selecione um arquivo CSV</p>
                    <p className="mb-4 text-xs text-slate-400">Formato: UTF-8, separado por virgula</p>
                    <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
                    <button onClick={() => fileRef.current?.click()}
                      className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700">
                      Escolher arquivo
                    </button>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                    <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Colunas suportadas</p>
                    <div className="grid grid-cols-2 gap-1">
                      {CSV_COLUMNS.map(c => (
                        <div key={c.key} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                          <span className={`h-1.5 w-1.5 rounded-full ${c.required ? 'bg-red-500' : 'bg-slate-300'}`} />
                          <code className="font-mono">{c.key}</code>
                          {c.required && <span className="text-[10px] text-red-500">*</span>}
                          <span className="text-slate-400">— {c.description}</span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[10px] text-slate-400">* Obrigatorio</p>
                  </div>
                  {importErrors.length > 0 && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 space-y-1">
                      {importErrors.map((e, i) => <p key={i}>{e}</p>)}
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2 */}
              {importStep === 'map' && (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950">
                    <CheckCircle className="h-5 w-5 flex-shrink-0 text-emerald-600" />
                    <span className="text-sm">
                      <span className="font-semibold text-emerald-800 dark:text-emerald-300">{csvRows.length} linhas</span>
                      <span className="text-emerald-700 dark:text-emerald-400"> encontradas no arquivo</span>
                    </span>
                  </div>

                  <div>
                    <p className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Mapear colunas</p>
                    <div className="space-y-2">
                      {CSV_COLUMNS.map(col => {
                        const mapped = importMapping[col.key];
                        const isMissing = col.required && !mapped;
                        return (
                          <div key={col.key} className={`flex items-center gap-3 rounded-lg border p-2.5 ${isMissing ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950' : mapped ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30' : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800'}`}>
                            <div className="w-32 flex-shrink-0">
                              <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">{col.key}</span>
                              {col.required && <span className="ml-0.5 text-[10px] text-red-500">*</span>}
                            </div>
                            <ChevronRight className="h-3 w-3 flex-shrink-0 text-slate-300" />
                            <select value={mapped || ''} onChange={e => setImportMapping(p => ({ ...p, [col.key]: e.target.value }))}
                              className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                              <option value="">(nao importar)</option>
                              {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                            {isMissing
                              ? <XCircle className="h-4 w-4 flex-shrink-0 text-red-500" />
                              : mapped
                                ? <CheckCircle className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                                : <div className="h-4 w-4" />
                            }
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Previa — 5 primeiros registros</p>
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800">
                          <tr>
                            {csvHeaders.map(h => (
                              <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {csvRows.slice(0, 5).map((row, i) => (
                            <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                              {csvHeaders.map(h => (
                                <td key={h} className="max-w-[120px] truncate px-3 py-2 text-slate-700 dark:text-slate-300">{row[h]}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {importErrors.length > 0 && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 space-y-1">
                      {importErrors.map((e, i) => <p key={i}>{e}</p>)}
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3 */}
              {importStep === 'import' && (
                <div className="flex flex-col items-center gap-4 py-6">
                  <div className={`flex h-16 w-16 items-center justify-center rounded-full ${importErrors.length ? 'bg-amber-100' : 'bg-emerald-100'}`}>
                    {importErrors.length ? <AlertCircle className="h-8 w-8 text-amber-600" /> : <CheckCircle className="h-8 w-8 text-emerald-600" />}
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-slate-900 dark:text-white">
                      {importDone} evento{importDone !== 1 ? 's' : ''} importado{importDone !== 1 ? 's' : ''}
                    </p>
                    {importErrors.length > 0 && (
                      <p className="mt-1 text-sm text-amber-600">{importErrors.length} linha{importErrors.length !== 1 ? 's' : ''} com erro</p>
                    )}
                  </div>
                  {importErrors.length > 0 && (
                    <div className="w-full max-h-40 overflow-y-auto rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 space-y-1">
                      {importErrors.map((e, i) => <p key={i}>{e}</p>)}
                    </div>
                  )}
                  <button onClick={() => setShowImport(false)}
                    className="rounded-xl bg-purple-600 px-6 py-2 text-sm font-semibold text-white hover:bg-purple-700">
                    Fechar
                  </button>
                </div>
              )}
            </div>

            {importStep !== 'import' && (
              <div className="flex justify-between border-t border-slate-200 px-6 py-4 dark:border-slate-700">
                <button onClick={() => importStep === 'map' ? setImportStep('upload') : setShowImport(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">
                  {importStep === 'map' ? 'Voltar' : 'Cancelar'}
                </button>
                {importStep === 'map' && (
                  <button onClick={handleImport} disabled={importing}
                    className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60">
                    {importing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {importing ? 'Importando...' : `Importar ${csvRows.length} registros`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
