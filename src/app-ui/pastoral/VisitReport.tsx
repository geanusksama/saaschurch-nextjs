import { useMemo, useState } from 'react';
import { CheckSquare, Heart, FileText, ArrowLeft, Save, User, Calendar, MapPin, Smile, Meh, Frown } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usePastoralVisits } from '../../lib/pastoralHooks';
import { getCurrentChurchId, replaceVisitPrayerPoints, updatePastoralVisit } from '../../lib/pastoralService';

const prayerTopics = ['Saude', 'Familia', 'Trabalho', 'Financas', 'Relacionamentos', 'Vida Espiritual', 'Decisoes', 'Outro'];
const nextStepsOptions = ['Nova visita agendada', 'Encaminhamento para aconselhamento', 'Oracao continua', 'Acompanhamento semanal', 'Visita ao culto', 'Integracao a celula', 'Outro'];

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

export default function VisitReport() {
  const [searchParams] = useSearchParams();
  const visitId = searchParams.get('id');
  const churchId = getCurrentChurchId();
  const userId = getCurrentUserId();
  const queryClient = useQueryClient();

  const { data: visits = [], isLoading } = usePastoralVisits({ status: 'all' });
  const visit = useMemo(() => {
    if (!visits.length) return null;
    if (visitId) return visits.find((item: any) => item.id === visitId) || null;
    return visits[0] as any;
  }, [visitId, visits]);

  const [reception, setReception] = useState<'good' | 'neutral' | 'difficult'>('good');
  const [summary, setSummary] = useState('');
  const [selectedPrayerTopics, setSelectedPrayerTopics] = useState<string[]>([]);
  const [prayerDetails, setPrayerDetails] = useState('');
  const [selectedNextSteps, setSelectedNextSteps] = useState<string[]>([]);
  const [nextVisitDate, setNextVisitDate] = useState('');
  const [isConfidential, setIsConfidential] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!visit?.id || !churchId) throw new Error('Visita nao encontrada.');

      const completed = reception !== 'difficult';
      await updatePastoralVisit(visit.id, {
        notes: summary || null,
        next_steps: selectedNextSteps.join('\n') || null,
        followup_required: selectedNextSteps.length > 0,
        followup_date: nextVisitDate ? `${nextVisitDate}T09:00:00` : null,
        completed_at: completed ? new Date().toISOString() : null,
        status: completed ? 'completed' : 'pending',
        updated_by: userId,
      });

      await replaceVisitPrayerPoints({
        churchId,
        visitId: visit.id,
        points: [
          ...selectedPrayerTopics,
          ...prayerDetails
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean),
        ],
        createdBy: userId,
      });
    },
    onSuccess: () => {
      setErrorMessage(null);
      void queryClient.invalidateQueries({ queryKey: ['pastoral-visits'] });
      void queryClient.invalidateQueries({ queryKey: ['pastoral-visit'] });
    },
    onError: (error: any) => setErrorMessage(error?.message || 'Nao foi possivel salvar o relatorio.'),
  });

  const toggle = (value: string, setter: (cb: (prev: string[]) => string[]) => void) => {
    setter((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]));
  };

  if (isLoading) return <div className="p-6 text-sm text-slate-500">Carregando visita...</div>;
  if (!visit) return <div className="p-6 text-sm text-slate-500">Nenhuma visita encontrada para registrar relatorio.</div>;

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-8">
        <Link to={`/app-ui/pastoral/visit-detail?id=${visit.id}`} className="w-10 h-10 bg-white rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
            <FileText className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Relatorio de Visita</h1>
            <p className="text-slate-600">Registre os detalhes e resultados da visita realizada</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Informacoes da Visita</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-3"><User className="w-4 h-4 text-slate-400" /><span>{visit.members?.full_name || 'Membro'}</span></div>
              <div className="flex items-center gap-3"><Calendar className="w-4 h-4 text-slate-400" /><span>{visit.scheduled_at ? new Date(visit.scheduled_at).toLocaleDateString('pt-BR') : '-'}</span></div>
              <div className="flex items-center gap-3"><MapPin className="w-4 h-4 text-slate-400" /><span>{visit.visit_type}</span></div>
              <div className="flex items-center gap-3"><User className="w-4 h-4 text-slate-400" /><span>{visit.users?.full_name || 'Responsavel'}</span></div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Como foi a recepcao?</h3>
            <div className="grid grid-cols-3 gap-3">
              <button onClick={() => setReception('good')} className={`p-4 rounded-lg border-2 ${reception === 'good' ? 'border-green-600 bg-green-50' : 'border-slate-200'}`}><Smile className="w-6 h-6 mx-auto mb-1" />Muito Boa</button>
              <button onClick={() => setReception('neutral')} className={`p-4 rounded-lg border-2 ${reception === 'neutral' ? 'border-yellow-600 bg-yellow-50' : 'border-slate-200'}`}><Meh className="w-6 h-6 mx-auto mb-1" />Neutra</button>
              <button onClick={() => setReception('difficult')} className={`p-4 rounded-lg border-2 ${reception === 'difficult' ? 'border-red-600 bg-red-50' : 'border-slate-200'}`}><Frown className="w-6 h-6 mx-auto mb-1" />Dificil</button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Resumo da Visita</h3>
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={6} className="w-full px-4 py-2 border border-slate-300 rounded-lg" />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-bold text-slate-900 flex items-center gap-2"><Heart className="w-5 h-5 text-purple-600" />Pontos de Oracao</h3>
            <div className="flex flex-wrap gap-2">
              {prayerTopics.map((topic) => (
                <button key={topic} onClick={() => toggle(topic, setSelectedPrayerTopics)} className={`px-3 py-1.5 rounded-full text-sm ${selectedPrayerTopics.includes(topic) ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-700'}`}>{topic}</button>
              ))}
            </div>
            <textarea value={prayerDetails} onChange={(e) => setPrayerDetails(e.target.value)} rows={4} placeholder="Um ponto por linha..." className="w-full px-4 py-2 border border-slate-300 rounded-lg" />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-bold text-slate-900 flex items-center gap-2"><CheckSquare className="w-5 h-5 text-blue-600" />Proximos Passos</h3>
            <div className="space-y-2">
              {nextStepsOptions.map((step) => (
                <label key={step} className="flex items-center gap-2">
                  <input type="checkbox" checked={selectedNextSteps.includes(step)} onChange={() => toggle(step, setSelectedNextSteps)} />
                  <span>{step}</span>
                </label>
              ))}
            </div>
            <input type="date" value={nextVisitDate} onChange={(e) => setNextVisitDate(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg" />
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
            <h3 className="font-bold text-slate-900">Acoes</h3>
            {errorMessage && <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">{errorMessage}</div>}
            <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full flex items-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-lg disabled:opacity-60">
              <Save className="w-4 h-4" />
              {saveMutation.isPending ? 'Salvando...' : 'Salvar Relatorio'}
            </button>
            <Link to={`/app-ui/pastoral/visit-detail?id=${visit.id}`} className="w-full flex items-center gap-2 px-4 py-3 bg-slate-100 text-slate-700 rounded-lg">
              <ArrowLeft className="w-4 h-4" />
              Cancelar
            </Link>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={isConfidential} onChange={(e) => setIsConfidential(e.target.checked)} className="mt-1" />
              <div>
                <p className="font-semibold text-slate-900">Relatorio Confidencial</p>
                <p className="text-sm text-slate-600">Apenas lideres autorizados poderao visualizar.</p>
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
