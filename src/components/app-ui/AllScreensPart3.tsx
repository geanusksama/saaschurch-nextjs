import { Users, Shield, Settings, Building2, Palette, Link2, Webhook, Key, Bell, Mail, MessageSquare, Database, Clock, Archive, Target, DollarSign, Calendar, BookOpen, Award, Heart, CheckSquare, MapPin, Smartphone } from 'lucide-react';
import { ScreenTemplate } from './AllScreens';

// System & Settings
export function UserNew() {
  return <ScreenTemplate title="Novo Usuário" description="Cadastre um novo usuário do sistema" icon={Users} gradientFrom="from-slate-600" gradientTo="to-slate-800" features={['Dados pessoais', 'Email', 'Função', 'Permissões']} />;
}

export function UserEdit() {
  return <ScreenTemplate title="Editar Usuário" description="Altere dados do usuário" icon={Users} gradientFrom="from-blue-600" gradientTo="to-indigo-600" features={['Informações', 'Função', 'Status', 'Senha']} />;
}

export function RolesList() {
  return <ScreenTemplate title="Funções" description="Gerencie funções de usuário" icon={Shield} gradientFrom="from-purple-600" gradientTo="to-indigo-600" features={['Criar função', 'Permissões', 'Atribuir', 'Hierarquia']} />;
}

export function RoleNew() {
  return <ScreenTemplate title="Nova Função" description="Crie uma nova função" icon={Shield} gradientFrom="from-indigo-600" gradientTo="to-purple-600" features={['Nome', 'Descrição', 'Permissões', 'Nível']} />;
}

export function PermissionsMatrix() {
  return <ScreenTemplate title="Matriz de Permissões" description="Controle granular de acesso" icon={Shield} gradientFrom="from-red-600" gradientTo="to-rose-600" features={['Por módulo', 'CRUD', 'Funções', 'Visual']} />;
}

export function ChurchSettings() {
  return <ScreenTemplate title="Configurações da Igreja" description="Dados da igreja local" icon={Building2} gradientFrom="from-blue-600" gradientTo="to-cyan-600" features={['Nome', 'Logo', 'Endereço', 'Contatos']} />;
}

export function ThemeSettings() {
  return <ScreenTemplate title="Temas e Aparência" description="Personalize a interface" icon={Palette} gradientFrom="from-purple-500" gradientTo="to-pink-500" features={['Cores', 'Logo', 'Modo escuro', 'Fontes']} />;
}

export function IntegrationSettings() {
  return <ScreenTemplate title="Integrações" description="Conecte com outros sistemas" icon={Link2} gradientFrom="from-green-600" gradientTo="to-emerald-600" features={['APIs', 'OAuth', 'Webhooks', 'Status']} />;
}

export function WebhookSettings() {
  return <ScreenTemplate title="Webhooks" description="Automação com webhooks" icon={Webhook} gradientFrom="from-orange-600" gradientTo="to-red-600" features={['Criar', 'Eventos', 'URL', 'Logs']} />;
}

export function APIKeys() {
  return <ScreenTemplate title="Chaves de API" description="Gerencie chaves de acesso" icon={Key} gradientFrom="from-slate-700" gradientTo="to-slate-900" features={['Criar chave', 'Revogar', 'Escopos', 'Logs']} />;
}

export function NotificationSettings() {
  return <ScreenTemplate title="Configurações de Notificação" description="Preferências de notificação" icon={Bell} gradientFrom="from-yellow-500" gradientTo="to-orange-500" features={['Push', 'Email', 'SMS', 'Canais']} />;
}

export function EmailSettings() {
  return <ScreenTemplate title="Configurações de Email" description="SMTP e templates" icon={Mail} gradientFrom="from-blue-600" gradientTo="to-indigo-600" features={['SMTP', 'Templates', 'Remetente', 'Testes']} />;
}

export function WhatsAppSettings() {
  return <ScreenTemplate title="Configurações de WhatsApp" description="Integração WhatsApp Business" icon={MessageSquare} gradientFrom="from-green-600" gradientTo="to-emerald-600" features={['API', 'Número', 'Mensagens', 'Logs']} />;
}

export function BackupSettings() {
  return <ScreenTemplate title="Backup e Restauração" description="Proteção de dados" icon={Database} gradientFrom="from-purple-600" gradientTo="to-indigo-600" features={['Agendar', 'Restaurar', 'Cloud', 'Histórico']} />;
}

export function AuditLog() {
  return <ScreenTemplate title="Log de Auditoria" description="Histórico de ações" icon={Clock} gradientFrom="from-slate-600" gradientTo="to-slate-800" features={['Usuário', 'Ação', 'Data', 'Filtros']} />;
}

// Multi-Igreja
export function FieldSwitcher() {
  return <ScreenTemplate title="Seletor de Campo" description="Alterne entre campos" icon={Building2} gradientFrom="from-blue-600" gradientTo="to-indigo-600" features={['Lista', 'Buscar', 'Acesso rápido', 'Favoritos']} />;
}

export function ChurchHierarchy() {
  return <ScreenTemplate title="Hierarquia de Igrejas" description="Organograma multi-igreja" icon={Building2} gradientFrom="from-purple-600" gradientTo="to-pink-600" features={['Campo', 'Regional', 'Igreja', 'Visual']} />;
}

export function RegionalView() {
  return <ScreenTemplate title="Visão Regional" description="Dashboard regional" icon={MapPin} gradientFrom="from-green-600" gradientTo="to-emerald-600" features={['Estatísticas', 'Igrejas', 'Metas', 'Relatórios']} />;
}

export function ChurchTransfer() {
  return <ScreenTemplate title="Transferência Entre Igrejas" description="Movimentação de membros" icon={Building2} gradientFrom="from-orange-600" gradientTo="to-red-600" features={['Origem', 'Destino', 'Aprovação', 'Histórico']} />;
}

export function ConsolidatedReports() {
  return <ScreenTemplate title="Relatórios Consolidados" description="Visão geral multi-igreja" icon={Archive} gradientFrom="from-indigo-600" gradientTo="to-purple-600" features={['Agregados', 'Comparações', 'Filtros', 'Exportar']} />;
}

// Pastoral
export function VisitNew() {
  return <ScreenTemplate title="Nova Visita" description="Agende uma visita pastoral" icon={Heart} gradientFrom="from-pink-500" gradientTo="to-rose-500" features={['Membro', 'Data', 'Motivo', 'Observações']} />;
}

export function VisitReport() {
  return <ScreenTemplate title="Relatório de Visita" description="Registre o resultado da visita" icon={CheckSquare} gradientFrom="from-blue-600" gradientTo="to-indigo-600" features={['Resumo', 'Oração', 'Próximos passos', 'Anexos']} />;
}

export function CounselingList() {
  return <ScreenTemplate title="Lista de Aconselhamentos" description="Gerencie sessões de aconselhamento" icon={Heart} gradientFrom="from-purple-600" gradientTo="to-pink-600" features={['Agendados', 'Histórico', 'Notas', 'Follow-up']} />;
}

export function CounselingNew() {
  return <ScreenTemplate title="Novo Aconselhamento" description="Agende um aconselhamento" icon={Calendar} gradientFrom="from-teal-600" gradientTo="to-cyan-600" features={['Pessoa', 'Data', 'Tipo', 'Conselheiro']} />;
}

export function CounselingSession() {
  return <ScreenTemplate title="Sessão de Aconselhamento" description="Registro da sessão" icon={BookOpen} gradientFrom="from-blue-600" gradientTo="to-indigo-600" features={['Notas', 'Próxima sessão', 'Recursos', 'Confidencial']} />;
}

export function PrayerNew() {
  return <ScreenTemplate title="Novo Pedido" description="Adicione um pedido de oração" icon={Heart} gradientFrom="from-pink-500" gradientTo="to-rose-500" features={['Título', 'Descrição', 'Urgência', 'Privacidade']} />;
}

export function PrayerWall() {
  return <ScreenTemplate title="Mural de Oração" description="Painel público de pedidos" icon={Heart} gradientFrom="from-purple-500" gradientTo="to-pink-500" features={['Listar', 'Orar', 'Comentar', 'Testemunhos']} />;
}

export function FollowupDashboard() {
  return <ScreenTemplate title="Dashboard de Follow-up" description="Acompanhamento de visitantes" icon={Target} gradientFrom="from-orange-600" gradientTo="to-red-600" features={['Novos', 'Em andamento', 'Concluídos', 'Tarefas']} />;
}

export function DiscipleshipTracking() {
  return <ScreenTemplate title="Acompanhamento Discipulado" description="Processo de discipulado" icon={BookOpen} gradientFrom="from-blue-600" gradientTo="to-indigo-600" features={['Estágios', 'Materiais', 'Progresso', 'Metas']} />;
}

export function DiscipleshipCurriculum() {
  return <ScreenTemplate title="Currículo de Discipulado" description="Conteúdo e materiais" icon={BookOpen} gradientFrom="from-green-600" gradientTo="to-emerald-600" features={['Lições', 'Vídeos', 'Questionários', 'Certificado']} />;
}

// Finance
export function CategoryManagement() {
  return <ScreenTemplate title="Categorias" description="Categorias de receitas e despesas" icon={DollarSign} gradientFrom="from-green-600" gradientTo="to-emerald-600" features={['Criar', 'Editar', 'Hierarquia', 'Ícones']} />;
}

export function ChartOfAccounts() {
  return <ScreenTemplate title="Plano de Contas" description="Estrutura contábil" icon={DollarSign} gradientFrom="from-blue-600" gradientTo="to-indigo-600" features={['Contas', 'Subcontas', 'Tipo', 'Código']} />;
}

export function MonthlyClosing() {
  return <ScreenTemplate title="Fechamento Mensal" description="Fechamento contábil" icon={Calendar} gradientFrom="from-purple-600" gradientTo="to-pink-600" features={['Conciliar', 'Relatórios', 'Aprovar', 'Trancar']} />;
}

export function BudgetPlanning() {
  return <ScreenTemplate title="Planejamento Orçamentário" description="Crie o orçamento anual" icon={Target} gradientFrom="from-orange-600" gradientTo="to-red-600" features={['Por categoria', 'Metas', 'Aprovação', 'Revisão']} />;
}

export function BudgetVsActual() {
  return <ScreenTemplate title="Orçado vs Realizado" description="Compare planejado com executado" icon={DollarSign} gradientFrom="from-teal-600" gradientTo="to-cyan-600" features={['Gráficos', 'Desvios', 'Análise', 'Exportar']} />;
}

export function GivingDashboard() {
  return <ScreenTemplate title="Dashboard de Dízimos" description="Análise de contribuições" icon={DollarSign} gradientFrom="from-green-600" gradientTo="to-emerald-600" features={['Total', 'Dizimistas', 'Média', 'Tendências']} />;
}

export function GivingStatements() {
  return <ScreenTemplate title="Comprovantes de Doação" description="Emita comprovantes" icon={Award} gradientFrom="from-purple-600" gradientTo="to-indigo-600" features={['Anual', 'Mensal', 'PDF', 'Email']} />;
}

export function RecurringTransactions() {
  return <ScreenTemplate title="Transações Recorrentes" description="Lançamentos automáticos" icon={Calendar} gradientFrom="from-blue-600" gradientTo="to-cyan-600" features={['Criar', 'Frequência', 'Valor', 'Status']} />;
}

export function BankReconciliation() {
  return <ScreenTemplate title="Conciliação Bancária" description="Reconcilie com extrato" icon={CheckSquare} gradientFrom="from-green-600" gradientTo="to-emerald-600" features={['Importar', 'Combinar', 'Divergências', 'Aprovar']} />;
}

export function FinancialReports() {
  return <ScreenTemplate title="Relatórios Financeiros" description="Relatórios contábeis" icon={Archive} gradientFrom="from-slate-700" gradientTo="to-slate-900" features={['DRE', 'Balanço', 'Fluxo', 'Customizado']} />;
}
