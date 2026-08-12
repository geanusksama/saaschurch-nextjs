import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Selecao de linhas para tabelas com paginacao no cliente.
 *
 * `availableIds` deve conter TODAS as linhas do filtro atual (nao apenas a pagina
 * visivel), para que a selecao sobreviva a troca de pagina e seja descartada
 * automaticamente quando um registro sai do filtro ou e excluido.
 */
export function useRowSelection(availableIds: string[]) {
  const [rawSelected, setRawSelected] = useState<string[]>([]);

  const availableSet = useMemo(() => new Set(availableIds), [availableIds]);
  const selected = useMemo(
    () => rawSelected.filter((id) => availableSet.has(id)),
    [rawSelected, availableSet],
  );
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggle = useCallback((id: string) => {
    setRawSelected((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  }, []);

  const setMany = useCallback((ids: string[], checked: boolean) => {
    setRawSelected((current) => {
      if (checked) return Array.from(new Set([...current, ...ids]));
      const removing = new Set(ids);
      return current.filter((id) => !removing.has(id));
    });
  }, []);

  const clear = useCallback(() => setRawSelected([]), []);

  return { selected, selectedSet, count: selected.length, toggle, setMany, clear };
}

type CheckboxProps = {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
};

/** Checkbox com suporte a estado indeterminado (so acessivel via DOM). */
export function RowCheckbox({ checked, indeterminate = false, onChange, label, disabled }: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked;
  }, [indeterminate, checked]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
      onClick={(event) => event.stopPropagation()}
      aria-label={label}
      title={label}
      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-purple-600 focus:ring-2 focus:ring-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}

/**
 * Executa `worker` sobre os itens em lotes, para nao disparar centenas de
 * requisicoes simultaneas. Devolve os itens que falharam, preservando a ordem.
 */
export async function runInBatches<T>(items: T[], worker: (item: T) => Promise<void>, batchSize = 4) {
  const failed: T[] = [];
  for (let index = 0; index < items.length; index += batchSize) {
    const slice = items.slice(index, index + batchSize);
    const results = await Promise.allSettled(slice.map(worker));
    results.forEach((result, position) => {
      if (result.status === 'rejected') failed.push(slice[position]);
    });
  }
  return failed;
}
