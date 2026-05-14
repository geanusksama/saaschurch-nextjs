import { useState } from 'react';
import { Heart, Search, Filter, Plus, Calendar, User, Clock, MoreVertical, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';
import { Link } from 'react-router';
import { useCounselings } from '../../lib/pastoralHooks';

const counselingTypes = [
  'Todos',
  'Aconselhamento Conjugal',
  'Orientação Espiritual',
  'Libertação',
  'Aconselhamento Familiar',
  'Crise Espiritual',
  'Aconselhamento de Carreira'
];

export default function CounselingList() {
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('Todos');
  const [selectedStatus, setSelectedStatus] = useState('all');

  const mappedType = selectedType === 'Todos' ? 'all' : selectedType;
  const { data: counselingSessions = [], isLoading } = useCounselings({
    search,
    status: selectedStatus as any,
    type: mappedType,
  });

  const filteredSessions = counselingSessions;

  const activeSessions = counselingSessions.filter(s => s.status === 'active').length;
  const completedSessions = counselingSessions.filter(s => s.status === 'completed').length;
  const totalSessions = counselingSessions.reduce((acc, s: any) => acc + Number(s.total_sessions || 0), 0);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
            <Heart className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Aconselhamentos</h1>
            <p className="text-slate-600 dark:text-slate-400">Gerencie sessões de aconselhamento e acompanhamento</p>
          </div>
        </div>
        <Link to="/app-ui/counseling-new" className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
          <Plus className="w-5 h-5" />
          Novo Aconselhamento
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Heart className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Ativos</p>
              <p className="text-2xl font-bold text-slate-900">{activeSessions}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Concluídos</p>
              <p className="text-2xl font-bold text-slate-900">{completedSessions}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Sessões Total</p>
              <p className="text-2xl font-bold text-slate-900">{totalSessions}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Alta Prioridade</p>
              <p className="text-2xl font-bold text-slate-900">
                {counselingSessions.filter((s: any) => s.priority === 'high' && s.status === 'active').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 mb-6">
        <div className="p-6 border-b border-slate-200">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por membro ou conselheiro..."
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              />
            </div>
            <div className="flex gap-3">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              >
                {counselingTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              >
                <option value="all">Todos Status</option>
                <option value="active">Ativos</option>
                <option value="completed">Concluídos</option>
              </select>
            </div>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="px-6 border-b border-slate-200">
          <div className="flex gap-6">
            <button
              onClick={() => setSelectedStatus('all')}
              className={`py-4 border-b-2 font-semibold ${
                selectedStatus === 'all'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos ({counselingSessions.length})
            </button>
            <button 
              onClick={() => setSelectedStatus('active')}
              className={`py-4 border-b-2 font-semibold ${
                selectedStatus === 'active'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Ativos ({activeSessions})
            </button>
            <button 
              onClick={() => setSelectedStatus('completed')}
              className={`py-4 border-b-2 font-semibold ${
                selectedStatus === 'completed'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Concluídos ({completedSessions})
            </button>
          </div>
        </div>

        {/* List */}
        <div className="divide-y divide-slate-200">
          {filteredSessions.map((session: any) => (
            <div key={session.id} className="p-6 hover:bg-slate-50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-bold text-slate-900">{session.members?.full_name || 'Membro'}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      session.status === 'active' 
                        ? 'bg-green-100 text-green-700'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {session.status === 'active' ? 'Ativo' : 'Concluído'}
                    </span>
                    {session.priority === 'high' && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                        Alta Prioridade
                      </span>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600 mb-2">
                    <div className="flex items-center gap-1.5">
                      <Heart className="w-4 h-4" />
                      {session.counseling_type}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <User className="w-4 h-4" />
                      {session.users?.full_name || 'Conselheiro'}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      {session.total_sessions} sessões
                    </div>
                    {session.next_session_at && (
                      <div className="flex items-center gap-1.5 text-purple-600 font-semibold">
                        <Clock className="w-4 h-4" />
                        Próxima: {new Date(session.next_session_at).toLocaleDateString('pt-BR')}
                      </div>
                    )}
                  </div>

                  <p className="text-sm text-slate-600 dark:text-slate-400">{session.current_summary || 'Sem resumo ainda.'}</p>
                </div>

                <div className="flex items-center gap-2">
                  <Link 
                    to={`/app-ui/counseling-session?counselingId=${session.id}`}
                    className="px-4 py-2 text-sm font-medium text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                  >
                    Ver Detalhes
                  </Link>
                  <button className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg transition-colors">
                    <MoreVertical className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {isLoading && (
          <div className="p-6 text-sm text-slate-500">Carregando aconselhamentos...</div>
        )}

        {filteredSessions.length === 0 && (
          <div className="p-12 text-center">
            <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 dark:text-slate-400">Nenhum aconselhamento encontrado</p>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200 p-6">
          <h3 className="font-bold text-slate-900 mb-4">Próximas Sessões</h3>
          <div className="space-y-3">
            {counselingSessions
              .filter((s: any) => s.next_session_at && s.status === 'active')
              .sort((a: any, b: any) => new Date(a.next_session_at).getTime() - new Date(b.next_session_at).getTime())
              .slice(0, 3)
              .map((session: any) => (
                <div key={session.id} className="text-sm">
                  <p className="font-semibold text-slate-900">{session.members?.full_name || 'Membro'}</p>
                  <p className="text-slate-600 dark:text-slate-400">
                    {new Date(session.next_session_at).toLocaleDateString('pt-BR', { 
                      day: 'numeric', 
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border border-blue-200 p-6">
          <h3 className="font-bold text-slate-900 mb-4">Tipos Mais Comuns</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Conjugal</span>
              <span className="font-bold text-slate-900">2</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Espiritual</span>
              <span className="font-bold text-slate-900">2</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Libertação</span>
              <span className="font-bold text-slate-900">1</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200 p-6">
          <h3 className="font-bold text-slate-900 mb-4">Conselheiros Ativos</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Pr. João Silva</span>
              <span className="font-bold text-slate-900">2</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Pr. Ana Costa</span>
              <span className="font-bold text-slate-900">2</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Líder Paula</span>
              <span className="font-bold text-slate-900">1</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
