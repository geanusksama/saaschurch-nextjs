import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { AlertTriangle, ArrowUpDown, Building2, ChevronDown, Download, Eye, Mail, MapPin, Pencil, Phone, Plus, Trash2, User, UserRound, Users, Search, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MemberEditDrawer } from './MemberEditDrawer';
import { MemberQuickCreateModal } from './MemberQuickCreateModal';
import { PrintModal } from './shared/PrintModal';
import { printReport } from '../../lib/printReport';
import { TableSkeleton, StatsSkeleton } from './shared/Skeleton';
import { useDebounce } from '../../lib/secretariaHooks';
import { qk } from '../../lib/queryClient';

import { apiBase } from '../../lib/apiBase';
import { logClientAudit } from '../../lib/auditClient';

type CampoOption = {
  id: string;
  name: string;
  code?: string | null;
};

type RegionalOption = {
  id: string;
  name: string;
  code?: string | null;
  campoId: string;
};

type ChurchOption = {
  id: string;
  name: string;
  code?: string | null;
  regionalId?: string;
  regional?: {
    id?: string;
    name?: string;
    campoId?: string;
    campo?: {
      id: string;
      name: string;
      code?: string | null;
    };
  };
};

type EcclesiasticalTitleOption = {
  id: string;
  name: string;
  abbreviation?: string | null;
  level: number;
};

type MemberRecord = {
  id: string;
  fullName: string;
  memberType?: string | null;
  maritalStatus?: string | null;
  phone?: string | null;
  mobile?: string | null;
  email?: string | null;
  membershipStatus?: string | null;
  membershipDate?: string | null;
  cpf?: string | null;
  cnpj?: string | null;
  churchId: string;
  ecclesiasticalTitle?: string | null;
  ecclesiasticalTitleId?: string | null;
  ecclesiasticalTitleRef?: {
    id: string;
    name: string;
    abbreviation?: string | null;
    level?: number;
  } | null;
  regional?: {
    id?: string;
    name?: string;
    code?: string | null;
  } | null;
  church?: {
    id?: string;
    name?: string;
    code?: string | null;
    regional?: {
      id?: string;
      name?: string;
      code?: string | null;
      campoId?: string | null;
      campo?: { id?: string; name?: string } | null;
    } | null;
  } | null;
  churchName?: string;
  churchCode?: string | null;
  regionalName?: string;
  fieldName?: string;
  photoUrl?: string | null;
  rol?: number | null;
  fatherName?: string | null;
  motherName?: string | null;
  spouseName?: string | null;
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressNeighborhood?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressZipcode?: string | null;
  birthDate?: string | null;
  baptismDate?: string | null;
  naturalityCity?: string | null;
};

type SortKey = 'fullName' | 'memberType' | 'contact' | 'churchName' | 'membershipStatus' | 'membershipDate' | 'ecclesiasticalTitle';
type MemberTypeFilter = 'ALL' | 'MEMBRO' | 'PF' | 'PJ';
type MembershipStatusFilter = 'ALL' | 'ativo' | 'inativo' | 'aguardando' | 'visitante';

const EMPTY_TITLE_FILTER = '__NONE__';
const EMPTY_MARITAL_STATUS_FILTER = '__NONE__';

const pageSizeOptions = [20, 50, 100, 250, 500, 1000, 5000];

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('mrm_user') || '{}');
  } catch {
    return {};
  }
}

function normalizeText(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeMembershipStatus(status?: string | null) {
  const normalized = normalizeText(status || '');

  if (!normalized) {
    return 'visitante';
  }

  if (normalized.includes('aguard')) {
    return 'aguardando';
  }

  if (normalized.includes('inativ') || normalized.includes('deslig')) {
    return 'inativo';
  }

  if (normalized.includes('visit')) {
    return 'visitante';
  }

  return 'ativo';
}

function normalizeMemberType(memberType?: string | null) {
  const normalized = normalizeText(memberType || 'MEMBRO');
  if (normalized === 'pj') return 'PJ';
  if (normalized === 'pf') return 'PF';
  return 'MEMBRO';
}

function normalizeMaritalStatus(status?: string | null) {
  const normalized = normalizeText(status || '');

  if (!normalized) {
    return EMPTY_MARITAL_STATUS_FILTER;
  }

  if (normalized.includes('cas')) {
    return 'casado';
  }

  if (normalized.includes('solt')) {
    return 'solteiro';
  }

  if (normalized.includes('viuv')) {
    return 'viuvo';
  }

  if (normalized.includes('divorc')) {
    return 'divorciado';
  }

  return normalized;
}

function getMembershipStatusLabel(status: Exclude<MembershipStatusFilter, 'ALL'>) {
  if (status === 'ativo') return 'Ativo';
  if (status === 'inativo') return 'Inativo';
  if (status === 'aguardando') return 'Aguardando ativação';
  return 'Visitante';
}

function getMaritalStatusLabel(status: string) {
  if (status === EMPTY_MARITAL_STATUS_FILTER) return 'Não informado';
  if (status === 'casado') return 'Casado';
  if (status === 'solteiro') return 'Solteiro';
  if (status === 'viuvo') return 'Viúvo';
  if (status === 'divorciado') return 'Divorciado';

  return status
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getMemberTypeLabel(memberType?: string | null) {
  const normalized = normalizeMemberType(memberType);
  if (normalized === 'PJ') return 'PJ';
  if (normalized === 'PF') return 'PF';
  return 'Membro';
}

function getMemberTypeBadgeClass(memberType?: string | null) {
  const normalized = normalizeMemberType(memberType);
  if (normalized === 'PJ') {
    return 'bg-indigo-100 text-indigo-700';
  }

  if (normalized === 'PF') {
    return 'bg-sky-100 text-sky-700';
  }

  return 'bg-violet-100 text-violet-700';
}

function buildAuthHeaders(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

function formatCpf(value?: string | null) {
  const digits = digitsOnly(value || '').slice(0, 11);

  if (!digits) {
    return '';
  }

  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function formatCnpj(value?: string | null) {
  const digits = digitsOnly(value || '').slice(0, 14);

  if (!digits) {
    return '';
  }

  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

function formatPhone(value?: string | null) {
  const digits = digitsOnly(value || '').slice(0, 11);

  if (!digits) {
    return '';
  }

  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }

  return digits
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

function sortTitles(titles: EcclesiasticalTitleOption[]) {
  return [...titles].sort((left, right) => {
    const levelDiff = (left.level || 0) - (right.level || 0);
    if (levelDiff !== 0) {
      return levelDiff;
    }

    return left.name.localeCompare(right.name, 'pt-BR');
  });
}

function getStatusBadgeClass(status: string) {
  if (status === 'inativo') {
    return 'bg-gray-100 text-gray-600';
  }

  if (status === 'aguardando') {
    return 'bg-amber-100 text-amber-700';
  }

  return 'bg-green-100 text-green-700';
}

function getTitleLabel(member: MemberRecord) {
  if (normalizeMemberType(member.memberType) !== 'MEMBRO') {
    return '-';
  }

  if (member.ecclesiasticalTitle) {
    return member.ecclesiasticalTitle;
  }

  return member.ecclesiasticalTitleRef?.name || '-';
}

function getMemberTitleFilterValue(member: MemberRecord) {
  if (normalizeMemberType(member.memberType) !== 'MEMBRO') {
    return EMPTY_TITLE_FILTER;
  }

  return member.ecclesiasticalTitleRef?.id || member.ecclesiasticalTitleId || EMPTY_TITLE_FILTER;
}

function getInitials(fullName: string) {
  return fullName
    .split(' ')
    .map((item) => item[0])
    .slice(0, 2)
    .join('');
}

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200/80 dark:bg-slate-700/70 ${className}`} />;
}

function MembersTableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, index) => (
        <tr key={index} className="border-b border-slate-200 last:border-b-0">
          <td className="px-4 py-4">
            <div className="flex items-center gap-3">
              <SkeletonBlock className="h-10 w-10 rounded-full" />
              <div className="space-y-2">
                <SkeletonBlock className="h-4 w-40" />
                <SkeletonBlock className="h-3 w-16" />
                <SkeletonBlock className="h-3 w-24" />
              </div>
            </div>
          </td>
          <td className="px-4 py-4">
            <div className="space-y-2">
              <SkeletonBlock className="h-4 w-36" />
              <SkeletonBlock className="h-4 w-44" />
            </div>
          </td>
          <td className="px-4 py-4"><SkeletonBlock className="h-4 w-32" /></td>
          <td className="px-4 py-4">
            <div className="space-y-2">
              <SkeletonBlock className="h-4 w-40" />
              <SkeletonBlock className="h-3 w-28" />
            </div>
          </td>
          <td className="px-4 py-4"><SkeletonBlock className="h-7 w-16 rounded-full" /></td>
          <td className="px-4 py-4"><SkeletonBlock className="h-4 w-24" /></td>
          <td className="px-4 py-4">
            <div className="flex justify-end gap-2">
              <SkeletonBlock className="h-8 w-8 rounded-lg" />
              <SkeletonBlock className="h-8 w-8 rounded-lg" />
              <SkeletonBlock className="h-8 w-8 rounded-lg" />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

// null  = todos selecionados (sem filtro)
// string[] = seleção explícita (vazio = nenhum marcado, aguardando seleção)
function MultiSelectDropdown({
  options,
  value,
  onChange,
  allLabel,
  disabled,
}: {
  options: { value: string; label: string }[];
  value: string[] | null;
  onChange: (v: string[] | null) => void;
  allLabel: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

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
    } else {
      onChange(null); // marcar todos → volta ao modo "todos"
    }
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
        onClick={() => !disabled && setOpen((p) => !p)}
        className="w-full flex items-center justify-between gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm bg-white dark:bg-slate-950 text-left text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-500"
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[200px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl">
          <div className="max-h-64 overflow-y-auto py-1">
            <label className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-sm font-semibold border-b border-slate-100 dark:border-slate-700">
              <input
                type="checkbox"
                checked={isAll}
                onChange={handleTodos}
                className="h-4 w-4 rounded border-slate-300 accent-purple-600"
              />
              {allLabel}
            </label>
            {options.map((option) => (
              <label key={option.value} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={isAll || selected.includes(option.value)}
                  onChange={() => toggle(option.value)}
                  className="h-4 w-4 rounded border-slate-300 accent-purple-600"
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

type MembersQueryData = {
  members: MemberRecord[];
  total: number;
  activeCount: number;
  inactiveCount: number;
  churchCount: number;
};

export function Members() {
  const navigate = useNavigate();
  const token = localStorage.getItem('mrm_token');
  const storedUser = readStoredUser();
  const activeFieldId = localStorage.getItem('mrm_active_field_id') || storedUser.campoId || '';
  const normalizedRole = normalizeText(storedUser.roleName);
  const isSecretaryOrTreasurer = normalizedRole.includes('secret') || normalizedRole.includes('tesour');
  const isChurchScopedUser = storedUser.profileType === 'church';
  const isAdminOrMaster = ['master', 'admin'].includes(storedUser.profileType || '');
  const hasFixedChurchScope = isChurchScopedUser || isSecretaryOrTreasurer;
  // Somente admin/master trocam o campo; regional/igreja ficam livres exceto perfil church
  const canChooseField = isAdminOrMaster;
  const canChooseRegional = !hasFixedChurchScope;
  const canChooseChurch = !hasFixedChurchScope;

  const [fields, setFields] = useState<CampoOption[]>([]);
  const [regionais, setRegionais] = useState<RegionalOption[]>([]);
  const [churches, setChurches] = useState<ChurchOption[]>([]);
  const [titles, setTitles] = useState<EcclesiasticalTitleOption[]>([]);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState(activeFieldId);
  const [selectedRegionalId, setSelectedRegionalId] = useState(storedUser.regionalId || '');
  const [selectedChurchId, setSelectedChurchId] = useState(storedUser.churchId || '');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 350);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<MemberTypeFilter>('MEMBRO');
  const [selectedTitleFilters, setSelectedTitleFilters] = useState<string[] | null>(null);
  const [selectedStatusFilters, setSelectedStatusFilters] = useState<string[] | null>(null);
  const [selectedMaritalStatusFilters, setSelectedMaritalStatusFilters] = useState<string[] | null>(null);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [editorMemberId, setEditorMemberId] = useState<string | null>(null);
  const [quickCreateType, setQuickCreateType] = useState<'PF' | 'PJ' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MemberRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('fullName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [serverTotal, setServerTotal] = useState(0);
  const [serverActiveCount, setServerActiveCount] = useState(0);
  const [serverInactiveCount, setServerInactiveCount] = useState(0);
  const [serverChurchCount, setServerChurchCount] = useState(0);
  const [error, setError] = useState('');
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [preparingPrint, setPreparingPrint] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [isNavigatingNew, setIsNavigatingNew] = useState(false);
  const isLoadingScreen = loadingFilters || loadingMembers;
  const isAnyActionActive = printModalOpen || preparingPrint || exportingExcel || (quickCreateType !== null) || isNavigatingNew;

  const filteredRegionais = useMemo(() => {
    if (hasFixedChurchScope && storedUser.regionalId) {
      return regionais.filter((regional) => regional.id === storedUser.regionalId);
    }

    if (!selectedFieldId) {
      return regionais;
    }

    return regionais.filter((regional) => regional.campoId === selectedFieldId);
  }, [regionais, selectedFieldId]);

  const filteredChurches = useMemo(() => {
    if (hasFixedChurchScope && storedUser.churchId) {
      return churches.filter((church) => church.id === storedUser.churchId);
    }

    const churchesInField = churches.filter((church) => {
      if (!selectedFieldId) {
        return true;
      }

      return church.regional?.campoId === selectedFieldId || church.regional?.campo?.id === selectedFieldId;
    });

    if (!selectedRegionalId) {
      return churchesInField;
    }

    return churchesInField.filter((church) => church.regional?.id === selectedRegionalId || church.regionalId === selectedRegionalId);
  }, [churches, hasFixedChurchScope, selectedFieldId, selectedRegionalId, storedUser.churchId]);

  const titleFilterOptions = useMemo(() => {
    const options = titles.map((title) => ({
      value: title.id,
      label: title.name,
    }));

    return [
      { value: 'ALL', label: 'Todos os títulos' },
      { value: EMPTY_TITLE_FILTER, label: 'Sem título' },
      ...options,
    ];
  }, [titles]);

  const maritalStatusFilterOptions = useMemo(() => [
    { value: 'ALL', label: 'Todos os estados civis' },
    { value: 'casado', label: 'Casado' },
    { value: 'solteiro', label: 'Solteiro' },
    { value: 'viuvo', label: 'Viúvo' },
    { value: 'divorciado', label: 'Divorciado' },
    { value: EMPTY_MARITAL_STATUS_FILTER, label: 'Não informado' },
  ], []);

  const visibleMembers = useMemo(() => {
    // All filtering is handled server-side; client only sorts the current page
    return [...members].sort((left, right) => {
      const leftValue = (() => {
        if (sortKey === 'memberType') {
          return normalizeMemberType(left.memberType);
        }
        if (sortKey === 'contact') {
          return left.mobile || left.phone || left.email || '';
        }
        if (sortKey === 'churchName') {
          return left.churchName || '';
        }
        if (sortKey === 'membershipStatus') {
          return left.membershipStatus || '';
        }
        if (sortKey === 'membershipDate') {
          return left.membershipDate || '';
        }
        if (sortKey === 'ecclesiasticalTitle') {
          return left.ecclesiasticalTitleRef?.name || left.ecclesiasticalTitle || '';
        }
        return left.fullName || '';
      })();

      const rightValue = (() => {
        if (sortKey === 'memberType') {
          return normalizeMemberType(right.memberType);
        }
        if (sortKey === 'contact') {
          return right.mobile || right.phone || right.email || '';
        }
        if (sortKey === 'churchName') {
          return right.churchName || '';
        }
        if (sortKey === 'membershipStatus') {
          return right.membershipStatus || '';
        }
        if (sortKey === 'membershipDate') {
          return right.membershipDate || '';
        }
        if (sortKey === 'ecclesiasticalTitle') {
          return right.ecclesiasticalTitleRef?.name || right.ecclesiasticalTitle || '';
        }
        return right.fullName || '';
      })();

      const comparison = String(leftValue).localeCompare(String(rightValue), 'pt-BR');
      return sortDirection === 'asc' ? comparison : comparison * -1;
    });
  }, [members, sortDirection, sortKey]);

  // API already paginates; visibleMembers is the sorted current page
  const paginatedMembers = visibleMembers;

  const totalPages = useMemo(() => Math.max(1, Math.ceil(serverTotal / pageSize)), [pageSize, serverTotal]);

  const stats = useMemo(() => ({
    activeMembers: serverActiveCount,
    inactiveMembers: serverInactiveCount,
    uniqueChurches: serverChurchCount,
  }), [serverActiveCount, serverInactiveCount, serverChurchCount]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedFieldId, selectedRegionalId, selectedChurchId, selectedTypeFilter, selectedTitleFilters, selectedStatusFilters, selectedMaritalStatusFilters, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    const loadFilters = async () => {
      if (!token) {
        setError('Sessao expirada. Faca login novamente.');
        setLoadingFilters(false);
        return;
      }

      try {
        setLoadingFilters(true);
        setError('');

        const fieldQuery = selectedFieldId ? `?fieldId=${encodeURIComponent(selectedFieldId)}` : '';
        const [fieldsResponse, regionaisResponse, churchesResponse, titlesResponse] = await Promise.all([
          fetch(`${apiBase}/campos`, { headers: buildAuthHeaders(token) }),
          fetch(`${apiBase}/regionais${fieldQuery}`, { headers: buildAuthHeaders(token) }),
          fetch(`${apiBase}/churches${fieldQuery}`, { headers: buildAuthHeaders(token) }),
          fetch(`${apiBase}/ecclesiastical-titles`, { headers: buildAuthHeaders(token) }),
        ]);

        if (!fieldsResponse.ok || !regionaisResponse.ok || !churchesResponse.ok || !titlesResponse.ok) {
          if (
            fieldsResponse.status === 401 ||
            fieldsResponse.status === 403 ||
            regionaisResponse.status === 401 ||
            regionaisResponse.status === 403 ||
            churchesResponse.status === 401 ||
            churchesResponse.status === 403 ||
            titlesResponse.status === 401 ||
            titlesResponse.status === 403
          ) {
            throw new Error('Sessao expirada. Faca login novamente.');
          }

          throw new Error('Falha ao carregar campos, regionais, igrejas e títulos.');
        }

        const [fieldsData, regionaisData, churchesData, titlesData] = await Promise.all([
          fieldsResponse.json(),
          regionaisResponse.json(),
          churchesResponse.json(),
          titlesResponse.json(),
        ]);

        const nextFields = Array.isArray(fieldsData) ? fieldsData : [];
        const nextRegionais = Array.isArray(regionaisData) ? regionaisData : [];
        const nextChurches = Array.isArray(churchesData) ? churchesData : [];
        const nextTitles = sortTitles(Array.isArray(titlesData) ? titlesData : []);

        setFields(hasFixedChurchScope && activeFieldId ? nextFields.filter((field) => field.id === activeFieldId) : nextFields);
        setRegionais(hasFixedChurchScope && storedUser.regionalId ? nextRegionais.filter((regional) => regional.id === storedUser.regionalId) : nextRegionais);
        setChurches(hasFixedChurchScope && storedUser.churchId ? nextChurches.filter((church) => church.id === storedUser.churchId) : nextChurches);
        setTitles(nextTitles);

        if (hasFixedChurchScope && activeFieldId && activeFieldId !== selectedFieldId) {
          setSelectedFieldId(activeFieldId);
        }

        if (hasFixedChurchScope && storedUser.regionalId && storedUser.regionalId !== selectedRegionalId) {
          setSelectedRegionalId(storedUser.regionalId);
        }

        if (hasFixedChurchScope && storedUser.churchId && storedUser.churchId !== selectedChurchId) {
          setSelectedChurchId(storedUser.churchId);
        }
      } catch (loadError) {
        setFields([]);
        setRegionais([]);
        setChurches([]);
        setTitles([]);
        setMembers([]);
        setError(loadError instanceof Error ? loadError.message : 'Nao foi possivel carregar os filtros.');
      } finally {
        setLoadingFilters(false);
      }
    };

    loadFilters();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedFieldId, hasFixedChurchScope, activeFieldId]);

  // ── TanStack Query — members ─────────────────────────────────────────────
  const memberQueryFilters = useMemo(() => ({
    churchId: selectedChurchId || undefined,
    regionalId: !selectedChurchId ? (selectedRegionalId || undefined) : undefined,
    campoId: (!selectedChurchId && !selectedRegionalId) ? (selectedFieldId || undefined) : undefined,
    q: debouncedSearch || undefined,
    page,
    pageSize,
    memberType: selectedTypeFilter !== 'ALL' ? selectedTypeFilter : undefined,
    status: selectedStatusFilters !== null && selectedStatusFilters.length > 0 ? selectedStatusFilters.join(',') : undefined,
    maritalStatus: selectedMaritalStatusFilters !== null && selectedMaritalStatusFilters.length > 0 ? selectedMaritalStatusFilters.join(',') : undefined,
    titleId: selectedTitleFilters !== null && selectedTitleFilters.length > 0 ? selectedTitleFilters.join(',') : undefined,
  }), [selectedChurchId, selectedRegionalId, selectedFieldId, debouncedSearch, page, pageSize, selectedTypeFilter, selectedStatusFilters, selectedMaritalStatusFilters, selectedTitleFilters]);

  const membersQuery = useQuery<MembersQueryData>({
    queryKey: qk.members(memberQueryFilters),
    queryFn: async () => {
      if (!token) throw new Error('Sessão expirada.');
      const params = new URLSearchParams();
      Object.entries(memberQueryFilters).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
      });
      const res = await fetch(`${apiBase}/members?${params.toString()}`, { headers: buildAuthHeaders(token) });
      if (!res.ok) throw new Error('Falha ao carregar membros.');
      const data = await res.json();
      const rows: MemberRecord[] = (Array.isArray(data) ? data : (data.data ?? [])).map((member: MemberRecord) => ({
        ...member,
        ecclesiasticalTitleId: member.ecclesiasticalTitleRef?.id || member.ecclesiasticalTitleId || '',
        churchName: member.church?.name || '',
        churchCode: member.church?.code || '',
        regionalName: member.church?.regional?.name || member.regional?.name || '',
        fieldName: member.church?.regional?.campo?.name || '',
      }));
      return {
        members: rows,
        total: data.total ?? rows.length,
        activeCount: data.activeCount ?? 0,
        inactiveCount: data.inactiveCount ?? 0,
        churchCount: data.churchCount ?? 0,
      };
    },
    enabled: !!token && !loadingFilters,
    placeholderData: (prev) => prev,
    staleTime: 5 * 60 * 1000,
  });

  // Refetch em background (trocou regional/igreja/filtro) — dados antigos ainda
  // na tela: mostra uma caixa de "Atualizando..." sem sumir com a lista.
  const isRefetching = membersQuery.isFetching && !loadingFilters && !loadingMembers;

  // Sync query result back to local state
  useEffect(() => {
    if (membersQuery.data) {
      setMembers(membersQuery.data.members);
      setServerTotal(membersQuery.data.total);
      setServerActiveCount(membersQuery.data.activeCount);
      setServerInactiveCount(membersQuery.data.inactiveCount);
      setServerChurchCount(membersQuery.data.churchCount);
      setLoadingMembers(false);
    } else if (membersQuery.isLoading) {
      setLoadingMembers(true);
    }
    if (membersQuery.error) {
      setError(membersQuery.error instanceof Error ? membersQuery.error.message : 'Erro ao carregar membros.');
      setLoadingMembers(false);
    }
  }, [membersQuery.data, membersQuery.isLoading, membersQuery.error]);

  // Log search actions
  useEffect(() => {
    if (debouncedSearch) {
      logClientAudit('read', `Pesquisou membros na secretaria por: "${debouncedSearch}"`, 'Lista de Membros');
    }
  }, [debouncedSearch]);

  // ── Legacy loadMembers useEffect (removed — replaced by TanStack Query above) ─

  // Busca TODOS os membros que batem com os filtros atuais (ignora a paginação
  // da tela), paginando a API. Usado por Exportar Excel e Imprimir — que devem
  // sempre trazer o total retornado pela query, não só a página exibida.
  const fetchAllMembers = useCallback(async (): Promise<MemberRecord[]> => {
    if (!token) throw new Error('Sessão expirada.');
    const FETCH_PAGE_SIZE = 5000;
    const baseParams = new URLSearchParams();
    Object.entries(memberQueryFilters).forEach(([k, v]) => {
      if (k === 'page' || k === 'pageSize') return;
      if (v !== undefined && v !== null && v !== '') baseParams.set(k, String(v));
    });
    baseParams.set('pageSize', String(FETCH_PAGE_SIZE));
    const all: MemberRecord[] = [];
    let pageNum = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const params = new URLSearchParams(baseParams);
      params.set('page', String(pageNum));
      const res = await fetch(`${apiBase}/members?${params.toString()}`, { headers: buildAuthHeaders(token) });
      if (!res.ok) throw new Error('Falha ao carregar membros.');
      const data = await res.json();
      const pageRows: MemberRecord[] = (Array.isArray(data) ? data : (data.data ?? [])).map((member: MemberRecord) => ({
        ...member,
        ecclesiasticalTitleId: member.ecclesiasticalTitleRef?.id || member.ecclesiasticalTitleId || '',
        churchName: member.church?.name || '',
        churchCode: member.church?.code || '',
        regionalName: member.church?.regional?.name || member.regional?.name || '',
        fieldName: member.church?.regional?.campo?.name || '',
      }));
      all.push(...pageRows);
      const total = typeof data.total === 'number' ? data.total : all.length;
      if (pageRows.length < FETCH_PAGE_SIZE || all.length >= total) break;
      pageNum++;
    }
    return all;
  }, [token, memberQueryFilters]);

  const handleExportExcel = useCallback(async () => {
    try {
      setExportingExcel(true);
      setError('');
      logClientAudit('read', 'Exportou lista de membros para planilha Excel', 'Lista de Membros');
      const allMembers = await fetchAllMembers();
      const XLSX = await import('xlsx');
      const rows = allMembers.map((m) => ({
        'Nome': m.fullName,
        'ROL': m.rol ?? '',
        'Tipo': getMemberTypeLabel(m.memberType),
        'Título Eclesiástico': getTitleLabel(m),
        'Igreja': m.churchName || '',
        'Regional': m.regionalName || '',
        'Campo': m.fieldName || '',
        'Situação': m.membershipStatus || '',
        'Membro desde': m.membershipDate ? new Date(m.membershipDate).toLocaleDateString('pt-BR') : '',
        'Telefone': formatPhone(m.mobile || m.phone) || '',
        'Email': m.email || '',
        'CPF': formatCpf(m.cpf) || '',
        'Estado Civil': m.maritalStatus || '',
        'Cônjuge': m.spouseName || '',
        'Nascimento': m.birthDate ? new Date(m.birthDate).toLocaleDateString('pt-BR') : '',
        'Endereço': [m.addressStreet, m.addressNumber, m.addressNeighborhood].filter(Boolean).join(', '),
        'Cidade': m.addressCity || '',
        'UF': m.addressState || '',
        'CEP': m.addressZipcode || '',
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Membros');
      XLSX.writeFile(wb, `membros_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      console.error(err);
      setError('Erro ao exportar planilha Excel.');
    } finally {
      setExportingExcel(false);
    }
  }, [fetchAllMembers]);

  const qc = useQueryClient();

  // Helper: update the current members cache key optimistically
  const patchMembersCache = useCallback((updater: (rows: MemberRecord[]) => MemberRecord[]) => {
    qc.setQueryData<MembersQueryData>(qk.members(memberQueryFilters), (old) =>
      old ? { ...old, members: updater(old.members) } : old
    );
  }, [qc, memberQueryFilters]);

  // After any mutation: silently refetch so cache matches DB
  const invalidateMembers = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['secretaria', 'members'] });
  }, [qc]);

  const handleSort = (nextSortKey: SortKey) => {
    if (sortKey === nextSortKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(nextSortKey);
    setSortDirection('asc');
  };

  const openEditor = (memberId: string) => {
    setEditorMemberId(memberId);
  };

  const closeEditor = () => {
    setEditorMemberId(null);
  };

  const closeQuickCreate = () => {
    setQuickCreateType(null);
  };

  const handleEditorSaved = (updated: any) => {
    if (!updated || !updated.id) return;
    const resolvedTitle = titles.find((title) => title.id === updated.ecclesiasticalTitleId);
    // 1. Optimistic cache update — screen refreshes instantly
    patchMembersCache((rows) =>
      rows.map((item) => {
        if (item.id !== updated.id) return item;
        return {
          ...item,
          ...updated,
          ecclesiasticalTitleRef: resolvedTitle
            ? { id: resolvedTitle.id, name: resolvedTitle.name, abbreviation: resolvedTitle.abbreviation, level: resolvedTitle.level }
            : item.ecclesiasticalTitleRef,
          churchName: item.churchName,
          churchCode: item.churchCode,
          regionalName: item.regionalName,
          fieldName: item.fieldName,
        };
      })
    );
    // 2. Silently refetch in background so IndexedDB + cache stay in sync with DB
    invalidateMembers();
  };

  const handleQuickCreated = (created: any) => {
    if (!created?.id) return;
    const newRow: MemberRecord = {
      ...created,
      ecclesiasticalTitleId: created.ecclesiasticalTitleRef?.id || created.ecclesiasticalTitleId || '',
      churchName: created.church?.name || filteredChurches.find((church) => church.id === created.churchId)?.name || '',
      churchCode: created.church?.code || filteredChurches.find((church) => church.id === created.churchId)?.code || '',
      regionalName: created.church?.regional?.name || '',
      fieldName: created.church?.regional?.campo?.name || '',
    };
    // 1. Optimistic: prepend to cache — tela atualiza na hora
    patchMembersCache((rows) => [newRow, ...rows]);
    // 2. Background refetch para sincronizar com banco
    invalidateMembers();
  };

  const requestDelete = (member: MemberRecord) => {
    setDeleteTarget(member);
  };

  const cancelDelete = () => {
    if (deleting) return;
    setDeleteTarget(null);
  };

  const confirmDelete = async (permanent: boolean) => {
    if (!token || !deleteTarget) return;

    // 1. Snapshot para rollback se o request falhar
    const snapshot = qc.getQueryData<MembersQueryData>(qk.members(memberQueryFilters));

    // 2. Remove da tela ANTES da resposta do servidor (optimistic)
    patchMembersCache((rows) => rows.filter((member) => member.id !== deleteTarget.id));
    setDeleteTarget(null);

    try {
      setDeleting(true);
      setError('');

      const url = permanent
        ? `${apiBase}/members/${deleteTarget.id}?permanent=true`
        : `${apiBase}/members/${deleteTarget.id}`;

      const response = await fetch(url, {
        method: 'DELETE',
        headers: buildAuthHeaders(token),
      });

      if (!response.ok) {
        const message = await response.json().catch(() => ({}));
        throw new Error(message.error || 'Falha ao excluir membro.');
      }

      // 3. Confirma exclusão: sincroniza cache com banco em background
      invalidateMembers();
    } catch (deleteError) {
      // 4. Rollback: restaura o membro na tela se o servidor recusou
      if (snapshot) qc.setQueryData(qk.members(memberQueryFilters), snapshot);
      setError(deleteError instanceof Error ? deleteError.message : 'Nao foi possivel excluir o membro.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-6 space-y-4 text-slate-900 dark:text-slate-100">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
            <Users className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Membros</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">Gerencie membros, cadastros PF e cadastros PJ da igreja</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            className="flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-600 hover:text-slate-900 dark:hover:text-white hover:shadow-sm transition-all duration-150 active:scale-[0.96] disabled:opacity-50 disabled:pointer-events-none focus:outline-none"
            onClick={() => setPrintModalOpen(true)}
            disabled={isAnyActionActive}
          >
            {(printModalOpen || preparingPrint) ? (
              <Loader2 className="h-4 w-4 animate-spin text-slate-600 dark:text-slate-400" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {preparingPrint ? 'Gerando...' : printModalOpen ? 'Carregando...' : 'Imprimir'}
          </button>
          <button
            className="flex items-center gap-2 rounded-lg border border-green-300 dark:border-green-800/40 bg-green-50 dark:bg-green-950/20 px-4 py-2 text-sm font-medium text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-950/40 hover:border-green-400 dark:hover:border-green-700 hover:shadow-sm transition-all duration-150 active:scale-[0.96] disabled:opacity-50 disabled:pointer-events-none focus:outline-none"
            onClick={handleExportExcel}
            disabled={!visibleMembers.length || isAnyActionActive}
          >
            {exportingExcel ? (
              <Loader2 className="h-4 w-4 animate-spin text-green-700 dark:text-green-400" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {exportingExcel ? 'Exportando...' : 'Exportar Excel'}
          </button>

          <button
            type="button"
            onClick={() => setQuickCreateType('PF')}
            disabled={isAnyActionActive}
            className="flex items-center gap-2 rounded-lg border border-sky-300 dark:border-sky-800/40 bg-sky-50 dark:bg-sky-950/20 px-4 py-2 text-sm font-medium text-sky-700 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-950/40 hover:border-sky-400 dark:hover:border-sky-700 hover:shadow-sm transition-all duration-150 active:scale-[0.96] disabled:opacity-50 disabled:pointer-events-none focus:outline-none"
          >
            {quickCreateType === 'PF' ? (
              <Loader2 className="h-4 w-4 animate-spin text-sky-700 dark:text-sky-400" />
            ) : (
              <UserRound className="h-4 w-4" />
            )}
            {quickCreateType === 'PF' ? 'Carregando...' : 'Novo PF'}
          </button>
          <button
            type="button"
            onClick={() => setQuickCreateType('PJ')}
            disabled={isAnyActionActive}
            className="flex items-center gap-2 rounded-lg border border-indigo-300 dark:border-indigo-800/40 bg-indigo-50 dark:bg-indigo-950/20 px-4 py-2 text-sm font-medium text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-950/40 hover:border-indigo-400 dark:hover:border-indigo-700 hover:shadow-sm transition-all duration-150 active:scale-[0.96] disabled:opacity-50 disabled:pointer-events-none focus:outline-none"
          >
            {quickCreateType === 'PJ' ? (
              <Loader2 className="h-4 w-4 animate-spin text-indigo-700 dark:text-indigo-400" />
            ) : (
              <Building2 className="h-4 w-4" />
            )}
            {quickCreateType === 'PJ' ? 'Carregando...' : 'Novo PJ'}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setIsNavigatingNew(true);
              navigate('/app-ui/members/new');
            }}
            disabled={isAnyActionActive}
            className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 hover:shadow-sm transition-all duration-150 active:scale-[0.96] disabled:opacity-50 disabled:pointer-events-none focus:outline-none"
          >
            {isNavigatingNew ? (
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {isNavigatingNew ? 'Carregando...' : 'Novo Membro'}
          </button>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Total</p>
            {isLoadingScreen ? <SkeletonBlock className="mt-1 h-7 w-12" /> : <p className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">{serverTotal}</p>}
          </div>
          <User className="h-5 w-5 text-blue-600" />
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Ativos</p>
            {isLoadingScreen ? <SkeletonBlock className="mt-1 h-7 w-12" /> : <p className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">{stats.activeMembers}</p>}
          </div>
          <User className="h-5 w-5 text-green-600" />
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Inativos</p>
            {isLoadingScreen ? <SkeletonBlock className="mt-1 h-7 w-12" /> : <p className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">{stats.inactiveMembers}</p>}
          </div>
          <User className="h-5 w-5 text-orange-600" />
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Igrejas</p>
            {isLoadingScreen ? <SkeletonBlock className="mt-1 h-7 w-12" /> : <p className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">{stats.uniqueChurches}</p>}
          </div>
          <MapPin className="h-5 w-5 text-purple-600" />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,1.25fr)_repeat(7,minmax(145px,0.8fr))] xl:items-end">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Busca</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar por nome, email, telefone, CPF, título ou igreja..."
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 py-2 pl-10 pr-4 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Campo</label>
            <select
              value={selectedFieldId}
              onChange={(event) => {
                setSelectedFieldId(event.target.value);
                setSelectedRegionalId('');
                setSelectedChurchId('');
              }}
              disabled={!canChooseField || loadingFilters}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-500"
            >
              {!hasFixedChurchScope && <option value="">Todos os campos</option>}
              {fields.map((field) => (
                <option key={field.id} value={field.id}>
                  {field.code ? `${field.code} - ` : ''}
                  {field.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Regional</label>
            <select
              value={selectedRegionalId}
              onChange={(event) => {
                setSelectedRegionalId(event.target.value);
                setSelectedChurchId('');
              }}
              disabled={!canChooseRegional || loadingFilters}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-500"
            >
              {!hasFixedChurchScope && <option value="">Todas as regionais</option>}
              {filteredRegionais.map((regional) => (
                <option key={regional.id} value={regional.id}>
                  {regional.code ? `${regional.code} - ` : ''}
                  {regional.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Igreja</label>
            <select
              value={selectedChurchId}
              onChange={(event) => setSelectedChurchId(event.target.value)}
              disabled={!canChooseChurch || loadingFilters}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-500"
            >
              {!hasFixedChurchScope && <option value="">Todas as igrejas</option>}
              {filteredChurches.map((church) => (
                <option key={church.id} value={church.id}>
                  {church.code ? `${church.code} - ` : ''}
                  {church.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Tipo</label>
            <select
              value={selectedTypeFilter}
              onChange={(event) => setSelectedTypeFilter(event.target.value as MemberTypeFilter)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="ALL">Todos os tipos</option>
              <option value="MEMBRO">Membro</option>
              <option value="PF">PF</option>
              <option value="PJ">PJ</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Título eclesiástico</label>
            <MultiSelectDropdown
              options={titleFilterOptions.filter((o) => o.value !== 'ALL')}
              value={selectedTitleFilters}
              onChange={setSelectedTitleFilters}
              allLabel="Todos os títulos"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Situação</label>
            <MultiSelectDropdown
              options={[
                { value: 'ativo', label: 'Ativo' },
                { value: 'inativo', label: 'Inativo' },
                { value: 'aguardando', label: 'Aguardando ativação' },
                { value: 'visitante', label: 'Visitante' },
              ]}
              value={selectedStatusFilters}
              onChange={setSelectedStatusFilters}
              allLabel="Todas as situações"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Estado civil</label>
            <MultiSelectDropdown
              options={maritalStatusFilterOptions.filter((o) => o.value !== 'ALL')}
              value={selectedMaritalStatusFilters}
              onChange={setSelectedMaritalStatusFilters}
              allLabel="Todos os estados civis"
            />
          </div>
        </div>
      </div>

      {isLoadingScreen ? (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          Carregando dados dos membros...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="relative rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        {isRefetching && (
          <div className="absolute inset-0 z-20 flex items-start justify-center rounded-xl bg-white/60 pt-24 backdrop-blur-[1px] dark:bg-slate-900/60">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-md dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              Atualizando lista...
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1380px]">
            <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">
                  <button type="button" onClick={() => handleSort('fullName')} className="inline-flex items-center gap-2">
                    Membro
                    <ArrowUpDown className="h-4 w-4 text-slate-400" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">
                  <button type="button" onClick={() => handleSort('contact')} className="inline-flex items-center gap-2">
                    Contato
                    <ArrowUpDown className="h-4 w-4 text-slate-400" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">
                  <button type="button" onClick={() => handleSort('memberType')} className="inline-flex items-center gap-2">
                    Tipo
                    <ArrowUpDown className="h-4 w-4 text-slate-400" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">
                  <button type="button" onClick={() => handleSort('ecclesiasticalTitle')} className="inline-flex items-center gap-2">
                    Título Eclesiástico
                    <ArrowUpDown className="h-4 w-4 text-slate-400" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">
                  <button type="button" onClick={() => handleSort('churchName')} className="inline-flex items-center gap-2">
                    Igreja
                    <ArrowUpDown className="h-4 w-4 text-slate-400" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">
                  <button type="button" onClick={() => handleSort('membershipStatus')} className="inline-flex items-center gap-2">
                    Status
                    <ArrowUpDown className="h-4 w-4 text-slate-400" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">
                  <button type="button" onClick={() => handleSort('membershipDate')} className="inline-flex items-center gap-2">
                    Desde
                    <ArrowUpDown className="h-4 w-4 text-slate-400" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-slate-900">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {isLoadingScreen ? <MembersTableSkeleton /> : paginatedMembers.map((member) => {
                const normalizedStatus = normalizeMembershipStatus(member.membershipStatus);
                const displayStatus = member.membershipStatus || 'VISITANTE';
                const normalizedType = normalizeMemberType(member.memberType);

                return (
                  <tr key={member.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                    <td className="px-4 py-4 align-top">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-sm font-semibold text-purple-700 overflow-hidden flex-shrink-0">
                          {member.photoUrl ? (
                            <img src={member.photoUrl} alt={member.fullName} className="w-full h-full object-cover" />
                          ) : (
                            getInitials(member.fullName)
                          )}
                        </div>
                        <div>
                          <p className="font-semibold uppercase text-slate-900 dark:text-slate-100">{member.fullName}</p>
                          {member.rol != null && (
                            <p className="text-xs font-semibold text-purple-600">ROL #{member.rol}</p>
                          )}
                          <p className="text-sm text-slate-500">{normalizedType === 'PJ' ? (formatCnpj(member.cnpj) || '-') : (formatCpf(member.cpf) || '-')}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="max-w-[260px] space-y-1">
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                          <Phone className="h-4 w-4 shrink-0" />
                          <span className="truncate">{formatPhone(member.mobile || member.phone) || '-'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                          <Mail className="h-4 w-4 shrink-0" />
                          <span className="truncate">{member.email || '-'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getMemberTypeBadgeClass(member.memberType)}`}>
                        {getMemberTypeLabel(member.memberType)}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{getTitleLabel(member)}</span>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                        <MapPin className="h-4 w-4 shrink-0" />
                        <span>{member.churchName || '-'}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{[member.regionalName, member.fieldName].filter(Boolean).join(' • ') || '-'}</p>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadgeClass(normalizedStatus)}`}>
                        {displayStatus}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300 align-top">
                      {member.membershipDate ? new Date(member.membershipDate).toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEditor(member.id)}
                          className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                        </button>

                        <Link
                          to={`/app-ui/members/${member.id}`}
                          className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Detalhes"
                        >
                          <Eye className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                        </Link>

                        <button
                          type="button"
                          onClick={() => requestDelete(member)}
                          className="rounded-lg p-2 hover:bg-red-50 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!isLoadingScreen && !paginatedMembers.length ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Nenhum membro encontrado para os filtros selecionados.
          </div>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-slate-200 dark:border-slate-700 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Exibindo {paginatedMembers.length ? (page - 1) * pageSize + 1 : 0} a {(page - 1) * pageSize + paginatedMembers.length} de {serverTotal} membros
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <span>Linhas por página</span>
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {pageSizeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                Anterior
              </button>
              <span className="text-sm text-slate-600 dark:text-slate-300">Página {page} de {totalPages}</span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                Próxima
              </button>
            </div>
          </div>
        </div>
      </div>

      <MemberEditDrawer
        memberId={editorMemberId}
        open={!!editorMemberId}
        onClose={closeEditor}
        onSaved={handleEditorSaved}
        titles={titles}
      />

      <MemberQuickCreateModal
        open={!!quickCreateType}
        type={quickCreateType}
        initialChurchId={selectedChurchId || storedUser.churchId || filteredChurches[0]?.id || ''}
        availableChurches={filteredChurches.map((church) => ({ id: church.id, name: church.name, code: church.code || '' }))}
        lockChurchSelection={hasFixedChurchScope && Boolean(selectedChurchId || storedUser.churchId)}
        onClose={closeQuickCreate}
        onCreated={handleQuickCreated}
      />

      {deleteTarget ? (
        <>
          <div className="fixed inset-0 z-40 bg-slate-900/50" onClick={cancelDelete} />
          <div className="fixed left-1/2 top-1/2 z-50 w-[92%] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700">
            <div className="p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Excluir membro</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    O que deseja fazer com <span className="font-semibold uppercase">{deleteTarget.fullName}</span>?
                  </p>
                  <div className="mt-4 space-y-2">
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-sm font-semibold text-amber-900">Arquivar (soft delete)</p>
                      <p className="text-xs text-amber-700 mt-0.5">O membro é desativado e ocultado das listas, mas todo o histórico de eventos e cards do pipeline é preservado.</p>
                    </div>
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                      <p className="text-sm font-semibold text-red-900">Excluir permanentemente</p>
                      <p className="text-xs text-red-700 mt-0.5">Remove o membro e apaga todo o histórico de eventos vinculado. Esta ação <strong>não pode ser desfeita</strong>.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 rounded-b-xl border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-6 py-3">
              <button
                type="button"
                onClick={cancelDelete}
                disabled={deleting}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => confirmDelete(false)}
                disabled={deleting}
                className="rounded-lg border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
              >
                {deleting ? 'Arquivando...' : 'Arquivar'}
              </button>
              <button
                type="button"
                onClick={() => confirmDelete(true)}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? 'Excluindo...' : 'Excluir tudo'}
              </button>
            </div>
          </div>
        </>
      ) : null}

      <PrintModal
        open={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        showGroupBy
        sortOptions={[
          { value: 'fullName', label: 'Nome' },
          { value: 'memberType', label: 'Tipo' },
          { value: 'ecclesiasticalTitle', label: 'Título Eclesiástico' },
          { value: 'churchName', label: 'Igreja' },
          { value: 'membershipStatus', label: 'Situação' },
          { value: 'membershipDate', label: 'Membro desde' },
        ]}
        columnOptions={[
          { value: 'fullName', label: 'Nome' },
          { value: 'rol', label: 'Rol' },
          { value: 'memberType', label: 'Tipo' },
          { value: 'title', label: 'Título Eclesiástico' },
          { value: 'churchName', label: 'Igreja' },
          { value: 'regionalName', label: 'Regional' },
          { value: 'membershipStatus', label: 'Situação' },
          { value: 'membershipDate', label: 'Membro desde' },
          { value: 'phone', label: 'Telefone', defaultChecked: false },
          { value: 'email', label: 'E-mail', defaultChecked: false },
          { value: 'cpf', label: 'CPF', defaultChecked: false },
          { value: 'maritalStatus', label: 'Est. Civil', defaultChecked: false },
          { value: 'spouseName', label: 'Cônjuge', defaultChecked: false },
          { value: 'fatherName', label: 'Pai', defaultChecked: false },
          { value: 'motherName', label: 'Mãe', defaultChecked: false },
          { value: 'birthDate', label: 'Nascimento', defaultChecked: false },
          { value: 'addressStreet', label: 'Endereço', defaultChecked: false },
          { value: 'addressCity', label: 'Cidade', defaultChecked: false },
          { value: 'addressState', label: 'UF', defaultChecked: false },
          { value: 'addressZipcode', label: 'CEP', defaultChecked: false },
        ]}
        defaultSort="fullName"
        onPrint={async (orientation, sortBy, selectedColumns, groupByChurch) => {
          logClientAudit('read', 'Imprimiu relatório ou ficha de membros', 'Lista de Membros');
          // Imprime TODOS os membros do filtro atual (não só a página exibida).
          let allMembers: MemberRecord[];
          setPreparingPrint(true);
          try {
            allMembers = await fetchAllMembers();
          } catch (err) {
            console.error(err);
            setError('Erro ao preparar a impressão de todos os membros.');
            return;
          } finally {
            setPreparingPrint(false);
          }
          const sorted = [...allMembers].sort((a, b) =>
            String(a[sortBy as keyof typeof a] ?? '').localeCompare(String(b[sortBy as keyof typeof b] ?? ''), 'pt-BR')
          );
          const allCols = [
            { label: 'Nome', key: 'fullName' },
            { label: 'Rol', key: 'rol', width: '45px' },
            { label: 'Tipo', key: 'memberType', width: '55px' },
            { label: 'Título Eclesiástico', key: 'title', width: '110px' },
            { label: 'Igreja', key: 'churchName' },
            { label: 'Regional', key: 'regionalName', width: '100px' },
            { label: 'Situação', key: 'membershipStatus', width: '70px' },
            { label: 'Membro desde', key: 'membershipDate', width: '75px' },
            { label: 'Telefone', key: 'phone', width: '100px' },
            { label: 'E-mail', key: 'email' },
            { label: 'CPF', key: 'cpf', width: '90px' },
            { label: 'Est. Civil', key: 'maritalStatus', width: '70px' },
            { label: 'Cônjuge', key: 'spouseName' },
            { label: 'Pai', key: 'fatherName' },
            { label: 'Mãe', key: 'motherName' },
            { label: 'Nascimento', key: 'birthDate', width: '75px' },
            { label: 'Endereço', key: 'addressStreet' },
            { label: 'Cidade', key: 'addressCity', width: '90px' },
            { label: 'UF', key: 'addressState', width: '30px' },
            { label: 'CEP', key: 'addressZipcode', width: '65px' },
          ];
          const rows = sorted.map((m) => ({
            fullName: m.fullName,
            rol: m.rol != null ? String(m.rol) : '—',
            memberType: m.memberType || '—',
            title: m.ecclesiasticalTitleRef?.name || m.ecclesiasticalTitle || '—',
            churchName: m.churchName || '—',
            regionalName: m.regionalName || m.regional?.name || m.church?.regional?.name || '—',
            membershipStatus: m.membershipStatus || '—',
            membershipDate: m.membershipDate ? new Date(m.membershipDate).toLocaleDateString('pt-BR') : '—',
            phone: m.mobile || m.phone || '—',
            email: m.email || '—',
            cpf: m.cpf ? formatCpf(m.cpf) : '—',
            maritalStatus: m.maritalStatus || '—',
            spouseName: m.spouseName || '—',
            fatherName: m.fatherName || '—',
            motherName: m.motherName || '—',
            birthDate: m.birthDate ? new Date(m.birthDate).toLocaleDateString('pt-BR') : '—',
            addressStreet: [m.addressStreet, m.addressNumber, m.addressNeighborhood].filter(Boolean).join(', ') || '—',
            addressCity: m.addressCity || '—',
            addressState: m.addressState || '—',
            addressZipcode: m.addressZipcode || '—',
          }));
          printReport({
            title: 'Lista de Membros',
            orientation,
            columns: allCols.filter((c) => selectedColumns.includes(c.key)),
            rows,
            ...(groupByChurch ? { groupByKey: 'churchName', groupByLabel: 'Igreja' } : {}),
          });
        }}
      />
    </div>
  );
}