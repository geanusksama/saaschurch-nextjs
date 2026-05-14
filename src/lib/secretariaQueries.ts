/**
 * TanStack Query data hooks for all Secretaria modules.
 * Each hook:
 *  1. Returns cached data instantly (staleTime 5 min)
 *  2. Revalidates silently in background
 *  3. Uses server-side pagination — never loads full tables
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiBase } from './apiBase';
import { authFetch } from './secretariaHooks';
import { qk } from './queryClient';
import { secretariaDb } from './secretariaDb';

// ─── Filter/ref types ─────────────────────────────────────────────────────────

export interface PaginatedFilters {
  page?: number;
  pageSize?: number;
  q?: string;
  fieldId?: string;
  regionalId?: string;
  churchId?: string;
  status?: string;
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  [key: string]: string | number | undefined;
}

// ─── Build URL with params ────────────────────────────────────────────────────

function buildUrl(path: string, filters: PaginatedFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  });
  const qs = params.toString();
  return `${apiBase}${path}${qs ? '?' + qs : ''}`;
}

// ─── Members ──────────────────────────────────────────────────────────────────

export interface MemberRow {
  id: string;
  fullName: string;
  phone?: string | null;
  churchName?: string | null;
  churchId?: string | null;
  membershipStatus?: string | null;
  ecclesiasticalTitle?: string | null;
  rol?: number | null;
}

export interface PagedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

async function fetchMembers(filters: PaginatedFilters): Promise<PagedResult<MemberRow>> {
  const url = buildUrl('/members', { ...filters, pageSize: filters.pageSize ?? 30 });
  const raw = await authFetch<MemberRow[] | PagedResult<MemberRow>>(url);
  // Handle both paginated and legacy flat responses
  if (Array.isArray(raw)) {
    return { data: raw, total: raw.length, page: 1, pageSize: raw.length, totalPages: 1 };
  }
  return raw as PagedResult<MemberRow>;
}

export function useMembers(filters: PaginatedFilters) {
  return useQuery({
    queryKey: qk.members(filters),
    queryFn: () => fetchMembers(filters),
    placeholderData: (prev) => prev, // keep previous data while loading next page
    staleTime: 5 * 60 * 1000,
  });
}

export function useMemberDetail(id: string) {
  return useQuery({
    queryKey: qk.memberDetail(id),
    queryFn: () => authFetch(`${apiBase}/members/${id}`),
    staleTime: 10 * 60 * 1000,
    enabled: !!id,
  });
}

// ─── Churches ─────────────────────────────────────────────────────────────────

export interface ChurchRow {
  id: string;
  name: string;
  code?: string | null;
  city?: string | null;
  state?: string | null;
  status?: string | null;
  leader?: string | null;
  regionalName?: string | null;
  campoName?: string | null;
}

async function fetchChurches(filters: PaginatedFilters): Promise<PagedResult<ChurchRow>> {
  const url = buildUrl('/churches', { ...filters, pageSize: filters.pageSize ?? 30 });
  const raw = await authFetch<ChurchRow[] | PagedResult<ChurchRow>>(url);
  if (Array.isArray(raw)) {
    return { data: raw, total: raw.length, page: 1, pageSize: raw.length, totalPages: 1 };
  }
  return raw as PagedResult<ChurchRow>;
}

export function useChurches(filters: PaginatedFilters) {
  return useQuery({
    queryKey: qk.churches(filters),
    queryFn: () => fetchChurches(filters),
    placeholderData: (prev) => prev,
    staleTime: 10 * 60 * 1000,
  });
}

// ─── Generic Kan-board list (Baptism / Consecration / Transfer / Requirements) ─

export interface KanCardRow {
  id: string;
  protocol?: string | null;
  candidateName?: string | null;
  memberFullName?: string | null;
  status?: string | null;
  statusLabel?: string | null;
  columnIndex?: number | null;
  columnName?: string | null;
  churchName?: string | null;
  serviceSigla?: string | null;
  serviceDescription?: string | null;
  openedAt?: string | null;
  updatedAt?: string | null;
}

async function fetchKanList(path: string, filters: PaginatedFilters): Promise<PagedResult<KanCardRow>> {
  const url = buildUrl(path, { ...filters, pageSize: filters.pageSize ?? 30 });
  const raw = await authFetch<KanCardRow[] | PagedResult<KanCardRow>>(url);
  if (Array.isArray(raw)) {
    return { data: raw, total: raw.length, page: 1, pageSize: raw.length, totalPages: 1 };
  }
  return raw as PagedResult<KanCardRow>;
}

export function useBaptismList(filters: PaginatedFilters) {
  return useQuery({
    queryKey: qk.baptism(filters),
    queryFn: () => fetchKanList('/baptism/list', filters),
    placeholderData: (prev) => prev,
    staleTime: 5 * 60 * 1000,
  });
}

export function useConsecrationList(filters: PaginatedFilters) {
  return useQuery({
    queryKey: qk.consecration(filters),
    queryFn: () => fetchKanList('/consecration/list', filters),
    placeholderData: (prev) => prev,
    staleTime: 5 * 60 * 1000,
  });
}

export function useTransferList(filters: PaginatedFilters) {
  return useQuery({
    queryKey: qk.transfer(filters),
    queryFn: () => fetchKanList('/transfer/list', filters),
    placeholderData: (prev) => prev,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRequirementsList(filters: PaginatedFilters) {
  return useQuery({
    queryKey: qk.requirements(filters),
    queryFn: () => fetchKanList('/requirements/list', filters),
    placeholderData: (prev) => prev,
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Credentials ──────────────────────────────────────────────────────────────

export interface CredentialRow {
  id: string;
  memberName?: string | null;
  type?: string | null;
  churchName?: string | null;
  situacao?: string | null;
  issuedAt?: string | null;
  requestedAt?: string | null;
  validity?: string | null;
}

export function useCredentialsList(filters: PaginatedFilters) {
  return useQuery({
    queryKey: qk.credentials(filters),
    queryFn: async () => {
      const url = buildUrl('/credentials', { ...filters, pageSize: filters.pageSize ?? 30 });
      const raw = await authFetch<CredentialRow[] | PagedResult<CredentialRow>>(url);
      if (Array.isArray(raw)) {
        return { data: raw, total: raw.length, page: 1, pageSize: raw.length, totalPages: 1 } as PagedResult<CredentialRow>;
      }
      return raw as PagedResult<CredentialRow>;
    },
    placeholderData: (prev) => prev,
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Contacts / CRM ───────────────────────────────────────────────────────────

export interface ContactRow {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  stage?: string | null;
  source?: string | null;
  lastContact?: string | null;
}

export function useContactsList(filters: PaginatedFilters) {
  return useQuery({
    queryKey: qk.contacts(filters),
    queryFn: async () => {
      const url = buildUrl('/contacts', { ...filters, pageSize: filters.pageSize ?? 30 });
      const raw = await authFetch<ContactRow[] | PagedResult<ContactRow>>(url);
      if (Array.isArray(raw)) {
        return { data: raw, total: raw.length, page: 1, pageSize: raw.length, totalPages: 1 } as PagedResult<ContactRow>;
      }
      return raw as PagedResult<ContactRow>;
    },
    placeholderData: (prev) => prev,
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Birthdays ────────────────────────────────────────────────────────────────

export function useBirthdaysList(filters: PaginatedFilters) {
  return useQuery({
    queryKey: qk.birthdays(filters),
    queryFn: async () => {
      const url = buildUrl('/members/birthdays', { ...filters, pageSize: filters.pageSize ?? 30 });
      const raw = await authFetch<unknown[] | PagedResult<unknown>>(url);
      if (Array.isArray(raw)) {
        return { data: raw, total: raw.length, page: 1, pageSize: raw.length, totalPages: 1 } as PagedResult<unknown>;
      }
      return raw as PagedResult<unknown>;
    },
    placeholderData: (prev) => prev,
    staleTime: 2 * 60 * 1000,
  });
}

// ─── Filter data (campos, regionais, churches) — long cache ──────────────────

export function useCampos() {
  return useQuery({
    queryKey: ['secretaria', 'campos'],
    queryFn: () => authFetch<unknown[]>(`${apiBase}/campos`),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

export function useRegionais(fieldId?: string) {
  return useQuery({
    queryKey: ['secretaria', 'regionais', fieldId ?? ''],
    queryFn: () => authFetch<unknown[]>(`${apiBase}/regionais${fieldId ? `?fieldId=${fieldId}` : ''}`),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

export function useChurchOptions(fieldId?: string) {
  return useQuery({
    queryKey: ['secretaria', 'church-options', fieldId ?? ''],
    queryFn: () => authFetch<unknown[]>(`${apiBase}/churches${fieldId ? `?fieldId=${fieldId}` : ''}`),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

export function useEcclesiasticalTitles() {
  return useQuery({
    queryKey: ['secretaria', 'ecclesiastical-titles'],
    queryFn: () => authFetch<unknown[]>(`${apiBase}/ecclesiastical-titles`),
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
  });
}

// ─── Invalidation helpers ─────────────────────────────────────────────────────

export function useInvalidateModule(module: keyof typeof qk) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['secretaria', module] });
}
