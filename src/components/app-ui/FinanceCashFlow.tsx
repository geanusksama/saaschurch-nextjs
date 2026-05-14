import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CalendarRange, CheckCircle2, ChevronDown, Clock3, Filter, Lock, LockOpen, ShieldCheck } from 'lucide-react';
import {
  fetchFinanceCashStatusOptions,
  listFinanceCashStatuses,
  updateFinanceCashStatuses,
  type FinanceCashStatusMonth,
  type FinanceCashStatusOptionChurch,
  type FinanceCashStatusOptionRegional,
  type FinanceCashStatusRow,
} from '../../lib/financeCashStatus';

const EXPLICIT_NONE = '__none__';

const MONTH_OPTIONS = [
  { value: 1, label: 'Jan' },
  { value: 2, label: 'Fev' },
  { value: 3, label: 'Mar' },
  { value: 4, label: 'Abr' },
  { value: 5, label: 'Mai' },
  { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' },
  { value: 8, label: 'Ago' },
  { value: 9, label: 'Set' },
  { value: 10, label: 'Out' },
  { value: 11, label: 'Nov' },
  { value: 12, label: 'Dez' },
];

function resolveSelection(selectedIds: string[], allIds: string[]) {
  if (selectedIds.includes(EXPLICIT_NONE)) {
    return [];
  }

  return selectedIds.length ? selectedIds : allIds;
}

function toggleSelection(current: string[], id: string) {
  const base = current.filter((item) => item !== EXPLICIT_NONE);
  return base.includes(id) ? base.filter((item) => item !== id) : [...base, id];
}

function renderMonthLabel(month: number) {
  return MONTH_OPTIONS.find((item) => item.value === month)?.label || String(month).padStart(2, '0');
}

function statusBadgeClass(month: FinanceCashStatusMonth) {
  if (month.status === 'OPEN') {
    return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
  }

  if (month.allowUntil) {
    return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
  }

  return 'bg-rose-50 text-rose-600 ring-1 ring-rose-200';
}

function formatMonthStatus(month: FinanceCashStatusMonth) {
  if (month.status === 'OPEN') {
    return 'Aberto';
  }

  if (month.allowUntil) {
    return `Permitido até ${new Date(`${month.allowUntil}T12:00:00`).toLocaleDateString('pt-BR')}`;
  }

  return 'Fechado';
}

function compactSelectionLabel(totalCount: number, selectedCount: number, singular: string, plural: string) {
  if (selectedCount === 0) {
    return `Nenhum ${singular}`;
  }

  if (selectedCount === totalCount) {
    return `Todos ${plural}`;
  }

  if (selectedCount === 1) {
    return `1 ${singular}`;
  }

  return `${selectedCount} ${plural}`;
}

function MultiSelectDropdown({
  label,
  allLabel,
  selectedIds,
  activeIds,
  items,
  open,
  setOpen,
  onToggle,
  onSelectAll,
  onSelectNone,
  disabled = false,
}: {
  label: string;
  allLabel: string;
  selectedIds: string[];
  activeIds: string[];
  items: Array<{ id: string; label: string; subLabel?: string }>;
  open: boolean;
  setOpen: (open: boolean) => void;
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  disabled?: boolean;
}) {
  const noneSelected = selectedIds.includes(EXPLICIT_NONE);
  const title = selectedIds.includes(EXPLICIT_NONE)
    ? `Nenhum ${label}`
    : compactSelectionLabel(items.length, activeIds.length || items.length, label, allLabel);

  return (
    <div className="relative min-w-[180px]">
      <button
        type="button"
        onClick={() => { if (!disabled) setOpen(!open); }}
        disabled={disabled}
        className={`h-8.5 w-full rounded-lg border border-slate-300 bg-white px-3 text-left text-[11px] leading-none text-slate-700 outline-none transition focus:border-blue-400 ${disabled ? 'cursor-not-allowed bg-slate-50 text-slate-500' : 'hover:border-slate-400'}`}
      >
        <span className="flex items-center justify-between gap-3">
          <span className="truncate">{title}</span>
          <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      {open && (
        <>
          <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[240px] rounded-lg border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-1.5">
              <span className="text-[9px] font-medium lowercase leading-none text-slate-500">{label}</span>
              <div className="flex items-center gap-2 whitespace-nowrap text-[9px] font-medium leading-none">
                <button type="button" onClick={onSelectAll} className="text-[9px] font-medium leading-none text-blue-600 hover:underline">Marcar todas</button>
                <button type="button" onClick={onSelectNone} className="text-[9px] font-medium leading-none text-slate-500 hover:underline">Desmarcar</button>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              {items.map((item) => {
                const checked = !noneSelected && (activeIds.length === 0 || activeIds.includes(item.id));
                return (
                  <label key={item.id} className="flex cursor-pointer items-start gap-2 px-3 py-1.5 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggle(item.id)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-[11px] leading-tight font-medium text-slate-700">{item.label}</span>
                      {item.subLabel && <span className="block truncate text-[10px] leading-tight text-slate-400">{item.subLabel}</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
          <button type="button" aria-label="Fechar filtros" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
        </>
      )}
    </div>
  );
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
    <div className={`flex min-w-fit shrink-0 flex-col items-center ${className}`.trim()}>
      <div className={`flex w-full items-end gap-1 px-1 ${bodyClassName}`.trim()}>{children}</div>
      <div className="mt-1 whitespace-nowrap text-[9px] uppercase tracking-[0.18em] text-slate-400">{label}</div>
    </div>
  );
}

function RibbonDivider() {
  return <div className="mx-1 hidden w-px self-stretch bg-slate-200 md:block" />;
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
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-[0.18em] text-slate-400">
        {icon ? <span className="text-slate-400">{icon}</span> : null}
        <span>{label}</span>
      </div>
      {children}
    </div>
  );
}

function RibbonActionButton({
  icon,
  label,
  tone,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  tone: 'green' | 'red' | 'amber';
  disabled?: boolean;
  onClick: () => void;
}) {
  const toneClass = tone === 'green'
    ? 'text-emerald-600 hover:bg-emerald-50'
    : tone === 'red'
      ? 'text-rose-600 hover:bg-rose-50'
      : 'text-amber-700 hover:bg-amber-50';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex h-[52px] w-[52px] shrink-0 flex-col items-center justify-center gap-0.5 rounded border border-transparent px-1 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${toneClass}`}
    >
      <span className="flex items-center justify-center">{icon}</span>
      <span className="mt-0.5 max-w-[60px] text-center text-[10px] leading-tight font-medium">{label}</span>
    </button>
  );
}

export function FinanceCashFlow() {
  const today = new Date();
  const me = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('mrm_user') || '{}'); } catch { return {}; }
  }, []);
  const normalizedRoleName = useMemo(
    () => String(me?.roleName || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(),
    [me?.roleName],
  );
  const canManageAllFilters = me?.profileType === 'master' || me?.profileType === 'admin' || me?.profileType === 'campo';
  const hasFixedChurchScope = me?.profileType === 'church' || normalizedRoleName.includes('secret') || normalizedRoleName.includes('tesour');
  const defaultRegionalId = typeof me?.regionalId === 'string' ? me.regionalId : '';
  const defaultChurchId = typeof me?.churchId === 'string' ? me.churchId : '';
  const [year, setYear] = useState(String(today.getFullYear()));
  const [selectedMonths, setSelectedMonths] = useState<number[]>([today.getMonth() + 1]);
  const [regionals, setRegionals] = useState<FinanceCashStatusOptionRegional[]>([]);
  const [churches, setChurches] = useState<FinanceCashStatusOptionChurch[]>([]);
  const [selectedRegionalIds, setSelectedRegionalIds] = useState<string[]>(defaultRegionalId ? [defaultRegionalId] : []);
  const [selectedChurchIds, setSelectedChurchIds] = useState<string[]>(defaultChurchId ? [defaultChurchId] : []);
  const [rows, setRows] = useState<FinanceCashStatusRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [bulkAllowUntil, setBulkAllowUntil] = useState('');
  const [regionalsOpen, setRegionalsOpen] = useState(false);
  const [churchesOpen, setChurchesOpen] = useState(false);
  const [activeChurch, setActiveChurch] = useState<FinanceCashStatusRow | null>(null);
  const [modalAllowUntil, setModalAllowUntil] = useState('');
  const [filtersReady, setFiltersReady] = useState(false);
  const bulkAllowUntilRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const response = await fetchFinanceCashStatusOptions();
        if (!isMounted) return;
        setRegionals(response.regionals);
        setChurches(response.churches);
        const churchFromProfile = defaultChurchId
          ? response.churches.find((church) => church.id === defaultChurchId)
          : undefined;
        const regionalFromProfile = defaultRegionalId
          ? response.regionals.find((regional) => regional.id === defaultRegionalId)
          : undefined;
        const resolvedRegionalId = regionalFromProfile?.id || churchFromProfile?.regionalId || '';

        setSelectedRegionalIds(resolvedRegionalId ? [resolvedRegionalId] : []);
        setSelectedChurchIds(churchFromProfile?.id ? [churchFromProfile.id] : []);
        setFiltersReady(true);
      } catch (err: any) {
        if (!isMounted) return;
        setError(err?.message || 'Não foi possível carregar as igrejas para o fluxo de caixa.');
        setFiltersReady(true);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [defaultChurchId, defaultRegionalId]);

  const allRegionalIds = useMemo(() => regionals.map((item) => item.id), [regionals]);
  const activeRegionalIds = useMemo(() => resolveSelection(selectedRegionalIds, allRegionalIds), [selectedRegionalIds, allRegionalIds]);

  const visibleChurches = useMemo(() => {
    if (selectedRegionalIds.includes(EXPLICIT_NONE)) {
      return [];
    }

    return churches.filter((church) => !activeRegionalIds.length || activeRegionalIds.includes(church.regionalId || ''));
  }, [churches, activeRegionalIds, selectedRegionalIds]);

  const allVisibleChurchIds = useMemo(() => visibleChurches.map((item) => item.id), [visibleChurches]);
  const activeChurchIds = useMemo(() => resolveSelection(selectedChurchIds, allVisibleChurchIds), [selectedChurchIds, allVisibleChurchIds]);

  useEffect(() => {
    const validVisibleIds = new Set(allVisibleChurchIds);
    setSelectedChurchIds((current) => current.filter((item) => item === EXPLICIT_NONE || validVisibleIds.has(item)));
  }, [allVisibleChurchIds]);

  useEffect(() => {
    if (!filtersReady) {
      return;
    }

    if (!regionals.length && !churches.length) {
      return;
    }

    if (!selectedMonths.length || selectedRegionalIds.includes(EXPLICIT_NONE) || selectedChurchIds.includes(EXPLICIT_NONE)) {
      setRows([]);
      return;
    }

    let active = true;

    (async () => {
      try {
        setLoading(true);
        setError('');
        const response = await listFinanceCashStatuses({
          year: Number(year),
          months: selectedMonths,
          regionalIds: selectedRegionalIds.length ? selectedRegionalIds : undefined,
          churchIds: selectedChurchIds.length ? selectedChurchIds : undefined,
        });
        if (!active) return;
        setRows(response.rows);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message || 'Não foi possível carregar o status do caixa.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [filtersReady, churches.length, regionals.length, year, selectedMonths, selectedRegionalIds, selectedChurchIds]);

  async function refreshRows() {
    const response = await listFinanceCashStatuses({
      year: Number(year),
      months: selectedMonths,
      regionalIds: selectedRegionalIds.length ? selectedRegionalIds : undefined,
      churchIds: selectedChurchIds.length ? selectedChurchIds : undefined,
    });
    setRows(response.rows);
  }

  async function runUpdate(action: 'open' | 'close' | 'allow', churchIds: string[]) {
    if (!churchIds.length) {
      setError('Selecione pelo menos uma igreja para atualizar o caixa.');
      return;
    }

    if (!selectedMonths.length) {
      setError('Selecione pelo menos um mês.');
      return;
    }

    const allowUntil = action === 'allow' ? (activeChurch ? modalAllowUntil : bulkAllowUntil) : '';
    if (action === 'allow' && !allowUntil) {
      setError('Informe a data limite da permissão temporária.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');

    try {
      const response = await updateFinanceCashStatuses({
        year: Number(year),
        months: selectedMonths,
        action,
        churchIds,
        allowUntil: action === 'allow' ? allowUntil : undefined,
      });

      await refreshRows();
      setNotice(`Atualização concluída em ${response.churches} igreja(s).`);
      setActiveChurch(null);
      setModalAllowUntil('');
    } catch (err: any) {
      setError(err?.message || 'Não foi possível atualizar o status do caixa.');
    } finally {
      setSaving(false);
    }
  }

  const filteredCount = rows.length;
  const bulkChurchIds = rows.map((row) => row.churchId);
  const monthCount = selectedMonths.length;

  return (
    <div className="flex min-h-[calc(100vh-64px)] w-full flex-col bg-slate-100">
      <div className="bg-white">
        <div className="px-4 pt-3 sm:px-6">
          <div className="flex items-end justify-between gap-3 overflow-x-auto text-sm text-slate-500">
            <div className="flex min-w-max items-end gap-1">
              <span className="px-4 py-2 font-semibold text-slate-700">Abertura e Fechamento de Caixa</span>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-200 bg-slate-50/70 px-3 py-3 sm:px-4">
          <div className="flex flex-wrap items-stretch gap-x-2 gap-y-3 md:flex-nowrap md:items-center md:overflow-visible">
            <RibbonGroup label="Escopo">
              <RibbonField label="Ano" icon={<CalendarRange className="h-3 w-3" />} className="min-w-[110px]">
                <input
                  type="number"
                  min="2000"
                  max="3000"
                  value={year}
                  onChange={(event) => setYear(event.target.value)}
                  className="h-8 w-full rounded border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none transition focus:border-blue-400"
                />
              </RibbonField>

              <RibbonField label="Regionais" className="min-w-[170px]">
                <MultiSelectDropdown
                  label="regional"
                  allLabel="as Regionais"
                  selectedIds={selectedRegionalIds}
                  activeIds={activeRegionalIds}
                  items={regionals.map((regional) => ({ id: regional.id, label: regional.name }))}
                  open={regionalsOpen}
                  setOpen={setRegionalsOpen}
                  onToggle={(id) => setSelectedRegionalIds((current) => toggleSelection(current, id))}
                  onSelectAll={() => setSelectedRegionalIds([])}
                  onSelectNone={() => setSelectedRegionalIds([EXPLICIT_NONE])}
                  disabled={!canManageAllFilters}
                />
              </RibbonField>

              <RibbonField label="Igrejas" className="min-w-[230px]">
                <MultiSelectDropdown
                  label="igreja"
                  allLabel="as Igrejas"
                  selectedIds={selectedChurchIds}
                  activeIds={activeChurchIds}
                  items={visibleChurches.map((church) => ({ id: church.id, label: church.name, subLabel: church.regionalName }))}
                  open={churchesOpen}
                  setOpen={setChurchesOpen}
                  onToggle={(id) => setSelectedChurchIds((current) => toggleSelection(current, id))}
                  onSelectAll={() => setSelectedChurchIds([])}
                  onSelectNone={() => setSelectedChurchIds([EXPLICIT_NONE])}
                  disabled={!canManageAllFilters}
                />
              </RibbonField>

            </RibbonGroup>

            <RibbonDivider />

            <RibbonGroup label="Permissão">
              <button
                type="button"
                title={bulkAllowUntil ? `Permitir até ${new Date(`${bulkAllowUntil}T12:00:00`).toLocaleDateString('pt-BR')}` : 'Selecionar data limite'}
                onClick={() => bulkAllowUntilRef.current?.showPicker?.() || bulkAllowUntilRef.current?.click()}
                className="flex h-[52px] w-[52px] shrink-0 flex-col items-center justify-center gap-0.5 rounded border border-transparent px-1 py-1 text-xs text-slate-600 transition-colors hover:bg-slate-200"
              >
                <CalendarRange className="h-3.5 w-3.5" />
                <span className="mt-0.5 max-w-[60px] text-center text-[10px] leading-tight">Data</span>
              </button>
              <input
                ref={bulkAllowUntilRef}
                type="date"
                value={bulkAllowUntil}
                onChange={(event) => setBulkAllowUntil(event.target.value)}
                className="pointer-events-none absolute h-0 w-0 opacity-0"
              />
            </RibbonGroup>

            <RibbonDivider />

            <RibbonGroup label="Ações" bodyClassName="grid w-full grid-cols-3 gap-1 px-0 md:flex md:w-auto md:gap-1 md:px-1" className="w-full md:w-auto">
              <RibbonActionButton
                icon={<LockOpen className="h-3.5 w-3.5" />}
                label="Abrir"
                tone="green"
                disabled={saving || !bulkChurchIds.length}
                onClick={() => { void runUpdate('open', bulkChurchIds); }}
              />
              <RibbonActionButton
                icon={<Lock className="h-3.5 w-3.5" />}
                label="Fechar"
                tone="red"
                disabled={saving || !bulkChurchIds.length}
                onClick={() => { void runUpdate('close', bulkChurchIds); }}
              />
              <RibbonActionButton
                icon={<Clock3 className="h-3.5 w-3.5" />}
                label="Permitir"
                tone="amber"
                disabled={saving || !bulkChurchIds.length}
                onClick={() => { void runUpdate('allow', bulkChurchIds); }}
              />
            </RibbonGroup>

            <RibbonDivider />

            <RibbonGroup label="Meses" bodyClassName="grid grid-cols-6 gap-1 px-0 md:px-1">
              {MONTH_OPTIONS.map((month) => {
                const selected = selectedMonths.includes(month.value);
                return (
                  <button
                    key={month.value}
                    type="button"
                    onClick={() => setSelectedMonths((current) => current.includes(month.value)
                      ? current.filter((item) => item !== month.value)
                      : [...current, month.value].sort((left, right) => left - right))}
                    className={`inline-flex min-w-[50px] items-center justify-center rounded border px-1.5 py-1.5 text-[11px] font-semibold transition ${selected ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-100' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
                  >
                    {month.label}
                  </button>
                );
              })}
            </RibbonGroup>
          </div>


        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {notice && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          {notice}
        </div>
      )}

      <div className="mt-3 bg-white overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3 lg:px-5">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-white">Todas ({filteredCount})</span>
            <span className="text-xs text-slate-500">Tabela padrão do sistema</span>
          </div>
          <div className="text-xs text-slate-500">Clique em uma linha para ação individual</div>
        </div>

        {loading ? (
          <div className="bg-white p-16 text-center shadow-sm">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            <p className="text-sm text-slate-500">Consultando status do caixa...</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white p-14 text-center">
            <p className="text-base font-semibold text-slate-600">Nenhuma igreja encontrada para os filtros selecionados.</p>
            <p className="mt-1 text-sm text-slate-400">Ajuste os filtros acima para listar os caixas.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Igreja</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">Regional</th>
                  {selectedMonths.map((month) => (
                    <th key={month} className="px-4 py-3 text-left text-xs font-semibold text-slate-500">{renderMonthLabel(month)} / {year}</th>
                  ))}
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500">Resumo</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const openMonths = row.months.filter((month) => month.status === 'OPEN').length;
                  const temporaryMonths = row.months.filter((month) => month.allowUntil).length;
                  const closedMonths = row.months.length - openMonths - temporaryMonths;

                  return (
                    <tr key={row.churchId} className="group hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 align-top">
                        <p className="font-semibold text-slate-800">{row.churchName}</p>
                      </td>
                      <td className="px-4 py-3 align-top text-slate-600">{row.regionalName}</td>
                      {row.months.map((month) => (
                        <td key={`${row.churchId}-${month.month}`} className="px-4 py-3 align-top">
                          <div className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusBadgeClass(month)}`}>
                            {formatMonthStatus(month)}
                          </div>
                        </td>
                      ))}
                      <td className="px-4 py-3 align-top text-center">
                        <div className="inline-flex flex-wrap items-center justify-center gap-1 text-[11px] font-semibold">
                          <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700 ring-1 ring-emerald-200">Abertos {openMonths}</span>
                          <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700 ring-1 ring-amber-200">Temporários {temporaryMonths}</span>
                          <span className="rounded-full bg-rose-50 px-2 py-1 text-rose-600 ring-1 ring-rose-200">Fechados {closedMonths}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center justify-center gap-1.5 opacity-80 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => void runUpdate('open', [row.churchId])}
                            disabled={saving}
                            className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100 disabled:opacity-60"
                          >
                            Abrir
                          </button>
                          <button
                            type="button"
                            onClick={() => void runUpdate('close', [row.churchId])}
                            disabled={saving}
                            className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 ring-1 ring-rose-200 hover:bg-rose-100 disabled:opacity-60"
                          >
                            Fechar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveChurch(row);
                              setModalAllowUntil(row.months.find((month) => month.allowUntil)?.allowUntil || bulkAllowUntil);
                            }}
                            className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-200 hover:bg-blue-100"
                          >
                            Gerenciar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {activeChurch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Gerenciar caixa da igreja</h2>
                <p className="mt-1 text-sm text-slate-500">{activeChurch.churchName} • {activeChurch.regionalName}</p>
              </div>
              <button type="button" onClick={() => setActiveChurch(null)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50">Fechar</button>
            </div>

            <div className="space-y-5 px-6 py-5">
              <div className="grid gap-3 md:grid-cols-2">
                {activeChurch.months.map((month) => (
                  <div key={`${activeChurch.churchId}-${month.month}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-800">{renderMonthLabel(month.month)} / {year}</p>
                    <div className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusBadgeClass(month)}`}>
                      {formatMonthStatus(month)}
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Permitir até</label>
                <input
                  type="date"
                  value={modalAllowUntil}
                  onChange={(event) => setModalAllowUntil(event.target.value)}
                  className="h-10 w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-blue-400"
                />
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                disabled={saving}
                onClick={() => void runUpdate('open', [activeChurch.churchId])}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                <ShieldCheck className="h-4 w-4" />
                Abrir meses
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void runUpdate('close', [activeChurch.churchId])}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
              >
                <Lock className="h-4 w-4" />
                Fechar meses
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void runUpdate('allow', [activeChurch.churchId])}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-60"
              >
                <Clock3 className="h-4 w-4" />
                Permitir até a data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
