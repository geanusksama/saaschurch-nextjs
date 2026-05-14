import { useState } from 'react';
import { ChevronRight, ChevronDown, Globe, Lock, LayoutDashboard, Users, Heart, DollarSign, MessageSquare, Calendar, Settings, UserCog, FileText, TrendingUp, Clipboard, Building2, Mail, Ticket, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Module {
  id: string;
  name: string;
  icon: any;
  description: string;
  submodules?: SubModule[];
}

interface SubModule {
  id: string;
  name: string;
  features: string[];
}

const publicWebsite: Module[] = [
  {
    id: 'landing',
    name: 'Página Inicial',
    icon: Globe,
    description: 'Homepage principal com visão geral do ministério',
    submodules: [
      { id: 'hero', name: 'Seção Hero', features: ['CTA Principal', 'Vídeo de Fundo', 'Estatísticas Rápidas'] },
      { id: 'about', name: 'Sobre o Ministério', features: ['Visão', 'Missão', 'Valores'] },
      { id: 'testimonies', name: 'Testemunhos', features: ['Histórias de Membros', 'Vídeos Testemunhais'] },
    ],
  },
  {
    id: 'vision',
    name: 'Visão da Igreja',
    icon: Heart,
    description: 'Visão, missão e valores do ministério',
    submodules: [
      { id: 'mission', name: 'Declaração de Missão', features: ['Missão Principal', 'Objetivos Estratégicos'] },
      { id: 'beliefs', name: 'Declaração de Fé', features: ['Crenças Doutrinárias', 'Valores Centrais'] },
    ],
  },
  {
    id: 'history',
    name: 'História',
    icon: FileText,
    description: 'Linha do tempo e marcos do ministério',
    submodules: [
      { id: 'timeline', name: 'Linha do Tempo', features: ['Fundação', 'Marcos Importantes', 'História de Crescimento'] },
      { id: 'founders', name: 'Fundadores', features: ['História da Liderança', 'Legado'] },
    ],
  },
  {
    id: 'leadership',
    name: 'Liderança',
    icon: UserCog,
    description: 'Líderes e estrutura ministerial',
    submodules: [
      { id: 'pastors', name: 'Pastores', features: ['Pastor Presidente', 'Pastores Associados'] },
      { id: 'elders', name: 'Presbíteros e Diáconos', features: ['Membros da Diretoria', 'Líderes Ministeriais'] },
    ],
  },
  {
    id: 'events-public',
    name: 'Eventos',
    icon: Calendar,
    description: 'Listagem pública de eventos',
    submodules: [
      { id: 'upcoming', name: 'Próximos Eventos', features: ['Calendário', 'Detalhes do Evento', 'Confirmação de Presença'] },
      { id: 'cibe', name: 'Congresso CIBE', features: ['Eventos Especiais', 'Informações da Conferência', 'Inscrição'] },
    ],
  },
  {
    id: 'tickets',
    name: 'Venda de Ingressos',
    icon: Ticket,
    description: 'Compra pública de ingressos',
    submodules: [
      { id: 'purchase', name: 'Compra de Ingresso', features: ['Seleção de Evento', 'Pagamento', 'Geração de QR Code'] },
      { id: 'confirmation', name: 'Confirmação', features: ['Recibo por Email', 'Ingresso Digital', 'Adicionar à Agenda'] },
    ],
  },
  {
    id: 'live',
    name: 'Transmissão ao Vivo',
    icon: Globe,
    description: 'Transmissões de cultos ao vivo',
    submodules: [
      { id: 'stream', name: 'Transmissão ao Vivo', features: ['Player de Vídeo', 'Chat', 'Widget de Doações'] },
      { id: 'archive', name: 'Arquivo', features: ['Cultos Anteriores', 'Biblioteca de Pregações'] },
    ],
  },
  {
    id: 'kids',
    name: 'Ministério Infantil',
    icon: Heart,
    description: 'Informações do ministério infantil',
    submodules: [
      { id: 'programs', name: 'Programas', features: ['Faixas Etárias', 'Currículo', 'Programação'] },
      { id: 'safety', name: 'Segurança e Check-in', features: ['Políticas de Segurança', 'Processo de Check-in'] },
    ],
  },
  {
    id: 'contact',
    name: 'Contato',
    icon: Mail,
    description: 'Informações de contato e formulários',
    submodules: [
      { id: 'info', name: 'Informações de Contato', features: ['Endereço', 'Telefone', 'Email', 'Mapa'] },
      { id: 'form', name: 'Formulário de Contato', features: ['Consulta Geral', 'Pedidos de Oração', 'Solicitar Visita'] },
    ],
  },
];

const adminSystem: Module[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    icon: LayoutDashboard,
    description: 'Análises e visão geral',
    submodules: [
      { id: 'overview', name: 'Visão Geral', features: ['Métricas Principais', 'Atividade Recente', 'Ações Rápidas'] },
      { id: 'analytics', name: 'Análises', features: ['Gráficos de Crescimento', 'Tendências de Presença', 'Resumo Financeiro'] },
      { id: 'notifications', name: 'Notificações', features: ['Alertas', 'Tarefas', 'Lembretes'] },
    ],
  },
  {
    id: 'secretariat',
    name: 'Secretaria',
    icon: Clipboard,
    description: 'Gestão de membros e processos',
    submodules: [
      { id: 'members', name: 'Gestão de Membros', features: ['Diretório de Membros', 'Gestão de Perfis', 'Grupos Familiares', 'Campos Personalizados'] },
      { id: 'baptism', name: 'Processo de Batismo', features: ['Registro de Candidatos', 'Rastreamento de Classes', 'Agendamento de Cerimônia', 'Geração de Certificados'] },
      { id: 'consecration', name: 'Consagração', features: ['Ordenação de Líderes', 'Registros de Cerimônias', 'Rastreamento de Credenciais'] },
      { id: 'transfer', name: 'Transferência entre Igrejas', features: ['Solicitações de Transferência', 'Geração de Cartas', 'Fluxo de Aprovação', 'Histórico'] },
      { id: 'credentials', name: 'Credenciais e Documentos', features: ['Carteiras de Membros', 'Cartas', 'Certificados', 'Modelos de Documentos'] },
      { id: 'attendance', name: 'Relatórios de Presença', features: ['Presença em Cultos', 'Pequenos Grupos', 'Eventos', 'Análise Estatística'] },
    ],
  },
  {
    id: 'crm',
    name: 'CRM',
    icon: TrendingUp,
    description: 'Pipeline de visitantes e membros',
    submodules: [
      { id: 'visitors', name: 'Visitantes', features: ['Visitantes de Primeira Vez', 'Informações de Contato', 'Tarefas de Acompanhamento', 'Histórico de Visitas'] },
      { id: 'leads', name: 'Pipeline de Leads', features: ['Estágios de Lead', 'Rastreamento de Conversão', 'Regras de Atribuição', 'Pontuação de Leads'] },
      { id: 'discipleship', name: 'Discipulado', features: ['Novos Convertidos', 'Classes e Cursos', 'Rastreamento de Mentoria', 'Crescimento Espiritual'] },
      { id: 'member-pipeline', name: 'Pipeline de Membros', features: ['Jornada Visitante → Membro', 'Níveis de Engajamento', 'Campanhas de Ativação'] },
    ],
  },
  {
    id: 'finance',
    name: 'Financeiro',
    icon: DollarSign,
    description: 'Tesouraria e gestão financeira',
    submodules: [
      { id: 'treasury', name: 'Tesouraria', features: ['Saldo de Contas', 'Reconciliação Bancária', 'Suporte Multi-moeda'] },
      { id: 'cashbook', name: 'Livro Caixa', features: ['Transações Diárias', 'Rastreamento de Recibos', 'Fluxo de Caixa'] },
      { id: 'income', name: 'Receitas', features: ['Dízimos e Ofertas', 'Doações', 'Receita de Eventos', 'Doações Recorrentes'] },
      { id: 'expenses', name: 'Despesas', features: ['Categorias de Despesas', 'Fluxo de Aprovação', 'Gestão de Fornecedores', 'Recibos'] },
      { id: 'closing', name: 'Fechamento Mensal', features: ['Fechamento de Período', 'Geração de Relatórios', 'Trilha de Auditoria'] },
      { id: 'analysis', name: 'Análise Financeira', features: ['Orçamento vs Real', 'Análise de Tendências', 'Relatórios', 'Previsões'] },
    ],
  },
  {
    id: 'ministries',
    name: 'Ministérios',
    icon: Users,
    description: 'Organização ministerial',
    submodules: [
      { id: 'departments', name: 'Departamentos', features: ['Configuração de Departamentos', 'Hierarquia', 'Alocação de Orçamento'] },
      { id: 'leaders', name: 'Líderes', features: ['Diretório de Líderes', 'Funções e Responsabilidades', 'Acompanhamento de Desempenho'] },
      { id: 'teams', name: 'Equipes', features: ['Gestão de Equipes', 'Escalas', 'Atribuição de Membros'] },
      { id: 'groups', name: 'Pequenos Grupos', features: ['Diretório de Grupos', 'Reuniões', 'Rastreamento de Crescimento', 'Recursos'] },
    ],
  },
  {
    id: 'communication',
    name: 'Comunicação',
    icon: MessageSquare,
    description: 'Mensagens multi-canal',
    submodules: [
      { id: 'whatsapp', name: 'Integração WhatsApp', features: ['Mensagens em Massa', 'Templates', 'Respostas Automáticas', 'Listas de Transmissão'] },
      { id: 'email', name: 'Campanhas de Email', features: ['Construtor de Email', 'Segmentação', 'Automação', 'Análises'] },
      { id: 'internal', name: 'Mensagens Internas', features: ['Chat da Equipe', 'Anúncios', 'Notificações'] },
      { id: 'sms', name: 'SMS', features: ['Campanhas de Texto', 'Lembretes', 'Alertas de Emergência'] },
    ],
  },
  {
    id: 'events-admin',
    name: 'Eventos',
    icon: Calendar,
    description: 'Sistema de gestão de eventos',
    submodules: [
      { id: 'creation', name: 'Criação de Eventos', features: ['Detalhes do Evento', 'Eventos Recorrentes', 'Formulários de Inscrição', 'Gestão de Capacidade'] },
      { id: 'ticket-sales', name: 'Venda de Ingressos', features: ['Níveis de Preço', 'Promoção Antecipada', 'Descontos para Grupos', 'Processamento de Pagamentos'] },
      { id: 'checkin', name: 'Check-in QR', features: ['Leitura de QR Code', 'App Mobile de Check-in', 'Rastreamento de Presença', 'Estatísticas em Tempo Real'] },
      { id: 'reporting', name: 'Relatórios de Eventos', features: ['Relatórios de Presença', 'Análise de Receita', 'Listas de Participantes'] },
    ],
  },
  {
    id: 'system',
    name: 'Sistema',
    icon: Settings,
    description: 'Configurações e administração',
    submodules: [
      { id: 'users', name: 'Gestão de Usuários', features: ['Contas de Usuário', 'Diretório da Equipe', 'Níveis de Acesso'] },
      { id: 'roles', name: 'Funções e Permissões', features: ['Definição de Funções', 'Matriz de Permissões', 'Controle de Acesso'] },
      { id: 'automation', name: 'Automação', features: ['Fluxos de Trabalho', 'Gatilhos', 'Ações', 'Sequências de Email'] },
      { id: 'settings', name: 'Configurações', features: ['Informações da Igreja', 'Identidade Visual', 'Integrações', 'Backup e Restauração'] },
    ],
  },
];

function ModuleCard({ module, isPublic }: { module: Module; isPublic: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = module.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg border border-slate-200 overflow-hidden"
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors"
      >
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isPublic ? 'bg-blue-100' : 'bg-purple-100'}`}>
          <Icon className={`w-5 h-5 ${isPublic ? 'text-blue-600' : 'text-purple-600'}`} />
        </div>
        <div className="flex-1 text-left">
          <h3 className="font-semibold text-slate-900">{module.name}</h3>
          <p className="text-sm text-slate-500">{module.description}</p>
        </div>
        {isOpen ? (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-slate-400" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && module.submodules && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-200 bg-slate-50"
          >
            <div className="p-4 space-y-3">
              {module.submodules.map((sub) => (
                <div key={sub.id} className="bg-white rounded-lg p-3 border border-slate-200">
                  <h4 className="font-medium text-slate-900 mb-2">{sub.name}</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {sub.features.map((feature) => (
                      <span
                        key={feature}
                        className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function InformationArchitecture() {
  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Arquitetura da Informação</h1>
        <p className="text-slate-600 dark:text-slate-400">Estrutura completa do sistema com todos os módulos, submódulos e funcionalidades</p>
      </div>

      {/* Public Website Section */}
      <section className="mb-12">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Globe className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Site Público</h2>
            <p className="text-slate-600 dark:text-slate-400">Páginas públicas para visitantes e membros</p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {publicWebsite.map((module) => (
            <ModuleCard key={module.id} module={module} isPublic={true} />
          ))}
        </div>
      </section>

      {/* Admin System Section */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <Lock className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Sistema Administrativo</h2>
            <p className="text-slate-600 dark:text-slate-400">Plataforma de gestão interna (requer autenticação)</p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {adminSystem.map((module) => (
            <ModuleCard key={module.id} module={module} isPublic={false} />
          ))}
        </div>
      </section>

      {/* Summary Stats */}
      <div className="mt-12 grid grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-6">
          <p className="text-sm text-slate-600 mb-1">Módulos Públicos</p>
          <p className="text-2xl font-bold text-slate-900">{publicWebsite.length}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-6">
          <p className="text-sm text-slate-600 mb-1">Módulos Admin</p>
          <p className="text-2xl font-bold text-slate-900">{adminSystem.length}</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-6">
          <p className="text-sm text-slate-600 mb-1">Total de Submódulos</p>
          <p className="text-2xl font-bold text-slate-900">
            {[...publicWebsite, ...adminSystem].reduce((acc, m) => acc + (m.submodules?.length || 0), 0)}
          </p>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-lg p-6">
          <p className="text-sm text-slate-600 mb-1">Total de Funcionalidades</p>
          <p className="text-2xl font-bold text-slate-900">
            {[...publicWebsite, ...adminSystem].reduce(
              (acc, m) => acc + (m.submodules?.reduce((a, s) => a + s.features.length, 0) || 0),
              0
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
