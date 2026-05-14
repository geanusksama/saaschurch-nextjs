import { Zap, Plus, Play, Pause, Settings, TrendingUp, Mail, MessageSquare, Bell, Users, Calendar } from 'lucide-react';
import { Link } from 'react-router';

const automations = [
  { 
    id: 1, 
    name: 'Boas-vindas Visitante', 
    trigger: 'Novo visitante registrado', 
    actions: 3, 
    status: 'Ativo', 
    executions: 124,
    successRate: 98
  },
  { 
    id: 2, 
    name: 'Notificação Batismo', 
    trigger: 'Pedido de batismo criado', 
    actions: 2, 
    status: 'Ativo', 
    executions: 45,
    successRate: 100
  },
  { 
    id: 3, 
    name: 'Lembrete Evento', 
    trigger: '24h antes do evento', 
    actions: 4, 
    status: 'Ativo', 
    executions: 312,
    successRate: 95
  },
  { 
    id: 4, 
    name: 'Follow-up Ausente', 
    trigger: 'Membro ausente 3 cultos', 
    actions: 2, 
    status: 'Pausado', 
    executions: 28,
    successRate: 89
  },
  { 
    id: 5, 
    name: 'Confirmação Ingresso', 
    trigger: 'Ingresso comprado', 
    actions: 5, 
    status: 'Ativo', 
    executions: 856,
    successRate: 99
  },
];

const templates = [
  { id: 1, name: 'Boas-vindas Visitante', category: 'Visitantes', uses: 12 },
  { id: 2, name: 'Lembrete Evento', category: 'Eventos', uses: 8 },
  { id: 3, name: 'Follow-up Ausente', category: 'Membros', uses: 15 },
  { id: 4, name: 'Confirmação Dízimo', category: 'Financeiro', uses: 3 },
];

export function Automation() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center">
            <Zap className="w-6 h-6 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Automações</h1>
            <p className="text-slate-600 dark:text-slate-400">Crie fluxos automatizados para comunicação e processos</p>
          </div>
        </div>
        <Link 
          to="/app-ui/automation/builder"
          className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nova Automação
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Automações Ativas</p>
              <p className="text-2xl font-bold text-slate-900">12</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Execuções Hoje</p>
              <p className="text-2xl font-bold text-slate-900">1,248</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Play className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Taxa de Sucesso</p>
              <p className="text-2xl font-bold text-slate-900">97%</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <Bell className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Mensagens Enviadas</p>
              <p className="text-2xl font-bold text-slate-900">45K</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Automations List */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-900">Minhas Automações</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {automations.map((automation) => (
                <div key={automation.id} className="border border-slate-200 rounded-lg p-4 hover:border-purple-300 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        automation.status === 'Ativo' ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                        <Zap className={`w-5 h-5 ${
                          automation.status === 'Ativo' ? 'text-green-600' : 'text-gray-400'
                        }`} />
                      </div>
                      <div>
                        <Link to={`/app-ui/automation/${automation.id}`} className="font-semibold text-slate-900 hover:text-purple-600">
                          {automation.name}
                        </Link>
                        <p className="text-sm text-slate-600 mt-1">{automation.trigger}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        automation.status === 'Ativo' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {automation.status}
                      </span>
                      <button className="p-2 hover:bg-slate-100 rounded-lg">
                        <Settings className="w-4 h-4 text-slate-600" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
                      <span>{automation.actions} ações</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Play className="w-4 h-4" />
                      <span>{automation.executions} execuções</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      <span className="text-green-600">{automation.successRate}% sucesso</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Templates */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-900">Templates</h2>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {templates.map((template) => (
                <div key={template.id} className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50 cursor-pointer">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Zap className="w-4 h-4 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900 text-sm">{template.name}</p>
                      <p className="text-xs text-slate-500">{template.category}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{template.uses} igrejas usando</p>
                </div>
              ))}
            </div>
            <button className="w-full mt-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-sm font-medium text-slate-700">
              Ver Todos os Templates
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
