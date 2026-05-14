import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '../../lib/secretariaHooks';
import { qk } from '../../lib/queryClient';
import { ArrowRightLeft, ArrowUpDown, Building2, Download, Pencil, Plus, Printer, Search, Trash2, UserRound, X } from 'lucide-react';
import { apiBase } from '../../lib/apiBase';
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
  ecclesiasticalTitle?: string | null;
  church?: { id: string; name: string; code?: string | null } | null;
};

type TransferQueueItem = {
  id: string;
  protocol: string;
  member?: { id: string; fullName: string; ecclesiasticalTitle?: string | null } | null;
  church?: { id: string; name: string; code?: string | null; regional?: { id?: string; campoId?: string | null } | null } | null;
  destinationChurch?: { id: string; name: string; code?: string | null } | null;
  currentTitle?: string | null;
  statusLabel: string;
  columnIndex: number;
  openedAt?: string | null;
  notes?: string | null;
};

type TransferHistoryItem = {
  id: string;
  protocol?: string | null;
  member?: { id: string; fullName: string; ecclesiasticalTitle?: string | null } | null;
  church?: { id: string; name: string; code?: string | null; regional?: { id?: string; campoId?: string | null } | null } | null;
  destinationChurch?: { id: string; name: string; code?: string | null } | null;
  currentTitle?: string | null;
  statusLabel: string;
  columnIndex: number;
  action: string;
  recordedAt?: string | null;
  notes?: string | null;
};

type StatusOption = {
  value: string;
  label: string;
  columnIndex: number;
};

type DashboardPayload = {
  queue: TransferQueueItem[];
  history: TransferHistoryItem[];
  statusOptions: StatusOption[];
};

type SortKey = 'member' | 'church' | 'destinationChurch' | 'title' | 'status' | 'openedAt';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const EMPTY_REQUEST_FORM = {
  originChurchId: '',
  memberId: '',
  destinationChurchId: '',
  notes: '',
  statusValue: '',
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

function memberMatchesQuery(member: { fullName?: string | null; rol?: number | null }, query: string) {
  const normalizedQuery = normalizeText(query).trim();
  if (!normalizedQuery) return true;
  if (/^\d+$/.test(normalizedQuery)) return String(member.rol || '') === normalizedQuery;
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  const parts = normalizeText(member.fullName || '').split(/\s+/).filter(Boolean);
  return terms.every((term) => parts.some((part) => part.startsWith(term)));
}

function getDateOnly(value?: string | null) {
  if (!value) return '';
  const raw = String(value);
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  return [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, '0'), String(date.getUTCDate()).padStart(2, '0')].join('-');
}

function formatDate(value?: string | null) {
  const dateOnly = getDateOnly(value);
  if (!dateOnly) return '-';
  const [year, month, day] = dateOnly.split('-');
  return `${day}/${month}/${year}`;
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
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

function moveActiveIndex(current: number, length: number, direction: 1 | -1) {
  if (!length) return -1;
  if (current < 0) return direction === 1 ? 0 : length - 1;
  return (current + direction + length) % length;
}

function parseStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('mrm_user') || '{}');
  } catch {
    return {};
  }
}

function statusClass(item: TransferQueueItem, statusOptions: StatusOption[]) {
  const label = normalizeText(item.statusLabel || '');
  const maxColumn = Math.max(...statusOptions.map((option) => option.columnIndex), 1);
  if (label.includes('cancel') || label.includes('reprov')) return 'bg-rose-100 text-rose-700';
  if (item.columnIndex === maxColumn || label.includes('concl') || label.includes('transfer')) return 'bg-green-100 text-green-700';
  if (label.includes('aprov')) return 'bg-blue-100 text-blue-700';
  return 'bg-amber-100 text-amber-700';
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

export function Transfer() {
  const storedUser = useMemo(parseStoredUser, []);
  const defaultDateRange = useMemo(() => getMonthDateRange(), []);
  const activeFieldId = localStorage.getItem('mrm_active_field_id') || storedUser.campoId || '';
  const [selectedFieldId, setSelectedFieldId] = useState(activeFieldId);
  const canManageTransferStatus = storedUser.profileType === 'master' || storedUser.profileType === 'admin';
  const normalizedRole = normalizeText(storedUser.roleName || '');
  const isSecretaryOrTreasurer = normalizedRole.includes('secret') || normalizedRole.includes('tesour');
  const isAdminOrMaster = ['master', 'admin'].includes(storedUser.profileType || '');
  const hasFixedChurchScope = (storedUser.profileType === 'church') || isSecretaryOrTreasurer;
  const canChooseField = isAdminOrMaster;
  const canChooseRegional = !hasFixedChurchScope;
  const canChooseChurch = !hasFixedChurchScope;
  const defaultRegionalFilter = storedUser.regionalId || '';
  const defaultChurchFilter = hasFixedChurchScope ? (storedUser.churchId || '') : '';

  const [fields, setFields] = useState<CampoOption[]>([]);
  const [regionais, setRegionais] = useState<RegionalOption[]>([]);
  const [churches, setChurches] = useState<ChurchOption[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const qc = useQueryClient();

  // ── TanStack Query para o dashboard de transferências ──────────────────
  const dashboardQuery = useQuery<DashboardPayload>({
    queryKey: qk.transfer({}),
    queryFn: async () => {
      const response = await authFetch(`${apiBase}/transfer/dashboard`);
      if (!response.ok) throw new Error('Falha ao carregar painel de transferência.');
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  });

  const dashboard = dashboardQuery.data ?? null;
  const loading = dashboardQuery.isLoading;
  const loadDashboard = () => qc.invalidateQueries({ queryKey: qk.transfer({}) });
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 350);
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
  const [requestForm, setRequestForm] = useState({ ...EMPTY_REQUEST_FORM });
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [editingRequest, setEditingRequest] = useState<TransferQueueItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TransferQueueItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [memberSearchOpen, setMemberSearchOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSearchPerformed, setMemberSearchPerformed] = useState(false);
  const [memberSearchLoading, setMemberSearchLoading] = useState(false);
  const [churchPickerOpen, setChurchPickerOpen] = useState(false);
  const [churchSearch, setChurchSearch] = useState('');
  const [churchSearchResults, setChurchSearchResults] = useState<ChurchOption[]>([]);
  const [churchSearchPerformed, setChurchSearchPerformed] = useState(false);
  const [churchSearchLoading, setChurchSearchLoading] = useState(false);
  const [selectedDestinationChurch, setSelectedDestinationChurch] = useState<ChurchOption | null>(null);
  const [activeChurchIndex, setActiveChurchIndex] = useState(-1);
  const churchOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);

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

  const destinationPickerChurches = useMemo(() => churchSearchResults, [churchSearchResults]);

  async function loadFilters() {
    setLoadingFilters(true);
    try {
      const fieldQuery = selectedFieldId ? `?fieldId=${encodeURIComponent(selectedFieldId)}` : '';
      const [fieldsResponse, regionaisResponse, churchesResponse] = await Promise.all([
        authFetch(`${apiBase}/campos`),
        authFetch(`${apiBase}/regionais${fieldQuery}`),
        authFetch(`${apiBase}/churches${fieldQuery}`),
      ]);
      if (!fieldsResponse.ok || !regionaisResponse.ok || !churchesResponse.ok) throw new Error('Falha ao carregar filtros de transferencia.');
      const [fieldsData, regionaisData, churchesData] = await Promise.all([fieldsResponse.json(), regionaisResponse.json(), churchesResponse.json()]);
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

  async function loadMembers(query?: string, churchId?: string) {
    const normalizedQuery = String(query || '').trim();
    if (!normalizedQuery) {
      setMembers([]);
      return;
    }
    const params = new URLSearchParams();
    if (churchId) {
      params.set('churchId', churchId);
    } else if (selectedRegionalId) {
      params.set('regionalId', selectedRegionalId);
    } else if (selectedFieldId) {
      params.set('campoId', selectedFieldId);
    }
    params.set('query', normalizedQuery);
    params.set('limit', '200');
    try {
      const response = await authFetch(`${apiBase}/members?${params.toString()}`);
      if (!response.ok) {
        setMembers([]);
        return;
      }
      const data = await response.json();
      setMembers(Array.isArray(data) ? data : []);
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

  useEffect(() => {
    churchOptionRefs.current = churchOptionRefs.current.slice(0, destinationPickerChurches.length);
    setActiveChurchIndex(destinationPickerChurches.length ? 0 : -1);
  }, [destinationPickerChurches]);

  useEffect(() => {
    if (activeChurchIndex >= 0) {
      churchOptionRefs.current[activeChurchIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeChurchIndex]);

  const visibleRows = useMemo(() => {
    const query = normalizeText(debouncedSearch);
    const rows = (dashboard?.queue || []).filter((item) => {
      const churchMeta = churches.find((church) => church.id === item.church?.id);
      const fieldMatch = !selectedFieldId || churchMeta?.regional?.campoId === selectedFieldId || churchMeta?.regional?.campo?.id === selectedFieldId;
      const regionalMatch = !selectedRegionalId || churchMeta?.regional?.id === selectedRegionalId || churchMeta?.regionalId === selectedRegionalId;
      const churchMatch = !selectedChurchId || item.church?.id === selectedChurchId;
      const statusMatch = !selectedStatusFilter || String(item.columnIndex) === selectedStatusFilter;
      const textMatch = !query || normalizeText(`${item.member?.fullName || ''} ${item.protocol} ${item.church?.name || ''} ${item.destinationChurch?.name || ''} ${item.currentTitle || ''} ${item.notes || ''}`).includes(query);
      const dateMatch = dateInRange(item.openedAt, dateFrom, dateTo);
      return fieldMatch && regionalMatch && churchMatch && statusMatch && textMatch && dateMatch;
    });
    return [...rows].sort((left, right) => {
      const leftValue = sortKey === 'member' ? left.member?.fullName || '' : sortKey === 'church' ? left.church?.name || '' : sortKey === 'destinationChurch' ? left.destinationChurch?.name || '' : sortKey === 'title' ? left.currentTitle || '' : sortKey === 'status' ? left.statusLabel || '' : left.openedAt || '';
      const rightValue = sortKey === 'member' ? right.member?.fullName || '' : sortKey === 'church' ? right.church?.name || '' : sortKey === 'destinationChurch' ? right.destinationChurch?.name || '' : sortKey === 'title' ? right.currentTitle || '' : sortKey === 'status' ? right.statusLabel || '' : right.openedAt || '';
      const comparison = String(leftValue).localeCompare(String(rightValue), 'pt-BR');
      return sortDirection === 'asc' ? comparison : comparison * -1;
    });
  }, [dashboard?.queue, churches, selectedFieldId, selectedRegionalId, selectedChurchId, selectedStatusFilter, debouncedSearch, dateFrom, dateTo, sortKey, sortDirection]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return visibleRows.slice(start, start + pageSize);
  }, [page, pageSize, visibleRows]);

  const filteredMembers = useMemo(
    () => members.filter((member) => memberMatchesQuery(member, memberSearch)).slice(0, 30),
    [members, memberSearch],
  );

  const totalPages = useMemo(() => Math.max(1, Math.ceil(visibleRows.length / pageSize)), [visibleRows.length, pageSize]);

  const stats = useMemo(() => ({
    total: visibleRows.length,
    pending: visibleRows.filter((row) => row.columnIndex === 1).length,
    approved: visibleRows.filter((row) => row.columnIndex === 2).length,
    churches: new Set(visibleRows.map((row) => row.destinationChurch?.id || row.church?.id).filter(Boolean)).size,
  }), [visibleRows]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection(key === 'openedAt' ? 'desc' : 'asc');
  }

  function openRequestModal(request?: TransferQueueItem | null) {
    const defaultOriginChurchId = request?.church?.id || selectedChurchId || (!canChooseChurch ? storedUser.churchId || '' : '');
    setEditingRequest(request || null);
    setModalError('');
    setMembers([]);
    setMemberSearch('');
    setMemberSearchPerformed(false);
    setMemberSearchLoading(false);
    setRequestForm({
      originChurchId: defaultOriginChurchId,
      memberId: request?.member?.id || '',
      destinationChurchId: request?.destinationChurch?.id || '',
      notes: request?.notes || '',
      statusValue: request ? String(request.columnIndex) : '',
    });
    setSelectedDestinationChurch(
      request?.destinationChurch
        ? {
            id: request.destinationChurch.id,
            name: request.destinationChurch.name,
            code: request.destinationChurch.code || null,
          }
        : null,
    );
    setRequestModalOpen(true);
  }

  function closeRequestModal() {
    setRequestModalOpen(false);
    setMemberSearchOpen(false);
    setChurchPickerOpen(false);
    setEditingRequest(null);
    setModalError('');
    setRequestForm({ ...EMPTY_REQUEST_FORM });
    setMembers([]);
    setMemberSearch('');
    setMemberSearchPerformed(false);
    setMemberSearchLoading(false);
    setChurchSearch('');
    setChurchSearchResults([]);
    setChurchSearchPerformed(false);
    setChurchSearchLoading(false);
    setSelectedDestinationChurch(null);
  }

  function handleMemberSelected(member: MemberOption) {
    setRequestForm((current) => ({
      ...current,
      originChurchId: member.churchId,
      memberId: member.id,
      destinationChurchId: current.destinationChurchId === member.churchId ? '' : current.destinationChurchId,
    }));
    if (selectedDestinationChurch?.id === member.churchId) {
      setSelectedDestinationChurch(null);
    }
    setMemberSearchOpen(false);
  }

  async function runMemberSearch() {
    const query = memberSearch.trim();
    if (!query) {
      setModalError('Digite o nome ou ROL do membro para buscar.');
      return;
    }

    setModalError('');
    setMemberSearchLoading(true);
    setMemberSearchPerformed(true);
    try {
      await loadMembers(query, !canChooseChurch ? storedUser.churchId || '' : requestForm.originChurchId || '');
    } finally {
      setMemberSearchLoading(false);
    }
  }

  function handleChurchSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveChurchIndex((current) => moveActiveIndex(current, destinationPickerChurches.length, 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveChurchIndex((current) => moveActiveIndex(current, destinationPickerChurches.length, -1));
      return;
    }

    if (event.key === 'Enter' && activeChurchIndex >= 0 && destinationPickerChurches[activeChurchIndex]) {
      event.preventDefault();
      const selectedChurch = destinationPickerChurches[activeChurchIndex];
      setRequestForm((current) => ({ ...current, destinationChurchId: selectedChurch.id }));
      setSelectedDestinationChurch(selectedChurch);
      setChurchPickerOpen(false);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      void runChurchSearch();
    }
  }

  async function runChurchSearch() {
    const query = churchSearch.trim();
    if (!query) {
      setModalError('Digite o nome, codigo ou regional da igreja para buscar.');
      setChurchSearchResults([]);
      setChurchSearchPerformed(false);
      return;
    }

    setModalError('');
    setChurchSearchLoading(true);
    setChurchSearchPerformed(true);
    try {
      const params = new URLSearchParams();
      params.set('query', query);
      if (selectedFieldId) params.set('fieldId', selectedFieldId);
      if (selectedRegionalId) params.set('regionalId', selectedRegionalId);

      const excludeChurchId = requestForm.originChurchId || storedUser.churchId || '';
      if (excludeChurchId) {
        params.set('excludeChurchId', excludeChurchId);
      }

      const response = await authFetch(`${apiBase}/transfer/church-options?${params.toString()}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Falha ao buscar igrejas.');
      }

      const data = await response.json();
      setChurchSearchResults(Array.isArray(data) ? data : []);
    } catch (searchError) {
      setChurchSearchResults([]);
      setModalError(searchError instanceof Error ? searchError.message : 'Nao foi possivel buscar as igrejas.');
    } finally {
      setChurchSearchLoading(false);
    }
  }

  async function handleRequestSubmit() {
    if (!requestForm.memberId) return setModalError('Selecione o membro.');
    if (!requestForm.destinationChurchId) return setModalError('Selecione a igreja de destino.');

    setRequestSubmitting(true);
    setModalError('');
    try {
      const endpoint = editingRequest ? `${apiBase}/transfer/requests/${editingRequest.id}` : `${apiBase}/transfer/requests`;
      const method = editingRequest ? 'PATCH' : 'POST';
      const response = await authFetch(endpoint, {
        method,
        body: JSON.stringify({ memberId: requestForm.memberId, destinationChurchId: requestForm.destinationChurchId, notes: requestForm.notes }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Falha ao salvar transferencia.');
      }
      if (editingRequest && requestForm.statusValue && requestForm.statusValue !== String(editingRequest.columnIndex)) {
        const statusResponse = await authFetch(`${apiBase}/kan/cards/${editingRequest.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ columnIndex: Number(requestForm.statusValue), observations: requestForm.notes, description: requestForm.notes }),
        });
        if (!statusResponse.ok) {
          const payload = await statusResponse.json().catch(() => ({}));
          throw new Error(payload.error || 'Falha ao atualizar status da transferencia.');
        }
      }
      closeRequestModal();
      await loadDashboard();
    } catch (submitError) {
      setModalError(submitError instanceof Error ? submitError.message : 'Nao foi possivel salvar a transferencia.');
    } finally {
      setRequestSubmitting(false);
    }
  }

  async function handleDeleteRequest() {
    if (!deleteTarget) return;

    // ── Optimistic: remove do cache imediatamente ─────────────────────────
    const queryKey = qk.transfer({});
    const snapshot = qc.getQueryData<DashboardPayload>(queryKey);
    if (snapshot) {
      qc.setQueryData<DashboardPayload>(queryKey, (prev) =>
        prev ? { ...prev, queue: prev.queue.filter((r) => r.id !== deleteTarget.id) } : prev
      );
    }
    setDeleteTarget(null);

    setDeleteLoading(true);
    try {
      const response = await authFetch(`${apiBase}/transfer/requests/${deleteTarget.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Falha ao excluir transferencia.');
      }
      // Refetch silencioso em background
      void qc.invalidateQueries({ queryKey });
    } catch (deleteError) {
      // Rollback: restaura snapshot anterior
      if (snapshot) qc.setQueryData<DashboardPayload>(queryKey, snapshot);
      setError(deleteError instanceof Error ? deleteError.message : 'Nao foi possivel excluir a transferencia.');
    } finally {
      setDeleteLoading(false);
    }
  }

  const selectedMember = useMemo(() => {
    if (requestForm.memberId) {
      const found = members.find((member) => member.id === requestForm.memberId);
      if (found) return found;
    }
    if (editingRequest?.member?.id === requestForm.memberId) {
      return {
        id: editingRequest.member.id,
        fullName: editingRequest.member.fullName,
        churchId: editingRequest.church?.id || requestForm.originChurchId,
        ecclesiasticalTitle: editingRequest.member.ecclesiasticalTitle || editingRequest.currentTitle || null,
        church: editingRequest.church ? { id: editingRequest.church.id, name: editingRequest.church.name, code: editingRequest.church.code || null } : null,
      };
    }
    return null;
  }, [members, requestForm.memberId, requestForm.originChurchId, editingRequest]);

  const originChurchLabel = useMemo(() => {
    const found = churches.find((church) => church.id === requestForm.originChurchId);
    if (found) {
      return `${found.code ? `${found.code} - ` : ''}${found.name}`;
    }
    if (selectedMember?.church?.name) {
      return `${selectedMember.church.code ? `${selectedMember.church.code} - ` : ''}${selectedMember.church.name}`;
    }
    return 'A origem sera definida ao selecionar o membro';
  }, [churches, requestForm.originChurchId, selectedMember]);

  const destinationChurchLabel = useMemo(() => {
    const found = churches.find((church) => church.id === requestForm.destinationChurchId) ||
      (selectedDestinationChurch?.id === requestForm.destinationChurchId ? selectedDestinationChurch : null);
    if (!found) return 'Selecione a igreja de destino';
    return `${found.code ? `${found.code} - ` : ''}${found.name}`;
  }, [churches, requestForm.destinationChurchId, selectedDestinationChurch]);

  return (
    <div className="space-y-4 p-6 text-slate-900 dark:text-slate-100">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
            <ArrowRightLeft className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Transferencia</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">Gerencie transferencias no mesmo padrao de batismo e consagracao</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm transition-colors hover:bg-slate-50"
            onClick={() => setPrintModalOpen(true)}
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </button>
          <button onClick={() => openRequestModal()} className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm text-white transition-colors hover:bg-purple-700">
            <Plus className="h-4 w-4" />
            Nova Transferencia
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"><div><p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Total</p><p className="text-xl font-bold text-slate-900">{stats.total}</p></div><ArrowRightLeft className="h-5 w-5 text-purple-600" /></div>
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"><div><p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Pendentes</p><p className="text-xl font-bold text-slate-900">{stats.pending}</p></div><ArrowRightLeft className="h-5 w-5 text-amber-500" /></div>
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"><div><p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Aprovadas</p><p className="text-xl font-bold text-slate-900">{stats.approved}</p></div><ArrowRightLeft className="h-5 w-5 text-blue-600" /></div>
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3"><div><p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Igrejas</p><p className="text-xl font-bold text-slate-900">{stats.churches}</p></div><Building2 className="h-5 w-5 text-green-600" /></div>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_minmax(135px,0.72fr)_minmax(135px,0.72fr)_minmax(150px,0.8fr)_minmax(120px,0.62fr)_minmax(125px,0.62fr)_minmax(125px,0.62fr)] xl:items-end">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Busca</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input type="text" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar por membro, protocolo, igreja, observacao" className="w-full rounded-lg border border-slate-200 py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Campo</label>
            <select value={selectedFieldId} onChange={(event) => { setSelectedFieldId(event.target.value); setSelectedRegionalId(''); setSelectedChurchId(''); }} disabled={!canChooseField || loadingFilters} className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100 disabled:text-slate-500">
              <option value="">Todos os campos</option>
              {fields.map((field) => <option key={field.id} value={field.id}>{field.code ? `${field.code} - ` : ''}{field.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Regional</label>
            <select value={selectedRegionalId} onChange={(event) => { setSelectedRegionalId(event.target.value); setSelectedChurchId(''); }} disabled={!canChooseRegional || loadingFilters} className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100 disabled:text-slate-500">
              <option value="">Todas as regionais</option>
              {filteredRegionais.map((regional) => <option key={regional.id} value={regional.id}>{regional.code ? `${regional.code} - ` : ''}{regional.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Igreja</label>
            <select value={selectedChurchId} onChange={(event) => setSelectedChurchId(event.target.value)} disabled={!canChooseChurch || loadingFilters} className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100 disabled:text-slate-500">
              <option value="">Todas as igrejas</option>
              {filteredChurchOptions.map((church) => <option key={church.id} value={church.id}>{church.code ? `${church.code} - ` : ''}{church.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Status</label>
            <select value={selectedStatusFilter} onChange={(event) => setSelectedStatusFilter(event.target.value)} className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
              <option value="">Todos os status</option>
              {(dashboard?.statusOptions || []).map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Data inicial</label>
            <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Data final</label>
            <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
        </div>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1280px]">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900"><button type="button" onClick={() => handleSort('member')} className="inline-flex items-center gap-2">Membro<ArrowUpDown className="h-4 w-4 text-slate-400" /></button></th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900"><button type="button" onClick={() => handleSort('church')} className="inline-flex items-center gap-2">Igreja Atual<ArrowUpDown className="h-4 w-4 text-slate-400" /></button></th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900"><button type="button" onClick={() => handleSort('destinationChurch')} className="inline-flex items-center gap-2">Igreja Destino<ArrowUpDown className="h-4 w-4 text-slate-400" /></button></th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900"><button type="button" onClick={() => handleSort('title')} className="inline-flex items-center gap-2">Titulo Atual<ArrowUpDown className="h-4 w-4 text-slate-400" /></button></th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900"><button type="button" onClick={() => handleSort('status')} className="inline-flex items-center gap-2">Status<ArrowUpDown className="h-4 w-4 text-slate-400" /></button></th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900"><button type="button" onClick={() => handleSort('openedAt')} className="inline-flex items-center gap-2">Aberto em<ArrowUpDown className="h-4 w-4 text-slate-400" /></button></th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Observacoes</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-slate-900">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? <TableLoadingRows columns={8} /> : paginatedRows.map((item) => (
                <tr key={item.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-4 py-4 align-top"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-sm font-semibold text-purple-700">{(item.member?.fullName || '?').split(' ').map((part) => part[0]).slice(0, 2).join('')}</div><div><p className="font-semibold uppercase text-slate-900">{item.member?.fullName || '-'}</p><p className="text-xs font-semibold text-purple-600">{item.protocol}</p></div></div></td>
                  <td className="px-4 py-4 align-top text-sm text-slate-600">{item.church?.code ? `${item.church.code} - ` : ''}{item.church?.name || '-'}</td>
                  <td className="px-4 py-4 align-top text-sm text-slate-600">{item.destinationChurch?.code ? `${item.destinationChurch.code} - ` : ''}{item.destinationChurch?.name || '-'}</td>
                  <td className="px-4 py-4 align-top text-sm font-medium text-slate-700">{item.currentTitle || item.member?.ecclesiasticalTitle || '-'}</td>
                  <td className="px-4 py-4 align-top"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(item, dashboard?.statusOptions || [])}`}>{item.statusLabel}</span></td>
                  <td className="px-4 py-4 align-top text-sm text-slate-600">{formatDate(item.openedAt)}</td>
                  <td className="px-4 py-4 align-top text-sm text-slate-600">{item.notes || '-'}</td>
                  <td className="px-4 py-4 align-top"><div className="flex items-center justify-end gap-1"><button type="button" onClick={() => openRequestModal(item)} className="rounded-lg p-2 transition-colors hover:bg-slate-100" title="Editar"><Pencil className="h-4 w-4 text-slate-600" /></button><button type="button" onClick={() => setDeleteTarget(item)} className="rounded-lg p-2 transition-colors hover:bg-red-50" title="Excluir"><Trash2 className="h-4 w-4 text-red-600" /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && !paginatedRows.length ? <div className="px-6 py-10 text-center text-sm text-slate-500">Nenhuma transferencia encontrada para os filtros selecionados.</div> : null}
        <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-slate-500">Exibindo {paginatedRows.length ? (page - 1) * pageSize + 1 : 0} a {Math.min(page * pageSize, visibleRows.length)} de {visibleRows.length} registros</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-sm text-slate-600"><span>Linhas por pagina</span><select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">{PAGE_SIZE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>
            <div className="flex items-center gap-2"><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">Anterior</button><span className="text-sm text-slate-600">Pagina {page} de {totalPages}</span><button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">Proxima</button></div>
          </div>
        </div>
      </div>

      {requestModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4"><h2 className="text-xl font-bold text-slate-900">{editingRequest ? 'Editar Transferencia' : 'Nova Transferencia'}</h2><button onClick={closeRequestModal} className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"><X className="h-4 w-4" /></button></div>
            <div className="space-y-5 px-6 py-5">
              {modalError ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{modalError}</div> : null}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Membro</label>
                <button type="button" onClick={() => { setMembers([]); setMemberSearch(''); setMemberSearchPerformed(false); setMemberSearchOpen(true); setModalError(''); }} className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-4 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50">
                  <span>{selectedMember?.fullName || 'Buscar membro'}</span>
                  <UserRound className="h-4 w-4 text-slate-400" />
                </button>
                {selectedMember ? <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-100 text-sm font-semibold text-purple-700"><UserRound className="h-4 w-4" /></div><div><p className="font-semibold text-slate-900">{selectedMember.fullName}</p><p>{selectedMember.ecclesiasticalTitle || 'Sem titulo definido'}</p></div></div></div> : null}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Igreja de Origem</label>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-600">{originChurchLabel}</div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Igreja de Destino</label>
                  <button
                    type="button"
                    onClick={() => {
                      setChurchSearch('');
                      setChurchSearchResults([]);
                      setChurchSearchPerformed(false);
                      setChurchSearchLoading(false);
                      setChurchPickerOpen(true);
                    }}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-4 py-2.5 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <span>{destinationChurchLabel}</span>
                    <Building2 className="h-4 w-4 text-slate-400" />
                  </button>
                </div>
              </div>
              <div className="flex justify-center">
                <div className="inline-flex items-center gap-3 rounded-full border border-purple-100 bg-gradient-to-r from-purple-50 via-white to-indigo-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-purple-700 shadow-sm">
                  <span>Origem</span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-600 text-white shadow-sm">
                    <ArrowRightLeft className="h-4 w-4" />
                  </span>
                  <span>Destino</span>
                </div>
              </div>
              {editingRequest && canManageTransferStatus ? <div><label className="mb-1.5 block text-sm font-medium text-slate-700">Status</label><select value={requestForm.statusValue} onChange={(event) => setRequestForm((current) => ({ ...current, statusValue: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">{(dashboard?.statusOptions || []).map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></div> : null}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Observacoes</label>
                <textarea rows={4} value={requestForm.notes} onChange={(event) => setRequestForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Detalhes da transferencia e historico da igreja anterior" className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 rounded-b-2xl border-t border-slate-200 bg-slate-50 px-6 py-4"><button onClick={closeRequestModal} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Cancelar</button><button onClick={handleRequestSubmit} disabled={requestSubmitting} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60">{requestSubmitting ? 'Salvando...' : editingRequest ? 'Salvar Alteracoes' : 'Criar Transferencia'}</button></div>
          </div>
        </div>
      ) : null}

      {memberSearchOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4"><h3 className="text-xl font-bold text-slate-900">Buscar Membro</h3><button onClick={() => setMemberSearchOpen(false)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"><X className="h-4 w-4" /></button></div>
            <div className="space-y-4 px-6 py-5">
              <div className="flex gap-3">
                <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void runMemberSearch(); } }} placeholder="Buscar membro..." className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" /></div>
                <button type="button" onClick={() => void runMemberSearch()} disabled={memberSearchLoading} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60">{memberSearchLoading ? 'Buscando...' : 'Buscar'}</button>
              </div>
              <p className="text-xs text-slate-500">Os membros so sao carregados quando voce faz a busca. Para perfil de igreja, a pesquisa fica limitada a igreja da conta.</p>
              <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
                {!memberSearchPerformed ? <p className="text-sm text-slate-500">Digite um termo e clique em buscar para carregar os membros.</p> : null}
                {filteredMembers.map((member) => (
                  <button key={member.id} type="button" onClick={() => handleMemberSelected(member)} className="block w-full rounded-xl border border-slate-200 p-4 text-left transition-colors hover:border-purple-300 hover:bg-slate-50">
                    <p className="font-semibold text-slate-900">{member.fullName}</p>
                    <p className="mt-1 text-sm text-slate-500">{member.church?.code ? `${member.church.code} - ` : ''}{member.church?.name || 'Igreja nao informada'}</p>
                  </button>
                ))}
                {memberSearchPerformed && !memberSearchLoading && filteredMembers.length === 0 ? <p className="text-sm text-slate-500">Nenhum membro encontrado.</p> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {churchPickerOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4"><h3 className="text-xl font-bold text-slate-900">Buscar Igreja</h3><button onClick={() => setChurchPickerOpen(false)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"><X className="h-4 w-4" /></button></div>
            <div className="space-y-4 px-6 py-5">
              <div className="flex gap-3">
                <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={churchSearch} onChange={(event) => { setChurchSearch(event.target.value); setActiveChurchIndex(0); }} onKeyDown={handleChurchSearchKeyDown} placeholder="Buscar igreja..." className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" /></div>
                <button type="button" onClick={() => void runChurchSearch()} disabled={churchSearchLoading} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60">{churchSearchLoading ? 'Buscando...' : 'Buscar'}</button>
              </div>
              <p className="text-xs text-slate-500">Selecione a igreja de destino para enviar a solicitacao de transferencia. Nesta tela, o perfil de igreja pesquisa as igrejas do campo.</p>
              <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1" onWheel={(event) => { if (!destinationPickerChurches.length || event.deltaY === 0) return; setActiveChurchIndex((current) => moveActiveIndex(current, destinationPickerChurches.length, event.deltaY > 0 ? 1 : -1)); }}>
                {destinationPickerChurches.map((church, index) => (
                  <button
                    key={church.id}
                    type="button"
                    ref={(element) => {
                      churchOptionRefs.current[index] = element;
                    }}
                    onClick={() => {
                      setRequestForm((current) => ({ ...current, destinationChurchId: church.id }));
                      setSelectedDestinationChurch(church);
                      setChurchPickerOpen(false);
                    }}
                    onMouseEnter={() => setActiveChurchIndex(index)}
                    className={`block w-full rounded-xl border p-4 text-left transition-colors ${activeChurchIndex === index ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' : 'border-slate-200 hover:border-purple-300 hover:bg-slate-50'}`}
                  >
                    <p className="font-semibold text-slate-900">{church.code ? `${church.code} - ` : ''}{church.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{church.regional?.name || 'Regional nao informada'}</p>
                  </button>
                ))}
                {!churchSearchPerformed ? <p className="text-sm text-slate-500">Digite e clique em buscar para carregar as igrejas.</p> : null}
                {churchSearchPerformed && !churchSearchLoading && destinationPickerChurches.length === 0 ? <p className="text-sm text-slate-500">Nenhuma igreja encontrada.</p> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-4"><h3 className="text-lg font-bold text-slate-900">Excluir Transferencia</h3></div>
            <div className="px-6 py-5 text-sm text-slate-600">Deseja excluir a transferencia de <span className="font-semibold text-slate-900">{deleteTarget.member?.fullName || deleteTarget.protocol}</span>?</div>
            <div className="flex items-center justify-end gap-3 rounded-b-2xl border-t border-slate-200 bg-slate-50 px-6 py-4"><button onClick={() => setDeleteTarget(null)} disabled={deleteLoading} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Cancelar</button><button onClick={handleDeleteRequest} disabled={deleteLoading} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">{deleteLoading ? 'Excluindo...' : 'Excluir'}</button></div>
          </div>
        </div>
      ) : null}

      <PrintModal
        open={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        sortOptions={[
          { value: 'member', label: 'Membro' },
          { value: 'church', label: 'Igreja Atual' },
          { value: 'destinationChurch', label: 'Igreja Destino' },
          { value: 'currentTitle', label: 'Titulo' },
          { value: 'status', label: 'Status' },
          { value: 'openedAt', label: 'Aberto em' },
        ]}
        columnOptions={[
          { value: 'member', label: 'Membro' },
          { value: 'church', label: 'Igreja Atual' },
          { value: 'destinationChurch', label: 'Igreja Destino' },
          { value: 'currentTitle', label: 'Título' },
          { value: 'status', label: 'Status' },
          { value: 'openedAt', label: 'Aberto em' },
        ]}
        defaultSort="member"
        onPrint={(orientation, sortBy, selectedColumns) => {
          const sorted = [...visibleRows].sort((a, b) => {
            const va = sortBy === 'member' ? (a.member?.fullName ?? '') : sortBy === 'church' ? (a.church?.name ?? '') : sortBy === 'destinationChurch' ? (a.destinationChurch?.name ?? '') : sortBy === 'currentTitle' ? (a.currentTitle ?? '') : sortBy === 'status' ? a.statusLabel : (a.openedAt ?? '');
            const vb = sortBy === 'member' ? (b.member?.fullName ?? '') : sortBy === 'church' ? (b.church?.name ?? '') : sortBy === 'destinationChurch' ? (b.destinationChurch?.name ?? '') : sortBy === 'currentTitle' ? (b.currentTitle ?? '') : sortBy === 'status' ? b.statusLabel : (b.openedAt ?? '');
            return va.localeCompare(vb, 'pt-BR');
          });
          const allCols = [
            { label: 'Membro', key: 'member' },
            { label: 'Igreja Atual', key: 'church' },
            { label: 'Igreja Destino', key: 'destinationChurch' },
            { label: 'Título', key: 'currentTitle', width: '100px' },
            { label: 'Status', key: 'status', width: '80px' },
            { label: 'Aberto em', key: 'openedAt', width: '80px' },
          ];
          printReport({
            title: 'Transferências',
            orientation,
            columns: allCols.filter((c) => selectedColumns.includes(c.key)),
            rows: sorted.map((r) => ({
              member: r.member?.fullName || r.protocol,
              church: r.church?.name || '—',
              destinationChurch: r.destinationChurch?.name || '—',
              currentTitle: r.currentTitle || r.member?.ecclesiasticalTitle || '—',
              status: r.statusLabel,
              openedAt: r.openedAt ? new Date(r.openedAt).toLocaleDateString('pt-BR') : '—',
            })),
          });
        }}
      />
    </div>
  );
}