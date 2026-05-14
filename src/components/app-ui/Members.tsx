import { useEffect, useMemo, useState, useCallback } from 'react';
import { AlertTriangle, ArrowUpDown, Building2, Download, Eye, Mail, MapPin, Pencil, Phone, Plus, Printer, Trash2, User, UserRound, Users, Search } from 'lucide-react';
import { Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MemberEditDrawer } from './MemberEditDrawer';
import { MemberQuickCreateModal } from './MemberQuickCreateModal';
import { PrintModal } from './shared/PrintModal';
import { printReport } from '../../lib/printReport';
import { TableSkeleton, StatsSkeleton } from './shared/Skeleton';
import { useDebounce } from '../../lib/secretariaHooks';
import { qk } from '../../lib/queryClient';

import { apiBase } from '../../lib/apiBase';

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

function buildAuthHeaders(token: string | null) {
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

  const title = member.ecclesiasticalTitleRef?.name || member.ecclesiasticalTitle || '';
  return normalizeText(title) || EMPTY_TITLE_FILTER;
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

export function Members() {
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
  const [selectedTitleFilter, setSelectedTitleFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<MembershipStatusFilter>('ALL');
  const [selectedMaritalStatusFilter, setSelectedMaritalStatusFilter] = useState('ALL');
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
  const [error, setError] = useState('');
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const isLoadingScreen = loadingFilters || loadingMembers;

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
      value: normalizeText(title.name),
      label: title.name,
    }));

    return [
      { value: 'ALL', label: 'Todos os títulos' },
      { value: EMPTY_TITLE_FILTER, label: 'Sem título' },
      ...options,
    ];
  }, [titles]);

  const maritalStatusFilterOptions = useMemo(() => {
    const uniqueStatuses = Array.from(
      new Set(members.map((member) => normalizeMaritalStatus(member.maritalStatus)).filter(Boolean)),
    );

    return [
      { value: 'ALL', label: 'Todos os estados civis' },
      ...uniqueStatuses.map((status) => ({
        value: status,
        label: getMaritalStatusLabel(status),
      })),
    ];
  }, [members]);

  const visibleMembers = useMemo(() => {
    const normalizedSearch = normalizeText(searchTerm);
    const typeFiltered = selectedTypeFilter === 'ALL'
      ? members
      : members.filter((member) => normalizeMemberType(member.memberType) === selectedTypeFilter);

    const titleFiltered = selectedTitleFilter === 'ALL'
      ? typeFiltered
      : typeFiltered.filter((member) => getMemberTitleFilterValue(member) === selectedTitleFilter);

    const statusFiltered = selectedStatusFilter === 'ALL'
      ? titleFiltered
      : titleFiltered.filter((member) => normalizeMembershipStatus(member.membershipStatus) === selectedStatusFilter);

    const maritalStatusFiltered = selectedMaritalStatusFilter === 'ALL'
      ? statusFiltered
      : statusFiltered.filter((member) => normalizeMaritalStatus(member.maritalStatus) === selectedMaritalStatusFilter);

    const filtered = !normalizedSearch
      ? maritalStatusFiltered
      : maritalStatusFiltered.filter((member) => {
          const haystack = [
            member.fullName,
            member.memberType,
            member.email,
            member.phone,
            member.mobile,
            member.cpf,
            member.cnpj,
            member.churchName,
            member.regionalName,
            member.fieldName,
            member.membershipStatus,
            member.maritalStatus,
            member.ecclesiasticalTitleRef?.name,
            member.ecclesiasticalTitle,
            member.rol != null ? String(member.rol) : null,
          ]
            .filter(Boolean)
            .join(' ');

          return normalizeText(haystack).includes(normalizedSearch);
        });

    return [...filtered].sort((left, right) => {
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
  }, [members, searchTerm, selectedMaritalStatusFilter, selectedStatusFilter, selectedTitleFilter, selectedTypeFilter, sortDirection, sortKey]);

  const paginatedMembers = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return visibleMembers.slice(startIndex, startIndex + pageSize);
  }, [page, pageSize, visibleMembers]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(visibleMembers.length / pageSize)), [pageSize, visibleMembers.length]);

  const stats = useMemo(() => {
    const activeMembers = visibleMembers.filter((member) => normalizeMembershipStatus(member.membershipStatus) === 'ativo').length;
    const inactiveMembers = visibleMembers.filter((member) => normalizeMembershipStatus(member.membershipStatus) === 'inativo').length;
    const uniqueChurches = new Set(visibleMembers.map((member) => member.churchId).filter(Boolean)).size;

    return { activeMembers, inactiveMembers, uniqueChurches };
  }, [visibleMembers]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedFieldId, selectedRegionalId, selectedChurchId, selectedTypeFilter, selectedTitleFilter, selectedStatusFilter, selectedMaritalStatusFilter, pageSize]);

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
  }, [token, selectedFieldId, canChooseField, canChooseRegional, canChooseChurch, activeFieldId, hasFixedChurchScope, selectedRegionalId, selectedChurchId, storedUser.regionalId, storedUser.churchId]);

  // ── TanStack Query — members ─────────────────────────────────────────────
  const memberQueryFilters = useMemo(() => ({
    churchId: selectedChurchId || undefined,
    regionalId: !selectedChurchId ? (selectedRegionalId || undefined) : undefined,
    campoId: (!selectedChurchId && !selectedRegionalId) ? (selectedFieldId || undefined) : undefined,
    q: debouncedSearch || undefined,
    page,
    pageSize,
  }), [selectedChurchId, selectedRegionalId, selectedFieldId, debouncedSearch, page, pageSize]);

  const membersQuery = useQuery({
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
      const rows = Array.isArray(data) ? data : (data.data ?? []);
      return rows.map((member: MemberRecord) => ({
        ...member,
        ecclesiasticalTitleId: member.ecclesiasticalTitleRef?.id || member.ecclesiasticalTitleId || '',
        churchName: member.church?.name || '',
        churchCode: member.church?.code || '',
        regionalName: member.church?.regional?.name || member.regional?.name || '',
        fieldName: member.church?.regional?.campo?.name || '',
      }));
    },
    enabled: !!token && !loadingFilters,
    placeholderData: (prev) => prev,
    staleTime: 5 * 60 * 1000,
  });

  // Sync query result back to local state (keeps rest of component working unchanged)
  useEffect(() => {
    if (membersQuery.data) {
      setMembers(membersQuery.data as MemberRecord[]);
      setLoadingMembers(false);
    } else if (membersQuery.isLoading) {
      setLoadingMembers(true);
    }
    if (membersQuery.error) {
      setError(membersQuery.error instanceof Error ? membersQuery.error.message : 'Erro ao carregar membros.');
      setLoadingMembers(false);
    }
  }, [membersQuery.data, membersQuery.isLoading, membersQuery.error]);

  // ── Legacy loadMembers useEffect (removed — replaced by TanStack Query above) ─

  const qc = useQueryClient();

  // Helper: update the current members cache key optimistically
  const patchMembersCache = useCallback((updater: (rows: MemberRecord[]) => MemberRecord[]) => {
    qc.setQueryData<MemberRecord[]>(qk.members(memberQueryFilters), (old) =>
      old ? updater(old) : old
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
    const snapshot = qc.getQueryData<MemberRecord[]>(qk.members(memberQueryFilters));

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
          <button className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            onClick={() => setPrintModalOpen(true)}
          >
            <Download className="h-4 w-4" />
            Imprimir
          </button>

          <button
            type="button"
            onClick={() => setQuickCreateType('PF')}
            className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-700 hover:bg-sky-100 transition-colors"
          >
            <UserRound className="h-4 w-4" />
            Novo PF
          </button>
          <button
            type="button"
            onClick={() => setQuickCreateType('PJ')}
            className="flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm text-indigo-700 hover:bg-indigo-100 transition-colors"
          >
            <Building2 className="h-4 w-4" />
            Novo PJ
          </button>
          <Link
            to="/app-ui/members/new"
            className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm text-white hover:bg-purple-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Novo Membro
          </Link>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Total</p>
            {isLoadingScreen ? <SkeletonBlock className="mt-1 h-7 w-12" /> : <p className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">{members.length}</p>}
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
            <select
              value={selectedTitleFilter}
              onChange={(event) => setSelectedTitleFilter(event.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {titleFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Situação</label>
            <select
              value={selectedStatusFilter}
              onChange={(event) => setSelectedStatusFilter(event.target.value as MembershipStatusFilter)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="ALL">Todas as situações</option>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
              <option value="aguardando">Aguardando ativação</option>
              <option value="visitante">Visitante</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Estado civil</label>
            <select
              value={selectedMaritalStatusFilter}
              onChange={(event) => setSelectedMaritalStatusFilter(event.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {maritalStatusFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
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

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
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
            Exibindo {paginatedMembers.length ? (page - 1) * pageSize + 1 : 0} a {Math.min(page * pageSize, visibleMembers.length)} de {visibleMembers.length} membros
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
          { value: 'memberType', label: 'Tipo' },
          { value: 'phone', label: 'Telefone' },
          { value: 'title', label: 'Título' },
          { value: 'churchName', label: 'Igreja' },
          { value: 'membershipStatus', label: 'Situação' },
          { value: 'membershipDate', label: 'Desde' },
        ]}
        defaultSort="fullName"
        onPrint={(orientation, sortBy, selectedColumns) => {
          const sorted = [...visibleMembers].sort((a, b) =>
            String(a[sortBy as keyof typeof a] ?? '').localeCompare(String(b[sortBy as keyof typeof b] ?? ''), 'pt-BR')
          );
          const allCols = [
            { label: 'Nome', key: 'fullName' },
            { label: 'Tipo', key: 'memberType', width: '55px' },
            { label: 'Telefone', key: 'phone', width: '100px' },
            { label: 'Título', key: 'title', width: '110px' },
            { label: 'Igreja', key: 'churchName' },
            { label: 'Situação', key: 'membershipStatus', width: '70px' },
            { label: 'Desde', key: 'membershipDate', width: '75px' },
          ];
          printReport({
            title: 'Lista de Membros',
            orientation,
            columns: allCols.filter((c) => selectedColumns.includes(c.key)),
            rows: sorted.map((m) => ({
              fullName: m.fullName,
              memberType: m.memberType || '—',
              phone: m.mobile || m.phone || '—',
              title: m.ecclesiasticalTitleRef?.name || m.ecclesiasticalTitle || '—',
              churchName: m.churchName || '—',
              membershipStatus: m.membershipStatus || '—',
              membershipDate: m.membershipDate ? new Date(m.membershipDate).toLocaleDateString('pt-BR') : '—',
            })),
          });
        }}
      />
    </div>
  );
}