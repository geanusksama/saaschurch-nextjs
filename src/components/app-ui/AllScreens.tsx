import { LucideIcon, Globe, Smartphone, Users, Calendar, Heart, DollarSign, Mail, FileText, Shield, Target, Settings, Zap, BarChart3, Book, Gift, Phone, Video, MessageSquare, Building2, Droplet, Baby, Award, CheckSquare, Ticket, Radio, Map, Bell, Archive, Database, Cloud, Lock, Key, UserPlus, LogOut } from 'lucide-react';
import { Link } from 'react-router';

interface ScreenTemplateProps {
  title: string;
  description: string;
  icon: LucideIcon;
  gradientFrom: string;
  gradientTo: string;
  features?: string[];
  backLink?: string;
}

function ScreenTemplate({ title, description, icon: Icon, gradientFrom, gradientTo, features, backLink }: ScreenTemplateProps) {
  // Convert gradient-from class to solid bg class: "from-pink-500" → "bg-pink-500"
  const solidBg = gradientFrom.replace(/^from-/, 'bg-');
  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-12 h-12 ${solidBg} rounded-xl flex items-center justify-center`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{title}</h1>
            <p className="text-slate-600 dark:text-slate-400">{description}</p>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="bg-purple-50 dark:bg-purple-950 rounded-xl p-8 border border-purple-100 dark:border-purple-900/50">
          <Icon className="w-16 h-16 text-purple-600 dark:text-purple-400 mb-4" />
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">{title}</h2>
          <p className="text-slate-700 dark:text-slate-300 mb-6">{description}</p>
          {features && (
            <ul className="space-y-2">
              {features.map((feature, i) => (
                <li key={i} className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <CheckSquare className="w-5 h-5 text-purple-500 dark:text-purple-400" />
                  {feature}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Funcionalidades</h3>
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <p className="text-sm text-slate-600 dark:text-slate-400">Esta tela está em desenvolvimento...</p>
            </div>
            <button className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors">
              Ação Principal
            </button>
            {backLink && (
              <Link to={backLink} className="block text-center text-sm text-slate-600 dark:text-slate-400 hover:text-purple-600">
                ← Voltar
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <BarChart3 className="w-8 h-8 text-blue-600 dark:text-blue-400 mb-3" />
          <h4 className="font-bold text-slate-900 dark:text-white mb-2">Analytics</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">Visualize dados e métricas importantes</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <Settings className="w-8 h-8 text-purple-600 dark:text-purple-400 mb-3" />
          <h4 className="font-bold text-slate-900 dark:text-white mb-2">Configurações</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">Personalize conforme necessário</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <FileText className="w-8 h-8 text-green-600 dark:text-green-400 mb-3" />
          <h4 className="font-bold text-slate-900 dark:text-white mb-2">Relatórios</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">Gere relatórios detalhados</p>
        </div>
      </div>
    </div>
  );
}

// Public Website
export function MinistryPublic() {
  return <ScreenTemplate title="Ministérios" description="Conheça nossos ministérios e equipes" icon={Heart} gradientFrom="from-pink-500" gradientTo="to-rose-500" features={['Louvor', 'Kids', 'Jovens', 'Mulheres', 'Homens']} />;
}

export function CIBETickets() {
  return <ScreenTemplate title="Ingressos CIBE" description="Adquira seu ingresso para a conferência" icon={Ticket} gradientFrom="from-orange-500" gradientTo="to-red-500" features={['Compra online', 'Pagamento seguro', 'QR Code', 'Confirmação por email']} />;
}

export function KidsPortal() {
  return <ScreenTemplate title="Portal Kids" description="Área especial para crianças" icon={Baby} gradientFrom="from-yellow-400" gradientTo="to-orange-400" features={['Histórias bíblicas', 'Jogos educativos', 'Vídeos', 'Atividades']} />;
}

export function OnlineRadio() {
  return <ScreenTemplate title="Rádio Online" description="Ouça nossa programação 24/7" icon={Radio} gradientFrom="from-purple-500" gradientTo="to-pink-500" features={['Transmissão ao vivo', 'Programação especial', 'Podcast', 'Louvores']} />;
}

export function Locations() {
  return <ScreenTemplate title="Localizações" description="Encontre uma igreja perto de você" icon={Map} gradientFrom="from-blue-500" gradientTo="to-cyan-500" features={['Mapa interativo', 'Endereços', 'Horários', 'Contatos']} />;
}

export function Blog() {
  return <ScreenTemplate title="Blog" description="Artigos e reflexões bíblicas" icon={Book} gradientFrom="from-slate-700" gradientTo="to-slate-900" features={['Artigos semanais', 'Estudos bíblicos', 'Testemunhos', 'Notícias']} />;
}

export function Timeline() {
  return <ScreenTemplate title="Linha do Tempo" description="Nossa jornada de 50 anos" icon={Calendar} gradientFrom="from-indigo-500" gradientTo="to-purple-500" features={['1974-2024', 'Marcos históricos', 'Conquistas', 'Expansão']} />;
}

// Auth
export function ChurchSelector() {
  return <ScreenTemplate title="Seletor de Igreja" description="Escolha sua igreja local" icon={Building2} gradientFrom="from-blue-600" gradientTo="to-indigo-600" features={['Buscar por região', 'Lista completa', 'Acesso rápido']} />;
}

export function Onboarding() {
  return <ScreenTemplate title="Bem-vindo" description="Configure sua conta" icon={UserPlus} gradientFrom="from-green-500" gradientTo="to-emerald-500" features={['Perfil', 'Preferências', 'Tutorial', 'Começar']} />;
}

// Dashboards
export function ChurchDashboard() {
  return <ScreenTemplate title="Dashboard da Igreja" description="Visão completa da igreja local" icon={Building2} gradientFrom="from-blue-600" gradientTo="to-indigo-600" features={['Membros', 'Finanças', 'Eventos', 'Ministérios']} />;
}

export function MinistryDashboard() {
  return <ScreenTemplate title="Dashboard de Ministério" description="Gestão do seu ministério" icon={Heart} gradientFrom="from-pink-500" gradientTo="to-rose-500" features={['Equipe', 'Escalas', 'Materiais', 'Relatórios']} />;
}

export function FinancialDashboard() {
  return <ScreenTemplate title="Dashboard Financeiro" description="Visão financeira consolidada" icon={DollarSign} gradientFrom="from-green-500" gradientTo="to-emerald-500" features={['Receitas', 'Despesas', 'Fluxo de caixa', 'Projeções']} />;
}

// Members
export function MemberPhoto() {
  return <ScreenTemplate title="Upload de Foto" description="Adicione foto ao perfil" icon={Users} gradientFrom="from-blue-500" gradientTo="to-cyan-500" features={['Webcam', 'Upload', 'Editar', 'Crop']} />;
}

export function FamilyTree() {
  return <ScreenTemplate title="Árvore Familiar" description="Visualize relacionamentos familiares" icon={Users} gradientFrom="from-purple-500" gradientTo="to-pink-500" features={['Diagrama visual', 'Adicionar membros', 'Relacionamentos']} />;
}

export function MembershipHistory() {
  return <ScreenTemplate title="Histórico de Membros" description="Timeline completa do membro" icon={Clock} gradientFrom="from-slate-600" gradientTo="to-slate-800" features={['Batismo', 'Ministérios', 'Células', 'Eventos']} />;
}

export function MemberExport() {
  return <ScreenTemplate title="Exportar Membros" description="Exporte dados em vários formatos" icon={Database} gradientFrom="from-green-600" gradientTo="to-emerald-600" features={['Excel', 'PDF', 'CSV', 'Filtros']} />;
}

export function MemberMerge() {
  return <ScreenTemplate title="Mesclar Membros" description="Combine registros duplicados" icon={Users} gradientFrom="from-blue-500" gradientTo="to-indigo-500" features={['Detectar duplicatas', 'Comparar', 'Mesclar', 'Histórico']} />;
}

export function MemberArchive() {
  return <ScreenTemplate title="Arquivar Membro" description="Mova membros para arquivo" icon={Archive} gradientFrom="from-slate-500" gradientTo="to-slate-700" features={['Motivo', 'Data', 'Observações', 'Restaurar']} />;
}

export function VisitorCheckin() {
  return <ScreenTemplate title="Check-in Visitantes" description="Cadastro rápido de visitantes" icon={UserPlus} gradientFrom="from-blue-500" gradientTo="to-cyan-500" features={['Dados básicos', 'Foto', 'Etiqueta', 'Follow-up']} />;
}

export function KidsCheckin() {
  return <ScreenTemplate title="Check-in Kids" description="Check-in de crianças" icon={Baby} gradientFrom="from-yellow-400" gradientTo="to-orange-400" features={['Pais responsáveis', 'Alergias', 'Etiqueta', 'Segurança']} />;
}

export function KidsPickup() {
  return <ScreenTemplate title="Retirada Kids" description="Sistema de retirada segura" icon={Shield} gradientFrom="from-red-500" gradientTo="to-rose-500" features={['Código de segurança', 'Confirmação', 'Responsáveis', 'Histórico']} />;
}

export function ServiceSelector() {
  return <ScreenTemplate title="Seletor de Culto" description="Escolha o culto para check-in" icon={Calendar} gradientFrom="from-purple-500" gradientTo="to-indigo-500" features={['Cultos programados', 'Horários', 'Locais', 'Capacidade']} />;
}

export function CheckinKiosk() {
  return <ScreenTemplate title="Modo Quiosque" description="Terminal de autoatendimento" icon={Smartphone} gradientFrom="from-teal-500" gradientTo="to-cyan-500" features={['Tela touch', 'Self-service', 'Etiquetas', 'Relatório']} />;
}

export function AttendanceLive() {
  return <ScreenTemplate title="Presença ao Vivo" description="Acompanhe presença em tempo real" icon={BarChart3} gradientFrom="from-green-500" gradientTo="to-emerald-500" features={['Dashboard live', 'Contagem', 'Gráficos', 'Exportar']} />;
}

// All screen exports
export { ScreenTemplate };