/**
 * Últimas buscas da barra superior, por usuário logado.
 *
 * Fica no `localStorage` da máquina, com chave derivada do id do usuário — assim
 * dois logins no mesmo computador não misturam histórico. É conveniência de
 * digitação, não dado de negócio: nada aqui vai para o servidor.
 */

const MAX_RECENT_SEARCHES = 5;
const STORAGE_PREFIX = 'mrm_recent_searches';

function storageKey(userId?: string | null) {
  return `${STORAGE_PREFIX}:${userId || 'anon'}`;
}

/** Id do usuário logado a partir da sessão gravada pelo login. */
export function currentUserKey(): string {
  try {
    const user = JSON.parse(localStorage.getItem('mrm_user') || '{}');
    return user?.id || user?.email || 'anon';
  } catch {
    return 'anon';
  }
}

export function readRecentSearches(userId = currentUserKey()): string[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string').slice(0, MAX_RECENT_SEARCHES) : [];
  } catch {
    return [];
  }
}

/**
 * Move o termo para o topo da lista (sem duplicar, ignorando caixa) e mantém só
 * os 5 mais recentes. Devolve a lista já atualizada.
 */
export function pushRecentSearch(term: string, userId = currentUserKey()): string[] {
  const clean = term.trim();
  if (!clean) return readRecentSearches(userId);
  const previous = readRecentSearches(userId).filter((item) => item.toLowerCase() !== clean.toLowerCase());
  const next = [clean, ...previous].slice(0, MAX_RECENT_SEARCHES);
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(next));
  } catch {
    /* quota cheia ou storage bloqueado: histórico é descartável */
  }
  return next;
}

export function clearRecentSearches(userId = currentUserKey()): string[] {
  try {
    localStorage.removeItem(storageKey(userId));
  } catch {
    /* idem */
  }
  return [];
}
