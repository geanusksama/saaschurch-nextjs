import { useMemo, useState } from 'react';
import { Target, User, Phone, Calendar, Clock, AlertCircle, TrendingUp, Plus, Search, CheckCircle } from 'lucide-react';
import { Link } from 'react-router';
import { usePastoralVisits } from '../../lib/pastoralHooks';

type StageKey = 'all' | 'new' | 'active' | 'pending' | 'completed';

function classifyStage(visit: any): Exclude<StageKey, 'all'> {
  if (visit.status === 'completed') return 'completed';
  if (visit.followup_date && new Date(visit.followup_date).getTime() < Date.now()) return 'pending';
  if (visit.created_at && Date.now() - new Date(visit.created_at).getTime() <= 7 * 24 * 60 * 60 * 1000) return 'new';
  return 'active';
}

export default function FollowupDashboard() {
  const [search, setSearch] = useState('');
  const [selectedStage, setSelectedStage] = useState<StageKey>('all');
  const { data: visits = [], isLoading } = usePastoralVisits({ status: 'all', search });

  const visitors = useMemo(
    () =>
      visits.map((visit: any) => {
        const stageKey = classifyStage(visit);
        return {
          id: visit.id,
          name: visit.members?.full_name || 'Membro',
          phone: visit.members?.phone || 'Sem telefone',
          firstVisit: visit.created_at,
          lastContact: visit.updated_at || visit.created_at,
          status: stageKey,
          stage: stageKey === 'new' ? 'Primeira visita' : stageKey === 'active' ? 'Em andamento' : stageKey === 'pending' ? 'Pendente' : 'Integrado',
          nextAction: visit.next_steps?.split('\n')[0] || 'Definir proxima acao',
          nextActionDate: visit.followup_date || visit.scheduled_at,
          responsible: visit.users?.full_name || 'Responsavel',
          notes: visit.reason || visit.notes || 'Sem observacao',
        };
      }),
    [visits],
  );

  const filteredVisitors = visitors.filter((visitor) => {
    const text = `${visitor.name} ${visitor.phone} ${visitor.responsible}`.toLowerCase();
    const matchesSearch = text.includes(search.toLowerCase());
    const matchesStage = selectedStage === 'all' || visitor.status === selectedStage;
    return matchesSearch && matchesStage;
  });

  const stages = [
    { id: 'new' as const, name: 'Novos', count: visitors.filter((v) => v.status === 'new').length },
    { id: 'active' as const, name: 'Em andamento', count: visitors.filter((v) => v.status === 'active').length },
    { id: 'pending' as const, name: 'Pendentes', count: visitors.filter((v) => v.status === 'pending').length },
    { id: 'completed' as const, name: 'Integrados', count: visitors.filter((v) => v.status === 'completed').length },
  ];

  const tasksToday = visitors.filter((v) => v.nextActionDate && new Date(v.nextActionDate).toDateString() === new Date().toDateString()).length;
  const pendingContacts = visitors.filter((v) => v.status === 'pending').length;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center"><TrendingUp className="w-6 h-6 text-orange-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard de Follow-up</h1>
            <p className="text-slate-600">Acompanhamento de visitantes e novos convertidos</p>
          </div>
        </div>
        <Link to="/app-ui/visit-new" className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
          <Plus className="w-5 h-5" /> Nova Visita
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {stages.map((stage) => (
          <div key={stage.id} className="bg-white rounded-xl border border-slate-200 p-6">
            <p className="text-sm text-slate-600">{stage.name}</p>
            <p className="text-2xl font-bold text-slate-900">{stage.count}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl border border-orange-200 p-6">
          <div className="flex items-center gap-3 mb-3"><Clock className="w-5 h-5 text-orange-600" /><h3 className="font-bold text-slate-900">Tarefas para hoje</h3></div>
          <p className="text-sm text-slate-600">{tasksToday} acoes previstas para hoje.</p>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-xl border border-red-200 p-6">
          <div className="flex items-center gap-3 mb-3"><AlertCircle className="w-5 h-5 text-red-600" /><h3 className="font-bold text-slate-900">Contatos pendentes</h3></div>
          <p className="text-sm text-slate-600">{pendingContacts} pessoas aguardando retorno.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 mb-6">
        <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome, telefone ou responsavel" className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg" />
          </div>
          <select value={selectedStage} onChange={(e) => setSelectedStage(e.target.value as StageKey)} className="px-4 py-2 border border-slate-300 rounded-lg">
            <option value="all">Todos</option>
            {stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
          </select>
        </div>

        {isLoading ? (
          <div className="p-6 text-sm text-slate-500">Carregando follow-up...</div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredVisitors.map((visitor) => (
              <div key={visitor.id} className="p-6 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-slate-900">{visitor.name}</h3>
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">{visitor.stage}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-slate-600 mb-2">
                      <div className="flex items-center gap-1.5"><Phone className="w-4 h-4" />{visitor.phone}</div>
                      <div className="flex items-center gap-1.5"><Calendar className="w-4 h-4" />{visitor.firstVisit ? new Date(visitor.firstVisit).toLocaleDateString('pt-BR') : '-'}</div>
                      <div className="flex items-center gap-1.5"><User className="w-4 h-4" />{visitor.responsible}</div>
                    </div>
                    <p className="text-sm text-slate-700">{visitor.nextAction}</p>
                  </div>
                  <Link to={`/app-ui/pastoral/visit-detail?id=${visitor.id}`} className="px-4 py-2 text-sm font-medium text-purple-600 hover:bg-purple-50 rounded-lg border border-purple-200">Ver perfil</Link>
                </div>
              </div>
            ))}
            {filteredVisitors.length === 0 && <div className="p-12 text-center text-slate-500">Nenhum registro de follow-up encontrado.</div>}
          </div>
        )}
      </div>

      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200 p-6">
        <div className="flex items-center gap-2 mb-2"><Target className="w-5 h-5 text-purple-600" /><h2 className="font-bold text-slate-900">Processo de follow-up</h2></div>
        <p className="text-sm text-slate-600">Fluxo atual: primeira visita, contato inicial, acompanhamento em celula, consolidacao e integracao.</p>
        <div className="mt-3 flex items-center gap-2 text-sm text-slate-700"><CheckCircle className="w-4 h-4 text-green-600" />Os dados acima sao alimentados pelas visitas pastorais reais.</div>
      </div>
    </div>
  );
}
