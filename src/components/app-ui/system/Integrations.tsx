import { Plug, Check, Settings, ExternalLink, Plus, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface Integration {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  isConnected: boolean;
  isPremium: boolean;
}

export function Integrations() {
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: 'stripe',
      name: 'Stripe',
      description: 'Processamento de pagamentos e doações online',
      category: 'Financeiro',
      icon: '💳',
      isConnected: true,
      isPremium: false
    },
    {
      id: 'google-calendar',
      name: 'Google Calendar',
      description: 'Sincronize eventos com Google Calendar',
      category: 'Produtividade',
      icon: '📅',
      isConnected: true,
      isPremium: false
    },
    {
      id: 'mailchimp',
      name: 'Mailchimp',
      description: 'Marketing por email e automações',
      category: 'Marketing',
      icon: '🐵',
      isConnected: false,
      isPremium: false
    },
    {
      id: 'zoom',
      name: 'Zoom',
      description: 'Reuniões e transmissões ao vivo',
      category: 'Comunicação',
      icon: '🎥',
      isConnected: true,
      isPremium: false
    },
    {
      id: 'youtube',
      name: 'YouTube',
      description: 'Transmissão ao vivo e arquivo de vídeos',
      category: 'Comunicação',
      icon: '📺',
      isConnected: true,
      isPremium: false
    },
    {
      id: 'mercadopago',
      name: 'Mercado Pago',
      description: 'Gateway de pagamento brasileiro',
      category: 'Financeiro',
      icon: '💰',
      isConnected: false,
      isPremium: false
    },
    {
      id: 'pagseguro',
      name: 'PagSeguro',
      description: 'Processamento de pagamentos',
      category: 'Financeiro',
      icon: '💵',
      isConnected: false,
      isPremium: false
    },
    {
      id: 'google-drive',
      name: 'Google Drive',
      description: 'Armazenamento e compartilhamento de arquivos',
      category: 'Armazenamento',
      icon: '📁',
      isConnected: false,
      isPremium: false
    },
    {
      id: 'dropbox',
      name: 'Dropbox',
      description: 'Sincronização de arquivos na nuvem',
      category: 'Armazenamento',
      icon: '📦',
      isConnected: false,
      isPremium: true
    },
    {
      id: 'slack',
      name: 'Slack',
      description: 'Notificações e comunicação da equipe',
      category: 'Produtividade',
      icon: '💬',
      isConnected: false,
      isPremium: true
    },
    {
      id: 'zapier',
      name: 'Zapier',
      description: 'Conecte com 3000+ aplicativos',
      category: 'Automação',
      icon: '⚡',
      isConnected: false,
      isPremium: true
    },
    {
      id: 'hubspot',
      name: 'HubSpot',
      description: 'CRM e automação de marketing',
      category: 'Marketing',
      icon: '🚀',
      isConnected: false,
      isPremium: true
    },
  ]);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = [
    { id: 'all', name: 'Todas' },
    { id: 'Financeiro', name: 'Financeiro' },
    { id: 'Comunicação', name: 'Comunicação' },
    { id: 'Marketing', name: 'Marketing' },
    { id: 'Produtividade', name: 'Produtividade' },
    { id: 'Armazenamento', name: 'Armazenamento' },
    { id: 'Automação', name: 'Automação' },
  ];

  const filteredIntegrations = selectedCategory === 'all'
    ? integrations
    : integrations.filter(i => i.category === selectedCategory);

  const connectedCount = integrations.filter(i => i.isConnected).length;

  const toggleConnection = (id: string) => {
    setIntegrations(prev =>
      prev.map(integration =>
        integration.id === id
          ? { ...integration, isConnected: !integration.isConnected }
          : integration
      )
    );
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Integrações</h1>
          <div className="flex items-center gap-3">
            <div className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg">
              <span className="font-bold">{connectedCount}</span> conectadas
            </div>
          </div>
        </div>
        <p className="text-slate-600 dark:text-slate-400">Conecte aplicativos externos ao MRM</p>
      </div>

      {/* Category Filter */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="flex flex-wrap gap-2">
          {categories.map(category => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                selectedCategory === category.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      {/* Integrations Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredIntegrations.map(integration => (
          <div
            key={integration.id}
            className="bg-white rounded-xl border border-slate-200 p-6 hover:border-purple-300 hover:shadow-md transition-all"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-2xl">
                  {integration.icon}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{integration.name}</h3>
                  <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                    {integration.category}
                  </span>
                </div>
              </div>
              {integration.isPremium && (
                <span className="px-2 py-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-xs font-bold rounded">
                  PRO
                </span>
              )}
            </div>

            {/* Description */}
            <p className="text-sm text-slate-600 mb-4">
              {integration.description}
            </p>

            {/* Status and Action */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              {integration.isConnected ? (
                <div className="flex items-center gap-2 text-green-600">
                  <div className="w-2 h-2 bg-green-600 rounded-full" />
                  <span className="text-sm font-medium">Conectado</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-slate-400">
                  <div className="w-2 h-2 bg-slate-300 rounded-full" />
                  <span className="text-sm font-medium">Desconectado</span>
                </div>
              )}

              {integration.isConnected ? (
                <div className="flex gap-2">
                  <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                    <Settings className="w-4 h-4 text-slate-600" />
                  </button>
                  <button
                    onClick={() => toggleConnection(integration.id)}
                    className="px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm"
                  >
                    Desconectar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => toggleConnection(integration.id)}
                  className="px-4 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
                >
                  Conectar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredIntegrations.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Plug className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="font-bold text-slate-900 mb-2">Nenhuma integração encontrada</h3>
          <p className="text-slate-600 dark:text-slate-400">Tente selecionar outra categoria</p>
        </div>
      )}

      {/* Request Integration */}
      <div className="mt-8 bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border border-purple-200 p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Plus className="w-6 h-6 text-purple-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-slate-900 mb-2">Não encontrou a integração que procura?</h3>
            <p className="text-slate-600 mb-4">
              Sugira uma nova integração para o MRM. Nossa equipe avalia todas as solicitações e prioriza 
              as mais votadas pela comunidade.
            </p>
            <button className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2.5 rounded-lg hover:bg-purple-700 transition-colors">
              <Plus className="w-5 h-5" />
              Solicitar Integração
            </button>
          </div>
        </div>
      </div>

      {/* Integration Tips */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h4 className="font-semibold text-blue-900 mb-3">Dicas de Integração</h4>
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <ChevronRight className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-700">
              Configure integrações financeiras primeiro para processar doações online
            </p>
          </div>
          <div className="flex items-start gap-2">
            <ChevronRight className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-700">
              Conecte Google Calendar ou Zoom para automatizar eventos e reuniões
            </p>
          </div>
          <div className="flex items-start gap-2">
            <ChevronRight className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-700">
              Use Zapier para criar automações personalizadas com milhares de apps
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
