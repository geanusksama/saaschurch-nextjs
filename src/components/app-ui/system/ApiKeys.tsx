import { Key, Plus, Copy, Eye, EyeOff, Trash2, Calendar, Clock } from 'lucide-react';
import { useState } from 'react';

const apiKeys = [
  { id: 1, name: 'Integração Mobile App', key: 'sk_live_51Hxt...kJ9P', created: '2024-01-15', lastUsed: '2 horas atrás', status: 'active' },
  { id: 2, name: 'Webhook Automação', key: 'sk_live_51Kpo...mN2Q', created: '2024-02-20', lastUsed: '1 dia atrás', status: 'active' },
  { id: 3, name: 'API Teste', key: 'sk_test_51Abc...xY7Z', created: '2024-03-01', lastUsed: 'Nunca', status: 'inactive' },
];

export function ApiKeys() {
  const [showKey, setShowKey] = useState<number | null>(null);
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);

  return (
    <div className="p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Chaves de API</h1>
          <p className="text-slate-600 dark:text-slate-400">Gerencie tokens de acesso à API do MRM</p>
        </div>
        <button 
          onClick={() => setShowNewKeyModal(true)}
          className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nova Chave
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Key className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Chaves Ativas</p>
              <p className="text-2xl font-bold text-slate-900">2</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Requisições Hoje</p>
              <p className="text-2xl font-bold text-slate-900">1.2k</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Última Chamada</p>
              <p className="text-2xl font-bold text-slate-900">2h</p>
            </div>
          </div>
        </div>
      </div>

      {/* API Keys List */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">Suas Chaves de API</h2>
        </div>

        <div className="divide-y divide-slate-200">
          {apiKeys.map((apiKey) => (
            <div key={apiKey.id} className="p-6 hover:bg-slate-50 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-slate-900">{apiKey.name}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      apiKey.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {apiKey.status === 'active' ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <code className="bg-slate-100 px-3 py-1.5 rounded font-mono text-sm text-slate-900">
                      {showKey === apiKey.id ? 'sk_live_51HxtJ9P2kN...complete_key_here' : apiKey.key}
                    </code>
                    <button
                      onClick={() => setShowKey(showKey === apiKey.id ? null : apiKey.id)}
                      className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                      title={showKey === apiKey.id ? 'Ocultar' : 'Mostrar'}
                    >
                      {showKey === apiKey.id ? (
                        <EyeOff className="w-4 h-4 text-slate-600" />
                      ) : (
                        <Eye className="w-4 h-4 text-slate-600" />
                      )}
                    </button>
                    <button
                      onClick={() => navigator.clipboard.writeText(apiKey.key)}
                      className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                      title="Copiar"
                    >
                      <Copy className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-slate-600">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      Criada em {new Date(apiKey.created).toLocaleDateString('pt-BR')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Último uso: {apiKey.lastUsed}
                    </span>
                  </div>
                </div>

                <button className="p-2 hover:bg-red-100 rounded-lg transition-colors group">
                  <Trash2 className="w-5 h-5 text-slate-400 group-hover:text-red-600" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Documentation */}
      <div className="mt-6 bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border border-purple-100 p-6">
        <h3 className="font-bold text-slate-900 mb-4">📚 Documentação da API</h3>
        
        <div className="space-y-3 text-sm text-slate-600">
          <div className="bg-white rounded-lg p-4">
            <p className="font-semibold text-slate-900 mb-2">Endpoint Base:</p>
            <code className="bg-slate-100 px-3 py-1.5 rounded font-mono text-xs block">
              https://api.mrm.church/v1
            </code>
          </div>

          <div className="bg-white rounded-lg p-4">
            <p className="font-semibold text-slate-900 mb-2">Autenticação:</p>
            <code className="bg-slate-100 px-3 py-1.5 rounded font-mono text-xs block">
              Authorization: Bearer YOUR_API_KEY
            </code>
          </div>

          <div className="bg-white rounded-lg p-4">
            <p className="font-semibold text-slate-900 mb-2">Exemplo de Requisição:</p>
            <pre className="bg-slate-100 px-3 py-2 rounded font-mono text-xs overflow-x-auto">
{`curl -X GET "https://api.mrm.church/v1/members" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"`}
            </pre>
          </div>
        </div>

        <a 
          href="#" 
          className="inline-flex items-center gap-2 mt-4 text-purple-600 hover:text-purple-700 font-semibold"
        >
          Ver documentação completa →
        </a>
      </div>

      {/* New Key Modal */}
      {showNewKeyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Criar Nova Chave de API</h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nome da Chave
                </label>
                <input
                  type="text"
                  placeholder="Ex: Integração WhatsApp"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Permissões
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked className="w-4 h-4 text-purple-600 rounded" />
                    <span className="text-sm text-slate-700">Leitura</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="w-4 h-4 text-purple-600 rounded" />
                    <span className="text-sm text-slate-700">Escrita</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="w-4 h-4 text-purple-600 rounded" />
                    <span className="text-sm text-slate-700">Admin</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowNewKeyModal(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                Criar Chave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
