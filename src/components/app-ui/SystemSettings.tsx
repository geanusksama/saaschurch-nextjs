import { 
  Settings, 
  Users, 
  Shield, 
  Bell, 
  Mail, 
  Webhook, 
  Key, 
  Database,
  List,
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
  Bot,
  Calculator
} from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { usePermissions } from '../../lib/usePermissions';
import { podeAcessarContabilidadeAgendamento } from '../../lib/contabilidadeAgendamentoRole';
import { apiBase } from '../../lib/apiBase';
import {
  isMasterUser,
  lockCampoVisibility,
  unlockCampoVisibility,
  useCampoVisible,
} from '../../lib/campoVisibility';

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
    category: 'Contabilidade',
    icon: Calculator,
    color: 'bg-amber-500',
    items: [
      { id: 'contabilidade-agendamentos', name: 'Envio Automático', description: 'Agendar relatório contábil por WhatsApp', path: '/app-ui/system/contabilidade-agendamentos', permKey: 'contabilidade_agendamentos' },
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
    // Listas que alimentam os dropdowns do sistema — CRUD genérico.
    // Para adicionar uma lista nova basta registrá-la em src/lib/lookupRegistry.ts.
    category: 'Listas e Cadastros Auxiliares',
    icon: List,
    color: 'bg-teal-500',
    items: [
      { id: 'chart-of-accounts',      name: 'Plano de Contas',       description: 'Categorias de receita e despesa',   path: '/app-ui/config/chart-of-accounts',      permKey: 'settings_chart_of_accounts' },
      { id: 'payment-methods',        name: 'Formas de Pagamento',   description: 'PIX, dinheiro, cartão...',          path: '/app-ui/config/payment-methods',        permKey: 'settings_payment_methods' },
      { id: 'document-types',         name: 'Tipos de Documento',    description: 'Recibo, nota fiscal, fatura...',    path: '/app-ui/config/document-types',         permKey: 'settings_document_types' },
      { id: 'cost-centers',           name: 'Centros de Custo',      description: 'Classificação de lançamentos',      path: '/app-ui/config/cost-centers',           permKey: 'settings_cost_centers' },
      { id: 'bancos',                 name: 'Bancos',                description: 'Contas bancárias e caixas',         path: '/app-ui/config/bancos',                 permKey: 'settings_bancos' },
      { id: 'departamentos',          name: 'Departamentos',         description: 'Missões, campanhas, obra, setores', path: '/app-ui/config/departamentos',          permKey: 'settings_departamentos' },
      { id: 'tipos-credor',           name: 'Tipos de Credor',       description: 'Pastor, fornecedor, prestador...',  path: '/app-ui/config/tipos-credor',           permKey: 'settings_tipos_credor' },
      { id: 'naturezas-despesa',      name: 'Naturezas de Despesa',  description: 'Fixa, variável, eventual',          path: '/app-ui/config/naturezas-despesa',      permKey: 'settings_naturezas_despesa' },
      { id: 'tipos-departamento',     name: 'Tipos de Departamento', description: 'Ministério, campanha, obra...',     path: '/app-ui/config/tipos-departamento',     permKey: 'settings_tipos_departamento' },
      { id: 'tipos-conta-bancaria',   name: 'Tipos de Conta',        description: 'Corrente, poupança, espécie...',    path: '/app-ui/config/tipos-conta-bancaria',   permKey: 'settings_tipos_conta_bancaria' },
      { id: 'church-functions',       name: 'Funções da Igreja',     description: 'Dirigente, líder, secretário...',   path: '/app-ui/config/church-functions',       permKey: 'settings_church_functions' },
      { id: 'ecclesiastical-titles',  name: 'Títulos Eclesiásticos', description: 'Membro, diácono, presbítero...',    path: '/app-ui/config/ecclesiastical-titles',  permKey: 'settings_ecclesiastical_titles' },
      { id: 'zonas',                  name: 'Zonas',                 description: 'Zona Leste, Zona Sul, Centro...',   path: '/app-ui/config/zonas',                  permKey: 'settings_zonas' },
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
  const roleName: string = storedUser.roleName || storedUser.role?.name || '';

  // ── Destravar visão de campo ────────────────────────────────────────────
  // Campo não aparece em lugar nenhum da interface. Quem precisa dele (só o
  // master) destrava aqui: 7 cliques na área à direita do cabeçalho abrem o
  // pedido da senha do campo. Sem essa senha nada muda — e o destravamento vale
  // só para esta sessão do navegador.
  const campoVisible = useCampoVisible();
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [campoPromptOpen, setCampoPromptOpen] = useState(false);
  const [campoPassword, setCampoPassword] = useState('');
  const [campoError, setCampoError] = useState('');
  const [campoChecking, setCampoChecking] = useState(false);

  const handleHotspotClick = () => {
    if (!isMasterUser() || campoVisible) return;
    clickCountRef.current += 1;
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    // Os 7 cliques precisam ser seguidos: 2s parado zera a contagem.
    clickTimerRef.current = setTimeout(() => { clickCountRef.current = 0; }, 2000);
    if (clickCountRef.current >= 7) {
      clickCountRef.current = 0;
      setCampoPassword('');
      setCampoError('');
      setCampoPromptOpen(true);
    }
  };

  const submitCampoPassword = async () => {
    const campoId: string = storedUser.campoId || localStorage.getItem('mrm_active_field_id') || '';
    if (!campoId) {
      setCampoError('Nenhum campo ativo para validar.');
      return;
    }
    setCampoChecking(true);
    setCampoError('');
    try {
      const token = localStorage.getItem('mrm_token');
      const res = await fetch(`${apiBase}/context-switcher/verify-field`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ fieldId: campoId, password: campoPassword }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || 'Senha do campo inválida.');
      }
      unlockCampoVisibility();
      setCampoPromptOpen(false);
      setCampoPassword('');
    } catch (err) {
      setCampoError(err instanceof Error ? err.message : 'Falha ao validar a senha do campo.');
    } finally {
      setCampoChecking(false);
    }
  };

  const visibleSections = settingsSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (!canView(item.permKey)) return false;
        // Contabilidade — Agendamento é exclusivo da função Tesouraria (nunca Secretaria).
        if (item.id === 'contabilidade-agendamentos') {
          return podeAcessarContabilidadeAgendamento(profileType, roleName);
        }
        return true;
      }),
    }))
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

          {/* Área à direita do cabeçalho: 7 cliques (só master) destravam a
              visão de campo. Sem marca visual — não é um botão anunciado. */}
          <div
            onClick={handleHotspotClick}
            aria-hidden="true"
            className="ml-auto h-12 w-40 self-stretch cursor-default select-none"
          />

          {campoVisible && (
            <button
              type="button"
              onClick={lockCampoVisibility}
              className="shrink-0 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 dark:border-purple-700 dark:bg-purple-900/30 dark:text-purple-200"
              title="Voltar a ocultar os controles de campo"
            >
              Visão de campo ativa · ocultar
            </button>
          )}
        </div>
      </div>

      {/* Modal: senha do campo */}
      {campoPromptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Senha do campo</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Informe a senha do campo para liberar os controles de campo nesta sessão.
            </p>

            {campoError && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {campoError}
              </div>
            )}

            <input
              type="password"
              autoFocus
              value={campoPassword}
              onChange={(e) => setCampoPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && campoPassword) void submitCampoPassword(); }}
              placeholder="Senha do campo"
              className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-slate-700 dark:bg-slate-800"
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setCampoPromptOpen(false); setCampoPassword(''); setCampoError(''); }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void submitCampoPassword()}
                disabled={campoChecking || !campoPassword}
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60"
              >
                {campoChecking ? 'Validando...' : 'Liberar'}
              </button>
            </div>
          </div>
        </div>
      )}

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