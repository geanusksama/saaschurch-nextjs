import { Link } from 'react-router';
import { 
  Building,
  Shield,
  CreditCard,
  Paperclip,
  Briefcase,
  Gift,
  Calendar,
  MapPin,
  Image,
  Map,
  Contact,
  Smartphone,
  Banknote,
  Layers,
  Clock,
  UserCheck,
  Church,
  FileType,
  Award,
  Columns,
  Phone,
  Plug,
  Radio,
  QrCode,
  Upload,
  Download,
  Globe,
  DollarSign,
  Users,
  BookOpen,
  Landmark
} from 'lucide-react';

const configurationModules = [
  // Estrutura Organizacional
  {
    section: 'Estrutura Organizacional',
    modules: [
      { icon: Building, name: 'Matriz', description: 'Configuração da igreja matriz', path: '/app-ui/config/matriz', color: 'purple' },
      { icon: Church, name: 'Campos', description: 'Gerenciar campos ministeriais', path: '/app-ui/config/campos', color: 'blue' },
      { icon: Layers, name: 'Regionais', description: 'Configurar regionais', path: '/app-ui/config/regionais', color: 'indigo' },
      { icon: Building, name: 'Igrejas', description: 'Cadastro de igrejas', path: '/app-ui/config/churches', color: 'purple' },
    ]
  },
  
  // Recursos Humanos
  {
    section: 'Recursos Humanos',
    modules: [
      { icon: Shield, name: 'Funções', description: 'Funções e cargos', path: '/app-ui/config/roles', color: 'green' },
      { icon: Award, name: 'Títulos Eclesiásticos', description: 'Pastor, Presbítero, Diácono', path: '/app-ui/config/titles', color: 'orange' },
      { icon: UserCheck, name: 'Líderes', description: 'Cadastro de liderança', path: '/app-ui/config/leaders', color: 'cyan' },
      { icon: Briefcase, name: 'Departamento', description: 'Departamentos da igreja', path: '/app-ui/config/departments', color: 'violet' },
      { icon: Users, name: 'Ministérios', description: 'Grupos ministeriais', path: '/app-ui/config/ministries', color: 'blue' },
      { icon: Users, name: 'Grupos', description: 'Grupos e células', path: '/app-ui/config/groups', color: 'indigo' },
    ]
  },
  
  // Credenciais e Documentos
  {
    section: 'Credenciais e Documentos',
    modules: [
      { icon: CreditCard, name: 'Modelos de Credencial', description: 'Templates de carteirinha', path: '/app-ui/config/credential-templates', color: 'pink' },
      { icon: FileType, name: 'Tipos de Documento', description: 'RG, CPF, CNH, etc', path: '/app-ui/config/document-types', color: 'slate' },
      { icon: Paperclip, name: 'Tipo de Anexo', description: 'Categorias de arquivos', path: '/app-ui/config/attachment-types', color: 'amber' },
      { icon: BookOpen, name: 'Tipos de Requerimento', description: 'Solicitações administrativas', path: '/app-ui/config/requirement-types', color: 'emerald' },
    ]
  },
  
  // Sacramentos e Ritos
  {
    section: 'Sacramentos e Ritos',
    modules: [
      { icon: Gift, name: 'Tipo de Consagração', description: 'Batismo, Confirmação, etc', path: '/app-ui/config/consecration-types', color: 'rose' },
      { icon: Clock, name: 'Serviços', description: 'Tipos de cultos e serviços', path: '/app-ui/config/services', color: 'teal' },
      { icon: Clock, name: 'Horários', description: 'Horários de cultos', path: '/app-ui/config/schedules', color: 'sky' },
    ]
  },
  
  // Localização
  {
    section: 'Localização',
    modules: [
      { icon: Globe, name: 'Países', description: 'Cadastro de países', path: '/app-ui/config/countries', color: 'blue' },
      { icon: Map, name: 'Estados', description: 'Estados e UF', path: '/app-ui/config/states', color: 'indigo' },
      { icon: MapPin, name: 'Cidades', description: 'Municípios', path: '/app-ui/config/cities', color: 'violet' },
    ]
  },
  
  // Financeiro
  {
    section: 'Financeiro',
    modules: [
      { icon: Landmark, name: 'Plano de Contas', description: 'Categorias contábeis', path: '/app-ui/config/chart-of-accounts', color: 'green' },
      { icon: DollarSign, name: 'Formas de Pagamento', description: 'Dinheiro, Cartão, PIX', path: '/app-ui/config/payment-methods', color: 'emerald' },
      { icon: Banknote, name: 'PIX', description: 'Chaves PIX da igreja', path: '/app-ui/config/pix', color: 'teal' },
    ]
  },
  
  // Eventos e Agenda
  {
    section: 'Eventos e Agenda',
    modules: [
      { icon: Calendar, name: 'Agenda Anual', description: 'Calendário de eventos', path: '/app-ui/config/annual-calendar', color: 'purple' },
      { icon: Image, name: 'Carrossel', description: 'Banners do site', path: '/app-ui/config/carousel', color: 'pink' },
    ]
  },
  
  // CRM e Pipeline
  {
    section: 'CRM e Pipeline',
    modules: [
      { icon: Columns, name: 'Pipelines / Kanban', description: 'Estágios do funil de vendas', path: '/app-ui/config/pipelines', color: 'blue' },
      { icon: Contact, name: 'Contatos', description: 'Configuração de contatos', path: '/app-ui/config/contacts-config', color: 'cyan' },
    ]
  },
  
  // Tecnologia
  {
    section: 'Apps e Integrações',
    modules: [
      { icon: Phone, name: 'Telefone Digital', description: 'Integração VoIP', path: '/app-ui/config/digital-phone', color: 'green' },
      { icon: Globe, name: 'Domínios', description: 'Gerenciar domínios', path: '/app-ui/config/domains', color: 'blue' },
      { icon: Plug, name: 'Integrações', description: 'Apps de terceiros', path: '/app-ui/config/integrations', color: 'purple' },
      { icon: Radio, name: 'Webhooks', description: 'Eventos automáticos', path: '/app-ui/config/webhooks', color: 'indigo' },
      { icon: Radio, name: 'API WhatsApp', description: 'WhatsApp Business API', path: '/app-ui/config/whatsapp-api', color: 'green' },
      { icon: QrCode, name: 'Face ID (Control ID)', description: 'Controle de acesso biométrico', path: '/app-ui/config/face-id', color: 'orange' },
      { icon: Smartphone, name: 'Dispositivos', description: 'Tablets e terminais', path: '/app-ui/config/devices', color: 'slate' },
    ]
  },
  
  // Dados
  {
    section: 'Gestão de Dados',
    modules: [
      { icon: Upload, name: 'Importação de Dados', description: 'Importar CSV e Excel', path: '/app-ui/config/data-import', color: 'blue' },
      { icon: Download, name: 'Exportação de Dados', description: 'Exportar relatórios', path: '/app-ui/config/data-export', color: 'purple' },
    ]
  },
];

const colorClasses: Record<string, string> = {
  purple: 'bg-purple-500',
  blue: 'bg-blue-500',
  indigo: 'bg-indigo-500',
  green: 'bg-green-500',
  emerald: 'bg-emerald-500',
  teal: 'bg-teal-500',
  cyan: 'bg-cyan-500',
  sky: 'bg-sky-500',
  violet: 'bg-violet-500',
  pink: 'bg-pink-500',
  rose: 'bg-rose-500',
  orange: 'bg-orange-500',
  amber: 'bg-amber-500',
  slate: 'bg-slate-500',
};

export function ConfigurationCenter() {
  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Centro de Configuração</h1>
        <p className="text-slate-600 dark:text-slate-400">Configure todos os módulos e parâmetros do sistema MRM</p>
      </div>

      {/* Configuration Modules */}
      <div className="space-y-12">
        {configurationModules.map((section) => (
          <div key={section.section}>
            <h2 className="text-xl font-bold text-slate-900 mb-4">{section.section}</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {section.modules.map((module) => {
                const Icon = module.icon;
                return (
                  <Link
                    key={module.path}
                    to={module.path}
                    className="group bg-white border border-slate-200 rounded-xl p-6 hover:border-purple-300 hover:shadow-lg transition-all"
                  >
                    <div className={`w-12 h-12 ${colorClasses[module.color]} rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="font-semibold text-slate-900 mb-1 group-hover:text-purple-600 transition-colors">
                      {module.name}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{module.description}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="mt-12 grid md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
          <p className="text-sm text-purple-600 font-medium mb-1">Total de Módulos</p>
          <p className="text-2xl font-bold text-purple-900">
            {configurationModules.reduce((acc, section) => acc + section.modules.length, 0)}
          </p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
          <p className="text-sm text-blue-600 font-medium mb-1">Categorias</p>
          <p className="text-2xl font-bold text-blue-900">{configurationModules.length}</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border border-green-200">
          <p className="text-sm text-green-600 font-medium mb-1">Configurados</p>
          <p className="text-2xl font-bold text-green-900">42</p>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-6 border border-orange-200">
          <p className="text-sm text-orange-600 font-medium mb-1">Pendentes</p>
          <p className="text-2xl font-bold text-orange-900">8</p>
        </div>
      </div>
    </div>
  );
}
