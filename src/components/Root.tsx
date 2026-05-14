import { Outlet, Link, useLocation } from 'react-router';
import { LayoutDashboard, Network, GitBranch, Menu, Workflow, Layers, Monitor, Grid } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const navigation = [
  { name: 'Visão Geral', path: '/documentation', icon: LayoutDashboard },
  { name: 'Arquitetura da Informação', path: '/documentation/information-architecture', icon: Network },
  { name: 'Fluxos de Usuário', path: '/documentation/user-flows', icon: Workflow },
  { name: 'Estrutura de Navegação', path: '/documentation/navigation', icon: Menu },
  { name: 'Relacionamento de Módulos', path: '/documentation/module-relationships', icon: GitBranch },
  { name: 'Hierarquia do Sistema', path: '/documentation/hierarchy', icon: Layers },
  { name: 'Catálogo de Telas (200+)', path: '/documentation/screen-catalog', icon: Grid },
  { name: 'Interface do Aplicativo', path: '/app-ui', icon: Monitor, divider: true },
];

export function Root() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="w-72 bg-white border-r border-slate-200 flex flex-col"
          >
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-lg">M</span>
                </div>
                <div>
                  <h1 className="font-bold text-slate-900">Plataforma MRM</h1>
                  <p className="text-xs text-slate-500">Arquitetura do Sistema</p>
                </div>
              </div>
            </div>

            <nav className="flex-1 p-4 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <div key={item.path}>
                    {item.divider && (
                      <div className="my-4 border-t border-slate-200 pt-4">
                        <p className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                          Aplicação
                        </p>
                      </div>
                    )}
                    <Link
                      to={item.path}
                      className={`
                        flex items-center gap-3 px-4 py-3 rounded-lg transition-all
                        ${isActive 
                          ? 'bg-purple-50 text-purple-700 font-medium' 
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }
                      `}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.name}</span>
                    </Link>
                  </div>
                );
              })}
            </nav>

            <div className="p-4 border-t border-slate-200">
              <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-4">
                <p className="text-xs font-medium text-slate-700 mb-1">Stack Tecnológico</p>
                <div className="flex flex-wrap gap-1.5">
                  {['React', 'Next.js', 'Supabase', 'PostgreSQL', 'Tailwind', 'Material 3'].map(tech => (
                    <span key={tech} className="text-xs bg-white px-2 py-1 rounded text-slate-600">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex-1">
            <h2 className="font-semibold text-slate-900">
              {navigation.find(n => n.path === location.pathname)?.name || 'Arquitetura MRM'}
            </h2>
            <p className="text-sm text-slate-500">Sistema de Gestão de Relacionamento Ministerial</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-full font-medium">
              v1.0 Arquitetura
            </span>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto bg-slate-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}