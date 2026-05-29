import { useState, useEffect } from 'react';
import { UserPlus, Search, CheckCircle2, XCircle, Clock, Eye, Users, Link2, Trash2, CheckSquare } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';

function getToken(): string {
  try { return localStorage.getItem('mrm_token') ?? ''; } catch { return ''; }
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
  campo_id: string | null;
  campo_name: string | null;
  campo_name_resolved: string | null;
  headquarters_id: string | null;
  is_member: boolean;
  member_id: string | null;
  status: string;
  created_at: string;
  observacoes: string | null;
};

type MemberResult = { id: string; label: string; sub: string };

export default function AppRegistrations() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('PENDENTE');
  const [campoFilter, setCampoFilter] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selected, setSelected] = useState<Cadastro | null>(null);
  const [nota, setNota] = useState('');
  const [ready, setReady] = useState(false);

  // Member linking state
  const [memberSearch, setMemberSearch] = useState('');
  const [memberResults, setMemberResults] = useState<MemberResult[]>([]);
  const [linkedMember, setLinkedMember] = useState<MemberResult | null>(null);
  const [memberSearching, setMemberSearching] = useState(false);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkConfirmDelete, setBulkConfirmDelete] = useState(false);

  useEffect(() => { setReady(true); }, []);

  const { data: cadastros = [], isLoading, isError } = useQuery({
    queryKey: ['app-cadastros'],
    enabled: ready,
    queryFn: async () => {
      const token = getToken();
      const res = await fetch('/api/app-registrations', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Erro ao carregar cadastros (${res.status})`);
      return res.json() as Promise<Cadastro[]>;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = getToken();
      const res = await fetch(`/api/app-registrations/${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Erro ao excluir cadastro');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-cadastros'] });
      setSelected(null);
      setNota('');
      setLinkedMember(null);
      setMemberSearch('');
      setMemberResults([]);
      setConfirmDelete(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, observacoes, member_id }: { id: string; status: string; observacoes?: string; member_id?: string }) => {
      const token = getToken();
      const payload: Record<string, unknown> = { status };
      if (observacoes !== undefined) payload.observacoes = observacoes;
      if (member_id !== undefined) payload.member_id = member_id;
      const res = await fetch(`/api/app-registrations/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Erro ao atualizar cadastro');
      return status;
    },
    onSuccess: (newStatus) => {
      queryClient.invalidateQueries({ queryKey: ['app-cadastros'] });
      // Muda o filtro para o novo status para o usuário ver onde o registro foi parar
      setStatusFilter(newStatus ?? '');
      setSelected(null);
      setNota('');
      setLinkedMember(null);
      setMemberSearch('');
      setMemberResults([]);
      setConfirmDelete(false);
    },
  });

  async function searchMemberByCpf(cpfInput: string) {
    const cpf = cpfInput.replace(/\D/g, '');
    if (cpf.length < 11) { setMemberResults([]); return; }
    setMemberSearching(true);
    try {
      const { data } = await supabase
        .from('members')
        .select('id, full_name, rol, cpf, churches(name)')
        .eq('cpf', cpf)
        .limit(1);
      if (data && data.length > 0) {
        const m = data[0] as any;
        const result: MemberResult = {
          id: m.id,
          label: m.full_name,
          sub: [m.rol ? `ROL ${m.rol}` : '', Array.isArray(m.churches) ? m.churches[0]?.name : m.churches?.name].filter(Boolean).join(' - '),
        };
        setMemberResults([result]);
        setLinkedMember(result);
      } else {
        setMemberResults([]);
        setLinkedMember(null);
      }
    } finally {
      setMemberSearching(false);
    }
  }

  function openDetail(c: Cadastro) {
    setSelected(c);
    setNota(c.observacoes ?? '');
    setLinkedMember(null);
    setMemberSearch('');
    setMemberResults([]);
    setConfirmDelete(false);
  }

  // Bulk action helpers
  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? new Set(filtered.map(c => c.id)) : new Set());
  }
  function toggleOne(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function bulkAction(action: 'approve' | 'reject' | 'delete') {
    if (!selectedIds.size) return;
    setBulkLoading(true);
    setBulkConfirmDelete(false);
    try {
      const token = getToken();
      const ids = Array.from(selectedIds);
      if (action === 'delete') {
        await Promise.all(ids.map(id =>
          fetch(`/api/app-registrations/${id}`, {
            method: 'DELETE',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          })
        ));
      } else {
        const status = action === 'approve' ? 'APROVADO' : 'REJEITADO';
        await Promise.all(ids.map(id =>
          fetch(`/api/app-registrations/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify({ status }),
          })
        ));
      }
      queryClient.invalidateQueries({ queryKey: ['app-cadastros'] });
      setSelectedIds(new Set());
      // Muda filtro para mostrar os registros que acabaram de ser processados
      if (action === 'approve') setStatusFilter('APROVADO');
      else if (action === 'reject') setStatusFilter('REJEITADO');
      else setStatusFilter('');
    } finally {
      setBulkLoading(false);
    }
  }

  const camposOptions = Array.from(
    new Set(cadastros.map(c => c.campo_name_resolved || c.campo_name || '').filter(Boolean))
  ).sort();

  const filtered = cadastros.filter(c => {
    const matchSearch = !search ||
      (c.nome ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (c.email ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || c.status === statusFilter;
    const campoResolved = c.campo_name_resolved || c.campo_name || '';
    const matchCampo = !campoFilter || campoResolved === campoFilter;
    return matchSearch && matchStatus && matchCampo;
  });

  const pending = cadastros.filter(c => c.status === 'PENDENTE').length;
  const allFilteredSelected = filtered.length > 0 && filtered.every(c => selectedIds.has(c.id));
  const someSelected = selectedIds.size > 0;

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
        <select value={campoFilter} onChange={e => setCampoFilter(e.target.value)}
          className="px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
        >
          <option value="">Todos os campos</option>
          {camposOptions.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Barra de ações em massa */}
      {someSelected && (
        <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3 flex-wrap">
          <span className="text-sm font-medium text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
            <CheckSquare className="w-4 h-4" />
            {selectedIds.size} selecionado(s)
          </span>
          <div className="flex gap-2 ml-auto flex-wrap">
            <button
              onClick={() => bulkAction('approve')}
              disabled={bulkLoading}
              className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {bulkLoading ? '...' : 'Aprovar todos'}
            </button>
            <button
              onClick={() => bulkAction('reject')}
              disabled={bulkLoading}
              className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
            >
              {bulkLoading ? '...' : 'Rejeitar todos'}
            </button>
            {bulkConfirmDelete ? (
              <>
                <span className="text-xs text-red-600 font-medium self-center">Confirmar exclusão?</span>
                <button onClick={() => setBulkConfirmDelete(false)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50">Cancelar</button>
                <button
                  onClick={() => bulkAction('delete')}
                  disabled={bulkLoading}
                  className="px-3 py-1.5 bg-red-700 text-white rounded-lg text-sm font-medium hover:bg-red-800 disabled:opacity-50"
                >
                  {bulkLoading ? '...' : 'Excluir'}
                </button>
              </>
            ) : (
              <button
                onClick={() => setBulkConfirmDelete(true)}
                disabled={bulkLoading}
                className="px-3 py-1.5 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50"
              >
                Excluir todos
              </button>
            )}
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Limpar seleção
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-16 text-slate-400">Carregando cadastros...</div>
      ) : isError ? (
        <div className="text-center py-16">
          <XCircle className="w-12 h-12 text-red-300 mx-auto mb-3" />
          <p className="text-red-500 dark:text-red-400 font-medium">Erro ao carregar cadastros</p>
          <p className="text-xs text-slate-400 mt-1">Verifique sua conexão ou tente recarregar a página</p>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['app-cadastros'] })}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            Tentar novamente
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400">Nenhum cadastro encontrado</p>
          {statusFilter ? (
            <button onClick={() => setStatusFilter('')} className="mt-2 text-xs text-blue-500 hover:underline">
              Mostrar todos os status
            </button>
          ) : (
            <p className="text-xs text-slate-400 mt-1">Os usuários que se cadastrarem pelo app aparecerão aqui</p>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={e => toggleAll(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer"
                  />
                </th>
                <th className="text-left px-4 py-3 text-slate-600 dark:text-slate-400 font-medium">Nome</th>
                <th className="text-left px-4 py-3 text-slate-600 dark:text-slate-400 font-medium">Email</th>
                <th className="text-left px-4 py-3 text-slate-600 dark:text-slate-400 font-medium">Campo</th>
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
                const isChecked = selectedIds.has(c.id);
                return (
                  <tr key={c.id} className={`border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 ${isChecked ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleOne(c.id)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{c.nome || '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{c.email}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {c.campo_name_resolved || c.campo_name || <span className="text-slate-300">—</span>}
                    </td>
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
                      <button onClick={() => openDetail(c)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500" title="Ver detalhes">
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
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Detalhes do Cadastro</h2>
            <dl className="text-sm space-y-2">
              {([
                ['Nome', selected.nome || '—'],
                ['Email', selected.email],
                ['Campo', selected.campo_name_resolved || selected.campo_name || '—'],
                ['Membro de igreja', selected.is_member ? 'Sim' : 'Não'],
                ['Status', STATUS_LABELS[selected.status]?.label ?? selected.status],
                ['Data de cadastro', new Date(selected.created_at).toLocaleString('pt-BR')],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-slate-500 shrink-0">{k}</dt>
                  <dd className="text-slate-900 dark:text-white text-right">{v}</dd>
                </div>
              ))}
              {selected.member_id && (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500 shrink-0">ID do membro vinculado</dt>
                  <dd className="text-blue-600 dark:text-blue-400 text-right text-xs font-mono truncate max-w-[180px]">{selected.member_id}</dd>
                </div>
              )}
            </dl>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Observações</label>
              <textarea value={nota} onChange={e => setNota(e.target.value)} rows={2}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Notas do administrador..."
              />
            </div>

            {/* Vinculação de membro (opcional) */}
            {selected.status === 'PENDENTE' && (
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-2 bg-slate-50 dark:bg-slate-900/30">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <Link2 className="w-3.5 h-3.5" /> Vincular a membro existente (opcional)
                </p>
                {selected.is_member && (
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    O usuário informou que já é membro da igreja.
                  </p>
                )}
                {linkedMember ? (
                  <div className="flex items-center justify-between bg-white dark:bg-slate-700 rounded-lg px-3 py-2 border border-green-200 dark:border-green-800">
                    <div>
                      <p className="text-xs text-green-600 dark:text-green-400 font-medium mb-0.5">Membro encontrado</p>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{linkedMember.label}</p>
                      <p className="text-xs text-slate-500">{linkedMember.sub}</p>
                    </div>
                    <button
                      onClick={() => { setLinkedMember(null); setMemberSearch(''); setMemberResults([]); }}
                      className="text-xs text-red-500 hover:text-red-700 ml-2"
                    >
                      Trocar
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={memberSearch}
                      onChange={e => setMemberSearch(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && searchMemberByCpf(memberSearch)}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      className="flex-1 px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono tracking-wider"
                    />
                    <button
                      onClick={() => searchMemberByCpf(memberSearch)}
                      disabled={memberSearching || memberSearch.replace(/\D/g, '').length < 11}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                      {memberSearching ? '…' : 'Buscar'}
                    </button>
                  </div>
                )}
                <p className="text-xs text-slate-400">
                  Pesquise o CPF para vincular ao cadastro de membro, ou aprove diretamente sem vínculo.
                </p>
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
              {confirmDelete ? (
                <>
                  <p className="w-full text-sm text-red-600 font-medium">Isso apagará o cadastro e o usuário do sistema. Confirmar?</p>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(selected.id)}
                    disabled={deleteMutation.isPending}
                    className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleteMutation.isPending ? 'Excluindo...' : 'Confirmar Exclusão'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => { setSelected(null); setNota(''); setLinkedMember(null); setMemberSearch(''); setMemberResults([]); setConfirmDelete(false); }}
                    className="flex-1 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50"
                  >
                    Fechar
                  </button>
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="p-2 border border-red-300 dark:border-red-800 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                    title="Excluir cadastro e usuário"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {selected.status === 'PENDENTE' && (
                    <>
                      <button
                        onClick={() => updateMutation.mutate({ id: selected.id, status: 'REJEITADO', observacoes: nota })}
                        disabled={updateMutation.isPending}
                        className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                      >
                        Rejeitar
                      </button>
                      {linkedMember ? (
                        <button
                          onClick={() => updateMutation.mutate({ id: selected.id, status: 'VINCULADO', observacoes: nota, member_id: linkedMember.id })}
                          disabled={updateMutation.isPending}
                          className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                        >
                          Vincular Membro
                        </button>
                      ) : (
                        <button
                          onClick={() => updateMutation.mutate({ id: selected.id, status: 'APROVADO', observacoes: nota })}
                          disabled={updateMutation.isPending}
                          className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                        >
                          Aprovar
                        </button>
                      )}
                    </>
                  )}
                  {selected.status === 'APROVADO' && (
                    <button
                      onClick={() => updateMutation.mutate({ id: selected.id, status: 'VINCULADO', observacoes: nota })}
                      disabled={updateMutation.isPending}
                      className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                      Marcar como Vinculado
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
