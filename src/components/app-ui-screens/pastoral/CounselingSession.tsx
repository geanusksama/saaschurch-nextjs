import { useState } from 'react';
import { BookOpen, Calendar, User, Heart, FileText, ArrowLeft, Save, Clock, CheckSquare, TrendingUp, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { useCounselings, useCounselingSessions, useCreateCounselingSession } from '../../lib/pastoralHooks';
import { getCurrentChurchId } from '../../lib/pastoralService';

const sessionGoals = [
  'Melhorar comunicação no relacionamento',
  'Resolver conflitos de forma saudável',
  'Fortalecer intimidade emocional',
  'Estabelecer rotinas de oração em casal'
];

export default function CounselingSession() {
  const [searchParams] = useSearchParams();
  const counselingId = searchParams.get('counselingId');
  const churchId = getCurrentChurchId();
  const createSession = useCreateCounselingSession();

  const { data: counselings = [] } = useCounselings({ status: 'all' });
  const counseling = counselings.find((c: any) => c.id === counselingId);
  const { data: sessionHistory = [] } = useCounselingSessions(counselingId);

  const sessionDate = new Date().toISOString().slice(0, 10);
  const memberName = counseling?.members?.full_name || 'Membro';
  const counselingType = counseling?.counseling_type || 'Aconselhamento';
  const counselor = counseling?.users?.full_name || 'Conselheiro';
  const sessionNumber = sessionHistory.length + 1;
  
  const [duration, setDuration] = useState('60');
  const [summary, setSummary] = useState('');
  const [progress, setProgress] = useState<'excellent' | 'good' | 'neutral' | 'concerning'>('good');
  const [concerns, setConcerns] = useState('');
  const [homework, setHomework] = useState('');
  const [prayerPoints, setPrayerPoints] = useState('');
  const [nextSessionDate, setNextSessionDate] = useState('');
  const [nextSessionTime, setNextSessionTime] = useState('');
  const [isConfidential, setIsConfidential] = useState(true);
  const [resources, setResources] = useState<string[]>([]);
  const [newResource, setNewResource] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const addResource = () => {
    if (newResource.trim()) {
      setResources([...resources, newResource]);
      setNewResource('');
    }
  };

  const removeResource = (index: number) => {
    setResources(resources.filter((_, i) => i !== index));
  };

  async function handleSave() {
    setErrorMessage(null);

    if (!churchId || !counselingId) {
      setErrorMessage('Aconselhamento não identificado.');
      return;
    }

    try {
      await createSession.mutateAsync({
        churchId,
        counselingId,
        sessionDate: `${sessionDate}T00:00:00`,
        durationMinutes: Number(duration || 60),
        notes: summary,
        privateNotes: isConfidential ? concerns : null,
        emotionalState: progress === 'excellent' ? 'improving' : progress === 'good' ? 'stable' : progress === 'neutral' ? 'anxious' : 'critical',
        spiritualState: progress === 'excellent' ? 'restored' : progress === 'good' ? 'growing' : progress === 'neutral' ? 'weak' : 'confused',
        progressLevel: progress === 'excellent' ? 90 : progress === 'good' ? 70 : progress === 'neutral' ? 50 : 30,
        nextSteps: [homework, resources.join('\n')].filter(Boolean).join('\n'),
        nextSessionAt: nextSessionDate ? `${nextSessionDate}T${nextSessionTime || '09:00'}:00` : undefined,
      });
      setSummary('');
      setHomework('');
      setPrayerPoints('');
    } catch (error: any) {
      setErrorMessage(error?.message || 'Não foi possível salvar a sessão.');
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-8">
        <Link to="/app-ui/counseling-list" className="w-10 h-10 bg-white rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </Link>
        <div>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Sessão de Aconselhamento #{sessionNumber}</h1>
            <p className="text-slate-600 dark:text-slate-400">Registre os detalhes desta sessão</p>
          </div>
        </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Session Info */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Informações da Sessão</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Pessoa</p>
                  <p className="font-semibold text-slate-900">{memberName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Data</p>
                  <p className="font-semibold text-slate-900">{sessionDate}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Heart className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Tipo</p>
                  <p className="font-semibold text-slate-900">{counselingType}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Conselheiro</p>
                  <p className="font-semibold text-slate-900">{counselor}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Session Duration */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Duração da Sessão</h3>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="Duração em minutos"
                  min="15"
                  step="15"
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                />
              </div>
              <span className="text-slate-600">minutos</span>
            </div>
          </div>

          {/* Progress Assessment */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Avaliação do Progresso</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                onClick={() => setProgress('excellent')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  progress === 'excellent'
                    ? 'border-green-600 bg-green-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <TrendingUp className={`w-6 h-6 mx-auto mb-2 ${progress === 'excellent' ? 'text-green-600' : 'text-slate-400'}`} />
                <p className={`text-sm font-semibold ${progress === 'excellent' ? 'text-green-600' : 'text-slate-700'}`}>
                  Excelente
                </p>
              </button>
              <button
                onClick={() => setProgress('good')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  progress === 'good'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <CheckSquare className={`w-6 h-6 mx-auto mb-2 ${progress === 'good' ? 'text-blue-600' : 'text-slate-400'}`} />
                <p className={`text-sm font-semibold ${progress === 'good' ? 'text-blue-600' : 'text-slate-700'}`}>
                  Bom
                </p>
              </button>
              <button
                onClick={() => setProgress('neutral')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  progress === 'neutral'
                    ? 'border-yellow-600 bg-yellow-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <AlertCircle className={`w-6 h-6 mx-auto mb-2 ${progress === 'neutral' ? 'text-yellow-600' : 'text-slate-400'}`} />
                <p className={`text-sm font-semibold ${progress === 'neutral' ? 'text-yellow-600' : 'text-slate-700'}`}>
                  Neutro
                </p>
              </button>
              <button
                onClick={() => setProgress('concerning')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  progress === 'concerning'
                    ? 'border-red-600 bg-red-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <AlertCircle className={`w-6 h-6 mx-auto mb-2 ${progress === 'concerning' ? 'text-red-600' : 'text-slate-400'}`} />
                <p className={`text-sm font-semibold ${progress === 'concerning' ? 'text-red-600' : 'text-slate-700'}`}>
                  Preocupante
                </p>
              </button>
            </div>
          </div>

          {/* Session Summary */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Resumo da Sessão</h3>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Descreva o que foi discutido, principais temas abordados, insights importantes..."
              rows={6}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
            />
          </div>

          {/* Concerns */}
          {progress === 'concerning' && (
            <div className="bg-red-50 rounded-xl border border-red-200 p-6">
              <h3 className="font-bold text-red-900 mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Preocupações e Alertas
              </h3>
              <textarea
                value={concerns}
                onChange={(e) => setConcerns(e.target.value)}
                placeholder="Descreva as preocupações específicas que precisam de atenção..."
                rows={4}
                className="w-full px-4 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-transparent"
              />
            </div>
          )}

          {/* Prayer Points */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Heart className="w-5 h-5 text-purple-600" />
              Pontos de Oração
            </h3>
            <textarea
              value={prayerPoints}
              onChange={(e) => setPrayerPoints(e.target.value)}
              placeholder="Registre os pedidos de oração específicos desta sessão..."
              rows={4}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
            />
          </div>

          {/* Homework */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-600" />
              Tarefa para Casa
            </h3>
            <textarea
              value={homework}
              onChange={(e) => setHomework(e.target.value)}
              placeholder="Atividades, leituras ou reflexões para fazer antes da próxima sessão..."
              rows={4}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
            />
          </div>

          {/* Resources */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Recursos Compartilhados</h3>
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newResource}
                  onChange={(e) => setNewResource(e.target.value)}
                  placeholder="Nome do livro, artigo, vídeo, etc..."
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  onKeyDown={(e) => e.key === 'Enter' && addResource()}
                />
                <button
                  onClick={addResource}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              
              {resources.length > 0 && (
                <div className="space-y-2">
                  {resources.map((resource, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="text-slate-900">{resource}</span>
                      <button
                        onClick={() => removeResource(index)}
                        className="text-red-600 hover:bg-red-50 p-1 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Next Session */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Próxima Sessão</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Data
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="date"
                    value={nextSessionDate}
                    onChange={(e) => setNextSessionDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Horário
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="time"
                    value={nextSessionTime}
                    onChange={(e) => setNextSessionTime(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Ações</h3>
            <div className="space-y-3">
              {errorMessage && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{errorMessage}</div>
              )}

              <button
                onClick={handleSave}
                disabled={createSession.isPending}
                className="w-full flex items-center gap-3 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-60"
              >
                <Save className="w-5 h-5" />
                {createSession.isPending ? 'Salvando...' : 'Salvar Sessão'}
              </button>
              <Link to="/app-ui/counseling-list" className="w-full flex items-center gap-3 px-4 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors">
                <ArrowLeft className="w-5 h-5" />
                Cancelar
              </Link>
            </div>
          </div>

          {/* Privacy */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Privacidade</h3>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isConfidential}
                onChange={(e) => setIsConfidential(e.target.checked)}
                className="mt-1 w-5 h-5 text-purple-600 rounded focus:ring-purple-600"
              />
              <div>
                <p className="font-semibold text-slate-900">Sessão Confidencial</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Apenas você e líderes autorizados poderão ver</p>
              </div>
            </label>
          </div>

          {/* Goals Progress */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Objetivos do Aconselhamento</h3>
            <div className="space-y-3">
              {sessionGoals.map((goal, index) => (
                <div key={index} className="flex items-start gap-2">
                  <CheckSquare className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-slate-700">{goal}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Session History */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Histórico de Sessões</h3>
            <div className="space-y-3">
              {sessionHistory.map(session => (
                <div key={session.id} className="text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-900">Sessão {session.session_number}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      Number(session.progress_level || 0) >= 80 ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {Number(session.progress_level || 0) >= 80 ? 'Excelente' : 'Bom'}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400">{new Date(session.session_date).toLocaleDateString('pt-BR')}</p>
                  <p className="text-slate-500 text-xs mt-1">{session.notes}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Estatísticas</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Total de Sessões</span>
                <span className="font-bold text-slate-900">{sessionNumber}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Tempo Total</span>
                <span className="font-bold text-slate-900">4h 15min</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Progresso Geral</span>
                <span className="font-bold text-green-600">Positivo</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
