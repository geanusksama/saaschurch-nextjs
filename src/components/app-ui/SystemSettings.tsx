import { 
  Settings, 
  Users, 
  Shield, 
  Bell, 
  Mail, 
  Webhook, 
  Key, 
  Database, 
  Palette, 
  Globe,
  Building,
  CreditCard,
  FileText,
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
  DollarSign,
  FileType,
  Award,
  Columns,
  Phone,
  Plug,
  Radio,
  QrCode,
  Upload,
  Download,
  BookOpen,
  Code
} from 'lucide-react';
import { Link } from 'react-router';

const settingsSections = [
  {
    category: 'Geral',
    icon: Settings,
    color: 'bg-purple-500',
    items: [
      { id: 'church-info', name: 'Informações da Igreja', description: 'Nome, endereço e contatos', path: '/app-ui/system/church-info' },
      { id: 'branding', name: 'Marca e Aparência', description: 'Logo, cores e temas', path: '/app-ui/system/branding' },
      { id: 'localization', name: 'Localização e Idioma', description: 'Fuso horário e moeda', path: '/app-ui/system/localization' },
    ]
  },
  {
    category: 'Usuários e Permissões',
    icon: Users,
    color: 'bg-blue-500',
    items: [
      { id: 'users', name: 'Usuários', description: 'Gerenciar contas de usuário', path: '/app-ui/system/users', badge: '45' },
      { id: 'roles', name: 'Funções', description: 'Criar e editar funções', path: '/app-ui/system/roles', badge: '8' },
      { id: 'permissions', name: 'Permissões', description: 'Matriz de permissões', path: '/app-ui/system/permissions' },
    ]
  },
  {
    category: 'Segurança',
    icon: Shield,
    color: 'bg-green-500',
    items: [
      { id: 'security', name: 'Configurações de Segurança', description: '2FA e políticas de senha', path: '/app-ui/system/security' },
      { id: 'audit-log', name: 'Log de Auditoria', description: 'Histórico de ações', path: '/app-ui/system/audit-log' },
      { id: 'api-keys', name: 'Chaves de API', description: 'Gerenciar tokens de API', path: '/app-ui/system/api-keys' },
    ]
  },
  {
    category: 'Notificações',
    icon: Bell,
    color: 'bg-orange-500',
    items: [
      { id: 'notifications', name: 'Preferências de Notificação', description: 'Configurar alertas', path: '/app-ui/system/notifications' },
      { id: 'templates', name: 'Templates de Notificação', description: 'Emails e SMS', path: '/app-ui/system/templates' },
    ]
  },
  {
    category: 'Comunicação',
    icon: Mail,
    color: 'bg-cyan-500',
    items: [
      { id: 'email', name: 'Configurações de Email', description: 'SMTP e remetentes', path: '/app-ui/system/email' },
      { id: 'whatsapp', name: 'WhatsApp Business', description: 'API e integração', path: '/app-ui/system/whatsapp' },
      { id: 'sms', name: 'SMS', description: 'Provedor e créditos', path: '/app-ui/system/sms' },
    ]
  },
  {
    category: 'Integrações',
    icon: Webhook,
    color: 'bg-pink-500',
    items: [
      { id: 'integrations', name: 'Integrações', description: 'Conectar apps externos', path: '/app-ui/system/integrations' },
      { id: 'webhooks', name: 'Webhooks', description: 'Eventos e callbacks', path: '/app-ui/system/webhooks' },
      { id: 'api', name: 'API', description: 'Documentação e acesso', path: '/app-ui/system/api' },
    ]
  },
  {
    category: 'Dados',
    icon: Database,
    color: 'bg-violet-500',
    items: [
      { id: 'import', name: 'Importação', description: 'Importar dados em massa', path: '/app-ui/system/import' },
      { id: 'export', name: 'Exportação', description: 'Exportar dados', path: '/app-ui/system/export' },
      { id: 'backup', name: 'Backup', description: 'Backup e restauração', path: '/app-ui/system/backup' },
    ]
  },
  {
    category: 'Documentação Técnica',
    icon: BookOpen,
    color: 'bg-indigo-500',
    items: [
      { id: 'architecture', name: 'Arquitetura do Sistema', description: 'Visão geral e módulos', path: '/documentation', external: true },
      { id: 'design-system', name: 'MRM Design System', description: 'Componentes e tokens de design', path: '/design-system', external: true },
      { id: 'screen-catalog', name: 'Catálogo de Telas', description: '200+ telas documentadas', path: '/documentation/screen-catalog-complete', external: true },
    ]
  },
];

export function SystemSettings() {
  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
            <Settings className="w-6 h-6 text-slate-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Configurações do Sistema</h1>
            <p className="text-slate-600 dark:text-slate-400">Gerencie todas as configurações da plataforma</p>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {settingsSections.map((section) => {
          const Icon = section.icon;
          return (
            <div key={section.category}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 ${section.color} rounded-lg flex items-center justify-center`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">{section.category}</h2>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {section.items.map((item) => (
                  <Link
                    key={item.id}
                    to={item.path}
                    className="bg-white border border-slate-200 rounded-xl p-6 hover:border-purple-300 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-slate-900">{item.name}</h3>
                      {item.badge && (
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{item.description}</p>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="mt-12 bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-8 border border-purple-100">
        <h3 className="text-lg font-bold text-slate-900 mb-6">Ações Rápidas</h3>
        <div className="grid md:grid-cols-4 gap-4">
          <Link 
            to="/documentation"
            className="bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-lg p-4 hover:shadow-lg transition-all text-left"
          >
            <BookOpen className="w-6 h-6 mb-2" />
            <p className="font-semibold text-sm">Arquitetura</p>
          </Link>
          <Link 
            to="/design-system"
            className="bg-gradient-to-br from-purple-600 to-blue-600 text-white rounded-lg p-4 hover:shadow-lg transition-all text-left"
          >
            <Palette className="w-6 h-6 mb-2" />
            <p className="font-semibold text-sm">Design System</p>
          </Link>
          <button className="bg-white border border-slate-200 rounded-lg p-4 hover:border-purple-300 hover:shadow-md transition-all text-left">
            <Users className="w-6 h-6 text-purple-600 mb-2" />
            <p className="font-semibold text-slate-900 text-sm">Adicionar Usuário</p>
          </button>
          <button className="bg-white border border-slate-200 rounded-lg p-4 hover:border-purple-300 hover:shadow-md transition-all text-left">
            <Key className="w-6 h-6 text-blue-600 mb-2" />
            <p className="font-semibold text-slate-900 text-sm">Gerar API Key</p>
          </button>
        </div>
      </div>
    </div>
  );
}