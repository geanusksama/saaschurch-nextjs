import { useState } from 'react';
import { Heart, Plus, Pencil, Trash2, Search, Users, Music2, Mic2, HandHeart, BookOpen, Camera, Radio, Baby, Sparkles, Shield, GraduationCap, CheckCircle, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem('mrm_user') || '{}'); } catch { return {}; }
}

type Ministry = {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  is_active: boolean;
  email?: string | null;
  phone?: string | null;
  leader?: { id: string; full_name: string } | null;
  member_count?: number;
};

type Member = { id: string; full_name: string };

const ICONS: Array<{ key: string; label: string; icon: LucideIcon }> = [
  { key: 'heart',          label: 'Cuidado',       icon: Heart },
  { key: 'music',          label: 'Louvor',        icon: Music2 },
  { key: 'mic',            label: 'Pregação',      icon: Mic2 },
  { key: 'hand-heart',     label: 'Ação social',   icon: HandHeart },
  { key: 'book-open',      label: 'Ensino',        icon: BookOpen },
  { key: 'camera',         label: 'Mídia',         icon: Camera },
  { key: 'radio',          label: 'Comunicação',   icon: Radio },
  { key: 'baby',           label: 'Infantil',      icon: Baby },
  { key: 'users',          label: 'Equipe',        icon: Users },
  { key: 'sparkles',       label: 'Jovens',        icon: Sparkles },
  { key: 'shield',         label: 'Intercessão',   icon: Shield },
  { key: 'graduation-cap', label: 'Discipulado',   icon: GraduationCap },
];

function getIcon(key?: string | null): LucideIcon {
  return ICONS.find(i => i.key === key)?.icon ?? Heart;
}

const EMPTY_FORM = {
  name: '', description: '', email: '', phone: '',
  color: '#8b5cf6', icon: 'heart', is_active: true, leader_id: '',
};

export default function AppMinistries() {
  const queryClient = useQueryClient();
  const user = getStoredUser();
  const churchId: string | undefined = user.churchId;

  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Ministry | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  const { data: ministries = [], isLoading } = useQuery({
    queryKey: ['app-ministries', churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from('ministries')
        .select(`
          id, name, description, color, icon, is_active, email, phone,
          leader:members!leader_id(id, full_name)
        `)
        .eq('church_id', churchId)
        .is('deleted_at', null)
        .order('name');
      if (error) throw error;
      return (data ?? []) as Ministry[];
    },
    enabled: !!churchId,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['app-ministries-members', churchId],
    queryFn: async () => {
      if (!churchId) return [];
      const { data, error } = await supabase
        .from('members')
        .select('id, full_name')
        .eq('church_id', churchId)
        .eq('status', 'active')
        .order('full_name');
      if (error) throw error;
      return (data ?? []) as Member[];
    },
    enabled: !!churchId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!churchId) throw new Error('Igreja não identificada. Faça login novamente.');
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description || null,
        email: form.email || null,
        phone: form.phone || null,
        color: form.color,
        icon: form.icon,
        is_active: form.is_active,
        leader_id: form.leader_id || null,
      };
      if (editing) {
        const { error } = await supabase.from('ministries').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        payload.church_id = churchId;
        const { error } = await supabase.from('ministries').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-ministries'] });
      closeModal();
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ministries')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['app-ministries'] }),
  });

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (m: Ministry) => {
    setEditing(m);
    setForm({
      name: m.name,
      description: m.description ?? '',
      email: m.email ?? '',
      phone: m.phone ?? '',
      color: m.color ?? '#8b5cf6',
      icon: m.icon ?? 'heart',
      is_active: m.is_active,
      leader_id: m.leader?.id ?? '',
    });
    setError('');
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditing(null); };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Nome é obrigatório'); return; }
    setError('');
    saveMutation.mutate();
  };

  const filtered = ministries.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    (m.description ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = ministries.filter(m => m.is_active).length;

  if (!churchId) {
    return (
      <div className="p-6 text-center py-24">
        <p className="text-slate-500 dark:text-slate-400">Igreja não identificada. Faça login novamente.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
            <Heart className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Ministérios</h1>
            <p className="text-slate-500 dark:text-slate-400">Departamentos ministeriais publicados no app</p>
          </div>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm font-medium">
          <Plus className="w-4 h-4" />
          Novo Ministério
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{ministries.length}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Total de Ministérios</p>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <p className="text-2xl font-bold text-purple-600">{activeCount}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Ativos no App</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome..."
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-900 dark:text-white"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-16 text-slate-400">Carregando ministérios...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Heart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400">Nenhum ministério encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(m => {
            const Icon = getIcon(m.icon);
            const bg = (m.color ?? '#8b5cf6') + '25';
            return (
              <div key={m.id}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: bg }}>
                  <Icon className="w-5 h-5" style={{ color: m.color ?? '#8b5cf6' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">{m.name}</p>
                    {m.is_active
                      ? <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full shrink-0"><CheckCircle className="w-3 h-3" />Ativo</span>
                      : <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-full shrink-0"><XCircle className="w-3 h-3" />Inativo</span>
                    }
                  </div>
                  {m.description && <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{m.description}</p>}
                  {m.leader && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      Líder: {m.leader.full_name}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(m)}
                    className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => { if (confirm(`Excluir ministério "${m.name}"?`)) deleteMutation.mutate(m.id); }}
                    className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl my-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
              {editing ? 'Editar Ministério' : 'Novo Ministério'}
            </h2>
            {error && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome *</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-900 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Descrição</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-900 dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Ícone</label>
                  <select value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-900 dark:text-white">
                    {ICONS.map(i => <option key={i.key} value={i.key}>{i.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cor</label>
                  <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                    className="w-full h-10 border border-slate-300 dark:border-slate-600 rounded-lg cursor-pointer" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Líder</label>
                <select value={form.leader_id} onChange={e => setForm(f => ({ ...f, leader_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-900 dark:text-white">
                  <option value="">— Sem líder definido —</option>
                  {members.map(mb => <option key={mb.id} value={mb.id}>{mb.full_name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-900 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Telefone</label>
                  <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-slate-900 dark:text-white" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="ministry_active" checked={form.is_active}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                  className="w-4 h-4 accent-purple-600" />
                <label htmlFor="ministry_active" className="text-sm text-slate-700 dark:text-slate-300">
                  Ativo (visível no app)
                </label>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={closeModal}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
                  Cancelar
                </button>
                <button type="submit" disabled={saveMutation.isPending}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
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
