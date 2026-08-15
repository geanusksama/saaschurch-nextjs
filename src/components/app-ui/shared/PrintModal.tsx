import { Printer, X } from 'lucide-react';
import { useState } from 'react';
import type { PrintOrientation } from '../../../lib/printReport';

export interface SortOption {
  value: string;
  label: string;
}

export interface ColumnOption {
  value: string;
  label: string;
  defaultChecked?: boolean;
}

export interface GroupOption {
  value: string;
  label: string;
}

interface PrintModalProps {
  open: boolean;
  onClose: () => void;
  /**
   * O 4º argumento é o agrupamento escolhido: `boolean` na versão antiga
   * (`showGroupBy`, agrupa por regional/igreja) ou o `value` da opção escolhida
   * quando a tela passa `groupOptions` — '' quando o usuário não quer agrupar.
   */
  onPrint: (orientation: PrintOrientation, sortBy: string, selectedColumns: string[], groupBy?: boolean | string) => void;
  sortOptions: SortOption[];
  columnOptions: ColumnOption[];
  defaultSort?: string;
  showGroupBy?: boolean;
  /** Agrupamentos livres (credor, plano de contas, status…). Tem precedência sobre `showGroupBy`. */
  groupOptions?: GroupOption[];
}

export function PrintModal({ open, onClose, onPrint, sortOptions, columnOptions, defaultSort, showGroupBy, groupOptions }: PrintModalProps) {
  const [orientation, setOrientation] = useState<PrintOrientation>('portrait');
  const [sortBy, setSortBy] = useState(defaultSort || sortOptions[0]?.value || '');
  const [selectedCols, setSelectedCols] = useState<Set<string>>(
    () => new Set(columnOptions.filter((c) => c.defaultChecked !== false).map((c) => c.value))
  );
  const [groupByChurch, setGroupByChurch] = useState(false);
  const [groupBy, setGroupBy] = useState('');

  if (!open) return null;

  function toggleCol(value: string) {
    setSelectedCols((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        if (next.size > 1) next.delete(value); // garante pelo menos 1 coluna
      } else {
        next.add(value);
      }
      return next;
    });
  }

  function toggleAll() {
    if (selectedCols.size === columnOptions.length) {
      setSelectedCols(new Set([columnOptions[0].value]));
    } else {
      setSelectedCols(new Set(columnOptions.map((c) => c.value)));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            <span className="font-semibold text-slate-900 dark:text-white text-sm">Imprimir relatório</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Orientation */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
              Orientação
            </label>
            <div className="flex gap-3">
              {([
                { value: 'portrait', label: 'Retrato', icon: '▯' },
                { value: 'landscape', label: 'Paisagem', icon: '▭' },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setOrientation(opt.value)}
                  className={`flex-1 flex flex-col items-center gap-1.5 rounded-xl border-2 py-3 text-sm font-medium transition-all ${
                    orientation === opt.value
                      ? 'border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400'
                      : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <span className="text-xl leading-none">{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sort by */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
              Ordenar por
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Columns */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Colunas
              </label>
              <button
                onClick={toggleAll}
                className="text-xs text-purple-600 hover:text-purple-800 dark:text-purple-400 font-medium"
              >
                {selectedCols.size === columnOptions.length ? 'Desmarcar todas' : 'Marcar todas'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {columnOptions.map((col) => (
                <label
                  key={col.value}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-all ${
                    selectedCols.has(col.value)
                      ? 'border-purple-400 bg-purple-50 text-purple-800 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-700'
                      : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedCols.has(col.value)}
                    onChange={() => toggleCol(col.value)}
                    className="accent-purple-600 w-3.5 h-3.5"
                  />
                  {col.label}
                </label>
              ))}
            </div>
          </div>

          {/* Agrupamento livre */}
          {groupOptions?.length ? (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                Agrupar por
              </label>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Sem agrupamento</option>
                {groupOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          ) : null}

          {/* Group by church */}
          {!groupOptions?.length && showGroupBy ? (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                Agrupamento
              </label>
              <label className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-all ${
                groupByChurch
                  ? 'border-purple-400 bg-purple-50 text-purple-800 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-700'
                  : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-300'
              }`}>
                <input
                  type="checkbox"
                  checked={groupByChurch}
                  onChange={(e) => setGroupByChurch(e.target.checked)}
                  className="accent-purple-600 w-3.5 h-3.5"
                />
                Agrupar por Regional / Igreja
              </label>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-200 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              const agrupamento = groupOptions?.length ? groupBy : (showGroupBy ? groupByChurch : undefined);
              onPrint(orientation, sortBy, [...selectedCols], agrupamento);
              onClose();
            }}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}
