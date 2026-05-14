import { Link } from 'react-router';
import { BarChart3, TrendingUp, Users, DollarSign, Calendar, Heart, Target, FileText } from 'lucide-react';

const reportCategories = [
  {
    id: 'members',
    name: 'Membros',
    icon: Users,
    color: 'bg-blue-500',
    reports: [
      { name: 'Crescimento de Membros', path: '/app-ui/reports/member-growth' },
      { name: 'Distribuição por Idade', path: '/app-ui/reports/age-distribution' },
      { name: 'Distribuição Geográfica', path: '/app-ui/reports/geographic' },
    ]
  },
  {
    id: 'financial',
    name: 'Financeiro',
    icon: DollarSign,
    color: 'bg-green-500',
    reports: [
      { name: 'Analytics Financeiro', path: '/app-ui/reports/financial' },
      { name: 'Dízimos e Ofertas', path: '/app-ui/reports/giving' },
      { name: 'Orçado vs Realizado', path: '/app-ui/reports/budget' },
    ]
  },
  {
    id: 'attendance',
    name: 'Presença',
    icon: Calendar,
    color: 'bg-purple-500',
    reports: [
      { name: 'Analytics de Presença', path: '/app-ui/reports/attendance' },
      { name: 'Frequência por Culto', path: '/app-ui/reports/service-frequency' },
      { name: 'Tendências de Presença', path: '/app-ui/reports/attendance-trends' },
    ]
  },
  {
    id: 'ministries',
    name: 'Ministérios',
    icon: Heart,
    color: 'bg-pink-500',
    reports: [
      { name: 'Distribuição de Ministérios', path: '/app-ui/reports/ministry-distribution' },
      { name: 'Engajamento de Voluntários', path: '/app-ui/reports/volunteer-engagement' },
      { name: 'Performance de Ministérios', path: '/app-ui/reports/ministry-performance' },
    ]
  },
  {
    id: 'events',
    name: 'Eventos',
    icon: Target,
    color: 'bg-orange-500',
    reports: [
      { name: 'Participação em Eventos', path: '/app-ui/reports/event-participation' },
      { name: 'ROI de Eventos', path: '/app-ui/reports/event-roi' },
      { name: 'Feedback de Eventos', path: '/app-ui/reports/event-feedback' },
    ]
  },
];

export default function ReportsDashboard() {
  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Relatórios e Analytics</h1>
            <p className="text-slate-600 dark:text-slate-400">Insights e análises detalhadas da igreja</p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-8 h-8" />
            <span className="text-sm opacity-90">Este Mês</span>
          </div>
          <p className="text-2xl font-bold mb-1">1,245</p>
          <p className="text-sm opacity-90">Membros Ativos</p>
          <div className="mt-2 flex items-center gap-1 text-sm">
            <TrendingUp className="w-4 h-4" />
            <span>+12.5% vs mês anterior</span>
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8" />
            <span className="text-sm opacity-90">Este Mês</span>
          </div>
          <p className="text-2xl font-bold mb-1">R$ 145k</p>
          <p className="text-sm opacity-90">Total Arrecadado</p>
          <div className="mt-2 flex items-center gap-1 text-sm">
            <TrendingUp className="w-4 h-4" />
            <span>+8.3% vs mês anterior</span>
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <Calendar className="w-8 h-8" />
            <span className="text-sm opacity-90">Média Semanal</span>
          </div>
          <p className="text-2xl font-bold mb-1">68%</p>
          <p className="text-sm opacity-90">Taxa de Presença</p>
          <div className="mt-2 flex items-center gap-1 text-sm">
            <TrendingUp className="w-4 h-4" />
            <span>+5.1% vs semana anterior</span>
          </div>
        </div>

        <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <Target className="w-8 h-8" />
            <span className="text-sm opacity-90">Este Trimestre</span>
          </div>
          <p className="text-2xl font-bold mb-1">24</p>
          <p className="text-sm opacity-90">Eventos Realizados</p>
          <div className="mt-2 flex items-center gap-1 text-sm">
            <TrendingUp className="w-4 h-4" />
            <span>+15.2% vs trimestre anterior</span>
          </div>
        </div>
      </div>

      {/* Report Categories */}
      <div className="space-y-6">
        {reportCategories.map((category) => {
          const Icon = category.icon;
          
          return (
            <div key={category.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className={`p-6 ${category.color} bg-opacity-10 border-b border-slate-200`}>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 ${category.color} rounded-xl flex items-center justify-center text-white`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">{category.name}</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{category.reports.length} relatórios disponíveis</p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {category.reports.map((report) => (
                    <Link
                      key={report.path}
                      to={report.path}
                      className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:border-purple-300 hover:bg-slate-50 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-slate-400 group-hover:text-purple-600" />
                        <span className="font-medium text-slate-900">{report.name}</span>
                      </div>
                      <span className="text-slate-400 group-hover:text-purple-600">→</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Custom Reports */}
      <div className="mt-8 bg-gradient-to-r from-purple-600 to-blue-500 rounded-xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">Relatórios Customizados</h2>
            <p className="text-purple-100">Crie relatórios personalizados com os dados que você precisa</p>
          </div>
          <Link
            to="/app-ui/reports/builder"
            className="px-6 py-3 bg-white text-purple-600 rounded-lg font-semibold hover:bg-purple-50 transition-all"
          >
            Criar Relatório
          </Link>
        </div>
      </div>
    </div>
  );
}
