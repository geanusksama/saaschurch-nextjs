import { Search, Bell, Settings, User, ChevronDown, Building2, LayoutDashboard, Users, Heart, DollarSign, MessageSquare, Calendar, Clipboard, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';

const sidebarNavigation = [
  { 
    name: 'Dashboard', 
    icon: LayoutDashboard, 
    path: '/dashboard',
    badge: null,
  },
  { 
    name: 'Secretaria', 
    icon: Clipboard, 
    path: '/secretariat',
    badge: '3',
    subItems: ['Membros', 'Batismo', 'Consagração', 'Transferências', 'Credenciais', 'Presença'],
  },
  { 
    name: 'CRM', 
    icon: TrendingUp, 
    path: '/crm',
    badge: '12',
    subItems: ['Visitantes', 'Leads', 'Discipulado', 'Pipeline'],
  },
  { 
    name: 'Financeiro', 
    icon: DollarSign, 
    path: '/finance',
    badge: null,
    subItems: ['Tesouraria', 'Livro Caixa', 'Receitas', 'Despesas', 'Fechamento', 'Análise'],
  },
  { 
    name: 'Ministérios', 
    icon: Heart, 
    path: '/ministries',
    badge: null,
    subItems: ['Departamentos', 'Líderes', 'Equipes', 'Grupos'],
  },
  { 
    name: 'Comunicação', 
    icon: MessageSquare, 
    path: '/communication',
    badge: '5',
    subItems: ['WhatsApp', 'Email', 'Interno', 'SMS'],
  },
  { 
    name: 'Eventos', 
    icon: Calendar, 
    path: '/events',
    badge: null,
    subItems: ['Criar Evento', 'Venda de Ingressos', 'Check-in', 'Relatórios'],
  },
  { 
    name: 'Sistema', 
    icon: Settings, 
    path: '/system',
    badge: null,
    subItems: ['Usuários', 'Funções', 'Permissões', 'Automação', 'Configurações'],
  },
];

const topbarActions = [
  { name: 'Buscar', icon: Search, shortcut: '⌘K' },
  { name: 'Notificações', icon: Bell, badge: 8 },
  { name: 'Configurações', icon: Settings },
  { name: 'Perfil', icon: User },
];

const quickActions = [
  { name: 'Adicionar Membro', category: 'Secretaria' },
  { name: 'Registrar Oferta', category: 'Financeiro' },
  { name: 'Enviar Mensagem', category: 'Comunicação' },
  { name: 'Criar Evento', category: 'Eventos' },
  { name: 'Novo Visitante', category: 'CRM' },
  { name: 'Agendar Batismo', category: 'Secretaria' },
];

export function Navigation() {
  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Estrutura de Navegação</h1>
        <p className="text-slate-600 dark:text-slate-400">Sistema completo de navegação com barra lateral, barra superior e busca global</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Sidebar Navigation */}
        <section>
          <h2 className="text-xl font-bold text-slate-900 mb-4">Navegação Lateral</h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Sidebar Header */}
            <div className="bg-gradient-to-br from-purple-600 to-blue-600 p-4">
              <div className="flex items-center gap-3 text-white">
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <span className="font-bold">M</span>
                </div>
                <div>
                  <p className="font-bold">Plataforma MRM</p>
                  <p className="text-xs text-purple-100">Gestão Ministerial</p>
                </div>
              </div>
            </div>

            {/* Church Switcher */}
            <div className="p-3 border-b border-slate-200 bg-slate-50">
              <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 hover:border-purple-300 transition-colors">
                <Building2 className="w-4 h-4 text-purple-600" />
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-slate-900">Sede Principal</p>
                  <p className="text-xs text-slate-500">Regional → Campo</p>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {/* Navigation Items */}
            <div className="p-3 space-y-1">
              {sidebarNavigation.map((item, index) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-700 hover:bg-purple-50 hover:text-purple-700 transition-colors group">
                      <Icon className="w-5 h-5" />
                      <span className="flex-1 text-left font-medium">{item.name}</span>
                      {item.badge && (
                        <span className="bg-purple-100 text-purple-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                          {item.badge}
                        </span>
                      )}
                      {item.subItems && (
                        <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-purple-600" />
                      )}
                    </button>
                    {item.subItems && (
                      <div className="ml-11 mt-1 space-y-0.5 text-sm">
                        {item.subItems.map((subItem) => (
                          <button
                            key={subItem}
                            className="w-full text-left px-3 py-1.5 rounded text-slate-600 hover:text-purple-700 hover:bg-purple-50 transition-colors"
                          >
                            {subItem}
                          </button>
                        ))}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Topbar & Features */}
        <section className="space-y-8">
          {/* Topbar */}
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-4">Barra Superior</h2>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-4">
                {/* Search */}
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar membros, eventos ou transações..."
                      className="w-full pl-10 pr-16 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">
                      ⌘K
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {topbarActions.slice(1).map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.name}
                        className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <Icon className="w-5 h-5 text-slate-600" />
                        {action.badge && (
                          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                            {action.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                  <div className="ml-2 flex items-center gap-2 pl-2 border-l border-slate-200">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-purple-600" />
                    </div>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Global Search */}
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-4">Busca Global (⌘K)</h2>
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Digite para buscar..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2">MEMBROS</p>
                  <div className="space-y-1">
                    <button className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg flex items-center gap-3">
                      <Users className="w-4 h-4 text-slate-400" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">João Silva</p>
                        <p className="text-xs text-slate-500">ID do Membro: #M12345</p>
                      </div>
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2">EVENTOS</p>
                  <div className="space-y-1">
                    <button className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg flex items-center gap-3">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">Culto de Domingo</p>
                        <p className="text-xs text-slate-500">Hoje às 10:00</p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-4">Ações Rápidas</h2>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="grid grid-cols-2 gap-2">
                {quickActions.map((action) => (
                  <button
                    key={action.name}
                    className="px-4 py-3 bg-slate-50 hover:bg-purple-50 border border-slate-200 hover:border-purple-300 rounded-lg text-left transition-colors group"
                  >
                    <p className="font-medium text-slate-900 group-hover:text-purple-700 text-sm">
                      {action.name}
                    </p>
                    <p className="text-xs text-slate-500">{action.category}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Navigation Features */}
      <div className="mt-12 grid md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
            <Search className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="font-bold text-slate-900 mb-2">Busca Inteligente</h3>
          <p className="text-sm text-slate-600">
            Busca global com atalhos de teclado (⌘K) pesquisando membros, eventos, transações e mais
          </p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6">
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
            <Building2 className="w-6 h-6 text-purple-600" />
          </div>
          <h3 className="font-bold text-slate-900 mb-2">Seletor de Igreja</h3>
          <p className="text-sm text-slate-600">
            Alternância fácil entre níveis de Campo, Regional e Igreja com um modal seletor
          </p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
            <Bell className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="font-bold text-slate-900 mb-2">Notificações</h3>
          <p className="text-sm text-slate-600">
            Alertas em tempo real para tarefas, aprovações, mensagens e atualizações do sistema com indicadores
          </p>
        </div>
      </div>
    </div>
  );
}
