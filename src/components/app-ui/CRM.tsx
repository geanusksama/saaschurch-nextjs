import { UserPlus, TrendingUp, Users, Phone, Mail, Calendar, ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { crmLeads } from '../../data/mockData';

export function CRM() {
  const visitantes = crmLeads.filter(l => l.stage === 'Visitante').length;
  const emAcompanhamento = crmLeads.filter(l => l.stage === 'Em Acompanhamento').length;
  const consolidados = crmLeads.filter(l => l.stage === 'Consolidado').length;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">CRM</h1>
            <p className="text-slate-600 dark:text-slate-400">Gerencie visitantes e processo de integração</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Link
            to="/app-ui/crm/pipeline"
            className="flex items-center gap-2 border border-slate-200 bg-white px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <TrendingUp className="w-5 h-5" />
            Ver Pipeline
          </Link>
          <Link
            to="/app-ui/lead-new"
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
          >
            <UserPlus className="w-5 h-5" />
            Novo Lead
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <UserPlus className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Total de Leads</p>
              <p className="text-2xl font-bold text-slate-900">{crmLeads.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Visitantes</p>
              <p className="text-2xl font-bold text-slate-900">{visitantes}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Em Acompanhamento</p>
              <p className="text-2xl font-bold text-slate-900">{emAcompanhamento}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Consolidados</p>
              <p className="text-2xl font-bold text-slate-900">{consolidados}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">Leads Recentes</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">Nome</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">Contato</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">Origem</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">Estágio</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">Responsável</th>
                <th className="text-left px-6 py-3 text-sm font-semibold text-slate-900">Último Contato</th>
                <th className="text-center px-6 py-3 text-sm font-semibold text-slate-900">Score</th>
                <th className="text-right px-6 py-3 text-sm font-semibold text-slate-900">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {crmLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                        {lead.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{lead.name}</p>
                        <p className="text-xs text-slate-500">{lead.church}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Phone className="w-4 h-4" />
                        <span>{lead.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Mail className="w-4 h-4" />
                        <span className="truncate max-w-[200px]">{lead.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                      {lead.source}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      lead.stage === 'Visitante' ? 'bg-purple-100 text-purple-700' :
                      lead.stage === 'Em Acompanhamento' ? 'bg-orange-100 text-orange-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {lead.stage}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {lead.responsible}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(lead.lastContact).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full">
                      <span className="text-white font-bold text-sm">{lead.score}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        to={`/app-ui/crm/${lead.id}`}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <ChevronRight className="w-5 h-5 text-slate-600" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}