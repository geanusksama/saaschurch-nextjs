/**
 * usePermissions – reads the active permission matrix from the backend
 * (falling back to localStorage then DEFAULT_PERMISSION_MODULES).
 *
 * Also applies user-level overrides stored in mrm_user.permissions
 * (format: { "dashboard.view": false, "members.create": true, ... })
 *
 * Priority: user override > matrix default for profileType
 *
 * Provides helpers:
 *   canView(moduleKey)   canCreate(moduleKey)
 *   canEdit(moduleKey)   canDelete(moduleKey)
 *
 * The hook also exposes `refreshPermissions()` so the PermissionsMatrix page
 * can force a refetch after saving.
 */
import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  DEFAULT_PERMISSION_MODULES,
  mergeModules,
  type PermissionModule,
  type ProfileKey,
} from '../app-ui/system/permissionCatalog';
import { resolvePermission } from './resolvePermission';
import { podeChave } from './permissoes/resolver';

import { apiBase as API_BASE } from './apiBase';
const LS_KEY = 'mrm_permissions';

// Module-level cache shared across all hook instances
let _moduleCache: PermissionModule[] | null = null;

function readLocalStorage(): PermissionModule[] | null {
  try {
    const s = localStorage.getItem(LS_KEY);
    if (s) return mergeModules(JSON.parse(s) as PermissionModule[]);
  } catch { /* ignore */ }
  return null;
}

function getInitialModules(): PermissionModule[] {
  // Perfis que não têm acesso ao endpoint /permissions/matrix (church, campo)
  // nunca devem usar um cache salvo — ele pode estar desatualizado de uma sessão
  // de admin anterior. Sempre partem do DEFAULT_PERMISSION_MODULES atualizado.
  try {
    const profileType = JSON.parse(localStorage.getItem('mrm_user') || '{}').profileType;
    if (profileType && !['master', 'admin'].includes(profileType)) {
      return [...DEFAULT_PERMISSION_MODULES];
    }
  } catch { /* ignore */ }
  return _moduleCache ?? readLocalStorage() ?? DEFAULT_PERMISSION_MODULES;
}

/** User-level overrides: { "dashboard.view": false, "members.create": true, ... } */
function readUserOverrides(): Record<string, boolean> {
  try {
    const u = JSON.parse(localStorage.getItem('mrm_user') || '{}');
    if (u?.permissions && typeof u.permissions === 'object') {
      return u.permissions as Record<string, boolean>;
    }
  } catch { /* ignore */ }
  return {};
}



/** Returns roleId if the user has a custom role assigned */
function readUserRoleId(): string | null {
  try {
    return JSON.parse(localStorage.getItem('mrm_user') || '{}').roleId ?? null;
  } catch { return null; }
}

// Retorna PermissionModule[] se ok, 'forbidden' se 403, null em outros erros.
//
// Uma busca compartilhada: cada <Permissao> monta este hook, e sem isto uma
// tela com 50 botões marcados fazia 50 GET /permissions/matrix ao abrir.
let _matrixPromise: Promise<PermissionModule[] | 'forbidden' | null> | null = null;
let _matrixQuando = 0;
const MATRIX_TTL_MS = 30_000;

function fetchMatrixFromServer(forcar = false): Promise<PermissionModule[] | 'forbidden' | null> {
  const agora = Date.now();
  if (!forcar && _matrixPromise && agora - _matrixQuando < MATRIX_TTL_MS) return _matrixPromise;
  _matrixQuando = agora;
  _matrixPromise = buscarMatrix();
  return _matrixPromise;
}

async function buscarMatrix(): Promise<PermissionModule[] | 'forbidden' | null> {
  try {
    const storedUser = JSON.parse(localStorage.getItem('mrm_user') || '{}');
    const token: string | null = storedUser?.token ?? localStorage.getItem('mrm_token') ?? null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/permissions/matrix`, { headers });
    if (res.status === 403) return 'forbidden';
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data)) return data as PermissionModule[];
    return null;
  } catch {
    return null;
  }
}

/**
 * Grupos de usuários: quem está em grupo vale só pela regra do grupo (whitelist).
 * O servidor devolve o mapa já resolvido em /permissoes/efetivas; ele é buscado
 * ao abrir, porque o mrm_user só é gravado no login. Cache de módulo: uma
 * busca por carga de página, compartilhada por todos os componentes.
 */
type Efetivas = { emGrupo: boolean; permissoes: Record<string, boolean> | null };
let _efetivas: Efetivas | null = null;
let _efetivasPromise: Promise<Efetivas | null> | null = null;

function buscarEfetivas(forcar = false): Promise<Efetivas | null> {
  if (_efetivasPromise && !forcar) return _efetivasPromise;
  const token = localStorage.getItem('mrm_token');
  if (!token) return Promise.resolve(null);
  _efetivasPromise = fetch(`${API_BASE}/permissoes/efetivas`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((d: Efetivas | null) => {
      if (d && typeof d.emGrupo === 'boolean') _efetivas = d;
      return _efetivas;
    })
    .catch(() => _efetivas);
  return _efetivasPromise;
}

// Listeners to notify all hook instances when matrix changes
const _listeners = new Set<() => void>();
function notifyAll() { _listeners.forEach((fn) => fn()); }

/** Call this from the PermissionsMatrix save handler to push updates globally */
export function setGlobalPermissionMatrix(modules: PermissionModule[]) {
  _moduleCache = modules;
  try { localStorage.setItem(LS_KEY, JSON.stringify(modules)); } catch { /* ignore */ }
  notifyAll();
}

export function usePermissions(profileType?: string) {
  const [modules, setModules] = useState<PermissionModule[]>(getInitialModules);
  const [userOverrides, setUserOverrides] = useState<Record<string, boolean>>(readUserOverrides);
  const [userRoleId, setUserRoleId] = useState<string | null>(readUserRoleId);
  const [efetivas, setEfetivas] = useState<Efetivas | null>(_efetivas);

  // Subscribe to global changes (e.g., after save in PermissionsMatrix)
  useEffect(() => {
    const refresh = () => {
      setModules(getInitialModules());
      setUserOverrides(readUserOverrides());
    };
    _listeners.add(refresh);

    // Listen for mrm_user updates from other components (e.g., UserPermissions save)
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'mrm_user') {
        setUserOverrides(readUserOverrides());
        setUserRoleId(readUserRoleId());
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      _listeners.delete(refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // Fetch from server on mount
  useEffect(() => {
    fetchMatrixFromServer().then((result) => {
      if (result === 'forbidden') {
        // Perfil sem acesso ao endpoint (ex: church). Descarta cache antigo e usa
        // DEFAULT_PERMISSION_MODULES para que a versão atualizada do catalog seja aplicada.
        _moduleCache = null;
        try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
        setModules([...DEFAULT_PERMISSION_MODULES]);
      } else if (result) {
        const merged = mergeModules(result);
        _moduleCache = merged;
        try { localStorage.setItem(LS_KEY, JSON.stringify(merged)); } catch { /* ignore */ }
        setModules(merged);
      }
    });
    // Also refresh user overrides and roleId from localStorage (may have been updated after login)
    setUserOverrides(readUserOverrides());
    setUserRoleId(readUserRoleId());
    buscarEfetivas().then((e) => e && setEfetivas(e));
  }, []);

  const refreshPermissions = useCallback(async () => {
    const result = await fetchMatrixFromServer(true);
    if (result === 'forbidden') {
      _moduleCache = null;
      try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
      setModules([...DEFAULT_PERMISSION_MODULES]);
    } else if (result) {
      const merged = mergeModules(result);
      setGlobalPermissionMatrix(merged);
      setModules(merged);
    }
    setUserOverrides(readUserOverrides());
    const e = await buscarEfetivas(true);
    if (e) setEfetivas(e);
  }, []);

  const pt = (profileType ?? 'church') as ProfileKey;
  const emGrupo = efetivas?.emGrupo === true;
  // Em grupo, o mapa efetivo do servidor substitui categoria e sobrescrita.
  const overridesEfetivos = useMemo(
    () => (emGrupo ? (efetivas?.permissoes ?? {}) : userOverrides),
    [emGrupo, efetivas, userOverrides],
  );

  // Memoized resolve — stable reference avoids unnecessary re-renders in consumers.
  // A regra em si vive em resolvePermission.ts (função pura, testável fora do React).
  const resolve = useCallback(
    (key: string, action: string): boolean =>
      emGrupo
        ? overridesEfetivos[`${key}.${action}`] === true
        : resolvePermission({ key, action, profileType: pt, modules, userOverrides, userRoleId }),
    [modules, userOverrides, userRoleId, pt, emGrupo, overridesEfetivos],
  );

  /** Chave completa: de módulo ("members.view") ou granular ("members.lista.exportar"). */
  const pode = useCallback(
    (chave: string): boolean =>
      podeChave(chave, { profileType: pt, modules, userOverrides: overridesEfetivos, userRoleId, emGrupo }),
    [pt, modules, overridesEfetivos, userRoleId, emGrupo],
  );

  // Memoize each action helper — stable references avoid unnecessary re-renders in consumers
  const canView   = useCallback((key: string) => resolve(key, 'view'),   [resolve]);
  const canCreate = useCallback((key: string) => resolve(key, 'create'), [resolve]);
  const canEdit   = useCallback((key: string) => resolve(key, 'edit'),   [resolve]);
  const canDelete = useCallback((key: string) => resolve(key, 'delete'), [resolve]);

  // master always has full access — checked after all hooks to respect Rules of Hooks
  if (profileType === 'master') {
    return {
      canView:   () => true,
      canCreate: () => true,
      canEdit:   () => true,
      canDelete: () => true,
      pode: () => true,
      emGrupo: false,
      refreshPermissions,
    };
  }

  return { canView, canCreate, canEdit, canDelete, pode, emGrupo, refreshPermissions };
}
