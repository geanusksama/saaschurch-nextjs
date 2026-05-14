/**
 * TanStack Query client configured for the Secretaria modules.
 *
 * - staleTime 5 min: cached data is still "fresh" for 5 minutes
 * - gcTime 30 min: keep unused cache in memory for 30 minutes
 * - retry 2: lightweight retry on transient failures
 * - IndexedDB persistence via idb-keyval-compatible approach
 */
/**
 * TanStack Query client — cache persistido no IndexedDB (idb-keyval).
 *
 * - staleTime 5 min  : dados considerados "frescos" por 5 minutos
 * - gcTime 24h       : mantém no IndexedDB por 24 horas entre sessões
 * - retry 2          : tenta novamente em falhas transitórias
 * - refetchOnWindowFocus: false — não recarrega só por trocar de aba
 *
 * Aparece no DevTools: Application → IndexedDB → keyval-store → secretaria-cache
 */
import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { get, set, del } from 'idb-keyval';

// Adaptador que faz idb-keyval funcionar como AsyncStorage (interface do React Native — mesma API)
const idbStorage = {
  getItem:    (key: string) => get<string>(key).then((v) => v ?? null),
  setItem:    (key: string, value: string) => set(key, value),
  removeItem: (key: string) => del(key),
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,         // 5 min — fresh
      gcTime:    24 * 60 * 60 * 1000,   // 24h  — keep in IndexedDB
      retry: 2,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});

// Persiste todo o cache TanStack Query no IndexedDB
const persister = createAsyncStoragePersister({
  storage: idbStorage,
  key: 'secretaria-cache',   // chave visível no DevTools → IndexedDB → keyval-store
  throttleTime: 2000,        // grava no máx a cada 2 s para não thrash
});

persistQueryClient({
  queryClient,
  persister,
  maxAge: 24 * 60 * 60 * 1000, // 24h TTL
});


// ─── Query key factories ─────────────────────────────────────────────────────
// Centralised so invalidations are consistent.

export const qk = {
  members:      (filters?: object) => ['secretaria', 'members',      filters ?? {}] as const,
  churches:     (filters?: object) => ['secretaria', 'churches',     filters ?? {}] as const,
  baptism:      (filters?: object) => ['secretaria', 'baptism',      filters ?? {}] as const,
  consecration: (filters?: object) => ['secretaria', 'consecration', filters ?? {}] as const,
  transfer:     (filters?: object) => ['secretaria', 'transfer',     filters ?? {}] as const,
  credentials:  (filters?: object) => ['secretaria', 'credentials',  filters ?? {}] as const,
  requirements: (filters?: object) => ['secretaria', 'requirements', filters ?? {}] as const,
  contacts:     (filters?: object) => ['secretaria', 'contacts',     filters ?? {}] as const,
  birthdays:    (filters?: object) => ['secretaria', 'birthdays',    filters ?? {}] as const,
  attendance:   (filters?: object) => ['secretaria', 'attendance',   filters ?? {}] as const,
  pipeline:     (filters?: object) => ['secretaria', 'pipeline',     filters ?? {}] as const,
  reports:      (filters?: object) => ['secretaria', 'reports',      filters ?? {}] as const,
  memberDetail: (id: string)       => ['secretaria', 'member',       id            ] as const,
  churchDetail: (id: string)       => ['secretaria', 'church',       id            ] as const,
};
