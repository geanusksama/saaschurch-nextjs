import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Ticket, Plus, Search, Pencil, Eye, Calendar, MoreHorizontal, Star } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem('mrm_user') || '{}'); } catch { return {}; }
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  RASCUNHO:   { label: 'Rascunho',  color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
  PUBLICADO:  { label: 'Publicado', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  ENCERRADO:  { label: 'Encerrado', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  CANCELADO:  { label: 'Cancelado', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

export default function AppEvents() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const user = getStoredUser();
  const churchId: string | undefined = user.churchId;

  const toggleFeatured = useMutation({
    mutationFn: async ({ id, current }: { id: string; current: boolean }) => {
      const { error } = await supabase
        .from('app_events')
        .update({ is_featured: !current })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['app-events', churchId] }),
  });

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['app-events', churchId],
    queryFn: async () => {
      let query = supabase
        .from('app_events')
        .select('id, nome, status, data_inicio, data_fim, gratuito, preco, capacidade_total, quantidade_disponivel, tipo_evento, is_featured')
        .is('deleted_at', null)
        .order('data_inicio', { ascending: false });
      if (churchId) query = query.eq('church_id', churchId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = events.filter((e: { nome: string }) =>
    e.nome.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
            <Ticket className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Eventos com Ingressos</h1>
            <p className="text-slate-500 dark:text-slate-400">Gerencie os eventos do app móvel</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/app-ui/app/events/new')}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Novo Evento
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar eventos..."
          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-slate-400">Carregando eventos...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Ticket className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400">Nenhum evento encontrado</p>
          <button
            onClick={() => navigate('/app-ui/app/events/new')}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700"
          >
            Criar primeiro evento
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                <th className="text-left px-4 py-3 text-slate-600 dark:text-slate-400 font-medium">Evento</th>
                <th className="text-left px-4 py-3 text-slate-600 dark:text-slate-400 font-medium">Data</th>
                <th className="text-left px-4 py-3 text-slate-600 dark:text-slate-400 font-medium">Tipo</th>
                <th className="text-left px-4 py-3 text-slate-600 dark:text-slate-400 font-medium">Preço</th>
                <th className="text-left px-4 py-3 text-slate-600 dark:text-slate-400 font-medium">Status</th>
                <th className="text-center px-4 py-3 text-slate-600 dark:text-slate-400 font-medium">Destaque</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ev: {
                id: string; nome: string; status: string; data_inicio: string;
                gratuito: boolean; preco: number; tipo_evento: string; is_featured: boolean;
              }) => {
                const s = STATUS_LABELS[ev.status] ?? { label: ev.status, color: 'bg-slate-100 text-slate-600' };
                return (
                  <tr key={ev.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{ev.nome}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(ev.data_inicio).toLocaleDateString('pt-BR')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{ev.tipo_evento === 'COM_ASSENTO' ? 'Com assento' : 'Livre'}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {ev.gratuito ? <span className="text-green-600 font-medium">Gratuito</span> : `R$ ${Number(ev.preco).toFixed(2)}`}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.color}`}>{s.label}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleFeatured.mutate({ id: ev.id, current: ev.is_featured })}
                        title={ev.is_featured ? 'Remover destaque' : 'Destacar no app'}
                        className={`p-1.5 rounded-lg transition ${
                          ev.is_featured
                            ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                            : 'text-slate-300 hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        <Star className="w-4 h-4" fill={ev.is_featured ? 'currentColor' : 'none'} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => navigate(`/app-ui/app/events/${ev.id}`)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
                          title="Ver detalhes"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => navigate(`/app-ui/app/events/${ev.id}/edit`)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
