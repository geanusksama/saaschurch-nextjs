import { Link } from 'react-router';
import { LayoutDashboard, Users, TrendingUp, DollarSign, Calendar, MessageSquare, Settings, Clipboard, ArrowRight } from 'lucide-react';

const modules = [
  {
    name: 'Dashboard',
    description: 'Visão geral com métricas e análises',
    icon: LayoutDashboard,
    path: '/app-ui/dashboard',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    name: 'Secretaria - Membros',
    description: 'Gestão completa de membros da igreja',
    icon: Clipboard,
    path: '/app-ui/members',
    color: 'from-purple-500 to-pink-500',
  },
  {
    name: 'CRM - Pipeline',
    description: 'Gestão de visitantes e leads',
    icon: TrendingUp,
    path: '/app-ui/crm',
    color: 'from-green-500 to-emerald-500',
  },
  {
    name: 'Financeiro',
    description: 'Tesouraria e gestão financeira',
    icon: DollarSign,
    path: '/app-ui/finance',
    color: 'from-orange-500 to-red-500',
  },
  {
    name: 'Ministérios',
    description: 'Departamentos e pequenos grupos',
    icon: Users,
    path: '/app-ui/ministries',
    color: 'from-indigo-500 to-purple-500',
  },
  {
    name: 'Comunicação',
    description: 'WhatsApp, Email e SMS',
    icon: MessageSquare,
    path: '/app-ui/communication',
    color: 'from-pink-500 to-rose-500',
  },
  {
    name: 'Eventos',
    description: 'Gestão de eventos e ingressos',
    icon: Calendar,
    path: '/app-ui/events',
    color: 'from-cyan-500 to-blue-500',
  },
  {
    name: 'Sistema',
    description: 'Usuários, permissões e automação',
    icon: Settings,
    path: '/app-ui/system',
    color: 'from-slate-500 to-zinc-500',
  },
];

export function AppLanding() {
  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <span className="text-white font-bold text-4xl">M</span>
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-4">Interface do Aplicativo MRM</h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Explore as telas reais do sistema de gestão ministerial com interface moderna e intuitiva
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <Link
                key={module.path}
                to={module.path}
                className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg hover:border-purple-300 transition-all group"
              >
                <div className={`w-14 h-14 bg-gradient-to-br ${module.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="font-bold text-slate-900 mb-2 group-hover:text-purple-700 transition-colors">
                  {module.name}
                </h3>
                <p className="text-sm text-slate-600 mb-4">{module.description}</p>
                <div className="flex items-center gap-2 text-purple-600 font-medium text-sm group-hover:gap-3 transition-all">
                  <span>Explorar</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </Link>
            );
          })}
        </div>

        {/* Info Cards */}
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-6">
            <h3 className="font-bold text-slate-900 mb-2">Interface Moderna</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Design baseado em Material 3 com Tailwind CSS para uma experiência visual excepcional
            </p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6">
            <h3 className="font-bold text-slate-900 mb-2">Dados Realistas</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Todas as telas contêm dados de exemplo realistas para demonstração completa do sistema
            </p>
          </div>
          <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-6">
            <h3 className="font-bold text-slate-900 mb-2">Navegação Completa</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Sistema totalmente navegável com rotas dinâmicas e estados interativos
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
