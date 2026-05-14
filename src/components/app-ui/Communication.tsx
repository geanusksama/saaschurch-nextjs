import { MessageSquare, Mail, Send, Users, BarChart3 } from 'lucide-react';
import { useState } from 'react';

const channels = [
  { id: 'whatsapp', name: 'WhatsApp', icon: MessageSquare, color: 'bg-green-500', sent: 1250, delivered: 1180, read: 920 },
  { id: 'email', name: 'Email', icon: Mail, color: 'bg-blue-500', sent: 890, delivered: 875, opened: 520 },
  { id: 'sms', name: 'SMS', icon: Send, color: 'bg-purple-500', sent: 450, delivered: 445, read: 380 },
];

const campaigns = [
  { id: '1', name: 'Convite Congresso CIBE', channel: 'WhatsApp', status: 'enviada', sent: 2500, opened: 1850, date: '2024-03-10' },
  { id: '2', name: 'Newsletter Semanal', channel: 'Email', status: 'agendada', sent: 0, opened: 0, date: '2024-03-17' },
  { id: '3', name: 'Lembrete Culto', channel: 'SMS', status: 'enviada', sent: 350, opened: 298, date: '2024-03-14' },
  { id: '4', name: 'Pedido de Oração', channel: 'Email', status: 'rascunho', sent: 0, opened: 0, date: '-' },
];

export function Communication() {
  const [activeTab, setActiveTab] = useState('campaigns');

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Central de Comunicação</h1>
            <p className="text-slate-600 dark:text-slate-400">Gerencie todas as comunicações da igreja</p>
          </div>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium">
          <Send className="w-5 h-5" />
          Nova Campanha
        </button>
      </div>

      {/* Channel Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {channels.map((channel) => {
          const Icon = channel.icon;
          return (
            <div key={channel.id} className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className={`${channel.color} w-12 h-12 rounded-lg flex items-center justify-center`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{channel.name}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Últimos 30 dias</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Enviadas</span>
                  <span className="font-semibold text-slate-900">{channel.sent}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Entregues</span>
                  <span className="font-semibold text-green-600">{channel.delivered}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Lidas/Abertas</span>
                  <span className="font-semibold text-blue-600">{channel.read || channel.opened}</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Taxa de Abertura</span>
                  <span className="font-bold text-purple-600">
                    {Math.round(((channel.read || channel.opened || 0) / channel.sent) * 100)}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('campaigns')}
          className={`px-6 py-2.5 rounded-lg font-medium ${
            activeTab === 'campaigns'
              ? 'bg-purple-600 text-white'
              : 'bg-white border border-slate-200 text-slate-700'
          }`}
        >
          Campanhas
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`px-6 py-2.5 rounded-lg font-medium ${
            activeTab === 'templates'
              ? 'bg-purple-600 text-white'
              : 'bg-white border border-slate-200 text-slate-700'
          }`}
        >
          Modelos
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-6 py-2.5 rounded-lg font-medium ${
            activeTab === 'analytics'
              ? 'bg-purple-600 text-white'
              : 'bg-white border border-slate-200 text-slate-700'
          }`}
        >
          Análises
        </button>
      </div>

      {/* Campaigns Table */}
      {activeTab === 'campaigns' && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">Campanhas Recentes</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Campanha</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Canal</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Status</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Enviadas</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Taxa Abertura</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Data</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-slate-700">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campaigns.map((campaign) => (
                  <tr key={campaign.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-900">{campaign.name}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-2 text-sm text-slate-700">
                        {campaign.channel === 'WhatsApp' && <MessageSquare className="w-4 h-4 text-green-600" />}
                        {campaign.channel === 'Email' && <Mail className="w-4 h-4 text-blue-600" />}
                        {campaign.channel === 'SMS' && <Send className="w-4 h-4 text-purple-600" />}
                        {campaign.channel}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                        campaign.status === 'enviada' ? 'bg-green-100 text-green-700' :
                        campaign.status === 'agendada' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-700">{campaign.sent}</td>
                    <td className="px-6 py-4">
                      {campaign.sent > 0 ? (
                        <span className="text-purple-600 font-semibold">
                          {Math.round((campaign.opened / campaign.sent) * 100)}%
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {campaign.date !== '-' ? new Date(campaign.date).toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="px-4 py-2 text-sm font-medium text-purple-600 hover:bg-purple-50 rounded-lg">
                        Ver Detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Templates */}
      {activeTab === 'templates' && (
        <div className="grid md:grid-cols-3 gap-6">
          {['Boas-vindas', 'Convite de Evento', 'Pedido de Oração', 'Newsletter', 'Lembrete', 'Agradecimento'].map((template) => (
            <div key={template} className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-shadow cursor-pointer">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <Mail className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-bold text-slate-900 mb-2">{template}</h3>
              <p className="text-sm text-slate-600 mb-4">Modelo pronto para uso</p>
              <button className="w-full py-2 border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 font-medium">
                Usar Modelo
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Analytics */}
      {activeTab === 'analytics' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <BarChart3 className="w-6 h-6 text-purple-600" />
            <h3 className="text-lg font-bold text-slate-900">Análise de Desempenho</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-600 mb-1">Total de Mensagens Enviadas</p>
              <p className="text-2xl font-bold text-slate-900">2,590</p>
              <p className="text-sm text-green-600 mt-1">+18% vs mês anterior</p>
            </div>
            <div className="p-6 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-600 mb-1">Taxa Média de Abertura</p>
              <p className="text-2xl font-bold text-slate-900">68%</p>
              <p className="text-sm text-green-600 mt-1">+5% vs mês anterior</p>
            </div>
            <div className="p-6 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-600 mb-1">Engajamento Total</p>
              <p className="text-2xl font-bold text-slate-900">1,758</p>
              <p className="text-sm text-slate-500 mt-1">Cliques e respostas</p>
            </div>
            <div className="p-6 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-600 mb-1">Melhor Canal</p>
              <p className="text-2xl font-bold text-slate-900">WhatsApp</p>
              <p className="text-sm text-slate-500 mt-1">74% taxa de leitura</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
