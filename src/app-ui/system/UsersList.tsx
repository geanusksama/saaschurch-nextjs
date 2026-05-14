import { useEffect, useState } from 'react';
import { Users, Plus, Search, Trash2, Edit, RefreshCw, Lock } from 'lucide-react';
import { Link } from 'react-router';
import { AlertDialog, ConfirmDialog } from '../../components/app-ui/shared/ConfirmDialog';

import { apiBase } from '../../lib/apiBase';

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

export default function UsersList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState('');

  const token = localStorage.getItem('mrm_token');
  const activeFieldId = localStorage.getItem('mrm_active_field_id') || '';

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (activeFieldId) {
        params.set('campoId', activeFieldId);
      }

      const res = await fetch(`${apiBase}/users${params.toString() ? `?${params.toString()}` : ''}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Erro ${res.status}`);
      }
      setUsers(await res.json());
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar usuários.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = (id: string) => {
    setConfirmTarget(id);
  };

  const confirmDelete = async () => {
    if (!confirmTarget) return;
    const id = confirmTarget;
    setDeletingId(id);
    try {
      const res = await fetch(`${apiBase}/users/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Falha ao excluir.');
      setUsers((prev) => prev.filter((u: any) => u.id !== id));
      setConfirmTarget(null);
    } catch (err: any) {
      setAlertMessage(err.message || 'Não foi possível excluir.');
      setConfirmTarget(null);
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = users.filter((u: any) =>
    u.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 text-slate-900 dark:text-slate-100">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6 text-slate-600 dark:text-slate-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Usuários do Sistema</h1>
            <p className="text-slate-600 dark:text-slate-400">Gerencie os usuários e permissões</p>
          </div>
        </div>
        <Link to="/app-ui/system/users/new" className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" />
          Novo Usuário
        </Link>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-lg text-sm flex items-center justify-between">
          <span>{error}</span>
          <div className="flex items-center gap-3">
            {(error.includes('autenticad') || error.includes('401') || error.includes('403')) && (
              <Link to="/auth/login" className="text-purple-600 hover:text-purple-800 font-medium underline">
                Fazer login
              </Link>
            )}
            <button onClick={load} className="flex items-center gap-1 text-red-600 hover:text-red-800 font-medium">
              <RefreshCw className="w-4 h-4" /> Tentar novamente
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-6">
        {activeFieldId ? (
          <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
            Listando usuários somente do campo ativo selecionado.
          </div>
        ) : null}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar usuários..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-500 dark:text-slate-400">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-slate-400 dark:text-slate-500">Nenhum usuário encontrado.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Usuário</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Telefone</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Perfil</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Vinculo</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Função</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filtered.map((user: any) => (
                <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                        <span className="font-bold text-purple-600">
                          {user.fullName?.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                        </span>
                      </div>
                      <span className="font-medium text-slate-900 dark:text-slate-100">{user.fullName}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{user.email}</td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{user.phone || '—'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${PROFILE_COLORS[user.profileType] || 'bg-slate-100 text-slate-700'}`}>
                      {PROFILE_LABELS[user.profileType] || user.profileType}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                    <div className="space-y-1">
                      <div>{user.campo?.name || 'Sem campo'}</div>
                      <div className="text-xs text-slate-400 dark:text-slate-500">{user.regional?.name || 'Sem regional'}</div>
                      <div className="text-xs text-slate-400 dark:text-slate-500">{user.church?.name || 'Sem igreja'}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {user.role ? (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
                        {user.role.name}
                      </span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {user.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/app-ui/system/users/${user.id}/permissions`}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        title="Permissões"
                      >
                        <Lock className="w-4 h-4 text-slate-500" />
                      </Link>
                      <Link
                        to={`/app-ui/system/users/${user.id}/edit`}
                        className="p-1.5 hover:bg-blue-100 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4 text-blue-600" />
                      </Link>
                      <button
                        onClick={() => handleDelete(user.id)}
                        disabled={deletingId === user.id}
                        className="p-1.5 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        title="Excluir usuário"
        message="Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        variant="danger"
        loading={Boolean(deletingId)}
        onConfirm={confirmDelete}
        onCancel={() => (deletingId ? null : setConfirmTarget(null))}
      />

      <AlertDialog
        open={Boolean(alertMessage)}
        title="Atenção"
        message={alertMessage}
        variant="warning"
        onClose={() => setAlertMessage('')}
      />
    </div>
  );
}
