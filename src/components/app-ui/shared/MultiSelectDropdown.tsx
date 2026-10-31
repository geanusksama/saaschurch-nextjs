import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';

/**
 * Seletor de várias opções com caixas de marcar — o mesmo da Lista de Membros
 * (Members.tsx), extraído para outras telas de consulta usarem igual.
 *
 * null     = todos (sem filtro)
 * string[] = seleção explícita (vazio = nenhum marcado)
 */
export function MultiSelectDropdown({
  options,
  value,
  onChange,
  allLabel,
  disabled,
  searchable,
}: {
  options: { value: string; label: string }[];
  value: string[] | null;
  onChange: (v: string[] | null) => void;
  allLabel: string;
  disabled?: boolean;
  /** Campo de filtro no topo. Ligado nas listas longas (igrejas, regionais). */
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  // fechar sempre limpa o texto de filtro do seletor
  const fechar = () => { setOpen(false); setSearch(''); };

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) fechar();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const visibleOptions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return options;
    return options.filter((o) => o.label.toLowerCase().includes(term));
  }, [options, search]);

  // null = modo "todos"; [] = nenhum marcado; [ids] = seleção parcial
  const isAll = value === null;
  const selected = value ?? [];

  const displayLabel = isAll
    ? allLabel
    : selected.length === 0
    ? 'Nenhum selecionado'
    : selected.length === 1
    ? (options.find((o) => o.value === selected[0])?.label ?? '1 selecionado')
    : `${selected.length} selecionados`;

  const handleTodos = () => {
    if (isAll) {
      onChange([]); // desmarcar todos → entra no modo seleção vazia
      return;
    }
    // Com um filtro digitado, "marcar todos" marca o que está à vista somado ao
    // que já estava escolhido — marcar a lista inteira aqui apagaria o filtro
    // que o usuário acabou de aplicar.
    if (search.trim()) {
      const next = Array.from(new Set([...selected, ...visibleOptions.map((o) => o.value)]));
      onChange(next.length === options.length ? null : next);
      return;
    }
    onChange(null); // marcar todos → volta ao modo "todos"
  };

  const toggle = (val: string) => {
    if (isAll) {
      // clicar em item individual quando "todos" está ativo = desmarcar só esse
      onChange(options.filter((o) => o.value !== val).map((o) => o.value));
      return;
    }
    const next = selected.includes(val)
      ? selected.filter((v) => v !== val)
      : [...selected, val];
    // se todos foram marcados individualmente → volta para modo "todos"
    onChange(next.length === options.length ? null : next);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (disabled) return; if (open) fechar(); else setOpen(true); }}
        className="flex h-[50px] w-full items-center justify-between gap-1 rounded-[14px] border-[1.5px] border-slate-200 bg-white px-3.5 text-left text-[15px] font-medium text-slate-900 outline-none focus:border-slate-900 disabled:bg-slate-50 disabled:text-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800"
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[240px] overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          {searchable && (
            <div className="border-b border-slate-100 dark:border-slate-700 p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  autoFocus
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filtrar..."
                  className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1.5 pl-8 pr-2 text-sm focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>
          )}
          <div className="max-h-64 overflow-y-auto py-1">
            <label className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-sm font-semibold border-b border-slate-100 dark:border-slate-700">
              <input
                type="checkbox"
                checked={isAll}
                onChange={handleTodos}
                className="h-4 w-4 rounded border-slate-300 accent-slate-900"
              />
              {search.trim() ? 'Marcar filtrados' : allLabel}
            </label>
            {visibleOptions.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-slate-400">Nada encontrado</p>
            ) : visibleOptions.map((option) => (
              <label key={option.value} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={isAll || selected.includes(option.value)}
                  onChange={() => toggle(option.value)}
                  className="h-4 w-4 rounded border-slate-300 accent-slate-900"
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
