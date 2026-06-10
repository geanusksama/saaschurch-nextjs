'use client';

import { useState, useRef, useEffect, useId, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { DayPicker, type DateRange } from 'react-day-picker';
import {
  format, isValid, parse, isSameDay,
  startOfMonth, endOfMonth, subMonths, addMonths, subDays, startOfWeek, endOfWeek,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarDays, X, ChevronRight, ChevronLeft } from 'lucide-react';

const rdpCss = `
.rdp-root{--rdp-accent:#1e293b;font-family:inherit;font-size:.82rem;user-select:none;width:100%}
.rdp-months{display:flex;gap:12px;flex-wrap:wrap;width:100%}
.rdp-month{min-width:0;flex:1;width:100%}
.rdp-month_caption{display:flex;align-items:center;justify-content:space-between;padding:6px 4px 4px;font-size:.8rem;font-weight:700;color:#0f172a;width:100%}
.rdp-nav{display:flex;gap:4px;align-items:center}
.rdp-button_previous,.rdp-button_next{background:none;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer;padding:3px 7px;color:#64748b;line-height:1;transition:background .12s,border-color .12s;font-size:.75rem}
.rdp-button_previous:hover,.rdp-button_next:hover{background:#f8fafc;border-color:#cbd5e1}
.rdp-month_grid{width:100%;table-layout:fixed;border-collapse:collapse}
.rdp-weekdays{width:100%}
.rdp-weekday{text-align:center;font-size:.62rem;font-weight:700;color:#94a3b8;padding:5px 0 3px;text-transform:uppercase;letter-spacing:.04em;width:calc(100%/7)}
.rdp-week{width:100%}
.rdp-day{text-align:center;position:relative;width:calc(100%/7)}
.rdp-day_button{width:100%;height:36px;border:none;background:none;border-radius:8px;cursor:pointer;font-size:.82rem;color:#334155;transition:background .1s,color .1s;display:flex;align-items:center;justify-content:center;margin:0;outline:none;box-sizing:border-box}
.rdp-day_button:hover{background:#e2e8f0;color:#0f172a}
.rdp-selected .rdp-day_button,.rdp-range_start .rdp-day_button,.rdp-range_end .rdp-day_button{background:#1e293b!important;color:#fff!important;font-weight:700}
.rdp-range_start .rdp-day_button{border-radius:8px 0 0 8px}
.rdp-range_end .rdp-day_button{border-radius:0 8px 8px 0}
.rdp-range_start.rdp-range_end .rdp-day_button{border-radius:8px}
.rdp-range_middle{background:#e2e8f0}
.rdp-range_middle .rdp-day_button{background:transparent;color:#1e293b;border-radius:0;font-weight:500}
.rdp-range_middle .rdp-day_button:hover{background:#cbd5e1}
.rdp-outside .rdp-day_button{color:#cbd5e1}
.rdp-disabled .rdp-day_button{color:#e2e8f0;cursor:default;pointer-events:none}
.rdp-today .rdp-day_button{color:#2563eb;font-weight:700}
.rdp-selected.rdp-today .rdp-day_button,.rdp-range_start.rdp-today .rdp-day_button,.rdp-range_end.rdp-today .rdp-day_button{color:#fff}
.rdp-hidden{visibility:hidden}
.rdp-dropdowns{display:flex;gap:4px;align-items:center}
.rdp-dropdown{appearance:none;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;cursor:pointer;font-size:.78rem;font-weight:600;color:#0f172a;padding:2px 22px 2px 6px;outline:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2394a3b8'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 5px center;transition:border-color .12s}
.rdp-dropdown:hover{border-color:#94a3b8}
.rdp-dropdown:focus{border-color:#3b82f6;box-shadow:0 0 0 2px #bfdbfe}
.rdp-caption_label{display:none}
.rdp-nav{display:none}
`;

interface DateRangePickerProps {
  from: string;
  to: string;
  onChangeFrom: (v: string) => void;
  onChangeTo: (v: string) => void;
  className?: string;
}

function toDateVal(iso: string): Date | undefined {
  if (!iso) return undefined;
  const d = parse(iso, 'yyyy-MM-dd', new Date());
  return isValid(d) ? d : undefined;
}
function toIso(d: Date | undefined): string {
  return d && isValid(d) ? format(d, 'yyyy-MM-dd') : '';
}
function now() { return new Date(); }

const PRESETS = [
  { label: 'Hoje',            from: () => now(),                              to: () => now() },
  { label: 'Esta semana',     from: () => startOfWeek(now(), { weekStartsOn: 0 }), to: () => endOfWeek(now(), { weekStartsOn: 0 }) },
  { label: 'Este mês',        from: () => startOfMonth(now()),                to: () => endOfMonth(now()) },
  { label: 'Mês anterior',    from: () => startOfMonth(subMonths(now(), 1)), to: () => endOfMonth(subMonths(now(), 1)) },
  { label: 'Últimos 7 dias',  from: () => subDays(now(), 6),                 to: () => now() },
  { label: 'Últimos 30 dias', from: () => subDays(now(), 29),                to: () => now() },
  { label: 'Últimos 3 meses', from: () => startOfMonth(subMonths(now(), 2)), to: () => endOfMonth(now()) },
  { label: 'Este ano',        from: () => new Date(now().getFullYear(), 0, 1), to: () => new Date(now().getFullYear(), 11, 31) },
];

export function DateRangePicker({ from, to, onChangeFrom, onChangeTo, className = '' }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange>({});
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const [isMobile, setIsMobile] = useState(false);
  const [displayMonth, setDisplayMonth] = useState<Date>(now());
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const styleId = useId();

  const fromDate = toDateVal(from);
  const toDateVal_ = toDateVal(to);

  const calcPosition = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const mobile = vw < 640;
    setIsMobile(mobile);

    if (mobile) {
      // Centralizado horizontalmente, abaixo do botão
      setStyle({
        position: 'fixed',
        top: rect.bottom + 6,
        left: 8,
        right: 8,
        zIndex: 9999,
      });
    } else {
      const popWidth = 520; // presets(140) + calendar(380)
      let left = rect.left + window.scrollX;
      if (left + popWidth > vw - 8) left = vw - popWidth - 8;
      if (left < 8) left = 8;
      setStyle({
        position: 'absolute',
        top: rect.bottom + window.scrollY + 6,
        left,
        width: popWidth,
        zIndex: 9999,
      });
    }
  }, []);

  function openPicker() {
    calcPosition();
    setDraft({ from: fromDate, to: toDateVal_ });
    setDisplayMonth(fromDate ?? now());
    setActivePreset(null);
    setOpen(true);
  }

  function handleSelect(r: DateRange | undefined) {
    setDraft(r ?? {});
    setActivePreset(null);
  }

  function applyPreset(preset: typeof PRESETS[0]) {
    const f = preset.from();
    setDraft({ from: f, to: preset.to() });
    setDisplayMonth(f);
    setActivePreset(preset.label);
  }

  function handleApply() {
    if (draft.from) {
      onChangeFrom(toIso(draft.from));
      onChangeTo(toIso(draft.to ?? draft.from));
    }
    setOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChangeFrom(toIso(startOfMonth(now())));
    onChangeTo(toIso(endOfMonth(now())));
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onResize() { calcPosition(); }
    document.addEventListener('mousedown', onDown);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('resize', onResize);
    };
  }, [open, calcPosition]);

  const label =
    fromDate && toDateVal_
      ? `${format(fromDate, 'dd/MM/yyyy')} – ${format(toDateVal_, 'dd/MM/yyyy')}`
      : fromDate
        ? `${format(fromDate, 'dd/MM/yyyy')} – ...`
        : 'Selecionar período';

  const draftLabel =
    draft.from && draft.to
      ? isSameDay(draft.from, draft.to)
        ? format(draft.from, "dd 'de' MMM 'de' yyyy", { locale: ptBR })
        : `${format(draft.from, "dd 'de' MMM", { locale: ptBR })} → ${format(draft.to, "dd 'de' MMM 'de' yyyy", { locale: ptBR })}`
      : draft.from
        ? `${format(draft.from, "dd 'de' MMM", { locale: ptBR })} → selecione a data final`
        : 'Clique em um dia para iniciar';

  const months = isMobile ? 1 : 2;

  const popover = open ? (
    <div ref={popRef} style={style} className="rounded-2xl border border-slate-200 bg-white shadow-2xl ring-1 ring-black/5 overflow-hidden">
      <div className="flex">

        {/* Presets — oculto no mobile */}
        {!isMobile && (
          <div className="w-36 shrink-0 border-r border-slate-100 bg-slate-50 py-3">
            <p className="px-3 pb-2 text-[9px] font-bold uppercase tracking-widest text-slate-400">Atalhos</p>
            {PRESETS.map(p => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p)}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition-colors ${
                  activePreset === p.label
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {p.label}
                {activePreset === p.label && <ChevronRight className="h-3 w-3 shrink-0" />}
              </button>
            ))}
          </div>
        )}

        {/* Calendar */}
        <div className="flex-1 min-w-0 p-3 overflow-x-hidden w-full">
          {/* Presets mobile — chips horizontais */}
          {isMobile && (
            <div className="mb-2 flex flex-wrap gap-1">
              {PRESETS.map(p => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition-colors ${
                    activePreset === p.label
                      ? 'border-slate-800 bg-slate-800 text-white'
                      : 'border-slate-200 text-slate-600 hover:border-slate-400'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          <DayPicker
            mode="range"
            selected={draft as DateRange}
            onSelect={handleSelect}
            locale={ptBR}
            month={displayMonth}
            onMonthChange={setDisplayMonth}
            numberOfMonths={months}
            captionLayout="dropdown"
            startMonth={new Date(2015, 0)}
            endMonth={new Date(now().getFullYear() + 2, 11)}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-3 py-2.5 gap-2">
        {/* Setas de navegação de mês */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            title="Mês anterior"
            onClick={() => setDisplayMonth(m => subMonths(m, 1))}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:border-slate-300 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Próximo mês"
            onClick={() => setDisplayMonth(m => addMonths(m, 1))}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:border-slate-300 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <span className="truncate text-xs text-slate-400 min-w-0 flex-1 text-center">{draftLabel}</span>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!draft.from}
            className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <style id={`rdp-${styleId.replace(/:/g, '')}`}>{rdpCss}</style>

      <div className={className}>
        <button
          ref={btnRef}
          type="button"
          onClick={openPicker}
          className="flex h-8 min-w-[200px] items-center gap-2 rounded border border-slate-300 bg-white px-2 text-left text-xs text-slate-700 outline-none transition-colors hover:border-blue-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 whitespace-nowrap"
        >
          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="flex-1 truncate">{label}</span>
          <span
            role="button"
            tabIndex={0}
            title="Restaurar mês atual"
            onClick={handleClear}
            onKeyDown={e => { if (e.key === 'Enter') handleClear(e as unknown as React.MouseEvent); }}
            className="flex h-4 w-4 items-center justify-center rounded text-slate-300 hover:text-slate-600"
          >
            <X className="h-3 w-3" />
          </span>
        </button>
      </div>

      {typeof document !== 'undefined' && popover
        ? createPortal(popover, document.body)
        : null}
    </>
  );
}
