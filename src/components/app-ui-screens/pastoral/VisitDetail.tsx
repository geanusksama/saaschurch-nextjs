import { ArrowLeft, Calendar, MapPin, User, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { getPastoralVisitById, listVisitParticipants, listVisitPrayerPoints } from '../../lib/pastoralService';

export default function VisitDetail() {
  const [searchParams] = useSearchParams();
  const visitId = searchParams.get('id');

  const { data: visit, isLoading, isError } = useQuery({
    queryKey: ['pastoral-visit-detail', visitId],
    enabled: !!visitId,
    queryFn: () => getPastoralVisitById(visitId!),
    staleTime: 20_000,
  });

  const { data: participants = [] } = useQuery({
    queryKey: ['pastoral-visit-participants', visitId],
    enabled: !!visitId,
    queryFn: () => listVisitParticipants(visitId!),
    staleTime: 20_000,
  });

  const { data: prayerPoints = [] } = useQuery({
    queryKey: ['pastoral-visit-prayer-points', visitId],
    enabled: !!visitId,
    queryFn: () => listVisitPrayerPoints(visitId!),
    staleTime: 20_000,
  });

  if (!visitId) {
    return <div className="p-6 text-sm text-slate-500">Selecione uma visita para ver os detalhes.</div>;
  }

  if (isLoading) {
    return <div className="p-6 text-sm text-slate-500">Carregando detalhes da visita...</div>;
  }

  if (isError || !visit) {
    return <div className="p-6 text-sm text-rose-600">Não foi possível carregar os detalhes da visita.</div>;
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Detalhes da Visita</h1>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  visit.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {visit.status === 'completed' ? 'Concluída' : 'Agendada'}
                </span>
                <span className="text-slate-600">{visit.visit_type}</span>
              </div>
            </div>
          </div>
          
          <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium">
            Editar Visita
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Informações Básicas */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Informações da Visita</h2>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-slate-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-slate-600 mb-1">Membro Visitado</p>
                  <p className="font-semibold text-slate-900">{visit.members?.full_name || 'Membro'}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{visit.members?.phone || 'Sem telefone'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-slate-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-slate-600 mb-1">Data e Hora</p>
                  <p className="font-semibold text-slate-900">
                    {visit.scheduled_at ? new Date(visit.scheduled_at).toLocaleDateString('pt-BR', { 
                      day: '2-digit', 
                      month: 'long', 
                      year: 'numeric' 
                    }) : '-'}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Duração: {visit.duration_minutes || 0} min</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-slate-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-slate-600 mb-1">Local</p>
                  <p className="font-semibold text-slate-900">{visit.address || visit.location_name || 'Não informado'}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-slate-400 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-slate-600 mb-1">Responsável</p>
                  <p className="font-semibold text-slate-900">{visit.users?.full_name || 'Responsável'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Motivo */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Motivo da Visita</h2>
            <p className="text-slate-700">{visit.reason || 'Sem motivo informado.'}</p>
          </div>

          {/* Anotações */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-purple-600" />
              <h2 className="text-xl font-bold text-slate-900">Anotações</h2>
            </div>
            <p className="text-slate-700 leading-relaxed">{visit.notes || 'Sem anotações registradas.'}</p>
          </div>

          {/* Pontos de Oração */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-bold text-slate-900">Pontos de Oração</h2>
            </div>
            <ul className="space-y-2">
              {prayerPoints.map((point, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-2" />
                  <span className="text-slate-700">{point.description}</span>
                </li>
              ))}
              {prayerPoints.length === 0 && <li className="text-slate-500">Sem pontos de oração.</li>}
            </ul>
          </div>

          {/* Próximos Passos */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <h2 className="text-xl font-bold text-slate-900">Próximos Passos</h2>
            </div>
            <ul className="space-y-2">
              {(visit.next_steps || '').split('\n').filter(Boolean).map((step, index) => (
                <li key={index} className="flex items-start gap-3">
                  <input 
                    type="checkbox" 
                    className="mt-1 w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                  />
                  <span className="text-slate-700">{step}</span>
                </li>
              ))}
              {!visit.next_steps && <li className="text-slate-500">Sem próximos passos.</li>}
            </ul>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Participantes */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Participantes</h3>
            <div className="space-y-3">
              {participants.map((participant, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-purple-600" />
                  </div>
                  <span className="text-sm font-medium text-slate-900">{participant.users?.full_name || participant.members?.full_name || 'Participante'}</span>
                </div>
              ))}
              {participants.length === 0 && <p className="text-sm text-slate-500">Sem participantes adicionais.</p>}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Ações Rápidas</h3>
            <div className="space-y-2">
              <button className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 rounded-lg border border-slate-200">
                Agendar Nova Visita
              </button>
              <button className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 rounded-lg border border-slate-200">
                Gerar Relatório
              </button>
              <button className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 rounded-lg border border-slate-200">
                Compartilhar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
