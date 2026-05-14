import { Webhook, Plus, Play, Pause, Trash2, Check, X, Clock } from 'lucide-react';
import { useState } from 'react';

const webhooks = [
  { id: 1, name: 'Novo Membro', url: 'https://api.exemplo.com/webhooks/novo-membro', event: 'member.created', status: 'active', calls: 145, lastTrigger: '2 horas atrás', success: 143, failed: 2 },
  { id: 2, name: 'Batismo Aprovado', url: 'https://api.exemplo.com/webhooks/batismo', event: 'baptism.approved', status: 'active', calls: 28, lastTrigger: '1 dia atrás', success: 28, failed: 0 },
  { id: 3, name: 'Contribuição Recebida', url: 'https://api.exemplo.com/webhooks/doacao', event: 'donation.received', status: 'paused', calls: 892, lastTrigger: '3 dias atrás', success: 890, failed: 2 },
];

const availableEvents = [
  { category: 'Membros', events: ['member.created', 'member.updated', 'member.deleted'] },
  { category: 'Batismo', events: ['baptism.requested', 'baptism.approved', 'baptism.completed'] },
  { category: 'Eventos', events: ['event.created', 'event.checkin', 'event.completed'] },
  { category: 'Financeiro', events: ['donation.received', 'payment.processed', 'invoice.sent'] },
];

export function Webhooks() {
  const [showNewModal, setShowNewModal] = useState(false);

  return (
    <div className="p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Webhooks</h1>
          <p className="text-slate-600 dark:text-slate-400">Configure callbacks HTTP para eventos do sistema</p>
        </div>
        <button 
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Novo Webhook
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Webhook className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Webhooks Ativos</p>
              <p className="text-2xl font-bold text-slate-900">2</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Chamadas com Sucesso</p>
              <p className="text-2xl font-bold text-slate-900">1.061</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <X className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Falhas</p>
              <p className="text-2xl font-bold text-slate-900">4</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Último Trigger</p>
              <p className="text-2xl font-bold text-slate-900">2h</p>
            </div>
          </div>
        </div>
      </div>

      {/* Webhooks List */}
      <div className="bg-white rounded-xl border border-slate-200 mb-6">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">Webhooks Configurados</h2>
        </div>

        <div className="divide-y divide-slate-200">
          {webhooks.map((webhook) => (
            <div key={webhook.id} className="p-6 hover:bg-slate-50 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-slate-900">{webhook.name}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      webhook.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {webhook.status === 'active' ? 'Ativo' : 'Pausado'}
                    </span>
                  </div>

                  <div className="space-y-1 mb-3">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      <span className="font-medium">Evento:</span> <code className="bg-slate-100 px-2 py-0.5 rounded text-xs">{webhook.event}</code>
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      <span className="font-medium">URL:</span> <code className="bg-slate-100 px-2 py-0.5 rounded text-xs">{webhook.url}</code>
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-slate-600">
                      {webhook.calls} chamadas
                    </span>
                    <span className="text-green-600 flex items-center gap-1">
                      <Check className="w-4 h-4" />
                      {webhook.success} sucesso
                    </span>
                    {webhook.failed > 0 && (
                      <span className="text-red-600 flex items-center gap-1">
                        <X className="w-4 h-4" />
                        {webhook.failed} falhas
                      </span>
                    )}
                    <span className="text-slate-500">
                      Último: {webhook.lastTrigger}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button 
                    className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                    title={webhook.status === 'active' ? 'Pausar' : 'Ativar'}
                  >
                    {webhook.status === 'active' ? (
                      <Pause className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                    ) : (
                      <Play className="w-5 h-5 text-green-600" />
                    )}
                  </button>
                  <button className="p-2 hover:bg-red-100 rounded-lg transition-colors group">
                    <Trash2 className="w-5 h-5 text-slate-400 group-hover:text-red-600" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Available Events */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">Eventos Disponíveis</h2>
        </div>

        <div className="p-6">
          <div className="grid md:grid-cols-2 gap-6">
            {availableEvents.map((category) => (
              <div key={category.category} className="border border-slate-200 rounded-lg p-4">
                <h3 className="font-semibold text-slate-900 mb-3">{category.category}</h3>
                <div className="space-y-2">
                  {category.events.map((event) => (
                    <code key={event} className="block bg-slate-100 px-3 py-2 rounded text-xs text-slate-900">
                      {event}
                    </code>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* New Webhook Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Criar Novo Webhook</h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nome
                </label>
                <input
                  type="text"
                  placeholder="Ex: Notificar novo membro"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  URL do Webhook
                </label>
                <input
                  type="url"
                  placeholder="https://api.exemplo.com/webhook"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Evento
                </label>
                <select className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                  <option>Selecione um evento</option>
                  <option>member.created</option>
                  <option>member.updated</option>
                  <option>baptism.approved</option>
                  <option>donation.received</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Secret Key (opcional)
                </label>
                <input
                  type="password"
                  placeholder="Chave secreta para assinatura"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-xs text-slate-500 mt-1">Usada para assinar requisições HMAC</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowNewModal(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                Criar Webhook
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
