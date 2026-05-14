/**
 * Dexie.js IndexedDB schema for all Secretaria modules.
 * Stores local snapshots, filters, pagination state and sync metadata.
 */
import Dexie, { type Table } from 'dexie';

// ─── Row types ──────────────────────────────────────────────────────────────

export interface CachedMember {
  id: string;
  fullName: string;
  phone?: string | null;
  church?: string | null;
  churchId?: string | null;
  membershipStatus?: string | null;
  ecclesiasticalTitle?: string | null;
  rol?: number | null;
  updatedAt?: string | null;
  _cachedAt: number;
}

export interface CachedChurch {
  id: string;
  name: string;
  code?: string | null;
  city?: string | null;
  state?: string | null;
  status?: string | null;
  updatedAt?: string | null;
  _cachedAt: number;
}

export interface CachedCard {
  id: string;
  module: string; // 'baptism' | 'consecration' | 'transfer' | 'credentials' | 'requirements'
  protocol?: string | null;
  candidateName?: string | null;
  status?: string | null;
  statusLabel?: string | null;
  columnIndex?: number | null;
  churchName?: string | null;
  openedAt?: string | null;
  updatedAt?: string | null;
  _cachedAt: number;
}

export interface CachedContact {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  stage?: string | null;
  updatedAt?: string | null;
  _cachedAt: number;
}

export interface SyncMeta {
  key: string; // e.g. 'members', 'churches', 'baptism', etc.
  lastSync: number; // Unix ms
  lastPage: number;
  totalCount: number;
  filters: string; // JSON-serialised filters
}

export interface UIFilterSnapshot {
  key: string; // module key
  filters: string; // JSON
  savedAt: number;
}

// ─── DB class ────────────────────────────────────────────────────────────────

class SecretariaDatabase extends Dexie {
  members!: Table<CachedMember>;
  churches!: Table<CachedChurch>;
  cards!: Table<CachedCard>;
  contacts!: Table<CachedContact>;
  syncMeta!: Table<SyncMeta>;
  uiFilters!: Table<UIFilterSnapshot>;

  constructor() {
    super('secretariaDb');

    this.version(1).stores({
      members:  '&id, fullName, churchId, membershipStatus, updatedAt, _cachedAt',
      churches: '&id, name, code, status, updatedAt, _cachedAt',
      cards:    '&id, module, status, statusLabel, columnIndex, openedAt, updatedAt, _cachedAt',
      contacts: '&id, name, phone, stage, updatedAt, _cachedAt',
      syncMeta: '&key',
      uiFilters:'&key',
    });
  }
}

export const secretariaDb = new SecretariaDatabase();

// ─── Helpers ─────────────────────────────────────────────────────────────────

export async function getSyncMeta(key: string): Promise<SyncMeta | null> {
  return (await secretariaDb.syncMeta.get(key)) ?? null;
}

export async function setSyncMeta(key: string, data: Partial<SyncMeta>) {
  await secretariaDb.syncMeta.put({ key, lastSync: 0, lastPage: 0, totalCount: 0, filters: '{}', ...data });
}

export async function saveUIFilters(key: string, filters: Record<string, unknown>) {
  await secretariaDb.uiFilters.put({ key, filters: JSON.stringify(filters), savedAt: Date.now() });
}

export async function loadUIFilters<T = Record<string, unknown>>(key: string): Promise<T | null> {
  const row = await secretariaDb.uiFilters.get(key);
  if (!row) return null;
  try { return JSON.parse(row.filters) as T; } catch { return null; }
}

/** Prune entries older than `maxAgeMs` (default 24 h) */
export async function pruneOldCache(maxAgeMs = 24 * 60 * 60 * 1000) {
  const cutoff = Date.now() - maxAgeMs;
  await Promise.all([
    secretariaDb.members.where('_cachedAt').below(cutoff).delete(),
    secretariaDb.churches.where('_cachedAt').below(cutoff).delete(),
    secretariaDb.cards.where('_cachedAt').below(cutoff).delete(),
    secretariaDb.contacts.where('_cachedAt').below(cutoff).delete(),
  ]);
}
