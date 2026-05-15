import React, { useEffect, useState } from 'react';
import { Shield, ArrowLeft, Check, X, Info, Save, RefreshCw } from 'lucide-react';
import { Link, useParams } from 'react-router';
import {
  DEFAULT_PERMISSION_MODULES,
  PERMISSION_GROUPS,
  ROLE_PERMISSION_ACTIONS,
  type Action,
} from './permissionCatalog';

import { apiBase } from '../../lib/apiBase';

const MODULES = DEFAULT_PERMISSION_MODULES;

const ACTIONS = ROLE_PERMISSION_ACTIONS;

const PROFILE_LABELS: Record<string, string> = {
  master: 'Master',
  admin: 'Administrador',
  campo: 'Campo',
  church: 'Igreja',
};

const PROFILE_COLORS: Record<string, string> = {
  master: 'bg-red-100 text-red-700',
  admin: 'bg-purple-100 text-purple-700',
  campo: 'bg-blue-100 text-blue-700',
  church: 'bg-green-100 text-green-700',
};

// permissions JSON format: { "dashboard.view": true, "members.create": false, ... }
type PermMap = Record<string, boolean>;

// ─── Component ──────────────────────────────────────────────────────────────
export default function UserPermissions() {
  const { id } = useParams<{ id: string }>();
  const token = localStorage.getItem('mrm_token');

  const [user, setUser] = useState<{ id: string; fullName: string; email: string; profileType: string } | null>(null);
  const [perms, setPerms] = useState<PermMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [filterGroup, setFilterGroup] = useState('');

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiBase}/users/${id}/permissions`, { headers });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Erro ${res.status}`);
      }
      const data = await res.json();
      setUser({ id: data.id, fullName: data.fullName, email: data.email, profileType: data.profileType });
      setPerms((data.permissions as PermMap) || {});
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar permissões.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (id) load(); }, [id]);

  const toggle = (moduleKey: string, action: Action) => {
    const k = `${moduleKey}.${action}`;
    setPerms((prev) => {
      const current = prev[k];
      if (current === undefined) return { ...prev, [k]: true };   // undefined → true
      if (current === true) return { ...prev, [k]: false };        // true → false
      const next = { ...prev };
      delete next[k];                                              // false → undefined (reset)
      return next;
    });
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${apiBase}/users/${id}/permissions`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: perms }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Erro ${res.status}`);
      }
      // Se o usuário editado é o usuário logado, atualiza mrm_user no localStorage
      // para que usePermissions reflita as mudanças sem exigir novo login
      try {
        const stored = localStorage.getItem('mrm_user');
        if (stored) {
          const me = JSON.parse(stored);
          if (me.id === id) {
            me.permissions = perms;
            localStorage.setItem('mrm_user', JSON.stringify(me));
            window.dispatchEvent(new StorageEvent('storage', { key: 'mrm_user', newValue: JSON.stringify(me) }));
          }
        }
      } catch (_) { /* ignore */ }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const resetAll = () => {
    setPerms({});
    setSaved(false);
  };

  const groups = PERMISSION_GROUPS;
  const filteredModules = filterGroup ? MODULES.filter((m) => m.group === filterGroup) : MODULES;

  // Returns 'all-allowed' | 'all-blocked' | 'all-default' | 'mixed'
  const getColumnState = (action: Action): 'all-allowed' | 'all-blocked' | 'all-default' | 'mixed' => {
    const values = filteredModules.map((m) => perms[`${m.key}.${action}`]);
    if (values.every((v) => v === true)) return 'all-allowed';
    if (values.every((v) => v === false)) return 'all-blocked';
    if (values.every((v) => v === undefined)) return 'all-default';
    return 'mixed';
  };

  // Cycles: mixed/default → all-allowed → all-blocked → all-default
  const toggleColumn = (action: Action) => {
    const state = getColumnState(action);
    setPerms((prev) => {
      const next = { ...prev };
      if (state === 'all-allowed') {
        // → all blocked
        filteredModules.forEach((m) => { next[`${m.key}.${action}`] = false; });
      } else if (state === 'all-blocked') {
        // → all default (remove overrides)
        filteredModules.forEach((m) => { delete next[`${m.key}.${action}`]; });
      } else {
        // mixed or all-default → all allowed
        filteredModules.forEach((m) => { next[`${m.key}.${action}`] = true; });
      }
      return next;
    });
    setSaved(false);
  };

  const grouped = groups
    .filter((g) => !filterGroup || g === filterGroup)
    .map((g) => ({ group: g, items: filteredModules.filter((m) => m.group === g) }))
    .filter((g) => g.items.length > 0);

  // Cell rendering: true=allowed (green), false=blocked (red), undefined=default (gray)
  const renderCell = (moduleKey: string, action: Action) => {
    const k = `${moduleKey}.${action}`;
    const val = perms[k];
    if (val === true) {
      return (
        <button
          onClick={() => toggle(moduleKey, action)}
          className="w-8 h-8 rounded-lg bg-green-100 hover:bg-green-200 flex items-center justify-center transition-colors mx-auto"
          title="Permitido (clique para bloquear)"
        >
          <Check className="w-4 h-4 text-green-600" />
        </button>
      );
    }
    if (val === false) {
      return (
        <button
          onClick={() => toggle(moduleKey, action)}
          className="w-8 h-8 rounded-lg bg-red-100 hover:bg-red-200 flex items-center justify-center transition-colors mx-auto"
          title="Bloqueado (clique para redefinir ao padrão)"
        >
          <X className="w-4 h-4 text-red-600" />
        </button>
      );
    }
    return (
      <button
        onClick={() => toggle(moduleKey, action)}
        className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 flex items-center justify-center transition-colors mx-auto"
        title="Padrão do perfil (clique para permitir)"
      >
        <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-500" />
      </button>
    );
  };

  return (
    <div className="p-6">
      {/* Back link */}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
            <Shield className="w-6 h-6 text-slate-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Permissões do Usuário
            </h1>
            {user && (
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-slate-500 dark:text-slate-400 text-sm">{user.fullName}</p>
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${PROFILE_COLORS[user.profileType] || 'bg-slate-100 text-slate-700'}`}>
                  {PROFILE_LABELS[user.profileType] || user.profileType}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="text-sm text-green-600 dark:text-green-400 font-medium">Salvo!</span>
          )}
          <button
            onClick={resetAll}
            className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            title="Remover todas as sobrescritas (usar padrões do perfil)"
          >
            Redefinir
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Info banner */}
      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-start gap-3 text-sm text-blue-700 dark:text-blue-300">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <span>
          Permissões marcadas aqui <strong>sobrescrevem</strong> os padrões do perfil para este usuário.
          Células cinzas usam o padrão do perfil. Verde = permitido, Vermelho = bloqueado.
          Clique para alternar. Use "Redefinir" para limpar todas as sobrescritas.
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-500">Carregando...</div>
      ) : (
        <>
          {/* Filter */}
          <div className="flex items-center gap-3 mb-4">
            <select
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
              className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="">Todos os módulos</option>
              {groups.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {Object.keys(perms).length} sobrescrita(s) ativa(s)
            </span>
          </div>

          {/* Matrix Table */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300 w-56">Módulo</th>
                  {ACTIONS.map((a) => {
                    const colState = getColumnState(a.key);
                    return (
                      <th key={a.key} className="px-2 py-3 text-center font-semibold text-slate-600 dark:text-slate-400 min-w-[72px] text-xs">
                        <button
                          onClick={() => toggleColumn(a.key)}
                          title={`Clique para alternar toda a coluna (estado: ${colState === 'all-allowed' ? 'todos permitidos' : colState === 'all-blocked' ? 'todos bloqueados' : colState === 'all-default' ? 'todos padrão' : 'misto'})`}
                          className={`inline-flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors cursor-pointer select-none
                            ${
                              colState === 'all-allowed'
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : colState === 'all-blocked'
                                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-700'
                            }`}
                        >
                          <span>{a.label}</span>
                          <span className="text-[9px] font-normal opacity-60">
                            {colState === 'all-allowed' ? '✓ todos' : colState === 'all-blocked' ? '✕ todos' : colState === 'all-default' ? '● padrão' : '— misto'}
                          </span>
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {grouped.map(({ group, items }) => (
                  <React.Fragment key={`group-${group}`}>
                    <tr className="bg-slate-50 dark:bg-slate-900/50">
                      <td
                        colSpan={1 + ACTIONS.length}
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
                        }`}
                      >
                        <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          {mod.name}
                        </td>
                        {ACTIONS.map((a) => (
                          <td key={a.key} className="px-2 py-2.5 text-center">
                            {renderCell(mod.key, a.key)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
