import { useState } from 'react';
import { useNavigate } from 'react-router';
import { LayoutGrid, Plus, Pencil, Trash2, Search } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem('mrm_user') || '{}'); } catch { return {}; }
}

interface Department {
  id: string;
  nome: string;
  descricao?: string;
  icone?: string;
  cor?: string;
  slug?: string;
  ordem: number;
  ativo: boolean;
  church_id?: string;
}

export default function AppEventDepartments() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState({ nome: '', descricao: '', cor: '#8b5cf6', ordem: '0', ativo: true });
  const [error, setError] = useState('');
  const user = getStoredUser();
  const churchId: string | undefined = user.churchId;

  const { data: departments = [], isLoading } = useQuery({
    queryKey: ['event-departments', churchId],
    queryFn: async () => {
      let query = supabase.from('event_departments').select('*').order('ordem');
      if (churchId) query = query.eq('church_id', churchId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Department[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        nome: form.nome,
        descricao: form.descricao || null,
        cor: form.cor,
        ordem: parseInt(form.ordem) || 0,
        ativo: form.ativo,
      };
      if (!editing) {
        if (!churchId) throw new Error('Igreja não identificada. Faça login novamente.');
        payload.church_id = churchId;
      }
      if (editing) {
        const { error } = await supabase.from('event_departments').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('event_departments').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-departments'] });
      closeModal();
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('event_departments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event-departments'] }),
  });

  const openNew = () => {
    setEditing(null);
    setForm({ nome: '', descricao: '', cor: '#8b5cf6', ordem: '0', ativo: true });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (d: Department) => {
    setEditing(d);
    setForm({ nome: d.nome, descricao: d.descricao ?? '', cor: d.cor ?? '#8b5cf6', ordem: String(d.ordem), ativo: d.ativo });
    setError('');
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditing(null); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) { setError('Nome é obrigatório'); return; }
    setError('');
    saveMutation.mutate();
  };

  const filtered = departments.filter(d => d.nome.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <LayoutGrid className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Departamentos</h1>
            <p className="text-slate-500 dark:text-slate-400">Categorias organizadoras dos eventos</p>
          </div>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium">
          <Plus className="w-4 h-4" />
          Novo Departamento
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar departamentos..." 
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-slate-400">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <LayoutGrid className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400">Nenhum departamento encontrado</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(d => (
            <div key={d.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: d.cor ?? '#8b5cf6' + '20' }}>
                    <span className="text-sm">📁</span>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{d.nome}</p>
                    {d.descricao && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{d.descricao}</p>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0 ml-2">
                  <button onClick={() => openEdit(d)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => { if (confirm('Excluir este departamento?')) deleteMutation.mutate(d.id); }}
                    className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${d.ativo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                  {d.ativo ? 'Ativo' : 'Inativo'}
                </span>
                <span className="text-xs text-slate-400">Ordem: {d.ordem}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
              {editing ? 'Editar Departamento' : 'Novo Departamento'}
            </h2>
            {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome *</label>
                <input type="text" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Descrição</label>
                <textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cor</label>
                  <input type="color" value={form.cor} onChange={e => setForm(f => ({ ...f, cor: e.target.value }))}
                    className="w-full h-10 border border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Ordem</label>
                  <input type="number" value={form.ordem} onChange={e => setForm(f => ({ ...f, ordem: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="ativo" checked={form.ativo} onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} className="w-4 h-4 accent-blue-600" />
                <label htmlFor="ativo" className="text-sm text-slate-700 dark:text-slate-300">Ativo</label>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
                  Cancelar
                </button>
                <button type="submit" disabled={saveMutation.isPending} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                  {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
