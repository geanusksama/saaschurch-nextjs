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
  Code,
  Sparkles,
  Bot
} from 'lucide-react';
import { Link } from 'react-router';
import { usePermissions } from '../../lib/usePermissions';

type SettingsItem = {
  id: string;
  name: string;
  description: string;
  path: string;
  badge?: string;
  external?: boolean;
  permKey: string;
};

type SettingsSection = {
  category: string;
  icon: any;
  color: string;
  items: SettingsItem[];
};

const settingsSections: SettingsSection[] = [
  {
    category: 'Geral',
    icon: Settings,
    color: 'bg-purple-500',
    items: [
      { id: 'church-info',   name: 'Informações da Igreja', description: 'Nome, endereço e contatos',       path: '/app-ui/system/church-info',  permKey: 'settings_church_info' },
      { id: 'branding',      name: 'Marca e Aparência',      description: 'Logo, cores e temas',             path: '/app-ui/system/branding',     permKey: 'settings_branding' },
      { id: 'localization',  name: 'Localização e Idioma',   description: 'Fuso horário e moeda',            path: '/app-ui/system/localization', permKey: 'settings_localization' },
    ]
  },
  {
    category: 'Usuários e Permissões',
    icon: Users,
    color: 'bg-blue-500',
    items: [
      { id: 'users',       name: 'Usuários',    description: 'Gerenciar contas de usuário', path: '/app-ui/system/users',       badge: '45', permKey: 'system_users' },
      { id: 'roles',       name: 'Funções',     description: 'Criar e editar funções',      path: '/app-ui/system/roles',       badge: '8',  permKey: 'system_roles' },
      { id: 'permissions', name: 'Permissões',  description: 'Matriz de permissões',        path: '/app-ui/system/permissions',              permKey: 'system_permissions' },
    ]
  },
  {
    category: 'Segurança',
    icon: Shield,
    color: 'bg-green-500',
    items: [
      { id: 'security',  name: 'Configurações de Segurança', description: '2FA e políticas de senha',  path: '/app-ui/system/security',   permKey: 'settings_security' },
      { id: 'audit-log', name: 'Log de Auditoria',           description: 'Histórico de ações',        path: '/app-ui/system/audit-log',  permKey: 'audit_log' },
      { id: 'api-keys',  name: 'Chaves de API',              description: 'Gerenciar tokens de API',   path: '/app-ui/system/api-keys',   permKey: 'settings_api_keys' },
    ]
  },
  {
    category: 'Notificações',
    icon: Bell,
    color: 'bg-orange-500',
    items: [
      { id: 'notifications', name: 'Preferências de Notificação', description: 'Configurar alertas', path: '/app-ui/system/notifications', permKey: 'settings_notifications' },
      { id: 'templates',     name: 'Templates de Notificação',    description: 'Emails e SMS',       path: '/app-ui/system/templates',     permKey: 'settings_templates' },
    ]
  },
  {
    category: 'Comunicação',
    icon: Mail,
    color: 'bg-cyan-500',
    items: [
      { id: 'email',     name: 'Configurações de Email', description: 'SMTP e remetentes',  path: '/app-ui/system/email',     permKey: 'settings_email_config' },
      { id: 'whatsapp',  name: 'WhatsApp Business',      description: 'API e integração',   path: '/app-ui/system/whatsapp',  permKey: 'settings_whatsapp_config' },
      { id: 'sms',       name: 'SMS',                    description: 'Provedor e créditos', path: '/app-ui/system/sms',      permKey: 'settings_sms_config' },
    ]
  },
  {
    category: 'Inteligência Artificial (IA)',
    icon: Sparkles,
    color: 'bg-emerald-500',
    items: [
      { id: 'ai-settings', name: 'Configurações de IA', description: 'Chaves de API OpenAI/Claude e modelo', path: '/app-ui/config/ai-settings', permKey: 'settings_branding' },
      { id: 'ai-agents',   name: 'Agentes de IA',       description: 'Criar assistentes inteligentes especialistas', path: '/app-ui/config/ai-agents',   permKey: 'settings_branding' },
    ]
  },
  {
    category: 'Integrações',
    icon: Webhook,
    color: 'bg-pink-500',
    items: [
      { id: 'integrations', name: 'Integrações', description: 'Conectar apps externos',   path: '/app-ui/system/integrations', permKey: 'integrations' },
      { id: 'webhooks',     name: 'Webhooks',    description: 'Eventos e callbacks',       path: '/app-ui/system/webhooks',     permKey: 'settings_webhooks' },
      { id: 'api',          name: 'API',         description: 'Documentação e acesso',     path: '/app-ui/system/api',          permKey: 'settings_api' },
    ]
  },
  {
    category: 'Dados',
    icon: Database,
    color: 'bg-violet-500',
    items: [
      { id: 'import',  name: 'Importação', description: 'Importar dados em massa', path: '/app-ui/system/import',  permKey: 'settings_import' },
      { id: 'export',  name: 'Exportação', description: 'Exportar dados',          path: '/app-ui/system/export',  permKey: 'settings_export' },
      { id: 'backup',  name: 'Backup',     description: 'Backup e restauração',    path: '/app-ui/system/backup',  permKey: 'settings_backup' },
    ]
  },
  {
    category: 'Documentação Técnica',
    icon: BookOpen,
    color: 'bg-indigo-500',
    items: [
      { id: 'architecture',  name: 'Arquitetura do Sistema', description: 'Visão geral e módulos',          path: '/documentation',                        external: true, permKey: 'settings_docs' },
      { id: 'design-system', name: 'MRM Design System',      description: 'Componentes e tokens de design', path: '/design-system',                        external: true, permKey: 'settings_docs' },
      { id: 'screen-catalog',name: 'Catálogo de Telas',      description: '200+ telas documentadas',        path: '/documentation/screen-catalog-complete', external: true, permKey: 'settings_docs' },
    ]
  },
];

function readStoredUser() {
  try { return JSON.parse(localStorage.getItem('mrm_user') || '{}'); } catch { return {}; }
}

export function SystemSettings() {
  const storedUser = readStoredUser();
  const profileType: string = storedUser.profileType || '';
  const isMaster = profileType === 'master';
  const { canView } = usePermissions(profileType);

  const visibleSections = settingsSections
    .map((section) => ({ ...section, items: section.items.filter((item) => canView(item.permKey)) }))
    .filter((section) => section.items.length > 0);
  return (
    <div className="p-6 text-slate-900 dark:text-slate-100">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center">
            <Settings className="w-6 h-6 text-slate-600 dark:text-slate-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Configurações do Sistema</h1>
            <p className="text-slate-600 dark:text-slate-400">Gerencie todas as configurações da plataforma</p>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {visibleSections.map((section) => {
          const Icon = section.icon;
          return (
            <div key={section.category}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 ${section.color} rounded-lg flex items-center justify-center`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{section.category}</h2>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {section.items.map((item) => (
                  <Link
                    key={item.id}
                    to={item.path}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">{item.name}</h3>
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

      {/* Quick Actions — visible to master only */}
      {isMaster && <div className="mt-12 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 rounded-xl p-8 border border-purple-100 dark:border-slate-700">
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-6">Ações Rápidas</h3>
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
          <button className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-md transition-all text-left">
            <Users className="w-6 h-6 text-purple-600 mb-2" />
            <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Adicionar Usuário</p>
          </button>
          <button className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-4 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-md transition-all text-left">
            <Key className="w-6 h-6 text-blue-600 mb-2" />
            <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Gerar API Key</p>
          </button>
        </div>
      </div>}
    </div>
  );
}