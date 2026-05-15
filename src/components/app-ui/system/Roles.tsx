import { Edit, Plus, Shield, Trash2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ROLE_PERMISSION_CATEGORIES } from '../../../app-ui/system/permissionCatalog';
import { ConfirmDialog } from '../shared/ConfirmDialog';

import { apiBase } from '../../../lib/apiBase';

type CampoOption = {
  id: string;
  name: string;
  code?: string | null;
};

type ChurchOption = {
  id: string;
  name: string;
};

type RoleRecord = {
  id: string;
  name: string;
  description: string | null;
  churchId: string | null;
  color: string | null;
  permissions: Record<string, boolean> | null;
  isSystem: boolean;
  church?: ChurchOption | null;
  _count?: {
    users: number;
  };
};

type RoleFormState = {
  name: string;
  description: string;
  churchId: string;
  color: string;
  permissions: string[];
  isSystem: boolean;
};

const permissionCategories = ROLE_PERMISSION_CATEGORIES;

const colorOptions = [
  { value: '#8b5cf6', label: 'Roxo' },
  { value: '#2563eb', label: 'Azul' },
  { value: '#16a34a', label: 'Verde' },
  { value: '#ea580c', label: 'Laranja' },
  { value: '#db2777', label: 'Rosa' },
  { value: '#475569', label: 'Cinza' },
];

const emptyForm: RoleFormState = {
  name: '',
  description: '',
  churchId: '',
  color: '#8b5cf6',
  permissions: [],
  isSystem: false,
};

// Flat list of every possible permission id (e.g. "dashboard.view")
const ALL_PERMISSION_IDS = permissionCategories.flatMap((cat) =>
  cat.permissions.map((p) => p.id),
);

function permissionMapToArray(permissions: RoleRecord['permissions']) {
  if (!permissions || typeof permissions !== 'object') return [];
  return Object.entries(permissions)
    .filter(([, allowed]) => Boolean(allowed))
    .map(([key]) => key);
}

// Stores true for checked items AND false for every unchecked item in the catalog,
// so the permission map is always a complete, explicit true/false record.
function permissionArrayToMap(checkedPermissions: string[]) {
  const checked = new Set(checkedPermissions);
  return Object.fromEntries(ALL_PERMISSION_IDS.map((id) => [id, checked.has(id)]));
}

export function Roles() {
  const token = localStorage.getItem('mrm_token');
  const storedUser = (() => { try { return JSON.parse(localStorage.getItem('mrm_user') || '{}'); } catch { return {}; } })();
  const activeFieldId = localStorage.getItem('mrm_active_field_id') || storedUser.campoId || '';
  const isMaster = storedUser.profileType === 'master';
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [churches, setChurches] = useState<ChurchOption[]>([]);
  const [campos, setCampos] = useState<CampoOption[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState(activeFieldId);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RoleRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleRecord | null>(null);
  const [form, setForm] = useState<RoleFormState>(emptyForm);

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const fieldQuery = selectedFieldId ? `?fieldId=${encodeURIComponent(selectedFieldId)}` : '';
      const [rolesResponse, churchesResponse, camposResponse] = await Promise.all([
        fetch(`${apiBase}/roles${fieldQuery}`, { headers }),
        fetch(`${apiBase}/churches${fieldQuery}`, { headers }),
        fetch(`${apiBase}/campos`, { headers }),
      ]);

      if (!rolesResponse.ok) {
        const body = await rolesResponse.json().catch(() => ({}));
        throw new Error(body.error || `Erro ${rolesResponse.status} ao carregar funcoes.`);
      }

      if (!churchesResponse.ok) {
        const body = await churchesResponse.json().catch(() => ({}));
        throw new Error(body.error || `Erro ${churchesResponse.status} ao carregar igrejas.`);
      }

      if (!camposResponse.ok) {
        const body = await camposResponse.json().catch(() => ({}));
        throw new Error(body.error || `Erro ${camposResponse.status} ao carregar campos.`);
      }

      const [rolesPayload, churchesPayload, camposPayload] = await Promise.all([
        rolesResponse.json(),
        churchesResponse.json(),
        camposResponse.json(),
      ]);

      setRoles(Array.isArray(rolesPayload) ? rolesPayload : []);
      setChurches(Array.isArray(churchesPayload) ? churchesPayload : []);
      setCampos(Array.isArray(camposPayload) ? camposPayload : []);
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar funcoes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedFieldId]);

  const setField = (field: keyof RoleFormState, value: string | string[] | boolean) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const openCreateModal = () => {
    setEditingRole(null);
    setForm({ ...emptyForm, churchId: '' });
    setModalOpen(true);
  };

  const openEditModal = (role: RoleRecord) => {
    setEditingRole(role);
    setForm({
      name: role.name || '',
      description: role.description || '',
      churchId: role.churchId || '',
      color: role.color || '#8b5cf6',
      permissions: permissionMapToArray(role.permissions),
      isSystem: Boolean(role.isSystem),
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingRole(null);
    setForm(emptyForm);
  };

  const togglePermission = (permissionId: string) => {
    setForm((previous) => ({
      ...previous,
      permissions: previous.permissions.includes(permissionId)
        ? previous.permissions.filter((permission) => permission !== permissionId)
        : [...previous.permissions, permissionId],
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!form.name.trim()) {
      setError('Nome da funcao e obrigatorio.');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(
        editingRole ? `${apiBase}/roles/${editingRole.id}` : `${apiBase}/roles`,
        {
          method: editingRole ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: JSON.stringify({
            name: form.name.trim(),
            description: form.description.trim() || null,
            churchId: form.churchId || null,
            color: form.color || null,
            permissions: permissionArrayToMap(form.permissions),
            isSystem: form.isSystem,
          }),
        },
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Erro ${response.status} ao salvar funcao.`);
      }

      await loadData();
      closeModal();
    } catch (err: any) {
      setError(err.message || 'Falha ao salvar funcao.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (role: RoleRecord) => {
    setDeleteTarget(role);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setError('');
    setDeleting(true);
    try {
      const response = await fetch(`${apiBase}/roles/${deleteTarget.id}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Erro ${response.status} ao excluir funcao.`);
      }

      await loadData();
      setDeleteTarget(null);
    } catch (err: any) {
      setError(err.message || 'Falha ao excluir funcao.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Funcoes personalizadas</h1>
          <p className="text-slate-600 dark:text-slate-400">
            Cadastre perfis como Tesoureiro, Kids, EBD, Secretario e novos perfis que surgirem.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-700"
        >
          <Plus className="h-4 w-4" />
          Nova Funcao
        </button>
      </div>

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)] md:items-end">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Campo
            {isMaster ? (
              <select
                value={selectedFieldId}
                onChange={(event) => setSelectedFieldId(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              >
                <option value="">Todos os campos</option>
                {campos.map((campo) => (
                  <option key={campo.id} value={campo.id}>{campo.name}</option>
                ))}
              </select>
            ) : (
              <div className="mt-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white">
                {campos.find((campo) => campo.id === selectedFieldId)?.name || storedUser.campoName || 'Campo do usuário logado'}
              </div>
            )}
          </label>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {isMaster ? 'Escolha o campo para filtrar as igrejas disponíveis no escopo da função.' : 'As igrejas abaixo já estão limitadas ao campo do usuário logado.'}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
        Essas funcoes complementam os perfis principais do sistema. Depois de criar aqui, elas aparecem no cadastro e na edicao de usuarios.
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-900/40">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">Funcao</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">Escopo</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">Permissoes</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">Usuarios</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase text-slate-600 dark:text-slate-400">Acoes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                  Carregando funcoes...
                </td>
              </tr>
            ) : roles.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                  Nenhuma funcao cadastrada ainda.
                </td>
              </tr>
            ) : (
              roles.map((role) => (
                <tr key={role.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/20">
                  <td className="px-6 py-4">
                    <div className="flex items-start gap-3">
                      <div
                        className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${role.color || '#8b5cf6'}22` }}
                      >
                        <Shield className="h-5 w-5" style={{ color: role.color || '#8b5cf6' }} />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-white">{role.name}</div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          {role.description || 'Sem descricao informada.'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                    {role.church?.name || 'Todas as igrejas'}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                    {permissionMapToArray(role.permissions).length} permissoes
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                      <Users className="h-3.5 w-3.5" />
                      {role._count?.users ?? 0}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(role)}
                        className="rounded-lg p-2 transition-colors hover:bg-blue-100 dark:hover:bg-blue-900/20"
                        title="Editar funcao"
                      >
                        <Edit className="h-4 w-4 text-blue-600" />
                      </button>
                      <button
                        onClick={() => handleDelete(role)}
                        className="rounded-lg p-2 transition-colors hover:bg-red-100 dark:hover:bg-red-900/20"
                        title="Excluir funcao"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 dark:bg-slate-800">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {editingRole ? 'Editar funcao' : 'Nova funcao'}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Cadastre funcoes novas para aparecerem na selecao de usuarios.
                </p>
              </div>
              <button
                onClick={closeModal}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {isMaster ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_minmax(0,1fr)] md:items-end">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Campo
                    </label>
                    <select
                      value={selectedFieldId}
                      onChange={(event) => setSelectedFieldId(event.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                    >
                      <option value="">Todos os campos</option>
                      {campos.map((campo) => (
                        <option key={campo.id} value={campo.id}>{campo.name}</option>
                      ))}
                    </select>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Escolha o campo para filtrar as igrejas disponiveis no escopo da funcao.
                  </p>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Nome da funcao
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(event) => setField('name', event.target.value)}
                    placeholder="Ex.: Tesoureiro"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Escopo da funcao
                  </label>
                  <select
                    value={form.churchId}
                    onChange={(event) => setField('churchId', event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  >
                    <option value="">Todas as igrejas</option>
                    {churches.map((church) => (
                      <option key={church.id} value={church.id}>
                        {church.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_180px]">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Descricao
                  </label>
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(event) => setField('description', event.target.value)}
                    placeholder="Ex.: Responsavel pelos lancamentos e relatorios financeiros"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Cor
                  </label>
                  <select
                    value={form.color}
                    onChange={(event) => setField('color', event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  >
                    {colorOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-3 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Permissoes da funcao
                </label>
                <div className="max-h-[360px] space-y-4 overflow-y-auto rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                  {permissionCategories.map((category) => (
                    <div key={category.name}>
                      <h3 className="mb-2 font-semibold text-slate-900 dark:text-white">{category.name}</h3>
                      <div className="space-y-2">
                        {category.permissions.map((permission) => (
                          <label key={permission.id} className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
                            <input
                              type="checkbox"
                              checked={form.permissions.includes(permission.id)}
                              onChange={() => togglePermission(permission.id)}
                              className="h-4 w-4 accent-purple-600"
                            />
                            <span>{permission.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-60"
                >
                  {saving ? 'Salvando...' : editingRole ? 'Salvar alteracoes' : 'Criar funcao'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Excluir função"
        message={`Tem certeza que deseja excluir a função "${deleteTarget?.name || ''}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        variant="danger"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => (deleting ? null : setDeleteTarget(null))}
      />
    </div>
  );
}
