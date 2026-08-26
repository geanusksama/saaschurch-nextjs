import { useSyncExternalStore } from 'react';

/**
 * Store compartilhado dos atalhos favoritos.
 *
 * Antes cada tela (sidebar do AppUI e a home de Apps) guardava a propria copia
 * em useState e so escrevia no localStorage. O evento nativo `storage` nao
 * dispara na aba que fez a escrita, entao as duas telas so se viam depois de um
 * reload. Aqui a fonte da verdade e unica e todos os assinantes sao notificados
 * na hora — a favoritacao reflete em tempo real em qualquer lugar.
 */

const STORAGE_KEY = 'mrm_favorite_nav_items';

const listeners = new Set<() => void>();

/**
 * Snapshot atual. Precisa ser uma referencia estavel entre renders, senao o
 * useSyncExternalStore entra em loop — por isso so trocamos o array quando o
 * conteudo realmente muda.
 */
let snapshot: string[] = readFromStorage();

function readFromStorage(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed.filter((path): path is string => typeof path === 'string') : [];
  } catch {
    return [];
  }
}

function emit() {
  listeners.forEach((listener) => listener());
}

function commit(next: string[]) {
  snapshot = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage indisponivel (modo privado, cota) — o estado em memoria segue valendo */
  }
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  // Primeiro assinante liga o sync entre abas.
  if (listeners.size === 1) {
    window.addEventListener('storage', handleStorageEvent);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener('storage', handleStorageEvent);
    }
  };
}

function handleStorageEvent(event: StorageEvent) {
  if (event.key !== STORAGE_KEY) return;
  snapshot = readFromStorage();
  emit();
}

function getSnapshot() {
  return snapshot;
}

/** Lista de paths favoritados, reativa em tempo real. */
export function useFavoritePaths(): string[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Adiciona ou remove um atalho e notifica todas as telas na mesma hora. */
export function toggleFavoritePath(path: string) {
  const current = snapshot;
  commit(current.includes(path) ? current.filter((item) => item !== path) : [...current, path]);
}

export function isFavoritePath(path: string) {
  return snapshot.includes(path);
}
