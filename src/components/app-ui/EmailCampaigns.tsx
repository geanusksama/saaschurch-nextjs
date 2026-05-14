import { Plus, Search, Mail, Users, TrendingUp, Eye, MousePointerClick, Send } from 'lucide-react';
import { Link } from 'react-router';

const campaigns = [
  { 
    id: 1, 
    name: 'Convite CIBE 2024', 
    status: 'sent', 
    sent: 1248, 
    opened: 892, 
    clicked: 456,
    date: '2024-03-10'
  },
  { 
    id: 2, 
    name: 'Boletim Semanal - Março', 
    status: 'draft', 
    sent: 0, 
    opened: 0, 
    clicked: 0,
    date: '2024-03-15'
  },
  { 
    id: 3, 
    name: 'Lembrete Retiro de Jovens', 
    status: 'scheduled', 
    sent: 0, 
    opened: 0, 
    clicked: 0,
    date: '2024-03-20'
  },
  { 
    id: 4, 
    name: 'Boas Vindas Novos Membros', 
    status: 'sent', 
    sent: 45, 
    opened: 38, 
    clicked: 22,
    date: '2024-03-08'
  },
];

const templates = [
  { id: 1, name: 'Convite de Evento', category: 'Eventos', preview: 'event-template.jpg' },
  { id: 2, name: 'Boletim Informativo', category: 'Newsletter', preview: 'newsletter-template.jpg' },
  { id: 3, name: 'Boas Vindas', category: 'Boas Vindas', preview: 'welcome-template.jpg' },
  { id: 4, name: 'Anúncio Geral', category: 'Comunicados', preview: 'announcement-template.jpg' },
];

export function EmailCampaigns() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Campanhas de Email</h1>
          <p className="text-slate-600 dark:text-slate-400">Crie e gerencie campanhas de email marketing</p>
        </div>
        <Link 
          to="/app-ui/email/new"
          className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Nova Campanha
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Send className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Emails Enviados</p>
              <p className="text-2xl font-bold text-slate-900">12.5K</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Eye className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Taxa de Abertura</p>
              <p className="text-2xl font-bold text-slate-900">71.5%</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <MousePointerClick className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Taxa de Cliques</p>
              <p className="text-2xl font-bold text-slate-900">36.5%</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Inscritos</p>
              <p className="text-2xl font-bold text-slate-900">3,248</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Campaigns List */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Campanhas</h2>
            </div>
            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar campanhas..."
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <div className="p-6">
            <div className="space-y-4">
              {campaigns.map((campaign) => (
                <Link
                  key={campaign.id}
                  to={`/app-ui/email/campaigns/${campaign.id}`}
                  className="block border border-slate-200 rounded-lg p-5 hover:border-purple-300 hover:bg-slate-50 transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-blue-500 rounded-lg flex items-center justify-center">
                        <Mail className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">{campaign.name}</h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {new Date(campaign.date).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      campaign.status === 'sent' ? 'bg-green-100 text-green-700' :
                      campaign.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {campaign.status === 'sent' ? 'Enviada' :
                       campaign.status === 'scheduled' ? 'Agendada' :
                       'Rascunho'}
                    </span>
                  </div>

                  {campaign.status === 'sent' && (
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <Send className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-semibold text-blue-900">{campaign.sent}</span>
                        </div>
                        <p className="text-xs text-blue-600">Enviados</p>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <Eye className="w-4 h-4 text-green-600" />
                          <span className="text-sm font-semibold text-green-900">
                            {Math.round((campaign.opened / campaign.sent) * 100)}%
                          </span>
                        </div>
                        <p className="text-xs text-green-600">Abertos</p>
                      </div>
                      <div className="text-center p-3 bg-purple-50 rounded-lg">
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <MousePointerClick className="w-4 h-4 text-purple-600" />
                          <span className="text-sm font-semibold text-purple-900">
                            {Math.round((campaign.clicked / campaign.sent) * 100)}%
                          </span>
                        </div>
                        <p className="text-xs text-purple-600">Clicados</p>
                      </div>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Templates */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-900">Templates</h2>
          </div>
          <div className="p-6 space-y-3">
            {templates.map((template) => (
              <div key={template.id} className="border border-slate-200 rounded-lg p-4 hover:border-purple-300 hover:bg-slate-50 transition-all cursor-pointer">
                <div className="aspect-video bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg mb-3 flex items-center justify-center">
                  <Mail className="w-12 h-12 text-slate-400" />
                </div>
                <h4 className="font-semibold text-slate-900 mb-1">{template.name}</h4>
                <p className="text-xs text-slate-500">{template.category}</p>
              </div>
            ))}

            <button className="w-full py-3 border-2 border-dashed border-slate-200 rounded-lg text-slate-500 hover:border-purple-300 hover:text-purple-600 transition-colors flex items-center justify-center gap-2">
              <Plus className="w-5 h-5" />
              Novo Template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
