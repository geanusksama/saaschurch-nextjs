import { useState, useEffect, useCallback } from 'react';
import { UserPlus, Search, CheckCircle2, XCircle, Clock, Eye, Users } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';

function getContext() {
  try {
    const user = JSON.parse(localStorage.getItem('mrm_user') || '{}');
    const fieldId = localStorage.getItem('mrm_active_field_id') || user.campoId || '';
    const token = localStorage.getItem('mrm_token') ?? '';
    return { fieldId, token };
  } catch { return { fieldId: '', token: '' }; }
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PENDENTE:  { label: 'Pendente',  color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock },
  APROVADO:  { label: 'Aprovado',  color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',   icon: CheckCircle2 },
  REJEITADO: { label: 'Rejeitado', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',           icon: XCircle },
  VINCULADO: { label: 'Vinculado', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',       icon: CheckCircle2 },
};

type Cadastro = {
  id: string;
  user_id: string | null;
  nome: string;
  email: string;
  headquarters_id: string | null;
  is_member: boolean;
  member_id: string | null;
  status: string;
  created_at: string;
  observacoes: string | null;
};

export default function AppRegistrations() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<Cadastro | null>(null);
  const [nota, setNota] = useState('');
  const [hqId, setHqId] = useState<string | null>(null);

  const loadHqId = useCallback(async () => {
    const { fieldId, token } = getContext();
    if (!fieldId) return;
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/headquarters?fieldId=${fieldId}`, { headers });
      if (!res.ok) return;
      const list = await res.json();
      if (list.length) setHqId(list[0].id);
    } catch { /* sem HQ */ }
  }, []);

  useEffect(() => { loadHqId(); }, [loadHqId]);

  const { data: cadastros = [], isLoading } = useQuery({
    queryKey: ['app-cadastros', hqId],
    queryFn: async () => {
      let query = supabase
        .from('app_cadastros')
        .select('id, user_id, nome, email, headquarters_id, is_member, member_id, status, created_at, observacoes')
        .order('created_at', { ascending: false });
      if (hqId) {
        // Mostra registros do campo + registros sem HQ (backfill antigo)
        query = query.or(`headquarters_id.eq.${hqId},headquarters_id.is.null`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Cadastro[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, observacoes }: { id: string; status: string; observacoes?: string }) => {
      const { error } = await supabase.from('app_cadastros')
        .update({ status, ...(observacoes !== undefined ? { observacoes } : {}) })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-cadastros'] });
      setSelected(null);
      setNota('');
    },
  });

  const filtered = cadastros.filter(c => {
    const matchSearch = !search ||
      (c.nome ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (c.email ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const pending = cadastros.filter(c => c.status === 'PENDENTE').length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
          <UserPlus className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Cadastros no App</h1>
          <p className="text-slate-500 dark:text-slate-400">Usuários que se cadastraram pelo app móvel</p>
        </div>
      </div>

      {pending > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 text-sm text-yellow-800 dark:text-yellow-300">
          <strong>{pending}</strong> cadastro(s) pendente(s) de aprovação.
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome ou email..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
          />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-slate-400">Carregando cadastros...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400">Nenhum cadastro encontrado</p>
          <p className="text-xs text-slate-400 mt-1">Os usuários que se cadastrarem pelo app aparecerão aqui</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                <th className="text-left px-4 py-3 text-slate-600 dark:text-slate-400 font-medium">Nome</th>
                <th className="text-left px-4 py-3 text-slate-600 dark:text-slate-400 font-medium">Email</th>
                <th className="text-left px-4 py-3 text-slate-600 dark:text-slate-400 font-medium">Membro</th>
                <th className="text-left px-4 py-3 text-slate-600 dark:text-slate-400 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-slate-600 dark:text-slate-400 font-medium">Data</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const s = STATUS_LABELS[c.status] ?? { label: c.status, color: 'bg-slate-100 text-slate-600', icon: Clock };
                const SIcon = s.icon;
                return (
                  <tr key={c.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{c.nome || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{c.email}</td>
                    <td className="px-4 py-3">
                      {c.is_member
                        ? <span className="text-xs text-green-600 font-medium">Sim</span>
                        : <span className="text-xs text-slate-400">Não</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
                        <SIcon className="w-3 h-3" />
                        {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => { setSelected(c); setNota(c.observacoes ?? ''); }} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500" title="Ver detalhes">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Detalhes do Cadastro</h2>
            <dl className="text-sm space-y-2">
              {([
                ['Nome', selected.nome || '—'],
                ['Email', selected.email],
                ['Membro de igreja', selected.is_member ? 'Sim' : 'Não'],
                ['Status', STATUS_LABELS[selected.status]?.label ?? selected.status],
                ['Data de cadastro', new Date(selected.created_at).toLocaleString('pt-BR')],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-slate-500 shrink-0">{k}</dt>
                  <dd className="text-slate-900 dark:text-white text-right">{v}</dd>
                </div>
              ))}
            </dl>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Observações</label>
              <textarea value={nota} onChange={e => setNota(e.target.value)} rows={2}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Notas do administrador..."
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => { setSelected(null); setNota(''); }} className="flex-1 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50">
                Fechar
              </button>
              {selected.status === 'PENDENTE' && (
                <>
                  <button onClick={() => updateMutation.mutate({ id: selected.id, status: 'REJEITADO', observacoes: nota })} disabled={updateMutation.isPending}
                    className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                    Rejeitar
                  </button>
                  <button onClick={() => updateMutation.mutate({ id: selected.id, status: 'APROVADO', observacoes: nota })} disabled={updateMutation.isPending}
                    className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                    Aprovar
                  </button>
                </>
              )}
              {selected.status === 'APROVADO' && (
                <button onClick={() => updateMutation.mutate({ id: selected.id, status: 'VINCULADO', observacoes: nota })} disabled={updateMutation.isPending}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  Marcar como Vinculado
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
