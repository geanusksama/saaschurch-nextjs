import { Code, Key, Book, Copy, Check, ExternalLink, Terminal, FileCode } from 'lucide-react';
import { useState } from 'react';

export function Api() {
  const [copied, setCopied] = useState<string | null>(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState('members');

  const apiKey = 'mrm_live_sk_1234567890abcdefghijklmnop';
  const apiUrl = 'https://api.mrm.exemplo.com/v1';

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const endpoints = [
    {
      id: 'members',
      name: 'Membros',
      description: 'Gerenciar membros da igreja',
      methods: [
        { method: 'GET', path: '/members', description: 'Listar todos os membros' },
        { method: 'POST', path: '/members', description: 'Criar novo membro' },
        { method: 'GET', path: '/members/:id', description: 'Buscar membro específico' },
        { method: 'PUT', path: '/members/:id', description: 'Atualizar membro' },
        { method: 'DELETE', path: '/members/:id', description: 'Deletar membro' },
      ]
    },
    {
      id: 'events',
      name: 'Eventos',
      description: 'Gerenciar eventos e check-ins',
      methods: [
        { method: 'GET', path: '/events', description: 'Listar eventos' },
        { method: 'POST', path: '/events', description: 'Criar evento' },
        { method: 'POST', path: '/events/:id/checkin', description: 'Fazer check-in' },
      ]
    },
    {
      id: 'finance',
      name: 'Financeiro',
      description: 'Transações e relatórios financeiros',
      methods: [
        { method: 'GET', path: '/transactions', description: 'Listar transações' },
        { method: 'POST', path: '/transactions', description: 'Criar transação' },
        { method: 'GET', path: '/reports/financial', description: 'Relatório financeiro' },
      ]
    },
    {
      id: 'crm',
      name: 'CRM',
      description: 'Leads e pipeline',
      methods: [
        { method: 'GET', path: '/leads', description: 'Listar leads' },
        { method: 'POST', path: '/leads', description: 'Criar lead' },
        { method: 'PUT', path: '/leads/:id/stage', description: 'Mover lead no pipeline' },
      ]
    },
  ];

  const selectedEndpointData = endpoints.find(e => e.id === selectedEndpoint);

  const exampleCode = `// Exemplo: Listar membros
const response = await fetch('${apiUrl}/members', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ${apiKey}',
    'Content-Type': 'application/json'
  }
});

const members = await response.json();
console.log(members);`;

  const exampleResponse = `{
  "data": [
    {
      "id": "mem_1234",
      "name": "João Silva",
      "email": "joao@exemplo.com",
      "phone": "+5511999999999",
      "status": "active",
      "joined_at": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 245
  }
}`;

  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
            <Code className="w-6 h-6 text-slate-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Documentação da API</h1>
            <p className="text-slate-600 dark:text-slate-400">Acesso programático aos dados do MRM</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* API Key */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Key className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="font-bold text-slate-900">Sua API Key</h3>
            </div>
            
            <div className="bg-slate-50 rounded-lg p-3 mb-3">
              <code className="text-xs text-slate-700 break-all">{apiKey}</code>
            </div>

            <button
              onClick={() => copyToClipboard(apiKey, 'api-key')}
              className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm"
            >
              {copied === 'api-key' ? (
                <>
                  <Check className="w-4 h-4" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copiar Key
                </>
              )}
            </button>

            <p className="text-xs text-red-600 mt-3">
              ⚠️ Mantenha sua API key segura e nunca a exponha em código público
            </p>
          </div>

          {/* Quick Info */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Informações Rápidas</h3>
            
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Base URL</p>
                <code className="text-xs text-slate-900 bg-slate-50 px-2 py-1 rounded">
                  {apiUrl}
                </code>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Versão</p>
                <code className="text-xs text-slate-900 bg-slate-50 px-2 py-1 rounded">
                  v1
                </code>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Rate Limit</p>
                <code className="text-xs text-slate-900 bg-slate-50 px-2 py-1 rounded">
                  100 req/min
                </code>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-500 mb-1">Formato</p>
                <code className="text-xs text-slate-900 bg-slate-50 px-2 py-1 rounded">
                  JSON
                </code>
              </div>
            </div>
          </div>

          {/* Resources */}
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-blue-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Recursos</h3>
            
            <div className="space-y-2">
              <a href="#" className="flex items-center justify-between p-3 bg-white rounded-lg hover:shadow-md transition-all">
                <div className="flex items-center gap-2">
                  <Book className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-slate-900">Docs Completas</span>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-400" />
              </a>

              <a href="#" className="flex items-center justify-between p-3 bg-white rounded-lg hover:shadow-md transition-all">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-purple-600" />
                  <span className="text-sm font-medium text-slate-900">Exemplos</span>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-400" />
              </a>

              <a href="#" className="flex items-center justify-between p-3 bg-white rounded-lg hover:shadow-md transition-all">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-slate-900">Postman</span>
                </div>
                <ExternalLink className="w-4 h-4 text-slate-400" />
              </a>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Authentication */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Autenticação</h3>
            <p className="text-slate-600 mb-4">
              Todas as requisições devem incluir sua API key no header Authorization:
            </p>
            
            <div className="bg-slate-900 rounded-lg p-4 relative">
              <button
                onClick={() => copyToClipboard('Authorization: Bearer ' + apiKey, 'auth-header')}
                className="absolute top-3 right-3 p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                {copied === 'auth-header' ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-slate-400" />
                )}
              </button>
              <code className="text-sm text-green-400">
                Authorization: Bearer {apiKey}
              </code>
            </div>
          </div>

          {/* Endpoints */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="border-b border-slate-200">
              <div className="flex overflow-x-auto">
                {endpoints.map(endpoint => (
                  <button
                    key={endpoint.id}
                    onClick={() => setSelectedEndpoint(endpoint.id)}
                    className={`px-6 py-4 whitespace-nowrap border-b-2 transition-colors ${
                      selectedEndpoint === endpoint.id
                        ? 'border-purple-600 bg-purple-50 text-purple-700 font-semibold'
                        : 'border-transparent text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {endpoint.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6">
              <p className="text-slate-600 mb-6">{selectedEndpointData?.description}</p>

              <div className="space-y-4">
                {selectedEndpointData?.methods.map((method, index) => (
                  <div key={index} className="border border-slate-200 rounded-lg p-4">
                    <div className="flex items-start gap-3 mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        method.method === 'GET' ? 'bg-blue-100 text-blue-700' :
                        method.method === 'POST' ? 'bg-green-100 text-green-700' :
                        method.method === 'PUT' ? 'bg-orange-100 text-orange-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {method.method}
                      </span>
                      <code className="text-sm font-mono text-slate-900">{method.path}</code>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{method.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Code Example */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-300">Exemplo de Código</span>
              </div>
              <button
                onClick={() => copyToClipboard(exampleCode, 'code-example')}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                {copied === 'code-example' ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-slate-400" />
                )}
              </button>
            </div>
            <pre className="bg-slate-900 px-6 py-4 overflow-x-auto">
              <code className="text-sm text-slate-300">{exampleCode}</code>
            </pre>
          </div>

          {/* Response Example */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-300">Exemplo de Resposta</span>
              </div>
              <button
                onClick={() => copyToClipboard(exampleResponse, 'response-example')}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                {copied === 'response-example' ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-slate-400" />
                )}
              </button>
            </div>
            <pre className="bg-slate-900 px-6 py-4 overflow-x-auto">
              <code className="text-sm text-slate-300">{exampleResponse}</code>
            </pre>
          </div>

          {/* Error Codes */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Códigos de Erro</h3>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <code className="px-2 py-1 bg-red-100 text-red-700 rounded text-sm font-mono">400</code>
                <div>
                  <p className="font-medium text-slate-900">Bad Request</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Parâmetros inválidos ou faltando</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <code className="px-2 py-1 bg-red-100 text-red-700 rounded text-sm font-mono">401</code>
                <div>
                  <p className="font-medium text-slate-900">Unauthorized</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">API key inválida ou ausente</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <code className="px-2 py-1 bg-red-100 text-red-700 rounded text-sm font-mono">404</code>
                <div>
                  <p className="font-medium text-slate-900">Not Found</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Recurso não encontrado</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <code className="px-2 py-1 bg-red-100 text-red-700 rounded text-sm font-mono">429</code>
                <div>
                  <p className="font-medium text-slate-900">Rate Limit Exceeded</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Muitas requisições em pouco tempo</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <code className="px-2 py-1 bg-red-100 text-red-700 rounded text-sm font-mono">500</code>
                <div>
                  <p className="font-medium text-slate-900">Server Error</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Erro interno do servidor</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
