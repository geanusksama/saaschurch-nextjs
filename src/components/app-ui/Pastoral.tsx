import { Calendar, User, Heart, BookOpen, Search, Filter, Plus, MoreVertical } from 'lucide-react';
import { Link } from 'react-router';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCurrentChurchId, getPastoralDashboardSummary, listRecentPrayerRequests } from '../../lib/pastoralService';
import { useCounselings, useDiscipleships, usePastoralVisits } from '../../lib/pastoralHooks';

export function Pastoral() {
  const churchId = getCurrentChurchId();
  const [activeTab, setActiveTab] = useState<'visits' | 'prayer' | 'counseling' | 'discipleship'>('visits');

  const { data: summary } = useQuery({
    queryKey: ['pastoral-dashboard-summary', churchId],
    enabled: !!churchId,
    queryFn: () => getPastoralDashboardSummary(churchId!),
    staleTime: 20_000,
  });

  const { data: recentPrayerRequests = [] } = useQuery({
    queryKey: ['pastoral-recent-prayers', churchId],
    enabled: !!churchId,
    queryFn: () => listRecentPrayerRequests(churchId!, 8),
    staleTime: 20_000,
  });

  const { data: visits = [] } = usePastoralVisits();
  const { data: counseling = [] } = useCounselings({ status: 'all' });
  const { data: discipleship = [] } = useDiscipleships({ status: 'all' });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
            <Heart className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Pastoral</h1>
            <p className="text-slate-600 dark:text-slate-400">Gerencie visitas, aconselhamentos e pedidos de oração</p>
          </div>
        </div>
        <button className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
          <Plus className="w-5 h-5" />
          {activeTab === 'visits' && 'Nova Visita'}
          {activeTab === 'prayer' && 'Novo Pedido'}
          {activeTab === 'counseling' && 'Novo Aconselhamento'}
          {activeTab === 'discipleship' && 'Novo Discipulado'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Visitas Agendadas</p>
              <p className="text-2xl font-bold text-slate-900">{summary?.scheduledVisits ?? 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Aconselhamentos</p>
              <p className="text-2xl font-bold text-slate-900">{summary?.activeCounseling ?? 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Heart className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Pedidos de Oração</p>
              <p className="text-2xl font-bold text-slate-900">{summary?.activePrayerRequests ?? 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Em Discipulado</p>
              <p className="text-2xl font-bold text-slate-900">{summary?.activeDiscipleship ?? 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 mb-6">
        <div className="border-b border-slate-200 px-6">
          <div className="flex gap-6">
            <button 
              onClick={() => setActiveTab('visits')}
              className={`py-4 border-b-2 font-semibold transition-colors ${
                activeTab === 'visits' 
                  ? 'border-purple-600 text-purple-600' 
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Visitas
            </button>
            <button 
              onClick={() => setActiveTab('prayer')}
              className={`py-4 border-b-2 font-semibold transition-colors ${
                activeTab === 'prayer' 
                  ? 'border-purple-600 text-purple-600' 
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Pedidos de Oração
            </button>
            <button 
              onClick={() => setActiveTab('counseling')}
              className={`py-4 border-b-2 font-semibold transition-colors ${
                activeTab === 'counseling' 
                  ? 'border-purple-600 text-purple-600' 
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Aconselhamento
            </button>
            <button 
              onClick={() => setActiveTab('discipleship')}
              className={`py-4 border-b-2 font-semibold transition-colors ${
                activeTab === 'discipleship' 
                  ? 'border-purple-600 text-purple-600' 
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Discipulado
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="p-6 border-b border-slate-200">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={
                  activeTab === 'visits' ? 'Buscar visitas...' :
                  activeTab === 'prayer' ? 'Buscar pedidos...' :
                  activeTab === 'counseling' ? 'Buscar aconselhamentos...' :
                  'Buscar discipulados...'
                }
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">
              <Filter className="w-5 h-5" />
              Filtros
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'visits' && (
            <div className="space-y-4">
              {visits.map((visit: any) => (
                <div key={visit.id} className="flex items-center gap-4 p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                    {(visit.members?.full_name || 'M').split(' ').map((n: string) => n[0]).join('')}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Link to={`/app-ui/pastoral/visit-detail?id=${visit.id}`} className="font-semibold text-slate-900 hover:text-purple-600">
                        {visit.members?.full_name || 'Membro'}
                      </Link>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        visit.status === 'completed' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {visit.status === 'completed' ? 'Realizada' : 'Agendada'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{visit.visit_type} • {visit.users?.full_name || 'Responsável'}</p>
                    <p className="text-xs text-slate-500 mt-1">{visit.reason || visit.notes || 'Sem observação'}</p>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center gap-2 text-sm text-slate-600 mb-1">
                      <Calendar className="w-4 h-4" />
                      {visit.scheduled_at ? new Date(visit.scheduled_at).toLocaleDateString('pt-BR') : '-'}
                    </div>
                  </div>

                  <button className="p-2 hover:bg-slate-100 rounded-lg">
                    <MoreVertical className="w-5 h-5 text-slate-600" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'prayer' && (
            <div className="space-y-4">
              {recentPrayerRequests.map((request: any) => (
                <div key={request.id} className="flex items-center gap-4 p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center text-white">
                    <Heart className="w-6 h-6" />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-900">
                        {request.is_anonymous ? 'Anônimo' : (request.requester_name || request.members?.full_name || 'Membro da igreja')}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        request.status === 'answered' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {request.status === 'answered' ? 'Respondido' : 'Ativo'}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        request.priority === 'urgent' 
                          ? 'bg-red-100 text-red-700' 
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {request.priority === 'urgent' ? 'Alta' : 'Normal'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700">{request.title}</p>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Calendar className="w-4 h-4" />
                      {new Date(request.created_at).toLocaleDateString('pt-BR')}
                    </div>
                  </div>

                  <button className="p-2 hover:bg-slate-100 rounded-lg">
                    <MoreVertical className="w-5 h-5 text-slate-600" />
                  </button>
                </div>
              ))}

              {recentPrayerRequests.length === 0 && (
                <div className="text-sm text-slate-500">Nenhum pedido de oração cadastrado ainda.</div>
              )}
            </div>
          )}

          {activeTab === 'counseling' && (
            <div className="space-y-4">
              {counseling.map((item: any) => (
                <div key={item.id} className="flex items-center gap-4 p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center text-white">
                    <User className="w-6 h-6" />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-900">{item.members?.full_name || 'Membro'}</h3>
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                        {item.total_sessions} sessões
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{item.counseling_type} • {item.users?.full_name || 'Conselheiro'}</p>
                    <p className="text-xs text-slate-500 mt-1">Próxima sessão: {item.next_session_at ? new Date(item.next_session_at).toLocaleDateString('pt-BR') : '-'}</p>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Calendar className="w-4 h-4" />
                      {item.started_at ? new Date(item.started_at).toLocaleDateString('pt-BR') : '-'}
                    </div>
                  </div>

                  <button className="p-2 hover:bg-slate-100 rounded-lg">
                    <MoreVertical className="w-5 h-5 text-slate-600" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'discipleship' && (
            <div className="space-y-4">
              {discipleship.map((item: any) => (
                <div key={item.id} className="flex items-center gap-4 p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
                  <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center text-white">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-900">{item.members?.full_name || 'Membro'}</h3>
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                        {item.status === 'completed' ? 'Concluído' : 'Em andamento'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Mentor: {item.users?.full_name || 'Sem mentor'} • {item.discipleship_programs?.name || 'Programa'}</p>
                    <p className="text-xs text-slate-500 mt-1">{item.current_lesson || 0} de {item.total_lessons || 0} lições • {item.progress_percent || 0}%</p>
                  </div>
                  <button className="p-2 hover:bg-slate-100 rounded-lg">
                    <MoreVertical className="w-5 h-5 text-slate-600" />
                  </button>
                </div>
              ))}

              {discipleship.length === 0 && (
                <div className="text-sm text-slate-500">Nenhum discipulado ativo ainda.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}