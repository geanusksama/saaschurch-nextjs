import { Target, UserPlus, FileText, Mail, Phone, Calendar, Settings, Zap, Award, Droplet, Heart, Gift, Book, Ticket, CheckSquare, QrCode, TrendingUp } from 'lucide-react';
import { ScreenTemplate } from './AllScreens';

// CRM
export function LeadNew() {
  return <ScreenTemplate title="Novo Lead" description="Cadastre um novo lead" icon={UserPlus} gradientFrom="from-orange-500" gradientTo="to-red-500" features={['Dados pessoais', 'Origem', 'Interesse', 'Responsável']} />;
}

export function LeadEdit() {
  return <ScreenTemplate title="Editar Lead" description="Altere informações do lead" icon={Target} gradientFrom="from-blue-600" gradientTo="to-indigo-600" features={['Informações', 'Estágio', 'Tags', 'Notas']} />;
}

export function LeadTimeline() {
  return <ScreenTemplate title="Timeline de Atividades" description="Histórico completo do lead" icon={Calendar} gradientFrom="from-purple-600" gradientTo="to-pink-600" features={['Visitas', 'Emails', 'Chamadas', 'Notas']} />;
}

export function LeadNotes() {
  return <ScreenTemplate title="Notas do Lead" description="Anotações importantes" icon={FileText} gradientFrom="from-amber-500" gradientTo="to-orange-500" features={['Adicionar', 'Editar', 'Anexos', 'Marcar']} />;
}

export function LeadTasks() {
  return <ScreenTemplate title="Tarefas do Lead" description="Tarefas de follow-up" icon={CheckSquare} gradientFrom="from-teal-600" gradientTo="to-cyan-600" features={['Criar', 'Atribuir', 'Prazo', 'Concluir']} />;
}

export function LeadEmails() {
  return <ScreenTemplate title="Emails do Lead" description="Histórico de emails" icon={Mail} gradientFrom="from-blue-600" gradientTo="to-indigo-600" features={['Enviados', 'Recebidos', 'Templates', 'Responder']} />;
}

export function LeadCalls() {
  return <ScreenTemplate title="Chamadas do Lead" description="Registro de ligações" icon={Phone} gradientFrom="from-green-600" gradientTo="to-emerald-600" features={['Ligar', 'Histórico', 'Notas', 'Duração']} />;
}

export function DealDetail() {
  return <ScreenTemplate title="Detalhes do Negócio" description="Informações do deal" icon={Target} gradientFrom="from-purple-600" gradientTo="to-indigo-600" features={['Valor', 'Estágio', 'Probabilidade', 'Atividades']} />;
}

export function DealStages() {
  return <ScreenTemplate title="Estágios do Negócio" description="Configure o pipeline" icon={Target} gradientFrom="from-orange-600" gradientTo="to-red-600" features={['Criar estágio', 'Ordem', 'Automação', 'Metas']} />;
}

export function ContactProperties() {
  return <ScreenTemplate title="Propriedades de Contato" description="Campos personalizados" icon={Settings} gradientFrom="from-slate-700" gradientTo="to-slate-900" features={['Criar campo', 'Tipo', 'Obrigatório', 'Valores']} />;
}

export function CustomFields() {
  return <ScreenTemplate title="Campos Customizados" description="Personalize formulários" icon={FileText} gradientFrom="from-blue-600" gradientTo="to-cyan-600" features={['Texto', 'Número', 'Data', 'Lista']} />;
}

export function Assignments() {
  return <ScreenTemplate title="Atribuições" description="Distribuição de leads" icon={UserPlus} gradientFrom="from-purple-600" gradientTo="to-pink-600" features={['Manual', 'Round-robin', 'Regras', 'Histórico']} />;
}

export function CRMReports() {
  return <ScreenTemplate title="Relatórios CRM" description="Métricas de vendas" icon={TrendingUp} gradientFrom="from-green-600" gradientTo="to-emerald-600" features={['Conversão', 'Pipeline', 'Atividades', 'Performance']} />;
}

// Automation
export function AutomationTriggers() {
  return <ScreenTemplate title="Gatilhos" description="Eventos que iniciam automações" icon={Zap} gradientFrom="from-yellow-500" gradientTo="to-orange-500" features={['Novo lead', 'Campo alterado', 'Data', 'Webhook']} />;
}

export function AutomationActions() {
  return <ScreenTemplate title="Ações" description="Ações automatizadas" icon={Zap} gradientFrom="from-purple-600" gradientTo="to-pink-600" features={['Enviar email', 'Criar tarefa', 'Atualizar campo', 'Notificar']} />;
}

export function AutomationConditions() {
  return <ScreenTemplate title="Condições" description="Lógica condicional" icon={Settings} gradientFrom="from-blue-600" gradientTo="to-indigo-600" features={['If/Else', 'AND/OR', 'Comparações', 'Delays']} />;
}

export function AutomationTemplates() {
  return <ScreenTemplate title="Templates" description="Modelos prontos" icon={FileText} gradientFrom="from-green-600" gradientTo="to-emerald-600" features={['Biblioteca', 'Personalizar', 'Salvar', 'Compartilhar']} />;
}

export function AutomationAnalytics() {
  return <ScreenTemplate title="Analytics" description="Métricas de automação" icon={TrendingUp} gradientFrom="from-teal-600" gradientTo="to-cyan-600" features={['Execuções', 'Taxa de sucesso', 'Erros', 'Performance']} />;
}

export function AutomationLogs() {
  return <ScreenTemplate title="Logs de Execução" description="Histórico detalhado" icon={FileText} gradientFrom="from-slate-700" gradientTo="to-slate-900" features={['Data', 'Status', 'Erros', 'Detalhes']} />;
}

export function AutomationTest() {
  return <ScreenTemplate title="Testar Automação" description="Teste antes de ativar" icon={CheckSquare} gradientFrom="from-orange-600" gradientTo="to-red-600" features={['Executar teste', 'Dados mock', 'Resultado', 'Debug']} />;
}

// Events
export function EventNew() {
  return <ScreenTemplate title="Novo Evento" description="Crie um novo evento" icon={Calendar} gradientFrom="from-red-500" gradientTo="to-rose-500" features={['Nome', 'Data', 'Local', 'Descrição']} />;
}

export function EventEdit() {
  return <ScreenTemplate title="Editar Evento" description="Altere informações do evento" icon={Calendar} gradientFrom="from-purple-600" gradientTo="to-pink-600" features={['Informações', 'Imagem', 'Ingressos', 'Publicar']} />;
}

export function TicketTypes() {
  return <ScreenTemplate title="Tipos de Ingresso" description="Configure ingressos" icon={Ticket} gradientFrom="from-orange-600" gradientTo="to-red-600" features={['Nome', 'Preço', 'Quantidade', 'Datas']} />;
}

export function TicketPayment() {
  return <ScreenTemplate title="Pagamento" description="Processe o pagamento" icon={Award} gradientFrom="from-green-600" gradientTo="to-emerald-600" features={['Cartão', 'PIX', 'Boleto', 'Confirmação']} />;
}

export function TicketConfirmation() {
  return <ScreenTemplate title="Confirmação" description="Ingresso confirmado" icon={CheckSquare} gradientFrom="from-blue-600" gradientTo="to-indigo-600" features={['QR Code', 'PDF', 'Email', 'WhatsApp']} />;
}

export function TicketQRCode() {
  return <ScreenTemplate title="QR Code do Ingresso" description="Código para entrada" icon={QrCode} gradientFrom="from-purple-600" gradientTo="to-pink-600" features={['Gerar', 'Validar', 'Segurança', 'Histórico']} />;
}

export function CheckinDashboard() {
  return <ScreenTemplate title="Dashboard de Check-in" description="Acompanhe entradas" icon={TrendingUp} gradientFrom="from-teal-600" gradientTo="to-cyan-600" features={['Total', 'Em tempo real', 'Gráficos', 'Status']} />;
}

export function CheckinScanner() {
  return <ScreenTemplate title="Scanner de QR Code" description="Valide ingressos" icon={QrCode} gradientFrom="from-blue-600" gradientTo="to-indigo-600" features={['Câmera', 'Validação', 'Som', 'Histórico']} />;
}

export function CheckinManual() {
  return <ScreenTemplate title="Check-in Manual" description="Entrada manual" icon={UserPlus} gradientFrom="from-orange-600" gradientTo="to-red-600" features={['Buscar', 'Confirmar', 'Lista', 'Observações']} />;
}

export function AttendanceReports() {
  return <ScreenTemplate title="Relatórios de Presença" description="Análise de participação" icon={TrendingUp} gradientFrom="from-green-600" gradientTo="to-emerald-600" features={['Total', 'Por tipo', 'Horários', 'Exportar']} />;
}

export function EventRegistration() {
  return <ScreenTemplate title="Inscrições de Evento" description="Cadastro de participantes" icon={UserPlus} gradientFrom="from-purple-600" gradientTo="to-pink-600" features={['Formulário', 'Dados', 'Confirmação', 'Email']} />;
}

// Ecclesiastical
export function BaptismForm() {
  return <ScreenTemplate title="Formulário de Batismo" description="Cadastro de candidato" icon={Droplet} gradientFrom="from-blue-500" gradientTo="to-cyan-500" features={['Dados', 'Testemunho', 'Documentos', 'Agendar']} />;
}

export function BaptismApproval() {
  return <ScreenTemplate title="Aprovação de Batismo" description="Processo de aprovação" icon={CheckSquare} gradientFrom="from-green-600" gradientTo="to-emerald-600" features={['Avaliar', 'Entrevista', 'Aprovar', 'Notificar']} />;
}

export function BaptismWorkflow() {
  return <ScreenTemplate title="Workflow de Batismo" description="Acompanhe o processo" icon={Target} gradientFrom="from-purple-600" gradientTo="to-indigo-600" features={['Etapas', 'Aulas', 'Status', 'Timeline']} />;
}

export function BaptismCertificate() {
  return <ScreenTemplate title="Certificado de Batismo" description="Emita certificados" icon={Award} gradientFrom="from-amber-600" gradientTo="to-orange-600" features={['Gerar PDF', 'Imprimir', 'Assinar', 'Histórico']} />;
}

export function ConsecrationWorkflow() {
  return <ScreenTemplate title="Workflow de Consagração" description="Processo de apresentação" icon={Heart} gradientFrom="from-pink-500" gradientTo="to-rose-500" features={['Solicitação', 'Aprovação', 'Cerimônia', 'Certificado']} />;
}

export function TransferForm() {
  return <ScreenTemplate title="Formulário de Transferência" description="Solicite transferência" icon={FileText} gradientFrom="from-indigo-600" gradientTo="to-purple-600" features={['Igreja origem', 'Igreja destino', 'Motivo', 'Documentos']} />;
}

export function Credentials() {
  return <ScreenTemplate title="Credenciais" description="Carteirinhas de membro" icon={Award} gradientFrom="from-blue-600" gradientTo="to-cyan-600" features={['Gerar', 'Foto', 'Imprimir', 'Validade']} />;
}

export function CredentialsNew() {
  return <ScreenTemplate title="Gerar Credencial" description="Nova carteirinha" icon={Award} gradientFrom="from-purple-600" gradientTo="to-pink-600" features={['Membro', 'Foto', 'Layout', 'Imprimir']} />;
}

export function WeddingRequests() {
  return <ScreenTemplate title="Casamentos" description="Cerimônias de casamento" icon={Heart} gradientFrom="from-rose-500" gradientTo="to-pink-500" features={['Noivos', 'Data', 'Pastor', 'Documentos']} />;
}

export function DedicationRequests() {
  return <ScreenTemplate title="Apresentações" description="Apresentação de crianças" icon={Baby} gradientFrom="from-yellow-400" gradientTo="to-orange-400" features={['Bebê', 'Pais', 'Data', 'Certificado']} />;
}
