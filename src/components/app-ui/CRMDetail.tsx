import { useParams, Link } from 'react-router';
import { ArrowLeft, Phone, Mail, Calendar, User, MapPin, MessageSquare, Clock, TrendingUp } from 'lucide-react';
import { crmLeads } from '../../data/mockData';

export function CRMDetail() {
  const { id } = useParams();
  const lead = crmLeads.find(l => l.id === Number(id));

  if (!lead) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <p className="text-slate-600 dark:text-slate-400">Lead não encontrado</p>
          <Link to="/app-ui/crm" className="text-purple-600 hover:text-purple-700 mt-4 inline-block">
            Voltar para CRM
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <User className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{lead.name}</h1>
            <p className="text-slate-600 dark:text-slate-400">Detalhes do Lead</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Info Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Informações de Contato</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Phone className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Telefone</p>
                  <p className="font-semibold text-slate-900">{lead.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Mail className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Email</p>
                  <p className="font-semibold text-slate-900">{lead.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Igreja</p>
                  <p className="font-semibold text-slate-900">{lead.church}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Notes Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Observações</h2>
            <p className="text-slate-700">{lead.notes}</p>
          </div>

          {/* Timeline Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Linha do Tempo</h2>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="w-2 bg-purple-500 rounded-full"></div>
                <div className="flex-1 pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-slate-900">Último contato</p>
                    <p className="text-sm text-slate-500">
                      {new Date(lead.lastContact).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Contato realizado pelo responsável</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-2 bg-blue-500 rounded-full"></div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-slate-900">Lead criado</p>
                    <p className="text-sm text-slate-500">
                      {new Date(lead.lastContact).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Origem: {lead.source}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Status</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-600 mb-2">Estágio</p>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  lead.stage === 'Visitante' ? 'bg-purple-100 text-purple-700' :
                  lead.stage === 'Em Acompanhamento' ? 'bg-orange-100 text-orange-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {lead.stage}
                </span>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-2">Score</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-slate-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full"
                      style={{ width: `${lead.score}%` }}
                    ></div>
                  </div>
                  <span className="font-bold text-slate-900">{lead.score}</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-2">Responsável</p>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-blue-500 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                    {lead.responsible.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <span className="font-semibold text-slate-900">{lead.responsible}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Ações Rápidas</h3>
            <div className="space-y-2">
              <button className="w-full flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                <MessageSquare className="w-4 h-4" />
                Enviar Mensagem
              </button>
              <button className="w-full flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                <Phone className="w-4 h-4" />
                Ligar
              </button>
              <button className="w-full flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                <Calendar className="w-4 h-4" />
                Agendar Visita
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
