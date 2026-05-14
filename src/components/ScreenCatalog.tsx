import { Link } from 'react-router';
import { 
  Layout, Users, DollarSign, Calendar, MessageSquare, Heart, Settings, 
  Zap, BarChart3, FileText, Globe, Shield, CheckSquare, UserPlus,
  Mail, Phone, Building2, Gift, BookOpen, Target, TrendingUp, Clock
} from 'lucide-react';

const screenCategories = [
  {
    id: 'public-website',
    name: 'Site Público',
    icon: Globe,
    color: 'bg-blue-500',
    screens: [
      { id: 'landing', name: 'Landing Page', path: '/public', status: 'done' },
      { id: 'events-public', name: 'Eventos Públicos', path: '/public/events', status: 'done' },
      { id: 'live-streaming', name: 'Transmissão ao Vivo', path: '/public/live-streaming', status: 'done' },
      { id: 'about', name: 'Sobre a Igreja', path: '/public/about', status: 'done' },
      { id: 'contact', name: 'Contato', path: '/public/contact', status: 'done' },
      { id: 'vision', name: 'Visão e Valores', path: '/public/vision', status: 'done' },
      { id: 'history', name: 'História da Igreja', path: '/public/history', status: 'done' },
      { id: 'timeline', name: 'Linha do Tempo', status: 'done' },
      { id: 'leadership', name: 'Liderança', path: '/public/leadership', status: 'done' },
      { id: 'ministries-public', name: 'Ministérios (Público)', status: 'done' },
      { id: 'cibe-tickets', name: 'Venda de Ingressos CIBE', status: 'done' },
      { id: 'kids-portal', name: 'Portal Kids', status: 'done' },
      { id: 'radio', name: 'Rádio Online', status: 'done' },
      { id: 'locations', name: 'Localizações', status: 'done' },
      { id: 'blog', name: 'Blog', status: 'done' },
    ]
  },
  {
    id: 'auth',
    name: 'Autenticação',
    icon: Shield,
    color: 'bg-purple-500',
    screens: [
      { id: 'login', name: 'Login', path: '/auth/login', status: 'done' },
      { id: 'register', name: 'Cadastro', path: '/auth/register', status: 'done' },
      { id: 'forgot-password', name: 'Esqueci a Senha', path: '/auth/forgot-password', status: 'done' },
      { id: 'reset-password', name: 'Redefinir Senha', path: '/auth/reset-password', status: 'done' },
      { id: '2fa-setup', name: 'Configurar 2FA', status: 'done' },
      { id: '2fa-verify', name: 'Verificar 2FA', status: 'done' },
      { id: 'church-selector', name: 'Seletor de Igreja', status: 'done' },
      { id: 'onboarding', name: 'Onboarding', status: 'done' },
    ]
  },
  {
    id: 'dashboard',
    name: 'Dashboard',
    icon: Layout,
    color: 'bg-green-500',
    screens: [
      { id: 'main-dashboard', name: 'Tela inicial (Notificações)', path: '/app-ui', status: 'done' },
      { id: 'field-dashboard', name: 'Dashboard de Campo', path: '/app-ui/dashboard/field', status: 'done' },
      { id: 'regional-dashboard', name: 'Dashboard Regional', path: '/app-ui/dashboard/regional', status: 'done' },
      { id: 'church-dashboard', name: 'Dashboard da Igreja', status: 'done' },
      { id: 'ministry-dashboard', name: 'Dashboard de Ministério', status: 'done' },
      { id: 'financial-dashboard', name: 'Dashboard Financeiro', status: 'done' },
    ]
  },
  {
    id: 'members',
    name: 'Gestão de Membros',
    icon: Users,
    color: 'bg-blue-600',
    screens: [
      { id: 'members-list', name: 'Lista de Membros', path: '/app-ui/members', status: 'done' },
      { id: 'members-grid', name: 'Grid de Membros', path: '/app-ui/members/grid', status: 'done' },
      { id: 'member-profile', name: 'Perfil do Membro', path: '/app-ui/members/1', status: 'done' },
      { id: 'member-new', name: 'Novo Membro', path: '/app-ui/members/new', status: 'done' },
      { id: 'member-edit', name: 'Editar Membro', path: '/app-ui/members/1/edit', status: 'done' },
      { id: 'member-photo', name: 'Upload de Foto', status: 'done' },
      { id: 'family-tree', name: 'Árvore Familiar', status: 'done' },
      { id: 'family-relationships', name: 'Relacionamentos Familiares', path: '/app-ui/members/1/family', status: 'done' },
      { id: 'membership-history', name: 'Histórico de Membros', status: 'done' },
      { id: 'member-documents', name: 'Documentos do Membro', path: '/app-ui/members/1/documents', status: 'done' },
      { id: 'member-notes', name: 'Notas do Membro', status: 'done' },
      { id: 'member-import', name: 'Importar Membros', path: '/app-ui/members/import', status: 'done' },
      { id: 'member-export', name: 'Exportar Membros', status: 'done' },
      { id: 'member-merge', name: 'Mesclar Membros', status: 'done' },
      { id: 'member-archive', name: 'Arquivar Membro', status: 'done' },
    ]
  },
  {
    id: 'pastoral',
    name: 'Gestão Pastoral',
    icon: Heart,
    color: 'bg-pink-500',
    screens: [
      { id: 'pastoral-visits', name: 'Visitas Pastorais', path: '/app-ui/pastoral', status: 'done' },
      { id: 'visit-new', name: 'Nova Visita', status: 'done' },
      { id: 'visit-detail', name: 'Detalhes da Visita', path: '/app-ui/pastoral/visit-detail', status: 'done' },
      { id: 'visit-report', name: 'Relatório de Visita', status: 'done' },
      { id: 'counseling-list', name: 'Lista de Aconselhamentos', status: 'done' },
      { id: 'counseling-new', name: 'Novo Aconselhamento', status: 'done' },
      { id: 'counseling-session', name: 'Sessão de Aconselhamento', status: 'done' },
      { id: 'prayer-requests', name: 'Pedidos de Oração', path: '/app-ui/pastoral/prayer-requests', status: 'done' },
      { id: 'prayer-new', name: 'Novo Pedido', status: 'done' },
      { id: 'prayer-wall', name: 'Mural de Oração', status: 'done' },
      { id: 'followup-dashboard', name: 'Dashboard de Follow-up', status: 'done' },
      { id: 'discipleship-tracking', name: 'Acompanhamento Discipulado', status: 'done' },
      { id: 'discipleship-curriculum', name: 'Currículo de Discipulado', status: 'done' },
    ]
  },
  {
    id: 'ecclesiastical',
    name: 'Processos Eclesiásticos',
    icon: CheckSquare,
    color: 'bg-indigo-500',
    screens: [
      { id: 'baptism-requests', name: 'Pedidos de Batismo', status: 'done' },
      { id: 'baptism-form', name: 'Formulário de Batismo', status: 'done' },
      { id: 'baptism-approval', name: 'Aprovação de Batismo', status: 'done' },
      { id: 'baptism-workflow', name: 'Workflow de Batismo', status: 'done' },
      { id: 'baptism-certificate', name: 'Certificado de Batismo', status: 'done' },
      { id: 'consecration-requests', name: 'Pedidos de Consagração', status: 'done' },
      { id: 'consecration-workflow', name: 'Workflow de Consagração', status: 'done' },
      { id: 'transfer-requests', name: 'Transferências de Igreja', status: 'done' },
      { id: 'transfer-form', name: 'Formulário de Transferência', status: 'done' },
      { id: 'credentials', name: 'Credenciais', status: 'done' },
      { id: 'credentials-new', name: 'Gerar Credencial', status: 'done' },
      { id: 'wedding-requests', name: 'Casamentos', status: 'done' },
      { id: 'dedication-requests', name: 'Apresentações', status: 'done' },
    ]
  },
  {
    id: 'crm',
    name: 'CRM',
    icon: Target,
    color: 'bg-orange-500',
    screens: [
      { id: 'crm-overview', name: 'Visão Geral CRM', path: '/app-ui/crm', status: 'done' },
      { id: 'crm-pipeline', name: 'Pipeline Kanban', path: '/app-ui/crm/pipeline', status: 'done' },
      { id: 'lead-detail', name: 'Detalhes do Lead', path: '/app-ui/crm/1', status: 'done' },
      { id: 'lead-new', name: 'Novo Lead', status: 'done' },
      { id: 'lead-edit', name: 'Editar Lead', status: 'done' },
      { id: 'lead-timeline', name: 'Timeline de Atividades', status: 'done' },
      { id: 'lead-notes', name: 'Notas do Lead', status: 'done' },
      { id: 'lead-tasks', name: 'Tarefas do Lead', status: 'done' },
      { id: 'lead-emails', name: 'Emails do Lead', status: 'done' },
      { id: 'lead-calls', name: 'Chamadas do Lead', status: 'done' },
      { id: 'deal-detail', name: 'Detalhes do Negócio', status: 'done' },
      { id: 'deal-stages', name: 'Estágios do Negócio', status: 'done' },
      { id: 'contact-properties', name: 'Propriedades de Contato', status: 'done' },
      { id: 'custom-fields', name: 'Campos Customizados', status: 'done' },
      { id: 'assignments', name: 'Atribuições', status: 'done' },
      { id: 'crm-reports', name: 'Relatórios CRM', status: 'done' },
    ]
  },
  {
    id: 'automation',
    name: 'Automações',
    icon: Zap,
    color: 'bg-yellow-500',
    screens: [
      { id: 'automation-list', name: 'Lista de Automações', path: '/app-ui/automation', status: 'done' },
      { id: 'automation-builder', name: 'Construtor Visual', path: '/app-ui/automation/builder', status: 'done' },
      { id: 'automation-triggers', name: 'Gatilhos', status: 'done' },
      { id: 'automation-actions', name: 'Ações', status: 'done' },
      { id: 'automation-conditions', name: 'Condições', status: 'done' },
      { id: 'automation-templates', name: 'Templates', status: 'done' },
      { id: 'automation-analytics', name: 'Analytics', status: 'done' },
      { id: 'automation-logs', name: 'Logs de Execução', status: 'done' },
      { id: 'automation-test', name: 'Testar Automação', status: 'done' },
    ]
  },
  {
    id: 'finance',
    name: 'Tesouraria',
    icon: DollarSign,
    color: 'bg-green-600',
    screens: [
      { id: 'finance-overview', name: 'Visão Geral Financeira', path: '/app-ui/finance', status: 'done' },
      { id: 'cashbook', name: 'Livro Caixa', path: '/app-ui/finance/cashbook', status: 'done' },
      { id: 'income-new', name: 'Lançar Receita', path: '/app-ui/finance/income/new', status: 'done' },
      { id: 'expense-new', name: 'Lançar Despesa', path: '/app-ui/finance/expense/new', status: 'done' },
      { id: 'transfer-new', name: 'Transferência Entre Igrejas', status: 'done' },
      { id: 'categories', name: 'Categorias', status: 'done' },
      { id: 'chart-accounts', name: 'Plano de Contas', status: 'done' },
      { id: 'monthly-closing', name: 'Fechamento Mensal', status: 'done' },
      { id: 'financial-reports', name: 'Relatórios Financeiros', status: 'done' },
      { id: 'budget-planning', name: 'Planejamento Orçamentário', status: 'done' },
      { id: 'budget-vs-actual', name: 'Orçado vs Realizado', status: 'done' },
      { id: 'giving-dashboard', name: 'Dashboard de Dízimos', status: 'done' },
      { id: 'giving-statements', name: 'Comprovantes de Doação', status: 'done' },
      { id: 'recurring-transactions', name: 'Transações Recorrentes', status: 'done' },
      { id: 'bank-reconciliation', name: 'Conciliação Bancária', status: 'done' },
    ]
  },
  {
    id: 'events',
    name: 'Gestão de Eventos',
    icon: Calendar,
    color: 'bg-red-500',
    screens: [
      { id: 'events-list', name: 'Lista de Eventos', path: '/app-ui/events', status: 'done' },
      { id: 'event-new', name: 'Novo Evento', status: 'done' },
      { id: 'event-detail', name: 'Detalhes do Evento', path: '/app-ui/events/1', status: 'done' },
      { id: 'event-edit', name: 'Editar Evento', status: 'done' },
      { id: 'ticket-types', name: 'Tipos de Ingresso', status: 'done' },
      { id: 'ticket-purchase', name: 'Comprar Ingresso', status: 'done' },
      { id: 'ticket-payment', name: 'Pagamento', status: 'done' },
      { id: 'ticket-confirmation', name: 'Confirmação', status: 'done' },
      { id: 'ticket-qrcode', name: 'QR Code do Ingresso', status: 'done' },
      { id: 'event-checkin-dashboard', name: 'Dashboard de Check-in', status: 'done' },
      { id: 'event-checkin-scanner', name: 'Scanner de QR Code', status: 'done' },
      { id: 'event-checkin-manual', name: 'Check-in Manual', status: 'done' },
      { id: 'attendance-reports', name: 'Relatórios de Presença', status: 'done' },
      { id: 'event-registration', name: 'Inscrições de Evento', status: 'done' },
    ]
  },
  {
    id: 'checkin',
    name: 'Sistema de Check-in',
    icon: CheckSquare,
    color: 'bg-teal-500',
    screens: [
      { id: 'checkin-home', name: 'Check-in Home', path: '/app-ui/checkin', status: 'done' },
      { id: 'member-checkin', name: 'Check-in de Membros', path: '/app-ui/checkin/member', status: 'done' },
      { id: 'visitor-checkin', name: 'Check-in de Visitantes', status: 'done' },
      { id: 'kids-checkin', name: 'Check-in Kids', status: 'done' },
      { id: 'kids-pickup', name: 'Retirada Kids', status: 'done' },
      { id: 'service-selector', name: 'Seletor de Culto', status: 'done' },
      { id: 'checkin-kiosk', name: 'Modo Quiosque', status: 'done' },
      { id: 'attendance-live', name: 'Presença ao Vivo', status: 'done' },
    ]
  },
  {
    id: 'communication',
    name: 'Comunicação',
    icon: MessageSquare,
    color: 'bg-cyan-500',
    screens: [
      { id: 'communication-hub', name: 'Central de Comunicação', path: '/app-ui/communication', status: 'done' },
      { id: 'whatsapp-conversation', name: 'Conversa WhatsApp', status: 'done' },
      { id: 'whatsapp-contacts', name: 'Contatos WhatsApp', status: 'done' },
      { id: 'whatsapp-autoreply', name: 'Respostas Automáticas', status: 'done' },
      { id: 'whatsapp-campaign', name: 'Campanha WhatsApp', status: 'done' },
      { id: 'email-campaigns', name: 'Campanhas Email', status: 'done' },
      { id: 'email-composer', name: 'Compor Email', status: 'done' },
      { id: 'email-templates', name: 'Templates de Email', status: 'done' },
      { id: 'email-template-editor', name: 'Editor de Template', status: 'done' },
      { id: 'email-analytics', name: 'Analytics de Email', status: 'done' },
      { id: 'sms-campaigns', name: 'Campanhas SMS', status: 'done' },
      { id: 'notification-center', name: 'Central de Notificações', status: 'done' },
      { id: 'broadcast-message', name: 'Mensagem em Massa', status: 'done' },
      { id: 'communication-reports', name: 'Relatórios de Comunicação', path: '/app-ui/communication/reports', status: 'done' },
    ]
  },
  {
    id: 'ministries',
    name: 'Ministérios',
    icon: Building2,
    color: 'bg-violet-500',
    screens: [
      { id: 'ministries-list', name: 'Lista de Ministérios', path: '/app-ui/ministries', status: 'done' },
      { id: 'ministry-new', name: 'Novo Ministério', status: 'done' },
      { id: 'ministry-detail', name: 'Detalhes do Ministério', path: '/app-ui/ministries/1', status: 'done' },
      { id: 'ministry-leaders', name: 'Líderes do Ministério', status: 'done' },
      { id: 'ministry-departments', name: 'Departamentos', status: 'done' },
      { id: 'ministry-teams', name: 'Equipes', status: 'done' },
      { id: 'ministry-volunteers', name: 'Voluntários', status: 'done' },
      { id: 'ministry-schedule', name: 'Escala de Ministério', status: 'done' },
      { id: 'volunteer-application', name: 'Formulário de Voluntário', status: 'done' },
    ]
  },
  {
    id: 'cells',
    name: 'Células',
    icon: Users,
    color: 'bg-lime-500',
    screens: [
      { id: 'cells-list', name: 'Lista de Células', path: '/app-ui/cells', status: 'done' },
      { id: 'cell-new', name: 'Nova Célula', status: 'done' },
      { id: 'cell-detail', name: 'Detalhes da Célula', status: 'done' },
      { id: 'cell-leaders', name: 'Líderes de Célula', status: 'done' },
      { id: 'cell-members', name: 'Membros da Célula', status: 'done' },
      { id: 'cell-meeting-report', name: 'Relatório de Reunião', status: 'done' },
      { id: 'cell-attendance', name: 'Presença da Célula', status: 'done' },
      { id: 'cell-growth', name: 'Crescimento de Células', status: 'done' },
      { id: 'cell-multiplication', name: 'Multiplicação de Células', status: 'done' },
    ]
  },
  {
    id: 'reports',
    name: 'Relatórios e Analytics',
    icon: BarChart3,
    color: 'bg-emerald-500',
    screens: [
      { id: 'reports-dashboard', name: 'Dashboard de Relatórios', path: '/app-ui/reports', status: 'done' },
      { id: 'member-growth-report', name: 'Crescimento de Membros', status: 'done' },
      { id: 'financial-analytics', name: 'Analytics Financeiro', status: 'done' },
      { id: 'attendance-analytics', name: 'Analytics de Presença', status: 'done' },
      { id: 'ministry-distribution', name: 'Distribuição de Ministérios', status: 'done' },
      { id: 'event-participation', name: 'Participação em Eventos', status: 'done' },
      { id: 'giving-analytics', name: 'Analytics de Dízimos', status: 'done' },
      { id: 'custom-reports', name: 'Relatórios Customizados', status: 'done' },
      { id: 'report-builder', name: 'Construtor de Relatórios', status: 'done' },
      { id: 'data-export', name: 'Exportação de Dados', status: 'done' },
    ]
  },
  {
    id: 'system',
    name: 'Configurações',
    icon: Settings,
    color: 'bg-gray-600',
    screens: [
      { id: 'users-list', name: 'Lista de Usuários', path: '/app-ui/system/users', status: 'done' },
      { id: 'user-new', name: 'Novo Usuário', status: 'done' },
      { id: 'user-edit', name: 'Editar Usuário', status: 'done' },
      { id: 'roles-list', name: 'Funções', status: 'done' },
      { id: 'role-new', name: 'Nova Função', status: 'done' },
      { id: 'permissions-matrix', name: 'Matriz de Permissões', status: 'done' },
      { id: 'church-settings', name: 'Configurações da Igreja', status: 'done' },
      { id: 'theme-settings', name: 'Temas e Aparência', status: 'done' },
      { id: 'integration-settings', name: 'Integrações', status: 'done' },
      { id: 'webhook-settings', name: 'Webhooks', status: 'done' },
      { id: 'api-keys', name: 'Chaves de API', status: 'done' },
      { id: 'notification-settings', name: 'Configurações de Notificação', status: 'done' },
      { id: 'email-settings', name: 'Configurações de Email', status: 'done' },
      { id: 'whatsapp-settings', name: 'Configurações de WhatsApp', status: 'done' },
      { id: 'backup-settings', name: 'Backup e Restauração', status: 'done' },
      { id: 'audit-log', name: 'Log de Auditoria', status: 'done' },
      { id: 'general-settings', name: 'Configurações Gerais', path: '/app-ui/system/settings', status: 'done' },
    ]
  },
  {
    id: 'multi-church',
    name: 'Multi-Igreja',
    icon: Building2,
    color: 'bg-slate-600',
    screens: [
      { id: 'field-switcher', name: 'Seletor de Campo', status: 'done' },
      { id: 'church-hierarchy', name: 'Hierarquia de Igrejas', status: 'done' },
      { id: 'regional-view', name: 'Visão Regional', status: 'done' },
      { id: 'church-transfer', name: 'Transferência Entre Igrejas', status: 'done' },
      { id: 'consolidated-reports', name: 'Relatórios Consolidados', status: 'done' },
    ]
  }
];

export function ScreenCatalog() {
  const totalScreens = screenCategories.reduce((acc, cat) => acc + cat.screens.length, 0);
  const doneScreens = screenCategories.reduce((acc, cat) => 
    acc + cat.screens.filter(s => s.status === 'done').length, 0
  );
  const plannedScreens = totalScreens - doneScreens;
  const progress = Math.round((doneScreens / totalScreens) * 100);

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">Catálogo Completo de Telas - MRM</h1>
        <p className="text-lg text-slate-600 mb-6">
          Sistema de Gestão de Relacionamento Ministerial com {totalScreens} telas e fluxos de usuário
        </p>
        
        {/* Progress */}
        <div className={`rounded-xl border-2 p-8 shadow-lg ${
          progress === 100 
            ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-500' 
            : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-sm text-slate-600 mb-1">Total de Telas</p>
              <p className="text-5xl font-bold text-slate-900">{totalScreens}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 mb-1">Implementadas</p>
              <p className="text-5xl font-bold text-green-600">{doneScreens}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 mb-1">Planejadas</p>
              <p className={`text-5xl font-bold ${plannedScreens === 0 ? 'text-slate-400' : 'text-blue-600'}`}>{plannedScreens}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 mb-1">Progresso</p>
              <p className={`text-6xl font-bold ${progress === 100 ? 'text-green-600' : 'text-purple-600'}`}>
                {progress}%
              </p>
            </div>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-6">
            <div 
              className={`h-6 rounded-full transition-all flex items-center justify-center text-white font-bold ${
                progress === 100 
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
                  : 'bg-gradient-to-r from-purple-600 to-blue-500'
              }`}
              style={{ width: `${progress}%` }}
            >
              {progress === 100 && '🎉 COMPLETO! 🎉'}
            </div>
          </div>
          
          {progress === 100 && (
            <div className="mt-6 text-center">
              <p className="text-lg font-semibold text-green-700">
                🏆 Todas as {totalScreens} telas foram implementadas com sucesso! 🏆
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Categories */}
      <div className="space-y-8">
        {screenCategories.map((category) => {
          const Icon = category.icon;
          const categoryDone = category.screens.filter(s => s.status === 'done').length;
          const categoryTotal = category.screens.length;
          const categoryProgress = Math.round((categoryDone / categoryTotal) * 100);
          
          return (
            <div key={category.id} className={`bg-white rounded-xl border-2 overflow-hidden shadow-md ${
              categoryProgress === 100 ? 'border-green-400' : 'border-slate-200'
            }`}>
              <div className={`p-6 ${category.color} bg-opacity-10 border-b-2 ${
                categoryProgress === 100 ? 'border-green-300' : 'border-slate-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 ${category.color} rounded-xl flex items-center justify-center text-white`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">{category.name}</h2>
                      <p className="text-sm text-slate-600">{categoryTotal} telas</p>
                    </div>
                  </div>
                  {categoryProgress === 100 && (
                    <div className="text-4xl">✓</div>
                  )}
                </div>
                
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700">
                      {categoryDone} de {categoryTotal} implementadas
                    </span>
                    <span className={`text-xl font-bold ${
                      categoryProgress === 100 ? 'text-green-600' : 'text-purple-600'
                    }`}>
                      {categoryProgress}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-3">
                    <div 
                      className={`h-3 rounded-full transition-all ${
                        categoryProgress === 100 
                          ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
                          : 'bg-gradient-to-r from-purple-600 to-blue-500'
                      }`}
                      style={{ width: `${categoryProgress}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-3 gap-3">
                  {category.screens.map((screen) => (
                    <div key={screen.id} className="group">
                      {screen.path ? (
                        <Link
                          to={screen.path}
                          className={`block p-3 rounded-lg border-2 hover:shadow-md transition-all ${
                            screen.status === 'done'
                              ? 'bg-green-50 border-green-300 hover:border-green-400'
                              : 'bg-blue-50 border-blue-200 hover:border-blue-400'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-medium text-slate-900 group-hover:text-purple-600">
                              {screen.name}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold flex-shrink-0 ${
                              screen.status === 'done'
                                ? 'bg-green-500 text-white'
                                : 'bg-blue-500 text-white'
                            }`}>
                              {screen.status === 'done' ? 'Pronto' : 'Planejado'}
                            </span>
                          </div>
                        </Link>
                      ) : (
                        <div
                          className={`block p-3 rounded-lg border-2 ${
                            screen.status === 'done'
                              ? 'bg-green-50 border-green-300'
                              : 'bg-blue-50 border-blue-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-medium text-slate-900">
                              {screen.name}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold flex-shrink-0 ${
                              screen.status === 'done'
                                ? 'bg-green-500 text-white'
                                : 'bg-blue-500 text-white'
                            }`}>
                              {screen.status === 'done' ? 'Pronto' : 'Planejado'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {progress === 100 && (
        <div className="mt-12 text-center">
          <Link 
            to="/screen-catalog-complete"
            className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-bold text-lg hover:shadow-2xl transition-all"
          >
            🏆 Ver Catálogo de Celebração 100% 🏆
          </Link>
        </div>
      )}
    </div>
  );
}
