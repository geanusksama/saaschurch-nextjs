import { useSyncExternalStore } from 'react';

/**
 * Módulos (categorias) fixados no topo da sidebar — pedido do dono em
 * 02/11/2026. Mesmo padrão de `favorites.ts`: fonte única no localStorage e
 * todos os assinantes notificados na hora.
 *
 * Sem nada salvo, Secretaria e Finanças (Tesouraria) vêm fixados. A pessoa pode
 * desafixar; a escolha dela passa a valer (inclusive a lista vazia).
 */

const STORAGE_KEY = 'mrm_pinned_nav_sections';
export const DEFAULT_PINNED_SECTIONS = ['Secretaria', 'Finanças'];

const listeners = new Set<() => void>();
let snapshot: string[] = readFromStorage();

function readFromStorage(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) return DEFAULT_PINNED_SECTIONS;
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter((name): name is string => typeof name === 'string') : DEFAULT_PINNED_SECTIONS;
  } catch {
    return DEFAULT_PINNED_SECTIONS;
  }
}

function commit(next: string[]) {
  snapshot = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage indisponível — o estado em memória segue valendo */
  }
  listeners.forEach((listener) => listener());
}

function handleStorageEvent(event: StorageEvent) {
  if (event.key !== STORAGE_KEY) return;
  snapshot = readFromStorage();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener('storage', handleStorageEvent);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', handleStorageEvent);
  };
}

function getSnapshot() {
  return snapshot;
}

/** Nomes das seções fixadas, reativo em tempo real. */
export function usePinnedSections(): string[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Fixa ou desafixa uma seção. */
export function togglePinnedSection(name: string) {
  commit(snapshot.includes(name) ? snapshot.filter((item) => item !== name) : [...snapshot, name]);
}
