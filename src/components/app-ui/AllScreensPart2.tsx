import { Mail, MessageSquare, Send, Bell, Calendar, Users, Target, Zap, FileText, Settings, DollarSign, TrendingUp, Award, Book, Gift, Heart, Building2, Phone, Shield } from 'lucide-react';
import { ScreenTemplate } from './AllScreens';

// Communication
export function WhatsAppConversation() {
  return <ScreenTemplate title="Conversa WhatsApp" description="Chat individual ou em grupo" icon={MessageSquare} gradientFrom="from-green-500" gradientTo="to-emerald-500" features={['Mensagens', 'Mídia', 'Áudio', 'Histórico']} />;
}

export function WhatsAppContacts() {
  return <ScreenTemplate title="Contatos WhatsApp" description="Gerencie contatos" icon={Users} gradientFrom="from-teal-500" gradientTo="to-cyan-500" features={['Lista', 'Grupos', 'Etiquetas', 'Sincronizar']} />;
}

export function WhatsAppAutoReply() {
  return <ScreenTemplate title="Respostas Automáticas" description="Configure mensagens automáticas" icon={Zap} gradientFrom="from-purple-500" gradientTo="to-pink-500" features={['Palavras-chave', 'Horários', 'Templates', 'Testes']} />;
}

export function WhatsAppCampaign() {
  return <ScreenTemplate title="Campanha WhatsApp" description="Envio em massa" icon={Send} gradientFrom="from-blue-500" gradientTo="to-indigo-500" features={['Segmentação', 'Agendamento', 'Templates', 'Relatórios']} />;
}

export function EmailCampaigns() {
  return <ScreenTemplate title="Campanhas Email" description="Marketing por email" icon={Mail} gradientFrom="from-red-500" gradientTo="to-rose-500" features={['Listas', 'Templates', 'Agendamento', 'Analytics']} />;
}

export function EmailComposer() {
  return <ScreenTemplate title="Compor Email" description="Editor de email rico" icon={FileText} gradientFrom="from-orange-500" gradientTo="to-red-500" features={['Editor visual', 'HTML', 'Anexos', 'Preview']} />;
}

export function EmailTemplates() {
  return <ScreenTemplate title="Templates de Email" description="Biblioteca de templates" icon={FileText} gradientFrom="from-blue-600" gradientTo="to-purple-600" features={['Galeria', 'Personalizar', 'Salvar', 'Compartilhar']} />;
}

export function EmailTemplateEditor() {
  return <ScreenTemplate title="Editor de Template" description="Crie templates personalizados" icon={Settings} gradientFrom="from-purple-600" gradientTo="to-pink-600" features={['Drag & drop', 'Blocos', 'Variáveis', 'Preview']} />;
}

export function EmailAnalytics() {
  return <ScreenTemplate title="Analytics de Email" description="Métricas de campanhas" icon={TrendingUp} gradientFrom="from-green-600" gradientTo="to-teal-600" features={['Aberturas', 'Cliques', 'Conversões', 'Gráficos']} />;
}

export function SMSCampaigns() {
  return <ScreenTemplate title="Campanhas SMS" description="Envio de SMS em massa" icon={Phone} gradientFrom="from-cyan-500" gradientTo="to-blue-500" features={['160 caracteres', 'Agendamento', 'Listas', 'Relatórios']} />;
}

export function NotificationCenter() {
  return <ScreenTemplate title="Central de Notificações" description="Todas notificações do sistema" icon={Bell} gradientFrom="from-yellow-500" gradientTo="to-orange-500" features={['Push', 'Email', 'SMS', 'Preferências']} />;
}

export function BroadcastMessage() {
  return <ScreenTemplate title="Mensagem em Massa" description="Comunicação ampla" icon={Send} gradientFrom="from-indigo-500" gradientTo="to-purple-500" features={['Multi-canal', 'Segmentação', 'Agendamento', 'Tracking']} />;
}

// Ministries
export function MinistryNew() {
  return <ScreenTemplate title="Novo Ministério" description="Cadastre um novo ministério" icon={Heart} gradientFrom="from-pink-500" gradientTo="to-rose-500" features={['Nome', 'Líder', 'Descrição', 'Membros']} />;
}

export function MinistryLeaders() {
  return <ScreenTemplate title="Líderes do Ministério" description="Equipe de liderança" icon={Award} gradientFrom="from-purple-600" gradientTo="to-indigo-600" features={['Líder principal', 'Vice-líderes', 'Coordenadores']} />;
}

export function MinistryDepartments() {
  return <ScreenTemplate title="Departamentos" description="Organize em departamentos" icon={Building2} gradientFrom="from-blue-600" gradientTo="to-cyan-600" features={['Criar', 'Editar', 'Líderes', 'Equipes']} />;
}

export function MinistryTeams() {
  return <ScreenTemplate title="Equipes" description="Gerencie equipes de ministério" icon={Users} gradientFrom="from-green-600" gradientTo="to-emerald-600" features={['Criar equipe', 'Adicionar membros', 'Tarefas', 'Comunicação']} />;
}

export function MinistryVolunteers() {
  return <ScreenTemplate title="Voluntários" description="Gestão de voluntários" icon={Heart} gradientFrom="from-red-500" gradientTo="to-pink-500" features={['Cadastro', 'Disponibilidade', 'Habilidades', 'Histórico']} />;
}

export function MinistrySchedule() {
  return <ScreenTemplate title="Escala de Ministério" description="Escalas e rodízios" icon={Calendar} gradientFrom="from-purple-500" gradientTo="to-blue-500" features={['Criar escala', 'Notificar', 'Substituições', 'Histórico']} />;
}

export function VolunteerApplication() {
  return <ScreenTemplate title="Formulário de Voluntário" description="Inscrição de novos voluntários" icon={FileText} gradientFrom="from-teal-500" gradientTo="to-cyan-500" features={['Dados', 'Ministérios', 'Disponibilidade', 'Aprovação']} />;
}

// Cells
export function CellNew() {
  return <ScreenTemplate title="Nova Célula" description="Cadastre uma nova célula" icon={Users} gradientFrom="from-lime-500" gradientTo="to-green-500" features={['Nome', 'Líder', 'Local', 'Horário']} />;
}

export function CellDetail() {
  return <ScreenTemplate title="Detalhes da Célula" description="Informações completas" icon={Users} gradientFrom="from-green-600" gradientTo="to-emerald-600" features={['Membros', 'Reuniões', 'Crescimento', 'Relatórios']} />;
}

export function CellLeaders() {
  return <ScreenTemplate title="Líderes de Célula" description="Gestão de líderes" icon={Award} gradientFrom="from-lime-600" gradientTo="to-green-600" features={['Treinamento', 'Acompanhamento', 'Metas', 'Suporte']} />;
}

export function CellMembers() {
  return <ScreenTemplate title="Membros da Célula" description="Lista de participantes" icon={Users} gradientFrom="from-teal-500" gradientTo="to-cyan-500" features={['Adicionar', 'Remover', 'Presença', 'Observações']} />;
}

export function CellMeetingReport() {
  return <ScreenTemplate title="Relatório de Reunião" description="Registro de reuniões" icon={FileText} gradientFrom="from-blue-600" gradientTo="to-indigo-600" features={['Data', 'Presença', 'Oferta', 'Observações']} />;
}

export function CellAttendance() {
  return <ScreenTemplate title="Presença da Célula" description="Controle de frequência" icon={Calendar} gradientFrom="from-purple-600" gradientTo="to-pink-600" features={['Check-in', 'Histórico', 'Estatísticas', 'Relatórios']} />;
}

export function CellGrowth() {
  return <ScreenTemplate title="Crescimento de Células" description="Análise de crescimento" icon={TrendingUp} gradientFrom="from-green-500" gradientTo="to-emerald-500" features={['Gráficos', 'Tendências', 'Metas', 'Comparações']} />;
}

export function CellMultiplication() {
  return <ScreenTemplate title="Multiplicação de Células" description="Processo de multiplicação" icon={Users} gradientFrom="from-lime-500" gradientTo="to-green-500" features={['Planejamento', 'Novos líderes', 'Divisão', 'Acompanhamento']} />;
}

// Reports
export function MemberGrowthReport() {
  return <ScreenTemplate title="Crescimento de Membros" description="Análise de crescimento" icon={TrendingUp} gradientFrom="from-blue-600" gradientTo="to-indigo-600" features={['Gráficos', 'Tendências', 'Períodos', 'Exportar']} />;
}

export function FinancialAnalyticsReport() {
  return <ScreenTemplate title="Analytics Financeiro" description="Análise financeira detalhada" icon={DollarSign} gradientFrom="from-green-600" gradientTo="to-emerald-600" features={['Receitas', 'Despesas', 'Lucro', 'Tendências']} />;
}

export function AttendanceAnalyticsReport() {
  return <ScreenTemplate title="Analytics de Presença" description="Análise de frequência" icon={Calendar} gradientFrom="from-purple-600" gradientTo="to-pink-600" features={['Por culto', 'Tendências', 'Comparações', 'Picos']} />;
}

export function MinistryDistributionReport() {
  return <ScreenTemplate title="Distribuição de Ministérios" description="Membros por ministério" icon={Heart} gradientFrom="from-pink-600" gradientTo="to-rose-600" features={['Pizza', 'Barras', 'Percentuais', 'Detalhes']} />;
}

export function EventParticipationReport() {
  return <ScreenTemplate title="Participação em Eventos" description="Análise de eventos" icon={Calendar} gradientFrom="from-orange-600" gradientTo="to-red-600" features={['Por evento', 'Tendências', 'Público', 'ROI']} />;
}

export function GivingAnalyticsReport() {
  return <ScreenTemplate title="Analytics de Dízimos" description="Análise de contribuições" icon={Gift} gradientFrom="from-emerald-600" gradientTo="to-teal-600" features={['Total', 'Média', 'Crescimento', 'Dizimistas']} />;
}

export function CustomReports() {
  return <ScreenTemplate title="Relatórios Customizados" description="Crie seus próprios relatórios" icon={FileText} gradientFrom="from-slate-700" gradientTo="to-slate-900" features={['Campos', 'Filtros', 'Agrupamentos', 'Salvar']} />;
}

export function ReportBuilder() {
  return <ScreenTemplate title="Construtor de Relatórios" description="Interface visual de criação" icon={Settings} gradientFrom="from-indigo-600" gradientTo="to-purple-600" features={['Drag & drop', 'Campos', 'Gráficos', 'Preview']} />;
}

export function DataExport() {
  return <ScreenTemplate title="Exportação de Dados" description="Exporte em vários formatos" icon={FileText} gradientFrom="from-blue-600" gradientTo="to-cyan-600" features={['Excel', 'PDF', 'CSV', 'JSON']} />;
}
