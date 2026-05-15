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
import { useEffect, useState, useCallback } from 'react';
import {
  DEFAULT_PERMISSION_MODULES,
  type PermissionModule,
  type ProfileKey,
} from '../app-ui/system/permissionCatalog';

import { apiBase as API_BASE } from './apiBase';
const LS_KEY = 'mrm_permissions';

// Module-level cache shared across all hook instances
let _moduleCache: PermissionModule[] | null = null;

function readLocalStorage(): PermissionModule[] | null {
  try {
    const s = localStorage.getItem(LS_KEY);
    if (s) return JSON.parse(s) as PermissionModule[];
  } catch { /* ignore */ }
  return null;
}

function getInitialModules(): PermissionModule[] {
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

async function fetchMatrixFromServer(): Promise<PermissionModule[] | null> {
  try {
    const storedUser = JSON.parse(localStorage.getItem('mrm_user') || '{}');
    const token: string | null = storedUser?.token ?? localStorage.getItem('mrm_token') ?? null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/permissions/matrix`, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data)) return data as PermissionModule[];
    return null;
  } catch {
    return null;
  }
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
    fetchMatrixFromServer().then((data) => {
      if (data) {
        _moduleCache = data;
        try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch { /* ignore */ }
        setModules(data);
      }
    });
    // Also refresh user overrides and roleId from localStorage (may have been updated after login)
    setUserOverrides(readUserOverrides());
    setUserRoleId(readUserRoleId());
  }, []);

  const refreshPermissions = useCallback(async () => {
    const data = await fetchMatrixFromServer();
    if (data) {
      setGlobalPermissionMatrix(data);
      setModules(data);
    }
    setUserOverrides(readUserOverrides());
  }, []);

  const pt = (profileType ?? 'church') as ProfileKey;

  // master always has full access
  if (profileType === 'master') {
    return {
      canView:   () => true,
      canCreate: () => true,
      canEdit:   () => true,
      canDelete: () => true,
      refreshPermissions,
    };
  }

  /**
   * Resolve a single action for a module:
   * 1. If user has an explicit override (true/false) → use it
   * 2. Otherwise use the matrix value for the profileType
   * 3. If module not in matrix → allow (don't break unknown items)
   */
  const resolve = (key: string, action: string): boolean => {
    const overrideKey = `${key}.${action}`;
    if (overrideKey in userOverrides) return userOverrides[overrideKey];
    // Role whitelist: if the user has a custom role AND permissions are loaded,
    // any key absent from the map is denied (the role is a whitelist).
    // Guard: only activate when overrides are non-empty to avoid blocking
    // the sidebar while permissions are still loading.
    if (userRoleId && Object.keys(userOverrides).length > 0) return false;
    // No role, or permissions not yet loaded → profile-type catalog defaults
    const mod = modules.find((m) => m.key === key);
    if (!mod) return true;
    const actionPerms = mod.permissions[action as keyof typeof mod.permissions];
    if (!actionPerms) return false;
    return (actionPerms as Record<string, boolean>)[pt] ?? false;
  };

  return {
    canView:   (key: string) => resolve(key, 'view'),
    canCreate: (key: string) => resolve(key, 'create'),
    canEdit:   (key: string) => resolve(key, 'edit'),
    canDelete: (key: string) => resolve(key, 'delete'),
    refreshPermissions,
  };
}
