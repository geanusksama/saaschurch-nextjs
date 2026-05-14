/**
 * Shared hooks for Secretaria modules:
 *
 * - useDebounce        — debounce a value (300-500ms)
 * - useServerPage      — server-side pagination helper
 * - usePrefetchNext    — prefetch the next page silently
 * - useAuthFetch       — fetch wrapper with Bearer token
 * - useDeltaSync       — incremental sync: only fetch updated_at > lastSync
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiBase } from './apiBase';
import { getSyncMeta, setSyncMeta } from './secretariaDb';

// ─── useDebounce ──────────────────────────────────────────────────────────────

export function useDebounce<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// ─── useAuthFetch ─────────────────────────────────────────────────────────────

export function getAuthHeaders(hasBody = true): Record<string, string> {
  const token = localStorage.getItem('mrm_token');
  const base: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  if (hasBody) base['Content-Type'] = 'application/json';
  return base;
}

export async function authFetch<T = unknown>(url: string, init: RequestInit = {}): Promise<T> {
  const hasBody = init.body != null;
  const res = await fetch(url, { ...init, headers: { ...getAuthHeaders(hasBody), ...(init.headers as Record<string, string> ?? {}) } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err?.error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

// ─── useServerPage ────────────────────────────────────────────────────────────

export interface PagedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Build a paginated URL with common filter params */
export function buildPagedUrl(base: string, params: Record<string, string | number | boolean | undefined | null>): string {
  const url = new URL(base, window.location.origin);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  });
  return url.pathname + url.search;
}

// ─── usePrefetchNext ──────────────────────────────────────────────────────────

export function usePrefetchNext<TFilters extends object>(
  queryKeyFn: (filters: TFilters) => readonly unknown[],
  fetchFn: (filters: TFilters) => Promise<unknown>,
  currentFilters: TFilters & { page: number; pageSize: number },
  totalPages: number,
) {
  const qc = useQueryClient();
  useEffect(() => {
    if (currentFilters.page < totalPages) {
      const nextFilters = { ...currentFilters, page: currentFilters.page + 1 };
      qc.prefetchQuery({ queryKey: queryKeyFn(nextFilters), queryFn: () => fetchFn(nextFilters), staleTime: 5 * 60 * 1000 });
    }
  }, [currentFilters.page, totalPages]);
}

// ─── useDeltaSync ─────────────────────────────────────────────────────────────

interface DeltaSyncOptions {
  moduleKey: string;
  endpoint: string;                               // e.g. '/api/members'
  onPatched: (rows: unknown[]) => void;           // merge rows into local store / cache
  intervalMs?: number;                             // default 60 s
}

/**
 * Silently polls the backend every `intervalMs` for rows updated after last sync.
 * Only fetches if the tab is visible. Stops on unmount.
 */
export function useDeltaSync({ moduleKey, endpoint, onPatched, intervalMs = 60_000 }: DeltaSyncOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sync = useCallback(async () => {
    if (document.hidden) return; // skip if tab not visible
    const meta = await getSyncMeta(moduleKey);
    const since = meta?.lastSync ? new Date(meta.lastSync).toISOString() : '';
    const url = `${apiBase}${endpoint}?updatedSince=${encodeURIComponent(since)}&pageSize=100`;
    try {
      const rows = await authFetch<unknown[]>(url);
      if (Array.isArray(rows) && rows.length > 0) {
        onPatched(rows);
      }
      await setSyncMeta(moduleKey, { lastSync: Date.now() });
    } catch {
      // silent fail — next tick will retry
    }
  }, [moduleKey, endpoint]);

  useEffect(() => {
    sync();
    timerRef.current = setInterval(sync, intervalMs);
    const onVisible = () => { if (!document.hidden) sync(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [sync, intervalMs]);
}

// ─── useOptimisticDelete ──────────────────────────────────────────────────────

/**
 * Remove an item instantly from TanStack Query cache,
 * then delete from backend in background.
 * If the delete fails, re-add to cache.
 */
export function useOptimisticDelete<T extends { id: string }>(
  queryKey: readonly unknown[],
) {
  const qc = useQueryClient();

  return useCallback(
    async (id: string, deleteFn: () => Promise<void>) => {
      // 1. Snapshot current cache
      const prev = qc.getQueryData<{ data: T[] }>(queryKey);
      // 2. Remove optimistically
      qc.setQueryData<{ data: T[] }>(queryKey, (old) =>
        old ? { ...old, data: old.data.filter((item) => item.id !== id) } : old
      );
      try {
        await deleteFn();
      } catch {
        // Rollback
        qc.setQueryData(queryKey, prev);
      }
    },
    [qc, queryKey],
  );
}
