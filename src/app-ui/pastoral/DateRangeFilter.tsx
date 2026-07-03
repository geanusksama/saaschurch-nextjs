/**
 * Filtro de intervalo de datas com presets (Hoje, Ontem, Semana, Mês,
 * Mês anterior, Personalizado). Usado nas abas Envio em Massa e Envios.
 *
 * Sempre expõe um intervalo válido (from/to no formato YYYY-MM-DD) — o
 * chamador decide o default inicial (ex.: mês atual).
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

export interface DateRangeFilterProps {
  dateFrom: string;
  dateTo: string;
  onChange: (from: string, to: string) => void;
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function startOfWeek(d: Date): Date {
  const day = d.getDay(); // 0=domingo
  const diff = (day === 0 ? 6 : day - 1); // volta até segunda-feira
  const start = new Date(d);
  start.setDate(d.getDate() - diff);
  return start;
}

/** Intervalo padrão sugerido para uma nova busca: mês atual (início a fim). */
export function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  return { from: toIso(startOfMonth(now)), to: toIso(endOfMonth(now)) };
}

type PresetKey = 'todos' | 'hoje' | 'ontem' | 'semana' | 'mes' | 'mes_anterior' | 'personalizado';

function presetRange(key: Exclude<PresetKey, 'personalizado'>): { from: string; to: string } {
  const now = new Date();
  if (key === 'todos') return { from: '', to: '' };
  if (key === 'hoje') return { from: toIso(now), to: toIso(now) };
  if (key === 'ontem') {
    const y = new Date(now); y.setDate(now.getDate() - 1);
    return { from: toIso(y), to: toIso(y) };
  }
  if (key === 'semana') return { from: toIso(startOfWeek(now)), to: toIso(now) };
  if (key === 'mes') return { from: toIso(startOfMonth(now)), to: toIso(endOfMonth(now)) };
  // mes_anterior
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { from: toIso(startOfMonth(prevMonth)), to: toIso(endOfMonth(prevMonth)) };
}

const PRESETS: Array<{ key: Exclude<PresetKey, 'personalizado'>; label: string }> = [
  { key: 'todos', label: 'Todos os períodos' },
  { key: 'hoje', label: 'Hoje' },
  { key: 'ontem', label: 'Ontem' },
  { key: 'semana', label: 'Esta semana' },
  { key: 'mes', label: 'Este mês' },
  { key: 'mes_anterior', label: 'Mês anterior' },
];

function activePreset(from: string, to: string): PresetKey {
  if (!from && !to) return 'todos';
  for (const p of PRESETS) {
    const r = presetRange(p.key);
    if (r.from === from && r.to === to) return p.key;
  }
  return 'personalizado';
}

function fmtBr(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export default function DateRangeFilter({ dateFrom, dateTo, onChange }: DateRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(dateFrom);
  const [customTo, setCustomTo] = useState(dateTo);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setCustomFrom(dateFrom); setCustomTo(dateTo); }, [dateFrom, dateTo]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const applyPreset = useCallback((key: Exclude<PresetKey, 'personalizado'>) => {
    const r = presetRange(key);
    onChange(r.from, r.to);
    setOpen(false);
  }, [onChange]);

  const applyCustom = () => {
    if (customFrom && customTo) {
      onChange(customFrom, customTo);
      setOpen(false);
    }
  };

  const preset = activePreset(dateFrom, dateTo);
  const presetLabel = PRESETS.find(p => p.key === preset)?.label;
  const label = presetLabel ?? (dateFrom && dateTo
    ? (dateFrom === dateTo ? fmtBr(dateFrom) : `${fmtBr(dateFrom)} – ${fmtBr(dateTo)}`)
    : 'Selecionar período');

  return (
    <div className="flex flex-col gap-1 relative" ref={rootRef}>
      <label className="text-xs font-medium text-slate-500">Período</label>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="h-9 px-3 rounded-lg border border-slate-200 text-sm bg-white inline-flex items-center gap-2 hover:border-slate-300 min-w-[190px]"
      >
        <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <span className="truncate">{label}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-auto flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-30 bg-white rounded-xl border border-slate-200 shadow-lg p-3 flex gap-3 w-max">
          <div className="flex flex-col gap-1 min-w-[140px]">
            {PRESETS.map(p => (
              <button key={p.key} onClick={() => applyPreset(p.key)}
                className={`text-left text-sm px-2.5 py-1.5 rounded-lg hover:bg-slate-50
                  ${preset === p.key ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-slate-600'}`}>
                {p.label}
              </button>
            ))}
            <div className={`text-left text-sm px-2.5 py-1.5 rounded-lg
              ${preset === 'personalizado' ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-slate-400'}`}>
              Personalizado
            </div>
          </div>
          <div className="flex flex-col gap-2 border-l border-slate-100 pl-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-slate-400">De</label>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="h-8 px-2 rounded-lg border border-slate-200 text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-slate-400">Até</label>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="h-8 px-2 rounded-lg border border-slate-200 text-sm" />
            </div>
            <button onClick={applyCustom} disabled={!customFrom || !customTo}
              className="h-8 px-3 rounded-lg bg-slate-800 text-white text-xs font-semibold hover:bg-slate-700 disabled:opacity-40">
              Aplicar personalizado
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
