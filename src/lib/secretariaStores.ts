/**
 * Zustand stores for Secretaria UI state only.
 *
 * NEVER store large datasets here — only:
 * - current filters
 * - sort/pagination
 * - active tab/module
 * - UI toggles
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Shared filter shape ──────────────────────────────────────────────────────

interface PageState {
  page: number;
  pageSize: number;
  setPage: (p: number) => void;
  setPageSize: (s: number) => void;
  reset: () => void;
}

function makePageStore(defaultSize = 30) {
  return create<PageState>()((set) => ({
    page: 1,
    pageSize: defaultSize,
    setPage: (page) => set({ page }),
    setPageSize: (pageSize) => set({ pageSize, page: 1 }),
    reset: () => set({ page: 1, pageSize: defaultSize }),
  }));
}

// ─── Members store ────────────────────────────────────────────────────────────

interface MembersFilters {
  q: string;
  fieldId: string;
  regionalId: string;
  churchId: string;
  status: string;
  sortKey: string;
  sortDir: 'asc' | 'desc';
  page: number;
  pageSize: number;
}
interface MembersStore extends MembersFilters {
  set: (partial: Partial<MembersFilters>) => void;
  reset: () => void;
}

const memberDefaults: MembersFilters = {
  q: '', fieldId: '', regionalId: '', churchId: '', status: '',
  sortKey: 'fullName', sortDir: 'asc', page: 1, pageSize: 30,
};

export const useMembersStore = create<MembersStore>()(
  persist(
    (set) => ({
      ...memberDefaults,
      set: (partial) => set((s) => ({ ...s, ...partial, page: 'q' in partial || 'status' in partial || 'churchId' in partial ? 1 : s.page })),
      reset: () => set(memberDefaults),
    }),
    { name: 'secretaria-members-filters', partialize: (s) => ({ fieldId: s.fieldId, regionalId: s.regionalId, churchId: s.churchId, status: s.status, sortKey: s.sortKey, sortDir: s.sortDir }) }
  )
);

// ─── Churches store ───────────────────────────────────────────────────────────

interface ChurchesFilters {
  q: string;
  fieldId: string;
  regionalId: string;
  status: string;
  sortKey: string;
  sortDir: 'asc' | 'desc';
  page: number;
  pageSize: number;
}
interface ChurchesStore extends ChurchesFilters {
  set: (partial: Partial<ChurchesFilters>) => void;
  reset: () => void;
}

const churchDefaults: ChurchesFilters = {
  q: '', fieldId: '', regionalId: '', status: '',
  sortKey: 'name', sortDir: 'asc', page: 1, pageSize: 30,
};

export const useChurchesStore = create<ChurchesStore>()(
  persist(
    (set) => ({
      ...churchDefaults,
      set: (partial) => set((s) => ({ ...s, ...partial, page: 'q' in partial || 'status' in partial ? 1 : s.page })),
      reset: () => set(churchDefaults),
    }),
    { name: 'secretaria-churches-filters', partialize: (s) => ({ fieldId: s.fieldId, regionalId: s.regionalId, status: s.status, sortKey: s.sortKey, sortDir: s.sortDir }) }
  )
);

// ─── Baptism / Consecration / Transfer / Credentials / Requirements store ────

function makeServiceStore(name: string, defaultPageSize = 30) {
  interface State {
    q: string;
    fieldId: string;
    churchId: string;
    statusFilter: string;
    dateFrom: string;
    dateTo: string;
    sortKey: string;
    sortDir: 'asc' | 'desc';
    page: number;
    pageSize: number;
    set: (partial: Partial<Omit<State, 'set' | 'reset'>>) => void;
    reset: () => void;
  }
  const defaults = { q: '', fieldId: '', churchId: '', statusFilter: '', dateFrom: '', dateTo: '', sortKey: 'openedAt', sortDir: 'desc' as const, page: 1, pageSize: defaultPageSize };
  return create<State>()(
    persist(
      (set) => ({
        ...defaults,
        set: (partial) => set((s) => ({ ...s, ...partial, page: 'q' in partial || 'statusFilter' in partial || 'churchId' in partial ? 1 : s.page })),
        reset: () => set(defaults),
      }),
      { name: `secretaria-${name}-filters`, partialize: (s) => ({ fieldId: s.fieldId, churchId: s.churchId, statusFilter: s.statusFilter, dateFrom: s.dateFrom, dateTo: s.dateTo }) }
    )
  );
}

export const useBaptismStore      = makeServiceStore('baptism');
export const useConsecrationStore = makeServiceStore('consecration');
export const useTransferStore     = makeServiceStore('transfer');
export const useCredentialsStore  = makeServiceStore('credentials');
export const useRequirementsStore = makeServiceStore('requirements');
export const useContactsStore     = makeServiceStore('contacts');
export const useBirthdaysStore    = makeServiceStore('birthdays');

// ─── Pipeline / global secretaria tabs ───────────────────────────────────────

interface SecretariaUIStore {
  activeModule: string;
  sidebarCollapsed: boolean;
  setActiveModule: (m: string) => void;
  toggleSidebar: () => void;
}

export const useSecretariaUI = create<SecretariaUIStore>()(
  persist(
    (set) => ({
      activeModule: 'members',
      sidebarCollapsed: false,
      setActiveModule: (activeModule) => set({ activeModule }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    { name: 'secretaria-ui' }
  )
);
