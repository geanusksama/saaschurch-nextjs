import { useState } from 'react';
import { Shield, Check, X, Info } from 'lucide-react';
import { Link } from 'react-router';
import {
  DEFAULT_PERMISSION_MODULES,
  PERMISSION_GROUPS,
  ROLE_PERMISSION_ACTIONS,
  type Action,
  type PermissionModule as Module,
  type ProfileKey,
} from './permissionCatalog';
import { setGlobalPermissionMatrix } from '../../lib/usePermissions';
import { apiBase } from '../../lib/apiBase';

const PROFILES: { key: ProfileKey; label: string; color: string }[] = [
  { key: 'master', label: 'Master',           color: 'text-red-600 dark:text-red-400' },
  { key: 'admin',  label: 'Administrador',    color: 'text-purple-600 dark:text-purple-400' },
  { key: 'campo',  label: 'Campo',            color: 'text-blue-600 dark:text-blue-400' },
  { key: 'church', label: 'Igreja',           color: 'text-green-600 dark:text-green-400' },
];

const ACTIONS = ROLE_PERMISSION_ACTIONS;

const PROFILE_COLORS: Record<ProfileKey, string> = {
  master: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  admin:  'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  campo:  'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  church: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
};

function loadModules(): Module[] {
  try {
    const stored = localStorage.getItem('mrm_permissions');
    if (stored) return JSON.parse(stored) as Module[];
  } catch { /* ignore */ }
  return DEFAULT_PERMISSION_MODULES;
}

export function PermissionsMatrix() {
  const [modules, setModules] = useState<Module[]>(loadModules);
  const [filterGroup, setFilterGroup] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [saved, setSaved] = useState(false);

  const groups = PERMISSION_GROUPS;
  const filtered = filterGroup ? modules.filter((m) => m.group === filterGroup) : modules;

  const toggle = (moduleKey: string, action: Action, profile: ProfileKey) => {
    if (!editMode) return;
    setModules((prev) =>
      prev.map((m) =>
        m.key === moduleKey
          ? { ...m, permissions: { ...m.permissions, [action]: { ...m.permissions[action], [profile]: !m.permissions[action][profile] } } }
          : m,
      ),
    );
    setSaved(false);
  };

  const handleSave = async () => {
    // Save to backend (persists across all sessions/devices)
    try {
      const storedUser = JSON.parse(localStorage.getItem('mrm_user') || '{}');
      const token: string | null = storedUser?.token ?? null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      await fetch(`${apiBase}/permissions/matrix`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ modules }),
      });
    } catch { /* ignore network errors – still persist locally */ }
    // Update global state + localStorage for all hook consumers
    setGlobalPermissionMatrix(modules);
    setSaved(true);
    setEditMode(false);
    setTimeout(() => setSaved(false), 3000);
  };

  // Agrupa módulos por grupo para exibir separadores
  const grouped: { group: string; items: Module[] }[] = groups
    .filter((g) => !filterGroup || g === filterGroup)
    .map((g) => ({ group: g, items: filtered.filter((m) => m.group === g) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="p-6 max-w-full">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
            <Shield className="w-6 h-6 text-slate-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Matriz de Permissões</h1>
            <p className="text-slate-500 dark:text-slate-400">Controle granular de acesso por perfil e módulo</p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-start gap-3 text-sm text-blue-700 dark:text-blue-300">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          Esta matriz define as permissões padrão por perfil. Permissões específicas podem ser sobrescritas por{' '}
          <Link to="/app-ui/system/roles" className="font-semibold underline">Funções customizadas</Link>
          &nbsp;atribuídas individualmente a cada usuário.
        </span>
      </div>

      {/* Legenda de Perfis */}
      <div className="flex flex-wrap gap-3 mb-4">
        {PROFILES.map((p) => (
          <span key={p.key} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${PROFILE_COLORS[p.key]}`}>
            {p.label}
          </span>
        ))}
        <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
          ✓ = Permitido &nbsp; ✕ = Bloqueado
        </span>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={filterGroup}
          onChange={(e) => setFilterGroup(e.target.value)}
          className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="">Todos os módulos</option>
          {groups.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>

        <div className="ml-auto flex items-center gap-2">
          {saved && (
            <span className="text-sm text-green-600 dark:text-green-400 font-medium">Salvo com sucesso!</span>
          )}
          {editMode ? (
            <>
              <button
                onClick={() => { setModules(DEFAULT_PERMISSION_MODULES); setEditMode(false); }}
                className="px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
              >
                Salvar Alterações
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              className="px-4 py-2 bg-slate-800 dark:bg-slate-600 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
            >
              Editar Permissões
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
              <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300 w-48">Módulo</th>
              {PROFILES.map((p) =>
                ACTIONS.map((a) => (
                  <th
                    key={`${p.key}-${a.key}`}
                    className="px-2 py-3 text-center font-semibold text-slate-600 dark:text-slate-400 min-w-[52px]"
                    title={`${p.label} — ${a.label}`}
                  >
                    <div className={`text-xs ${p.color}`}>{p.label.slice(0, 4)}</div>
                    <div className="text-xs text-slate-400 dark:text-slate-500">{a.label}</div>
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {grouped.map(({ group, items }) => (
              <>
                <tr key={`group-${group}`} className="bg-slate-50 dark:bg-slate-900/50">
                  <td
                    colSpan={1 + PROFILES.length * ACTIONS.length}
                    className="px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                  >
                    {group}
                  </td>
                </tr>
                {items.map((mod, idx) => (
                  <tr
                    key={mod.key}
                    className={`border-b border-slate-100 dark:border-slate-700/50 ${
                      idx % 2 === 0 ? '' : 'bg-slate-50/50 dark:bg-slate-900/20'
                    } ${editMode ? 'hover:bg-purple-50/30 dark:hover:bg-purple-900/10' : ''}`}
                  >
                    <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                      {mod.name}
                    </td>
                    {PROFILES.map((p) =>
                      ACTIONS.map((a) => {
                        const allowed = mod.permissions[a.key][p.key];
                        return (
                          <td key={`${p.key}-${a.key}`} className="px-2 py-2.5 text-center">
                            <button
                              onClick={() => toggle(mod.key, a.key, p.key)}
                              disabled={!editMode}
                              className={`w-7 h-7 rounded-full flex items-center justify-center mx-auto transition-colors ${
                                allowed
                                  ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400'
                                  : 'bg-slate-100 dark:bg-slate-700 text-slate-300 dark:text-slate-600'
                              } ${editMode ? 'cursor-pointer hover:ring-2 hover:ring-purple-400' : 'cursor-default'}`}
                              title={`${mod.name} — ${p.label} — ${a.label}: ${allowed ? 'Permitido' : 'Bloqueado'}`}
                            >
                              {allowed
                                ? <Check className="w-3.5 h-3.5" />
                                : <X className="w-3.5 h-3.5" />
                              }
                            </button>
                          </td>
                        );
                      })
                    )}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary Cards */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
        {PROFILES.map((p) => {
          const total = modules.length * ACTIONS.length;
          const allowed = modules.reduce(
            (acc, m) => acc + ACTIONS.filter((a) => m.permissions[a.key][p.key]).length,
            0,
          );
          const pct = Math.round((allowed / total) * 100);
          return (
            <div key={p.key} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold mb-2 ${PROFILE_COLORS[p.key]}`}>
                {p.label}
              </span>
              <div className="flex items-end gap-1">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">{pct}%</span>
                <span className="text-xs text-slate-400 mb-1">acesso</span>
              </div>
              <div className="mt-2 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-400 dark:bg-purple-600 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">{allowed}/{total} permissões</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
