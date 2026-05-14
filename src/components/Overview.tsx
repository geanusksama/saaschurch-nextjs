import { Link } from 'react-router';
import { Network, Workflow, Menu, GitBranch, Layers, ArrowRight, Check, Monitor, Grid, Palette } from 'lucide-react';
import { motion } from 'motion/react';

const deliverables = [
  {
    title: 'Arquitetura da Informação',
    description: 'Estrutura completa do sistema mostrando todos os módulos, submódulos e sua organização',
    icon: Network,
    path: '/documentation/information-architecture',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    title: 'Fluxos de Usuário',
    description: 'Jornadas principais desde captação de visitantes até gestão de membros e eventos',
    icon: Workflow,
    path: '/documentation/user-flows',
    color: 'from-purple-500 to-pink-500',
  },
  {
    title: 'Estrutura de Navegação',
    description: 'Navegação lateral, barra superior e funcionalidade de busca global',
    icon: Menu,
    path: '/documentation/navigation',
    color: 'from-green-500 to-emerald-500',
  },
  {
    title: 'Relacionamento de Módulos',
    description: 'Como os diferentes módulos interagem e compartilham dados na plataforma',
    icon: GitBranch,
    path: '/documentation/module-relationships',
    color: 'from-orange-500 to-red-500',
  },
  {
    title: 'Hierarquia do Sistema',
    description: 'Estrutura multi-igreja com níveis Campo, Regional e Igreja Local',
    icon: Layers,
    path: '/documentation/hierarchy',
    color: 'from-indigo-500 to-purple-500',
  },
  {
    title: 'Catálogo de Telas (200+)',
    description: 'Mapa completo de todas as 200+ telas organizadas por módulo',
    icon: Grid,
    path: '/documentation/screen-catalog',
    color: 'from-emerald-500 to-teal-500',
    featured: true,
  },
  {
    title: 'MRM Design System',
    description: 'Biblioteca completa de componentes reutilizáveis e tokens de design',
    icon: Palette,
    path: '/documentation/design-system',
    color: 'from-pink-500 to-rose-500',
    featured: true,
  },
  {
    title: 'Interface do Aplicativo',
    description: 'Telas reais do sistema com interface moderna e funcional',
    icon: Monitor,
    path: '/app-ui',
    color: 'from-violet-500 to-purple-500',
    featured: true,
  },
];

const systemFeatures = [
  'Site Público com Eventos e Streaming',
  'Sistema de Autenticação Completo',
  'Gestão Completa de Membros',
  'CRM Pipeline Estilo Hubspot',
  'Gestão Pastoral e Discipulado',
  'Processos de Batismo e Consagração',
  'Células e Ministérios',
  'Check-in com QR Code',
  'WhatsApp e Email Campaigns',
  'Automações Visuais (Zapier-style)',
  'Tesouraria e Controle Financeiro',
  'Relatórios e Analytics Completos',
  'Multi-igreja (Campo/Regional/Local)',
  'Sistema de Configurações Expandido',
];

export function Overview() {
  return (
    <div className="p-6">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-12"
      >
        <div className="bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-600 rounded-2xl p-8 text-white">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-bold mb-4">MRM – Ministry Relationship Management</h1>
            <p className="text-xl text-purple-100 mb-6">
              Um CRM completo para gestão de igrejas combinando os melhores recursos do HubSpot, Notion, Stripe e Supabase Studio
            </p>
            <div className="flex gap-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
                <p className="text-sm text-purple-100">Site Público</p>
                <p className="text-lg font-semibold">Landing + Eventos</p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
                <p className="text-sm text-purple-100">Sistema Admin</p>
                <p className="text-lg font-semibold">8 Módulos Principais</p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2">
                <p className="text-sm text-purple-100">Multi-igreja</p>
                <p className="text-lg font-semibold">Campo → Regional → Igreja</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* System Features Grid */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Capacidades do Sistema</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {systemFeatures.map((feature, index) => (
            <motion.div
              key={feature}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white rounded-lg p-4 border border-slate-200 hover:border-purple-300 hover:shadow-sm transition-all"
            >
              <Check className="w-5 h-5 text-green-600 mb-2" />
              <p className="text-sm font-medium text-slate-700">{feature}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Architecture Deliverables */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Entregáveis da Arquitetura</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {deliverables.map((deliverable, index) => {
            const Icon = deliverable.icon;
            return (
              <motion.div
                key={deliverable.path}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Link
                  to={deliverable.path}
                  className="block bg-white rounded-xl p-6 border border-slate-200 hover:border-slate-300 hover:shadow-lg transition-all group"
                >
                  <div className={`w-12 h-12 bg-gradient-to-br ${deliverable.color} rounded-lg flex items-center justify-center mb-4`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-2 group-hover:text-purple-600 transition-colors">
                    {deliverable.title}
                  </h3>
                  <p className="text-sm text-slate-600 mb-4">{deliverable.description}</p>
                  <div className="flex items-center gap-2 text-purple-600 font-medium text-sm">
                    <span>Explorar</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Complete Catalog Banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5 }}
        className="my-12"
      >
        <Link 
          to="/documentation/screen-catalog-complete"
          className="block bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl border-4 border-green-600 p-8 hover:shadow-2xl transition-all group text-white"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-5xl mb-3">🎉 🏆 ✨</div>
              <h2 className="text-4xl font-bold mb-3">PROJETO 100% COMPLETO!</h2>
              <p className="text-xl text-green-50 mb-2">
                Todas as 196 telas foram implementadas com sucesso
              </p>
              <p className="text-green-100 mb-4">
                Sistema completo de gestão de igreja totalmente navegável e funcional
              </p>
              <div className="inline-flex items-center gap-2 bg-white text-green-600 px-6 py-3 rounded-lg font-bold text-lg">
                Ver Catálogo Completo
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
            <div className="text-9xl opacity-20">✓</div>
          </div>
        </Link>
      </motion.div>

      {/* Tech Stack Info */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-12 bg-white rounded-xl p-6 border border-slate-200"
      >
        <h3 className="font-bold text-slate-900 mb-4">Stack Tecnológico</h3>
        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm font-medium text-slate-600 mb-2">Frontend</p>
            <p className="text-slate-900">React, Next.js, Tailwind CSS, Material Design 3</p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 mb-2">Backend</p>
            <p className="text-slate-900">Supabase, PostgreSQL, Row Level Security</p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 mb-2">Integrações</p>
            <p className="text-slate-900">API WhatsApp, Serviços de Email, Processamento de Pagamentos</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}