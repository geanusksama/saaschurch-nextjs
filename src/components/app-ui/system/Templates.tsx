import { Mail, MessageSquare, Smartphone, Plus, Edit, Trash2, Copy, Eye, Search, Filter } from 'lucide-react';
import { useState } from 'react';

const templates = [
  {
    id: 1,
    name: 'Boas-vindas Novo Membro',
    type: 'email',
    category: 'Membros',
    subject: 'Bem-vindo(a) à {{church_name}}!',
    lastModified: '2024-03-10',
    status: 'active'
  },
  {
    id: 2,
    name: 'Confirmação de Batismo',
    type: 'email',
    category: 'Eclesiástico',
    subject: 'Seu batismo foi agendado',
    lastModified: '2024-03-08',
    status: 'active'
  },
  {
    id: 3,
    name: 'Lembrete de Evento',
    type: 'whatsapp',
    category: 'Eventos',
    subject: 'Evento: {{event_name}} amanhã!',
    lastModified: '2024-03-15',
    status: 'active'
  },
  {
    id: 4,
    name: 'Confirmação de Doação',
    type: 'email',
    category: 'Financeiro',
    subject: 'Obrigado pela sua contribuição',
    lastModified: '2024-03-12',
    status: 'active'
  },
  {
    id: 5,
    name: 'Aniversário',
    type: 'whatsapp',
    category: 'Comunicação',
    subject: 'Feliz Aniversário {{member_name}}!',
    lastModified: '2024-03-05',
    status: 'active'
  },
  {
    id: 6,
    name: 'Recuperação de Senha',
    type: 'email',
    category: 'Sistema',
    subject: 'Redefinir sua senha',
    lastModified: '2024-02-28',
    status: 'active'
  },
  {
    id: 7,
    name: 'Novo Lead Atribuído',
    type: 'email',
    category: 'CRM',
    subject: 'Novo lead atribuído a você',
    lastModified: '2024-03-14',
    status: 'active'
  },
  {
    id: 8,
    name: 'Convite Célula',
    type: 'sms',
    category: 'Células',
    subject: 'Você foi convidado para uma célula',
    lastModified: '2024-03-11',
    status: 'draft'
  },
];

export function Templates() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'email' | 'whatsapp' | 'sms'>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || template.type === filterType;
    return matchesSearch && matchesType;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail className="w-4 h-4" />;
      case 'whatsapp': return <MessageSquare className="w-4 h-4" />;
      case 'sms': return <Smartphone className="w-4 h-4" />;
      default: return null;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'email': return 'bg-blue-100 text-blue-700';
      case 'whatsapp': return 'bg-green-100 text-green-700';
      case 'sms': return 'bg-orange-100 text-orange-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Templates de Notificação</h1>
          <button className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2.5 rounded-lg hover:bg-purple-700 transition-colors">
            <Plus className="w-5 h-5" />
            Novo Template
          </button>
        </div>
        <p className="text-slate-600 dark:text-slate-400">Modelos de email, WhatsApp e SMS</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Type Filter */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilterType('all')}
              className={`px-4 py-2.5 rounded-lg transition-colors ${
                filterType === 'all'
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterType('email')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors ${
                filterType === 'email'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Mail className="w-4 h-4" />
              Email
            </button>
            <button
              onClick={() => setFilterType('whatsapp')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors ${
                filterType === 'whatsapp'
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              WhatsApp
            </button>
            <button
              onClick={() => setFilterType('sms')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-colors ${
                filterType === 'sms'
                  ? 'bg-orange-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              SMS
            </button>
          </div>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map(template => (
          <div
            key={template.id}
            className="bg-white rounded-xl border border-slate-200 p-6 hover:border-purple-300 hover:shadow-md transition-all cursor-pointer"
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className={`p-2 rounded-lg ${getTypeColor(template.type)}`}>
                {getTypeIcon(template.type)}
              </div>
              <div className="flex gap-1">
                <button className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                  <Eye className="w-4 h-4 text-slate-600" />
                </button>
                <button className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                  <Edit className="w-4 h-4 text-slate-600" />
                </button>
                <button className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                  <Copy className="w-4 h-4 text-slate-600" />
                </button>
                <button className="p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="mb-4">
              <h3 className="font-bold text-slate-900 mb-2">{template.name}</h3>
              <p className="text-sm text-slate-600 mb-3">{template.subject}</p>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 bg-slate-100 text-slate-700 rounded-full">
                  {template.category}
                </span>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  template.status === 'active'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {template.status === 'active' ? 'Ativo' : 'Rascunho'}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-4 border-t border-slate-200">
              <p className="text-xs text-slate-500">
                Modificado em {new Date(template.lastModified).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Mail className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="font-bold text-slate-900 mb-2">Nenhum template encontrado</h3>
          <p className="text-slate-600 mb-4">Tente ajustar os filtros ou criar um novo template</p>
          <button className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2.5 rounded-lg hover:bg-purple-700 transition-colors mx-auto">
            <Plus className="w-5 h-5" />
            Criar Template
          </button>
        </div>
      )}

      {/* Variables Info */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h4 className="font-semibold text-blue-900 mb-2">Variáveis Disponíveis</h4>
        <p className="text-sm text-blue-700 mb-3">
          Use estas variáveis nos seus templates para personalização automática:
        </p>
        <div className="grid md:grid-cols-3 gap-2">
          <code className="text-xs bg-white px-2 py-1 rounded border border-blue-200">
            {'{{member_name}}'}
          </code>
          <code className="text-xs bg-white px-2 py-1 rounded border border-blue-200">
            {'{{church_name}}'}
          </code>
          <code className="text-xs bg-white px-2 py-1 rounded border border-blue-200">
            {'{{event_name}}'}
          </code>
          <code className="text-xs bg-white px-2 py-1 rounded border border-blue-200">
            {'{{event_date}}'}
          </code>
          <code className="text-xs bg-white px-2 py-1 rounded border border-blue-200">
            {'{{pastor_name}}'}
          </code>
          <code className="text-xs bg-white px-2 py-1 rounded border border-blue-200">
            {'{{amount}}'}
          </code>
        </div>
      </div>
    </div>
  );
}
