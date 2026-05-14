import { useMemo, useState } from 'react';
import { Heart, Plus, MessageCircle, User, Clock, TrendingUp, CheckCircle, Search } from 'lucide-react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getCurrentChurchId, getPrayerWallSummary, listPrayerRequests, prayForRequest, type PrayerCategory } from '../../lib/pastoralService';

const categories: Array<{ value: 'all' | PrayerCategory; label: string; icon: string }> = [
  { value: 'all', label: 'Todos', icon: '🙏' },
  { value: 'saude', label: 'Saúde', icon: '🏥' },
  { value: 'familia', label: 'Família', icon: '👨‍👩‍👧‍👦' },
  { value: 'trabalho', label: 'Trabalho', icon: '💼' },
  { value: 'financas', label: 'Finanças', icon: '💰' },
  { value: 'vida_espiritual', label: 'Vida Espiritual', icon: '✝️' },
  { value: 'decisoes', label: 'Decisões', icon: '🤔' },
  { value: 'libertacao', label: 'Libertação', icon: '🛡️' },
  { value: 'gratidao', label: 'Gratidão', icon: '🌟' },
  { value: 'outro', label: 'Outro', icon: '📌' },
];

function getCategoryMeta(category: PrayerCategory) {
  return categories.find((c) => c.value === category) || { value: 'outro', label: 'Outro', icon: '📌' };
}

function getCurrentUserId() {
  try {
    const raw = localStorage.getItem('mrm_user');
    if (!raw) return null;
    const user = JSON.parse(raw);
    return user?.id || null;
  } catch {
    return null;
  }
}

export default function PrayerWall() {
  const churchId = getCurrentChurchId();
  const userId = getCurrentUserId();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | PrayerCategory>('all');
  const [filterAnswered, setFilterAnswered] = useState(false);
  const [filterUrgent, setFilterUrgent] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'urgent' | 'answered'>('all');

  const { data: requests = [], isLoading, isError } = useQuery({
    queryKey: ['prayer-wall', churchId, search, selectedCategory, filterAnswered, filterUrgent],
    enabled: !!churchId,
    queryFn: () => listPrayerRequests({
      churchId: churchId!,
      search,
      category: selectedCategory,
      answered: filterAnswered,
      urgent: filterUrgent,
    }),
    staleTime: 20_000,
  });

  const { data: summary } = useQuery({
    queryKey: ['prayer-wall-summary', churchId],
    enabled: !!churchId,
    queryFn: () => getPrayerWallSummary(churchId!),
    staleTime: 20_000,
  });

  const prayMutation = useMutation({
    mutationFn: (payload: { requestId: string; mode: 'prayed' | 'amen' }) => prayForRequest({
      churchId: churchId!,
      requestId: payload.requestId,
      userId,
      mode: payload.mode,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prayer-wall'] });
      queryClient.invalidateQueries({ queryKey: ['prayer-wall-summary'] });
    },
  });

  const tabbedRequests = useMemo(() => {
    if (activeTab === 'urgent') return requests.filter((request) => request.priority === 'urgent' && request.status !== 'answered');
    if (activeTab === 'answered') return requests.filter((request) => request.status === 'answered');
    return requests;
  }, [activeTab, requests]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-rose-100 rounded-xl flex items-center justify-center">
            <Heart className="w-6 h-6 text-rose-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Mural de Oração</h1>
            <p className="text-slate-600 dark:text-slate-400">Ore pelos pedidos da comunidade e compartilhe testemunhos</p>
          </div>
        </div>
        <Link to="/app-ui/prayer-new" className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
          <Plus className="w-5 h-5" />
          Novo Pedido
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl text-white p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <Heart className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm opacity-90">Pedidos Ativos</p>
              <p className="text-2xl font-bold">{summary?.active ?? 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl text-white p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm opacity-90">Respondidos</p>
              <p className="text-2xl font-bold">{summary?.answered ?? 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl text-white p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm opacity-90">Total de Orações</p>
              <p className="text-2xl font-bold">{summary?.prayers ?? 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-xl text-white p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm opacity-90">Urgentes</p>
              <p className="text-2xl font-bold">{summary?.urgent ?? 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 mb-6 p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar pedidos de oração..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setFilterUrgent(!filterUrgent)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterUrgent
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Urgentes
            </button>
            <button
              onClick={() => setFilterAnswered(!filterAnswered)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterAnswered
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Respondidos
            </button>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {categories.map(category => (
            <button
              key={category.value}
              onClick={() => setSelectedCategory(category.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                selectedCategory === category.value
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 mb-6">
        <div className="px-6 pt-4 border-b border-slate-200">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('all')}
              className={`py-3 border-b-2 text-sm font-semibold ${
                activeTab === 'all'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos ({requests.length})
            </button>
            <button
              onClick={() => setActiveTab('urgent')}
              className={`py-3 border-b-2 text-sm font-semibold ${
                activeTab === 'urgent'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Urgentes ({requests.filter((request) => request.priority === 'urgent' && request.status !== 'answered').length})
            </button>
            <button
              onClick={() => setActiveTab('answered')}
              className={`py-3 border-b-2 text-sm font-semibold ${
                activeTab === 'answered'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Respondidos ({requests.filter((request) => request.status === 'answered').length})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <th className="px-4 py-3">Membro / Solicitante</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Pedido</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Orações</th>
                <th className="px-4 py-3">Comentários</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-sm">
              {tabbedRequests.map((request) => {
                const category = getCategoryMeta(request.category);
                const isAnswered = request.status === 'answered';
                const authorName = request.is_anonymous
                  ? 'Anônimo'
                  : (request.requester_name || request.members?.full_name || 'Membro da igreja');

                return (
                  <tr key={request.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="font-medium text-slate-900">{authorName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        <span>{category.icon}</span>
                        <span>{category.label}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{request.title}</p>
                      <p className="line-clamp-2 text-xs text-slate-600">{request.description}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-semibold ${
                          isAnswered ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {isAnswered ? 'Respondido' : 'Ativo'}
                        </span>
                        {request.priority === 'urgent' && !isAnswered && (
                          <span className="inline-flex w-fit rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Urgente</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{new Date(request.created_at).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3 font-semibold text-purple-700">{request.prayed_count}</td>
                    <td className="px-4 py-3 text-slate-700">{request.comments_count}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          className="inline-flex items-center gap-1 rounded-lg border border-purple-200 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-50"
                          onClick={() => {
                            void prayMutation.mutateAsync({ requestId: request.id, mode: isAnswered ? 'amen' : 'prayed' });
                          }}
                          disabled={prayMutation.isPending || !churchId}
                        >
                          <Heart className="w-3.5 h-3.5" />
                          {isAnswered ? 'Amém' : 'Orar'}
                        </button>
                        <button className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                          <MessageCircle className="w-3.5 h-3.5" />
                          Comentários
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Prayer Requests */}
      {!churchId && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          Selecione uma igreja para carregar o Mural de Oração.
        </div>
      )}

      {isError && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Não foi possível carregar os pedidos de oração no momento.
        </div>
      )}

      {isLoading && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Carregando mural de oração...
        </div>
      )}

      {tabbedRequests.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <Heart className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">Nenhum pedido encontrado</p>
        </div>
      )}
    </div>
  );
}
