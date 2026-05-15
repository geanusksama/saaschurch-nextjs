import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '../../lib/secretariaHooks';
import { qk } from '../../lib/queryClient';
import { ArrowUpDown, Building2, Calendar, CheckCircle2, Clock3, Download, Droplets, Pencil, Plus, Printer, Search, Trash2, UserRound, X, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { apiBase } from '../../lib/apiBase';
import { ConfirmDialog } from './shared/ConfirmDialog';
import { PrintModal } from './shared/PrintModal';
import { printReport } from '../../lib/printReport';

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
  regionalId?: string | null;
  addressCity?: string | null;
  regionalName?: string | null;
  regional?: {
    id?: string;
    name?: string;
    campoId?: string;
    campo?: {
      id?: string;
      name?: string;
      code?: string | null;
    } | null;
  } | null;
};

type MemberOption = {
  id: string;
  fullName: string;
  churchId: string;
  church?: { id: string; name: string; code?: string | null } | null;
  baptismStatus?: string | null;
};

type BaptismSchedule = {
  id: string;
  churchId: string;
  fieldId?: string | null;
  churchName: string;
  churchCode?: string | null;
  scheduledDate: string;
  notes?: string | null;
  createdAt?: string | null;
};

type BaptismQueueItem = {
  id: string;
  protocol: string;
  member?: { id: string; fullName: string; phone?: string | null; mobile?: string | null } | null;
  church?: { id: string; name: string; code?: string | null } | null;
  service?: { id: number; sigla: string; description: string } | null;
  statusLabel: string;
  columnIndex: number;
  openedAt?: string | null;
  baptismDate?: string | null;
  nextBaptism?: BaptismSchedule | null;
  notes?: string | null;
};

type DashboardPayload = {
  canManageSchedules: boolean;
  schedules: BaptismSchedule[];
  queue: BaptismQueueItem[];
  stats: {
    pendingCount: number;
    approvedCount: number;
    cancelledCount: number;
    nextBaptismDate?: string | null;
  };
};

type SortKey = 'member' | 'church' | 'service' | 'status' | 'baptismDate' | 'openedAt';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const EMPTY_REQUEST_FORM = {
  churchId: '',
  memberId: '',
  type: 'water',
  baptismDate: '',
  notes: '',
};

const EMPTY_SCHEDULE_FORM = {
  churchId: '',
  scheduledDate: '',
  notes: '',
};

function authFetch(url: string, init: RequestInit = {}) {
  const token = localStorage.getItem('mrm_token');
  return fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
}

function normalizeText(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function getDateOnly(value?: string | null) {
  if (!value) return '';
  const raw = String(value);
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function formatDate(value?: string | null) {
  if (!value) return 'Nao definido';
  const dateOnly = getDateOnly(value);
  if (dateOnly) {
    const [year, month, day] = dateOnly.split('-');
    return `${day}/${month}/${year}`;
  }
  return 'Nao definido';
}

function toDateInputValue(value?: string | null) {
  return getDateOnly(value);
}

function getDaysUntilDate(value?: string | null) {
  const dateOnly = getDateOnly(value);
  if (!dateOnly) return null;

  const target = new Date(`${dateOnly}T00:00:00`);
  const today = new Date();
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target.getTime() - current.getTime()) / 86400000);
}

function getDaysUntilLabel(value?: string | null) {
  const days = getDaysUntilDate(value);
  if (days === null) return '';
  if (days === 0) return 'Acontece hoje';
  if (days === 1) return 'Falta 1 dia';
  if (days > 1) return `Faltam ${days} dias`;
  if (days === -1) return 'Data vencida ha 1 dia';
  return `Data vencida ha ${Math.abs(days)} dias`;
}

function parseStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('mrm_user') || '{}');
  } catch {
    return {};
  }
}

function memberMatchesQuery(member: { fullName?: string | null; rol?: number | null }, query: string) {
  const normalizedQuery = normalizeText(query).trim();
  if (!normalizedQuery) return true;
  if (/^\d+$/.test(normalizedQuery)) return String(member.rol || '') === normalizedQuery;
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  const parts = normalizeText(member.fullName || '').split(/\s+/).filter(Boolean);
  return terms.every((term) => parts.some((part) => part.startsWith(term)));
}

function statusClass(columnIndex: number) {
  if (columnIndex === 2) return 'bg-green-100 text-green-700';
  if (columnIndex === 3) return 'bg-rose-100 text-rose-700';
  return 'bg-blue-100 text-blue-700';
}

function dateInRange(value: string | null | undefined, from: string, to: string) {
  const current = getDateOnly(value);
  if (!current) return !from && !to;
  if (from && current < from) return false;
  if (to && current > to) return false;
  return true;
}

function getMonthDateRange(baseDate = new Date()) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function moveActiveIndex(current: number, length: number, direction: 1 | -1) {
  if (!length) return -1;
  if (current < 0) return direction === 1 ? 0 : length - 1;
  return (current + direction + length) % length;
}

function TableLoadingRows({ columns, rows = 6 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="animate-pulse border-b border-slate-100">
          {Array.from({ length: columns }).map((__, columnIndex) => (
            <td key={columnIndex} className="px-4 py-4">
              <div className="h-4 rounded bg-slate-100" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function Baptism() {
  const storedUser = useMemo(parseStoredUser, []);
  const defaultDateRange = useMemo(() => getMonthDateRange(), []);
  const activeFieldId = localStorage.getItem('mrm_active_field_id') || storedUser.campoId || '';
  const modalFieldScopeId = activeFieldId || storedUser.campoId || '';
  const normalizedRole = normalizeText(storedUser.roleName || '');
  const isSecretaryOrTreasurer = normalizedRole.includes('secret') || normalizedRole.includes('tesour');
  const isAdminOrMaster = ['master', 'admin'].includes(storedUser.profileType || '');
  const hasFixedChurchScope = (storedUser.profileType === 'church') || isSecretaryOrTreasurer;
  // Somente admin/master podem trocar o campo; regional/igreja ficam livres exceto perfil church
  const canChooseField = isAdminOrMaster;
  const canChooseRegional = !hasFixedChurchScope;
  const canChooseChurch = !hasFixedChurchScope;
  const defaultRegionalFilter = storedUser.regionalId || '';
  const defaultChurchFilter = hasFixedChurchScope ? (storedUser.churchId || '') : '';

  const qc = useQueryClient();

  const [fields, setFields] = useState<CampoOption[]>([]);
  const [regionais, setRegionais] = useState<RegionalOption[]>([]);
  const [churches, setChurches] = useState<ChurchOption[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 350);
  const [selectedFieldId, setSelectedFieldId] = useState(activeFieldId);
  const [selectedRegionalId, setSelectedRegionalId] = useState(defaultRegionalFilter);
  const [selectedChurchId, setSelectedChurchId] = useState(defaultChurchFilter);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState(defaultDateRange.start);
  const [dateTo, setDateTo] = useState(defaultDateRange.end);
  const [sortKey, setSortKey] = useState<SortKey>('openedAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [error, setError] = useState('');

  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [requestForm, setRequestForm] = useState({ ...EMPTY_REQUEST_FORM });
  const [scheduleForm, setScheduleForm] = useState({ ...EMPTY_SCHEDULE_FORM });
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [editingSchedule, setEditingSchedule] = useState<BaptismSchedule | null>(null);
  const [editingRequest, setEditingRequest] = useState<BaptismQueueItem | null>(null);
  const [churchPickerTarget, setChurchPickerTarget] = useState<'schedule' | 'request' | null>(null);
  const [churchSearch, setChurchSearch] = useState('');
  const [activeChurchIndex, setActiveChurchIndex] = useState(-1);
  const [memberSearchOpen, setMemberSearchOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSearchPerformed, setMemberSearchPerformed] = useState(false);
  const [memberSearchLoading, setMemberSearchLoading] = useState(false);
  const [activeMemberIndex, setActiveMemberIndex] = useState(-1);
  const [selectedMember, setSelectedMember] = useState<MemberOption | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'schedule' | 'request'; id: string; label: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const churchOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const memberOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // ── TanStack Query para o dashboard ──────────────────────────────────────
  const dashboardQuery = useQuery<DashboardPayload>({
    queryKey: qk.baptism({}),
    queryFn: async () => {
      const response = await authFetch(`${apiBase}/baptism/dashboard`);
      if (!response.ok) throw new Error('Falha ao carregar painel de batismo.');
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  });

  const dashboard = dashboardQuery.data ?? null;
  const loading = dashboardQuery.isLoading;

  // Substituição de loadDashboard — agora invalida o cache para refetch silencioso
  const loadDashboard = () => qc.invalidateQueries({ queryKey: qk.baptism({}) });

  const canManageSchedules = dashboard?.canManageSchedules ?? false;

  const filteredRegionais = useMemo(() => {
    if (!selectedFieldId) return regionais;
    return regionais.filter((regional) => regional.campoId === selectedFieldId);
  }, [regionais, selectedFieldId]);

  const filteredChurchOptions = useMemo(() => {
    const inField = churches.filter((church) => {
      if (!selectedFieldId) return true;
      return church.regional?.campoId === selectedFieldId || church.regional?.campo?.id === selectedFieldId;
    });

    if (!selectedRegionalId) return inField;
    return inField.filter((church) => church.regional?.id === selectedRegionalId || church.regionalId === selectedRegionalId);
  }, [churches, selectedFieldId, selectedRegionalId]);

  const modalScopedChurchOptions = useMemo(() => {
    if (!modalFieldScopeId) return churches;
    return churches.filter((church) => church.regional?.campoId === modalFieldScopeId || church.regional?.campo?.id === modalFieldScopeId);
  }, [churches, modalFieldScopeId]);

  async function loadFilters() {
    setLoadingFilters(true);
    try {
      const fieldQuery = selectedFieldId ? `?fieldId=${encodeURIComponent(selectedFieldId)}` : '';
      const [fieldsResponse, regionaisResponse, churchesResponse] = await Promise.all([
        authFetch(`${apiBase}/campos`),
        authFetch(`${apiBase}/regionais${fieldQuery}`),
        authFetch(`${apiBase}/churches${fieldQuery}`),
      ]);

      if (!fieldsResponse.ok || !regionaisResponse.ok || !churchesResponse.ok) {
        throw new Error('Falha ao carregar filtros de batismo.');
      }

      const [fieldsData, regionaisData, churchesData] = await Promise.all([
        fieldsResponse.json(),
        regionaisResponse.json(),
        churchesResponse.json(),
      ]);

      setFields(Array.isArray(fieldsData) ? fieldsData : []);
      setRegionais(Array.isArray(regionaisData) ? regionaisData : []);
      setChurches(Array.isArray(churchesData) ? churchesData : []);
    } catch (loadError) {
      setFields([]);
      setRegionais([]);
      setChurches([]);
      setError(loadError instanceof Error ? loadError.message : 'Nao foi possivel carregar os filtros.');
    } finally {
      setLoadingFilters(false);
    }
  }

  async function loadMembers(churchId?: string, query?: string) {
    const normalizedQuery = String(query || '').trim();
    if (!normalizedQuery) {
      setMembers([]);
      return;
    }

    const params = new URLSearchParams();
    if (churchId) {
      params.set('churchId', churchId);
    } else {
      const activeCampo = modalFieldScopeId;
      if (activeCampo) params.set('campoId', activeCampo);
    }
    params.set('query', normalizedQuery);
    params.set('limit', '30');

    try {
      const response = await authFetch(`${apiBase}/members?${params.toString()}`);
      if (!response.ok) {
        setMembers([]);
        return;
      }
      const data = await response.json();
      const rows = Array.isArray(data) ? data : [];
      setMembers(rows);
    } catch {
      setMembers([]);
    }
  }

  useEffect(() => {
    loadFilters();
  }, [selectedFieldId]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedFieldId, selectedRegionalId, selectedChurchId, selectedStatusFilter, dateFrom, dateTo, pageSize]);

  const sortedSchedules = useMemo(() => {
    return [...(dashboard?.schedules || [])].sort((left, right) => {
      const leftDate = getDateOnly(left.scheduledDate);
      const rightDate = getDateOnly(right.scheduledDate);
      const comparison = leftDate.localeCompare(rightDate);
      if (comparison !== 0) return comparison;
      const leftCreated = getDateOnly(left.createdAt || null);
      const rightCreated = getDateOnly(right.createdAt || null);
      return leftCreated.localeCompare(rightCreated);
    });
  }, [dashboard?.schedules]);

  const visibleSchedules = useMemo(() => {
    return sortedSchedules.filter((schedule) => {
      const query = normalizeText(debouncedSearch);
      const scheduleChurch = churches.find((church) => church.id === schedule.churchId);
      const fieldMatch = !selectedFieldId || schedule.fieldId === selectedFieldId || scheduleChurch?.regional?.campoId === selectedFieldId || scheduleChurch?.regional?.campo?.id === selectedFieldId;
      const textMatch = !query || normalizeText(`${schedule.churchCode || ''} ${schedule.churchName} ${schedule.notes || ''}`).includes(query);
      const dateMatch = dateInRange(schedule.scheduledDate, dateFrom, dateTo);
      return fieldMatch && textMatch && dateMatch;
    });
  }, [sortedSchedules, churches, selectedFieldId, debouncedSearch, dateFrom, dateTo]);
  const currentSchedule = visibleSchedules[0] || null;

  const pickerChurches = useMemo(() => {
    const source = modalScopedChurchOptions;
    const query = normalizeText(churchSearch);
    if (!query) return source;
    return source.filter((church) => normalizeText(`${church.code || ''} ${church.name} ${church.regional?.name || ''} ${church.addressCity || ''}`).includes(query));
  }, [modalScopedChurchOptions, churchSearch]);

  const filteredMembers = useMemo(() => {
    return members.filter((member) => memberMatchesQuery(member, memberSearch)).slice(0, 30);
  }, [members, memberSearch]);

  useEffect(() => {
    churchOptionRefs.current = churchOptionRefs.current.slice(0, pickerChurches.length);
    setActiveChurchIndex(pickerChurches.length ? 0 : -1);
  }, [pickerChurches]);

  useEffect(() => {
    memberOptionRefs.current = memberOptionRefs.current.slice(0, filteredMembers.length);
    setActiveMemberIndex(filteredMembers.length ? 0 : -1);
  }, [filteredMembers]);

  useEffect(() => {
    if (activeChurchIndex >= 0) {
      churchOptionRefs.current[activeChurchIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeChurchIndex]);

  useEffect(() => {
    if (activeMemberIndex >= 0) {
      memberOptionRefs.current[activeMemberIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeMemberIndex]);

  const visibleRows = useMemo(() => {
    const query = normalizeText(debouncedSearch);
    const rows = (dashboard?.queue || []).filter((item) => {
      const churchMeta = churches.find((church) => church.id === item.church?.id);
      const fieldMatch = !selectedFieldId || churchMeta?.regional?.campoId === selectedFieldId || churchMeta?.regional?.campo?.id === selectedFieldId;
      const regionalMatch = !selectedRegionalId || churchMeta?.regional?.id === selectedRegionalId || churchMeta?.regionalId === selectedRegionalId;
      const churchMatch = !selectedChurchId || item.church?.id === selectedChurchId;
      const statusMatch = !selectedStatusFilter || String(item.columnIndex) === selectedStatusFilter;
      const textMatch = !query || normalizeText(`${item.member?.fullName || ''} ${item.protocol} ${item.church?.name || ''} ${item.service?.description || ''} ${item.notes || ''}`).includes(query);
      const dateMatch = dateInRange(item.openedAt, dateFrom, dateTo);
      return fieldMatch && regionalMatch && churchMatch && statusMatch && textMatch && dateMatch;
    });  

    return [...rows].sort((left, right) => {
      const leftValue = (() => {
        if (sortKey === 'member') return left.member?.fullName || '';
        if (sortKey === 'church') return left.church?.name || '';
        if (sortKey === 'service') return left.service?.description || '';
        if (sortKey === 'status') return left.statusLabel || '';
        if (sortKey === 'baptismDate') return left.baptismDate || left.nextBaptism?.scheduledDate || '';
        return left.openedAt || '';
      })();

      const rightValue = (() => {
        if (sortKey === 'member') return right.member?.fullName || '';
        if (sortKey === 'church') return right.church?.name || '';
        if (sortKey === 'service') return right.service?.description || '';
        if (sortKey === 'status') return right.statusLabel || '';
        if (sortKey === 'baptismDate') return right.baptismDate || right.nextBaptism?.scheduledDate || '';
        return right.openedAt || '';
      })();

      const comparison = String(leftValue).localeCompare(String(rightValue), 'pt-BR');
      return sortDirection === 'asc' ? comparison : comparison * -1;
    });
  }, [dashboard?.queue, churches, selectedFieldId, selectedRegionalId, selectedChurchId, selectedStatusFilter, debouncedSearch, dateFrom, dateTo, sortKey, sortDirection]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return visibleRows.slice(start, start + pageSize);
  }, [page, pageSize, visibleRows]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(visibleRows.length / pageSize)), [visibleRows.length, pageSize]);

  const stats = useMemo(() => {
    return {
      pending: visibleRows.filter((row) => row.columnIndex === 1).length,
      approved: visibleRows.filter((row) => row.columnIndex === 2).length,
      cancelled: visibleRows.filter((row) => row.columnIndex === 3).length,
      churches: new Set(visibleRows.map((row) => row.church?.id).filter(Boolean)).size,
    };
  }, [visibleRows]);

  function latestScheduleForChurch(churchId?: string) {
    if (!churchId) return currentSchedule;
    return sortedSchedules.find((schedule) => schedule.churchId === churchId) || currentSchedule;
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection(key === 'member' || key === 'church' || key === 'service' || key === 'status' ? 'asc' : 'desc');
  }

  function openScheduleModal(schedule?: BaptismSchedule | null) {
    setEditingSchedule(schedule || null);
    setModalError('');
    setChurchSearch('');
    setActiveChurchIndex(-1);
    setScheduleForm({
      churchId: schedule?.churchId || (!canManageSchedules ? storedUser.churchId || '' : ''),
      scheduledDate: toDateInputValue(schedule?.scheduledDate),
      notes: schedule?.notes || '',
    });
    setScheduleModalOpen(true);
  }

  function openRequestModal(schedule?: BaptismSchedule | null, request?: BaptismQueueItem | null) {
    const churchId = request?.church?.id || schedule?.churchId || (!canManageSchedules ? storedUser.churchId || '' : '');
    const defaultSchedule = request?.baptismDate ? null : schedule || latestScheduleForChurch(churchId);

    setEditingRequest(request || null);
    setModalError('');
    setMemberSearch('');
    setMemberSearchPerformed(false);
    setMemberSearchLoading(false);
    setActiveMemberIndex(-1);
    setMembers([]);
    setSelectedMember(
      request?.member?.id
        ? { id: request.member.id, fullName: request.member.fullName, churchId, church: request.church || null }
        : null,
    );
    setRequestForm({
      ...EMPTY_REQUEST_FORM,
      churchId,
      memberId: request?.member?.id || '',
      type: 'water',
      baptismDate: toDateInputValue(request?.baptismDate || defaultSchedule?.scheduledDate || ''),
      notes: request?.notes || '',
    });
    setRequestModalOpen(true);
  }

  function handleChurchSelected(church: ChurchOption) {
    if (churchPickerTarget === 'schedule') {
      setScheduleForm((current) => ({ ...current, churchId: church.id }));
    }
    if (churchPickerTarget === 'request') {
      const fallbackSchedule = latestScheduleForChurch(church.id);
      setMembers([]);
      setMemberSearch('');
      setMemberSearchPerformed(false);
      setActiveMemberIndex(-1);
      setSelectedMember(null);
      setRequestForm((current) => ({
        ...current,
        churchId: church.id,
        memberId: '',
        baptismDate: toDateInputValue(fallbackSchedule?.scheduledDate || ''),
      }));
    }
    setChurchPickerTarget(null);
  }

  function handleMemberSelected(member: MemberOption) {
    const fallbackSchedule = latestScheduleForChurch(member.churchId);
    setSelectedMember(member);
    setRequestForm((current) => ({
      ...current,
      churchId: member.churchId,
      memberId: member.id,
      baptismDate: current.baptismDate || toDateInputValue(fallbackSchedule?.scheduledDate || ''),
    }));
    setMemberSearchOpen(false);
  }

  async function runMemberSearch() {
    const query = memberSearch.trim();
    if (!query) {
      toast.error('Digite o nome ou ROL do membro para buscar.');
      return;
    }

    setMemberSearchLoading(true);
    setMemberSearchPerformed(true);
    setActiveMemberIndex(-1);
    try {
      await loadMembers(requestForm.churchId || (!canManageSchedules ? storedUser.churchId || '' : ''), query);
    } finally {
      setMemberSearchLoading(false);
    }
  }

  function handleChurchSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveChurchIndex((current) => moveActiveIndex(current, pickerChurches.length, 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveChurchIndex((current) => moveActiveIndex(current, pickerChurches.length, -1));
      return;
    }

    if (event.key === 'Enter' && activeChurchIndex >= 0 && pickerChurches[activeChurchIndex]) {
      event.preventDefault();
      handleChurchSelected(pickerChurches[activeChurchIndex]);
    }
  }

  function handleMemberSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveMemberIndex((current) => moveActiveIndex(current, filteredMembers.length, 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveMemberIndex((current) => moveActiveIndex(current, filteredMembers.length, -1));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (activeMemberIndex >= 0 && filteredMembers[activeMemberIndex]) {
        handleMemberSelected(filteredMembers[activeMemberIndex]);
        return;
      }
      runMemberSearch();
    }
  }

  async function submitSchedule() {
    setModalError('');
    if (!scheduleForm.churchId || !scheduleForm.scheduledDate) {
      setModalError('Igreja e data sao obrigatorias.');
      return;
    }

    setScheduleSubmitting(true);
    try {
      const response = await authFetch(`${apiBase}/baptism/schedules${editingSchedule ? `/${editingSchedule.id}` : ''}`, {
        method: editingSchedule ? 'PATCH' : 'POST',
        body: JSON.stringify(scheduleForm),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Falha ao salvar data de batismo.');
      }
      setEditingSchedule(null);
      setScheduleModalOpen(false);
      setScheduleForm({ ...EMPTY_SCHEDULE_FORM });
      toast.success(editingSchedule ? 'Data de batismo atualizada.' : 'Data de batismo criada.');
      await loadDashboard();
    } catch (submitError) {
      setModalError(submitError instanceof Error ? submitError.message : 'Falha ao salvar data.');
    } finally {
      setScheduleSubmitting(false);
    }
  }

  async function submitRequest() {
    setModalError('');
    if (!requestForm.memberId) {
      setModalError('Selecione um membro.');
      return;
    }

    setRequestSubmitting(true);
    try {
      const response = await authFetch(`${apiBase}/baptism/requests${editingRequest ? `/${editingRequest.id}` : ''}`, {
        method: editingRequest ? 'PATCH' : 'POST',
        body: JSON.stringify({
          memberId: requestForm.memberId,
          type: requestForm.type,
          notes: requestForm.notes,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Falha ao salvar o batismo.');
      }
      setEditingRequest(null);
      setSelectedMember(null);
      setRequestModalOpen(false);
      setRequestForm({ ...EMPTY_REQUEST_FORM });
      toast.success(editingRequest ? 'Registro de batismo atualizado.' : 'Processo de batismo iniciado.');
      await loadDashboard();
    } catch (submitError) {
      setModalError(submitError instanceof Error ? submitError.message : 'Falha ao salvar o registro.');
    } finally {
      setRequestSubmitting(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;

    // ── Optimistic: remove do cache imediatamente ─────────────────────────
    const queryKey = qk.baptism({});
    const snapshot = qc.getQueryData<DashboardPayload>(queryKey);
    if (snapshot) {
      qc.setQueryData<DashboardPayload>(queryKey, (prev) => {
        if (!prev) return prev;
        if (deleteTarget.kind === 'schedule') {
          return { ...prev, schedules: prev.schedules.filter((s) => s.id !== deleteTarget.id) };
        }
        return { ...prev, queue: prev.queue.filter((r) => r.id !== deleteTarget.id) };
      });
    }
    setDeleteTarget(null);

    setDeleteLoading(true);
    try {
      const endpoint = deleteTarget.kind === 'schedule'
        ? `${apiBase}/baptism/schedules/${deleteTarget.id}`
        : `${apiBase}/kan/cards/${deleteTarget.id}`;
      const response = await authFetch(endpoint, { method: 'DELETE' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Falha ao excluir registro.');
      }
      toast.success(deleteTarget.kind === 'schedule' ? 'Agendamento excluido.' : 'Registro de batismo excluido.');
      // Refetch silencioso em background para sincronizar stats
      void qc.invalidateQueries({ queryKey });
    } catch (deleteError) {
      // Rollback: restaura snapshot anterior
      if (snapshot) qc.setQueryData<DashboardPayload>(queryKey, snapshot);
      toast.error(deleteError instanceof Error ? deleteError.message : 'Falha ao excluir.');
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="space-y-4 p-6 text-slate-900 dark:text-slate-100">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
            <Droplets className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Batismo</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">Gerencie pedidos e processos de batismo</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => toast.info('Exportacao sera ligada no mesmo padrao dos demais servicos.')}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm transition-colors hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Exportar
          </button>
          {canManageSchedules ? (
            <button
              type="button"
              onClick={() => openScheduleModal(currentSchedule)}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm transition-colors hover:bg-slate-50"
            >
              <Calendar className="h-4 w-4" />
              Agendar Batismo
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setPrintModalOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm transition-colors hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </button>
          <button
            type="button"
            onClick={() => openRequestModal(currentSchedule)}
            className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm text-white transition-colors hover:bg-purple-700"
          >
            <Plus className="h-4 w-4" />
            Novo Batismo
          </button>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pendentes" value={stats.pending} icon={<Clock3 className="h-5 w-5 text-blue-600" />} />
        <StatCard label="Aprovados" value={stats.approved} icon={<CheckCircle2 className="h-5 w-5 text-green-600" />} />
        <StatCard label="Cancelados" value={stats.cancelled} icon={<XCircle className="h-5 w-5 text-rose-600" />} />
        <NextScheduleCard
          schedule={currentSchedule}
          canManageSchedules={canManageSchedules}
          onCreate={() => openScheduleModal()}
          onEdit={() => currentSchedule && openScheduleModal(currentSchedule)}
          onDelete={() => currentSchedule && setDeleteTarget({ kind: 'schedule', id: currentSchedule.id, label: `${currentSchedule.churchName} - ${formatDate(currentSchedule.scheduledDate)}` })}
        />
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_minmax(135px,0.72fr)_minmax(135px,0.72fr)_minmax(150px,0.8fr)_minmax(120px,0.62fr)_minmax(125px,0.62fr)_minmax(125px,0.62fr)] xl:items-end">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Busca</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar por membro, protocolo, igreja, servico ou observacao..."
                className="w-full rounded-lg border border-slate-200 py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
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
              className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100 disabled:text-slate-500"
            >
              <option value="">Todos os campos</option>
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
              className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100 disabled:text-slate-500"
            >
              <option value="">Todas as regionais</option>
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
              className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100 disabled:text-slate-500"
            >
              <option value="">Todas as igrejas</option>
              {filteredChurchOptions.map((church) => (
                <option key={church.id} value={church.id}>
                  {church.code ? `${church.code} - ` : ''}
                  {church.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Status</label>
            <select
              value={selectedStatusFilter}
              onChange={(event) => setSelectedStatusFilter(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Todos os status</option>
              <option value="1">Pendente</option>
              <option value="2">Aprovado</option>
              <option value="3">Cancelado</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Data inicial</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Data final</label>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>
      </div>

      {(loading || loadingFilters) ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <span className="inline-flex items-center gap-2">
            <Clock3 className="h-4 w-4 animate-pulse text-blue-600" />
            Carregando batismos e filtros...
          </span>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1380px]">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">
                  <button type="button" onClick={() => handleSort('member')} className="inline-flex items-center gap-2">
                    Membro
                    <ArrowUpDown className="h-4 w-4 text-slate-400" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">
                  <button type="button" onClick={() => handleSort('church')} className="inline-flex items-center gap-2">
                    Igreja
                    <ArrowUpDown className="h-4 w-4 text-slate-400" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">
                  <button type="button" onClick={() => handleSort('service')} className="inline-flex items-center gap-2">
                    Servico
                    <ArrowUpDown className="h-4 w-4 text-slate-400" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">
                  <button type="button" onClick={() => handleSort('status')} className="inline-flex items-center gap-2">
                    Status
                    <ArrowUpDown className="h-4 w-4 text-slate-400" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">
                  <button type="button" onClick={() => handleSort('baptismDate')} className="inline-flex items-center gap-2">
                    Data do Batismo
                    <ArrowUpDown className="h-4 w-4 text-slate-400" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">
                  <button type="button" onClick={() => handleSort('openedAt')} className="inline-flex items-center gap-2">
                    Aberto em
                    <ArrowUpDown className="h-4 w-4 text-slate-400" />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Observacoes</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-slate-900">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading || loadingFilters ? <TableLoadingRows columns={8} /> : null}
              {!loading && !loadingFilters ? paginatedRows.map((item) => {
                const churchMeta = churches.find((church) => church.id === item.church?.id);
                return (
                  <tr key={item.id} className="transition-colors hover:bg-slate-50">
                    <td className="px-4 py-4 align-top">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-sm font-semibold text-purple-700">
                          {(item.member?.fullName || 'MB').split(' ').map((part) => part[0]).slice(0, 2).join('')}
                        </div>
                        <div>
                          <p className="font-semibold uppercase text-slate-900">{item.member?.fullName || 'Membro nao vinculado'}</p>
                          <p className="text-xs font-semibold text-purple-600">{item.protocol}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-slate-600">
                      <p>{item.church?.code ? `${item.church.code} - ` : ''}{item.church?.name || '-'}</p>
                      <p className="mt-1 text-xs text-slate-500">{[churchMeta?.regional?.name, churchMeta?.regional?.campo?.name].filter(Boolean).join(' • ') || '-'}</p>
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-slate-700">{item.service?.description || 'Batismo'}</td>
                    <td className="px-4 py-4 align-top">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(item.columnIndex)}`}>
                        {item.statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-slate-600">{formatDate(item.baptismDate || item.nextBaptism?.scheduledDate)}</td>
                    <td className="px-4 py-4 align-top text-sm text-slate-600">{formatDate(item.openedAt || null)}</td>
                    <td className="px-4 py-4 align-top text-sm text-slate-600">
                      <div className="max-w-[260px] whitespace-pre-wrap break-words">{item.notes || '-'}</div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openRequestModal(item.nextBaptism || currentSchedule, item)}
                          className="rounded-lg p-2 transition-colors hover:bg-slate-100"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4 text-slate-600" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget({ kind: 'request', id: item.id, label: item.member?.fullName || item.protocol })}
                          className="rounded-lg p-2 transition-colors hover:bg-rose-50"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4 text-rose-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : null}
            </tbody>
          </table>
        </div>

        {!loading && !paginatedRows.length ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500">Nenhum registro de batismo encontrado para os filtros selecionados.</div>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-slate-500">
            Exibindo {paginatedRows.length ? (page - 1) * pageSize + 1 : 0} a {Math.min(page * pageSize, visibleRows.length)} de {visibleRows.length} registros
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span>Linhas por pagina</span>
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Anterior
              </button>
              <span className="text-sm text-slate-600">Pagina {page} de {totalPages}</span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Proxima
              </button>
            </div>
          </div>
        </div>
      </div>

      {requestModalOpen ? (
        <ModalShell title={editingRequest ? 'Editar Batismo' : 'Iniciar Batismo'} onClose={() => {
          setEditingRequest(null);
          setSelectedMember(null);
          setMembers([]);
          setMemberSearch('');
          setMemberSearchPerformed(false);
          setRequestModalOpen(false);
        }}>
          <p className="mb-4 text-sm text-slate-500">Preencha os dados para iniciar ou ajustar o processo.</p>

          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium text-slate-700">Igreja</label>
            <button
              type="button"
              onClick={() => {
                if (canManageSchedules) {
                  setChurchSearch('');
                  setChurchPickerTarget('request');
                }
              }}
              disabled={!canManageSchedules}
              className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 text-left text-sm text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              <span>{selectedChurchLabel(requestForm.churchId, churches, selectedMember)}</span>
              <Building2 className="h-4 w-4 text-slate-400" />
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Membro</label>
              <button
                type="button"
                onClick={() => {
                  setMembers([]);
                  setMemberSearch('');
                  setMemberSearchPerformed(false);
                  setMemberSearchOpen(true);
                }}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 text-left text-sm text-slate-700"
              >
                <span>{selectedMember?.fullName || 'Buscar membro'}</span>
                <UserRound className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Tipo</label>
              <input
                type="text"
                value="Batismo em Aguas"
                readOnly
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="mb-2 block text-sm font-medium text-slate-700">Data do Batismo</label>
            <input
              type="date"
              value={requestForm.baptismDate}
              readOnly
              disabled
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100"
            />
            <p className="mt-1 text-xs text-slate-500">A data vem da agenda de batismo definida pela sede.</p>
          </div>

          <div className="mt-4">
            <label className="mb-2 block text-sm font-medium text-slate-700">Observacoes</label>
            <textarea
              rows={4}
              value={requestForm.notes}
              onChange={(event) => setRequestForm((current) => ({ ...current, notes: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {modalError ? <p className="mt-3 text-sm text-rose-600">{modalError}</p> : null}

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setEditingRequest(null);
                setSelectedMember(null);
                setRequestModalOpen(false);
              }}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={submitRequest}
              disabled={requestSubmitting}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {requestSubmitting ? 'Salvando...' : editingRequest ? 'Salvar Alteracoes' : 'Iniciar Processo'}
            </button>
          </div>
        </ModalShell>
      ) : null}

      {scheduleModalOpen ? (
        <ModalShell title={editingSchedule ? 'Editar Batismo' : 'Agendar Batismo'} onClose={() => {
          setEditingSchedule(null);
          setScheduleModalOpen(false);
        }}>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Igreja</label>
            <button
              type="button"
              onClick={() => {
                setChurchSearch('');
                setChurchPickerTarget('schedule');
              }}
              className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 text-left text-sm text-slate-700"
            >
              <span>{selectedChurchLabel(scheduleForm.churchId, churches, null)}</span>
              <Building2 className="h-4 w-4 text-slate-400" />
            </button>
          </div>

          <div className="mt-4">
            <label className="mb-2 block text-sm font-medium text-slate-700">Data</label>
            <input
              type="date"
              value={scheduleForm.scheduledDate}
              onChange={(event) => setScheduleForm((current) => ({ ...current, scheduledDate: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="mt-4">
            <label className="mb-2 block text-sm font-medium text-slate-700">Observacoes</label>
            <textarea
              rows={3}
              value={scheduleForm.notes}
              onChange={(event) => setScheduleForm((current) => ({ ...current, notes: event.target.value }))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {modalError ? <p className="mt-3 text-sm text-rose-600">{modalError}</p> : null}

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setEditingSchedule(null);
                setScheduleModalOpen(false);
              }}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={submitSchedule}
              disabled={scheduleSubmitting}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
            >
              {scheduleSubmitting ? 'Salvando...' : editingSchedule ? 'Salvar Alteracoes' : 'Salvar Data'}
            </button>
          </div>
        </ModalShell>
      ) : null}

      {churchPickerTarget ? (
        <ModalShell title="Buscar Igreja" onClose={() => setChurchPickerTarget(null)}>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={churchSearch}
              onChange={(event) => {
                setChurchSearch(event.target.value);
                setActiveChurchIndex(0);
              }}
              onKeyDown={handleChurchSearchKeyDown}
              placeholder="Buscar igreja..."
              className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <p className="mb-3 text-xs text-slate-500">Use as setas ou a roda do mouse para navegar. Pressione Enter para selecionar.</p>
          <div
            className="max-h-[340px] space-y-3 overflow-y-auto pr-1"
            onWheel={(event) => {
              if (!pickerChurches.length || event.deltaY === 0) return;
              setActiveChurchIndex((current) => moveActiveIndex(current, pickerChurches.length, event.deltaY > 0 ? 1 : -1));
            }}
          >
            {pickerChurches.map((church, index) => (
              <button
                key={church.id}
                type="button"
                ref={(element) => {
                  churchOptionRefs.current[index] = element;
                }}
                onClick={() => handleChurchSelected(church)}
                onMouseEnter={() => setActiveChurchIndex(index)}
                className={`block w-full rounded-xl border p-4 text-left transition-colors ${activeChurchIndex === index ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' : 'border-slate-200 hover:border-purple-300 hover:bg-slate-50'}`}
              >
                <p className="font-semibold text-slate-900">{church.code ? `${church.code} - ` : ''}{church.name}</p>
                <p className="mt-1 text-sm text-slate-500">{church.addressCity || 'Cidade nao informada'} {church.regional?.name ? `• ${church.regional.name}` : ''}</p>
              </button>
            ))}
            {pickerChurches.length === 0 ? <p className="text-sm text-slate-500">Nenhuma igreja encontrada.</p> : null}
          </div>
        </ModalShell>
      ) : null}

      {memberSearchOpen ? (
        <ModalShell title="Buscar Membro" onClose={() => setMemberSearchOpen(false)}>
          <div className="mb-4 flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={memberSearch}
                onChange={(event) => {
                  setMemberSearch(event.target.value);
                  setActiveMemberIndex(0);
                }}
                onKeyDown={handleMemberSearchKeyDown}
                placeholder="Digite para buscar membro..."
                className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <button
              type="button"
              onClick={runMemberSearch}
              disabled={memberSearchLoading}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60"
            >
              {memberSearchLoading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
          <p className="mb-3 text-xs text-slate-500">Use as setas ou a roda do mouse para navegar. Pressione Enter para selecionar.</p>
          <div
            className="max-h-[340px] space-y-3 overflow-y-auto pr-1"
            onWheel={(event) => {
              if (!filteredMembers.length || event.deltaY === 0) return;
              setActiveMemberIndex((current) => moveActiveIndex(current, filteredMembers.length, event.deltaY > 0 ? 1 : -1));
            }}
          >
            {!memberSearchPerformed ? <p className="text-sm text-slate-500">Digite um termo e clique em buscar para carregar os membros.</p> : null}
            {filteredMembers.map((member, index) => (
              <button
                key={member.id}
                type="button"
                ref={(element) => {
                  memberOptionRefs.current[index] = element;
                }}
                onClick={() => handleMemberSelected(member)}
                onMouseEnter={() => setActiveMemberIndex(index)}
                className={`block w-full rounded-xl border p-4 text-left transition-colors ${activeMemberIndex === index ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' : 'border-slate-200 hover:border-purple-300 hover:bg-slate-50'}`}
              >
                <p className="font-semibold text-slate-900">{member.fullName}</p>
                <p className="mt-1 text-sm text-slate-500">{member.church?.code ? `${member.church.code} - ` : ''}{member.church?.name || 'Igreja nao informada'}</p>
              </button>
            ))}
            {memberSearchPerformed && !memberSearchLoading && filteredMembers.length === 0 ? <p className="text-sm text-slate-500">Nenhum membro encontrado.</p> : null}
          </div>
        </ModalShell>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={deleteTarget?.kind === 'schedule' ? 'Excluir agendamento' : 'Excluir registro de batismo'}
        message={deleteTarget ? `Confirma a exclusao de ${deleteTarget.label}?` : ''}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        loading={deleteLoading}
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          if (!deleteLoading) {
            setDeleteTarget(null);
          }
        }}
      />

      <PrintModal
        open={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        sortOptions={[
          { value: 'member', label: 'Membro' },
          { value: 'church', label: 'Igreja' },
          { value: 'service', label: 'Servico' },
          { value: 'status', label: 'Status' },
          { value: 'baptismDate', label: 'Data Batismo' },
          { value: 'openedAt', label: 'Aberto em' },
        ]}
        columnOptions={[
          { value: 'member', label: 'Membro' },
          { value: 'church', label: 'Igreja' },
          { value: 'service', label: 'Serviço' },
          { value: 'status', label: 'Status' },
          { value: 'baptismDate', label: 'Data Batismo' },
          { value: 'openedAt', label: 'Aberto em' },
          { value: 'notes', label: 'Obs', defaultChecked: false },
        ]}
        defaultSort="member"
        onPrint={(orientation, sortBy, selectedColumns) => {
          const sorted = [...visibleRows].sort((a, b) => {
            const va = sortBy === 'member' ? (a.member?.fullName ?? '') : sortBy === 'church' ? (a.church?.name ?? '') : sortBy === 'service' ? (a.service?.description ?? '') : sortBy === 'status' ? a.statusLabel : sortBy === 'baptismDate' ? (a.baptismDate ?? '') : (a.openedAt ?? '');
            const vb = sortBy === 'member' ? (b.member?.fullName ?? '') : sortBy === 'church' ? (b.church?.name ?? '') : sortBy === 'service' ? (b.service?.description ?? '') : sortBy === 'status' ? b.statusLabel : sortBy === 'baptismDate' ? (b.baptismDate ?? '') : (b.openedAt ?? '');
            return va.localeCompare(vb, 'pt-BR');
          });
          const allCols = [
            { label: 'Membro', key: 'member' },
            { label: 'Igreja', key: 'church' },
            { label: 'Serviço', key: 'service', width: '90px' },
            { label: 'Status', key: 'status', width: '80px' },
            { label: 'Data Batismo', key: 'baptismDate', width: '90px' },
            { label: 'Aberto em', key: 'openedAt', width: '80px' },
            { label: 'Obs', key: 'notes' },
          ];
          printReport({
            title: 'Batismos',
            orientation,
            columns: allCols.filter((c) => selectedColumns.includes(c.key)),
            rows: sorted.map((r) => ({
              member: r.member?.fullName || r.protocol,
              church: r.church?.name || '—',
              service: r.service?.description || '—',
              status: r.statusLabel,
              baptismDate: r.baptismDate ? new Date(r.baptismDate).toLocaleDateString('pt-BR') : '—',
              openedAt: r.openedAt ? new Date(r.openedAt).toLocaleDateString('pt-BR') : '—',
              notes: r.notes || '',
            })),
          });
        }}
      />
    </div>
  );
}

function selectedChurchLabel(churchId: string, churches: ChurchOption[], selectedMember: MemberOption | null) {
  const church = churches.find((item) => item.id === churchId);
  if (church) {
    return `${church.code ? `${church.code} - ` : ''}${church.name}`;
  }
  if (selectedMember?.church?.name) {
    return `${selectedMember.church.code ? `${selectedMember.church.code} - ` : ''}${selectedMember.church.name}`;
  }
  return 'Selecionar igreja';
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: ReactNode }) {
  return (
    <div className="flex min-h-[94px] items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="text-xl font-bold leading-tight text-slate-900">{value}</p>
      </div>
      {icon}
    </div>
  );
}

function NextScheduleCard({
  schedule,
  canManageSchedules,
  onCreate,
  onEdit,
  onDelete,
}: {
  schedule: BaptismSchedule | null;
  canManageSchedules: boolean;
  onCreate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const daysUntilLabel = getDaysUntilLabel(schedule?.scheduledDate);
  const cardTone = schedule
    ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/70 dark:bg-emerald-950/45'
    : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900';

  return (
    <div className={`min-h-[94px] rounded-3xl border px-4 py-3 ${cardTone}`}>
      {!schedule ? (
        <div className="flex h-full items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
              <Calendar className="h-5 w-5 text-slate-500 dark:text-slate-300" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Próximo Batismo</p>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Nenhuma data agendada</p>
            </div>
          </div>
          {canManageSchedules ? (
            <button onClick={onCreate} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
              Agendar
            </button>
          ) : null}
        </div>
      ) : (
        <div className="flex h-full items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-200 bg-white dark:border-emerald-800/80 dark:bg-emerald-900/40">
              <Calendar className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">Próximo Batismo</p>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="text-2xl font-extrabold leading-tight text-emerald-950 dark:text-emerald-50">{formatDate(schedule.scheduledDate)}</p>
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{daysUntilLabel}</p>
              </div>
              <p className="text-xs font-medium text-emerald-800/80 dark:text-emerald-200/80">{schedule.churchCode ? `${schedule.churchCode} - ` : ''}{schedule.churchName}</p>
            </div>
          </div>
          {canManageSchedules ? (
            <div className="flex items-center gap-1 rounded-2xl border border-emerald-200 bg-white p-1 dark:border-emerald-800/70 dark:bg-emerald-900/40">
              <button onClick={onEdit} className="rounded-xl p-2 transition hover:bg-emerald-100 dark:hover:bg-emerald-800/60" title="Editar">
                <Pencil className="h-4 w-4 text-emerald-700 dark:text-emerald-200" />
              </button>
              <button onClick={onDelete} className="rounded-xl p-2 transition hover:bg-rose-50" title="Excluir">
                <Trash2 className="h-4 w-4 text-rose-600" />
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}