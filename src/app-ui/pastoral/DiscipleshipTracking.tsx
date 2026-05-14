import { useState } from 'react';
import { BookOpen, User, TrendingUp, CheckCircle, Clock, Award, Target, Calendar, Plus, Search, Star } from 'lucide-react';
import { Link } from 'react-router';
import { useCreateDiscipleshipMeeting, useDiscipleshipPrograms, useDiscipleships } from '../../lib/pastoralHooks';
import { getCurrentChurchId } from '../../lib/pastoralService';

const stages = [
  { 
    id: 'fundamentos', 
    name: 'Fundamentos', 
    description: 'Base da fé cristã',
    color: 'blue',
    cardClass: 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800',
    iconClass: 'bg-blue-600',
    textClass: 'text-blue-600 dark:text-blue-400',
    lessons: 7
  },
  { 
    id: 'crescimento', 
    name: 'Crescimento', 
    description: 'Maturidade espiritual',
    color: 'purple',
    cardClass: 'bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800',
    iconClass: 'bg-purple-600',
    textClass: 'text-purple-600 dark:text-purple-400',
    lessons: 7
  },
  { 
    id: 'multiplicacao', 
    name: 'Multiplicação', 
    description: 'Fazendo discípulos',
    color: 'green',
    cardClass: 'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800',
    iconClass: 'bg-green-600',
    textClass: 'text-green-600 dark:text-green-400',
    lessons: 6
  },
];

export default function DiscipleshipTracking() {
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const churchId = getCurrentChurchId();
  const createMeeting = useCreateDiscipleshipMeeting();

  const { data: disciples = [], isLoading } = useDiscipleships({ search, status: selectedStatus as any });
  const { data: programs = [] } = useDiscipleshipPrograms();

  const filteredDisciples = disciples;

  const activeCount = disciples.filter(d => d.status === 'active').length;
  const completedCount = disciples.filter(d => d.status === 'completed').length;
  const avgProgress = disciples.length
    ? Math.round(disciples.reduce((acc, d: any) => acc + Number(d.progress_percent || 0), 0) / disciples.length)
    : 0;

  const programCountByStage = {
    fundamentos: disciples.filter((d: any) => d.discipleship_programs?.stage === 'fundamentos').length,
    crescimento: disciples.filter((d: any) => d.discipleship_programs?.stage === 'crescimento').length,
    multiplicacao: disciples.filter((d: any) => d.discipleship_programs?.stage === 'multiplicacao').length,
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Acompanhamento de Discipulado</h1>
            <p className="text-slate-600 dark:text-slate-400">Gerencie o progresso e desenvolvimento espiritual</p>
          </div>
        </div>
        <Link to="/app-ui/discipleship-new" className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
          <Plus className="w-5 h-5" />
          Novo Discípulo
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Em Discipulado</p>
              <p className="text-2xl font-bold text-slate-900">{activeCount}</p>
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
              <p className="text-2xl font-bold text-slate-900">{completedCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Progresso Médio</p>
              <p className="text-2xl font-bold text-slate-900">{avgProgress}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Award className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Multiplicadores</p>
              <p className="text-2xl font-bold text-slate-900">
                {programCountByStage.multiplicacao}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stages Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {stages.map(stage => (
          <div key={stage.id} className={`rounded-xl border p-6 ${stage.cardClass}`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">{stage.name}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">{stage.description}</p>
              </div>
              <div className={`w-12 h-12 ${stage.iconClass} rounded-lg flex items-center justify-center`}>
                <BookOpen className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">{stage.lessons} lições</span>
              <span className={`font-bold ${stage.textClass}`}>
                {programCountByStage[stage.id as keyof typeof programCountByStage] || 0} pessoas
              </span>
            </div>
          </div>
        ))}
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
                placeholder="Buscar por nome ou discipulador..."
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              />
            </div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
            >
              <option value="all">Todos os Status</option>
              <option value="active">Ativos</option>
              <option value="completed">Concluídos</option>
            </select>
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
              Todos ({disciples.length})
            </button>
            <button
              onClick={() => setSelectedStatus('active')}
              className={`py-4 border-b-2 font-semibold ${
                selectedStatus === 'active'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Ativos ({activeCount})
            </button>
            <button
              onClick={() => setSelectedStatus('completed')}
              className={`py-4 border-b-2 font-semibold ${
                selectedStatus === 'completed'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Concluídos ({completedCount})
            </button>
          </div>
        </div>

        {/* Disciples List */}
        <div className="divide-y divide-slate-200">
          {filteredDisciples.map((disciple: any) => {
            const program = programs.find((p: any) => p.id === disciple.program_id) || disciple.discipleship_programs;
            const progress = Number(disciple.progress_percent || 0);
            const totalLessons = Number(disciple.total_lessons || program?.lessons_count || 0);
            const currentLesson = Number(disciple.current_lesson || 0);

            return (
            <div key={disciple.id} className="p-6 hover:bg-slate-50 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-bold text-slate-900">{disciple.members?.full_name || 'Membro'}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      disciple.status === 'active' 
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {program?.name || 'Programa'}
                    </span>
                    {progress === 100 && (
                      <Award className="w-5 h-5 text-yellow-500" />
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-slate-600 mb-3">
                    <div className="flex items-center gap-1.5">
                      <User className="w-4 h-4" />
                      Discipulador: {disciple.users?.full_name || 'Sem discipulador'}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      Início: {disciple.started_at ? new Date(disciple.started_at).toLocaleDateString('pt-BR') : '-'}
                    </div>
                    {disciple.next_meeting_at && (
                      <div className="flex items-center gap-1.5 text-purple-600 font-semibold">
                        <Clock className="w-4 h-4" />
                        Próximo encontro: {new Date(disciple.next_meeting_at).toLocaleDateString('pt-BR')}
                      </div>
                    )}
                  </div>

                  <div className="mb-3">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-slate-600">Progresso</span>
                      <span className="font-semibold text-slate-900">
                        {currentLesson} / {totalLessons} lições ({progress}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          progress === 100 ? 'bg-green-600' :
                          progress >= 70 ? 'bg-blue-600' :
                          progress >= 40 ? 'bg-purple-600' :
                          'bg-orange-600'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {disciple.notes && (
                    <p className="text-sm text-slate-600 italic">💬 {disciple.notes}</p>
                  )}
                </div>

                <div className="flex flex-col gap-2 ml-4">
                  <button className="px-4 py-2 text-sm font-medium text-purple-600 hover:bg-purple-50 rounded-lg border border-purple-200 transition-colors">
                    Ver Progresso
                  </button>
                  <button
                    className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200 transition-colors disabled:opacity-60"
                    disabled={createMeeting.isPending || !churchId}
                    onClick={() => {
                      const nextLesson = Math.max(1, currentLesson + 1);
                      const total = Math.max(1, totalLessons || 1);
                      const progressPercent = Math.min(100, Math.round((nextLesson / total) * 100));
                      void createMeeting.mutateAsync({
                        churchId: churchId!,
                        discipleshipId: disciple.id,
                        meetingDate: new Date().toISOString(),
                        lessonNumber: nextLesson,
                        lessonTitle: `Lição ${nextLesson}`,
                        notes: `Encontro registrado rapidamente pela tela de acompanhamento.`,
                        progressPercent,
                      });
                    }}
                  >
                    Registrar Encontro
                  </button>
                </div>
              </div>
            </div>
          );})}
        </div>

        {isLoading && (
          <div className="p-6 text-sm text-slate-500">Carregando discipulados...</div>
        )}

        {filteredDisciples.length === 0 && (
          <div className="p-12 text-center">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 dark:text-slate-400">Nenhum discípulo encontrado</p>
          </div>
        )}
      </div>

      {/* Quick Access */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link to="/app-ui/discipleship-curriculum" className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200 p-6 hover:shadow-lg transition-all">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 mb-1">Currículo de Discipulado</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Ver todas as lições e materiais disponíveis</p>
            </div>
          </div>
        </Link>

        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border border-blue-200 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Target className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 mb-1">Meta do Mês</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Iniciar 3 novos discipulados</p>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 bg-blue-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: '66%' }} />
                </div>
                <span className="text-xs font-semibold text-blue-600">2/3</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
