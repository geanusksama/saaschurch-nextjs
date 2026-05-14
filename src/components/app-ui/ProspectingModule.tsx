import { Target, Plus, Phone, Mail, Calendar, User, TrendingUp, MessageSquare } from 'lucide-react';
import { Badge } from '../../design-system/components/Badge';

const prospects = [
  {
    id: 1,
    name: 'Roberto Almeida',
    phone: '(11) 99111-1111',
    email: 'roberto@email.com',
    source: 'Indicação',
    stage: 'Contato Inicial',
    score: 85,
    lastContact: '2024-03-15',
    assignedTo: 'Pastor João',
    notes: 'Interessado em conhecer a igreja'
  },
  {
    id: 2,
    name: 'Juliana Fernandes',
    phone: '(11) 99222-2222',
    email: 'juliana@email.com',
    source: 'Redes Sociais',
    stage: 'Visitou Culto',
    score: 92,
    lastContact: '2024-03-14',
    assignedTo: 'Maria Santos',
    notes: 'Participou do culto de domingo'
  },
  {
    id: 3,
    name: 'Marcelo Costa',
    phone: '(11) 99333-3333',
    email: 'marcelo@email.com',
    source: 'Site',
    stage: 'Em Acompanhamento',
    score: 78,
    lastContact: '2024-03-12',
    assignedTo: 'Pastor João',
    notes: 'Interessado em batismo'
  },
  {
    id: 4,
    name: 'Patrícia Lima',
    phone: '(11) 99444-4444',
    email: 'patricia@email.com',
    source: 'Evento',
    stage: 'Novo Lead',
    score: 65,
    lastContact: '2024-03-10',
    assignedTo: 'Pedro Oliveira',
    notes: 'Conheceu a igreja no congresso'
  },
];

const stages = [
  { name: 'Novo Lead', count: 12, color: 'slate' },
  { name: 'Contato Inicial', count: 8, color: 'blue' },
  { name: 'Visitou Culto', count: 15, color: 'purple' },
  { name: 'Em Acompanhamento', count: 23, color: 'orange' },
  { name: 'Convertido', count: 45, color: 'green' },
];

export function ProspectingModule() {
  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
            <Target className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Prospecção</h1>
            <p className="text-slate-600 dark:text-slate-400">Gerencie novos visitantes e leads</p>
          </div>
        </div>
        <button className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
          <Plus className="w-5 h-5" />
          Novo Lead
        </button>
      </div>

      {/* Pipeline Stats */}
      <div className="grid md:grid-cols-5 gap-4 mb-8">
        {stages.map((stage) => (
          <div key={stage.name} className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className={`w-3 h-3 rounded-full bg-${stage.color}-500`} />
              <span className="text-2xl font-bold text-slate-900">{stage.count}</span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">{stage.name}</p>
          </div>
        ))}
      </div>

      {/* Prospects Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Leads Recentes</h2>
            <div className="flex gap-2">
              <select className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                <option>Todos os Estágios</option>
                <option>Novo Lead</option>
                <option>Contato Inicial</option>
                <option>Visitou Culto</option>
                <option>Em Acompanhamento</option>
              </select>
              <select className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                <option>Todos Responsáveis</option>
                <option>Pastor João</option>
                <option>Maria Santos</option>
                <option>Pedro Oliveira</option>
              </select>
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-200">
          {prospects.map((prospect) => (
            <div key={prospect.id} className="p-6 hover:bg-slate-50 transition-colors cursor-pointer">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-purple-700 font-bold text-lg">
                  {prospect.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-bold text-slate-900">{prospect.name}</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{prospect.notes}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right mr-4">
                        <div className="text-xs text-slate-500 mb-1">Score</div>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-purple-600 rounded-full"
                              style={{ width: `${prospect.score}%` }}
                            />
                          </div>
                          <span className="text-sm font-bold text-slate-900">{prospect.score}</span>
                        </div>
                      </div>
                      <Badge variant="active">{prospect.stage}</Badge>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                    <div className="flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      {prospect.phone}
                    </div>
                    <div className="flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      {prospect.email}
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      Fonte: {prospect.source}
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {prospect.assignedTo}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Último contato: {new Date(prospect.lastContact).toLocaleDateString('pt-BR')}
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <button className="flex items-center gap-1 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm font-medium">
                      <Phone className="w-4 h-4" />
                      Ligar
                    </button>
                    <button className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium">
                      <MessageSquare className="w-4 h-4" />
                      WhatsApp
                    </button>
                    <button className="flex items-center gap-1 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium">
                      <Mail className="w-4 h-4" />
                      Email
                    </button>
                    <button className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium">
                      Ver Detalhes
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
