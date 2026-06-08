export type Action = 'view' | 'create' | 'edit' | 'delete';
export type ProfileKey = 'master' | 'admin' | 'campo' | 'church';

export interface ModulePermission {
  view: Record<ProfileKey, boolean>;
  create: Record<ProfileKey, boolean>;
  edit: Record<ProfileKey, boolean>;
  delete: Record<ProfileKey, boolean>;
}

export interface PermissionModule {
  group: string;
  name: string;
  key: string;
  permissions: ModulePermission;
}

const full = (): Record<ProfileKey, boolean> => ({ master: true, admin: true, campo: true, church: true });
const admin = (): Record<ProfileKey, boolean> => ({ master: true, admin: true, campo: false, church: false });
const mngr = (): Record<ProfileKey, boolean> => ({ master: true, admin: true, campo: true, church: false });
const none = (): Record<ProfileKey, boolean> => ({ master: false, admin: false, campo: false, church: false });

function mkPerms(
  view: Record<ProfileKey, boolean>,
  create: Record<ProfileKey, boolean>,
  edit: Record<ProfileKey, boolean>,
  remove: Record<ProfileKey, boolean>,
): ModulePermission {
  return { view, create, edit, delete: remove };
}

export const DEFAULT_PERMISSION_MODULES: PermissionModule[] = [
  // ── Principal ────────────────────────────────────────────────────────────
  { group: 'Principal', name: 'Dashboard',         key: 'dashboard',    permissions: mkPerms(full(), none(), none(), none()) },
  { group: 'Principal', name: 'Notificações',      key: 'notifications', permissions: mkPerms(full(), none(), none(), none()) },
  { group: 'Principal', name: 'Caixa de Entrada',  key: 'inbox',        permissions: mkPerms(full(), none(), none(), none()) },

  // ── Secretaria ───────────────────────────────────────────────────────────
  { group: 'Secretaria', name: 'Lista de Membros',       key: 'members',           permissions: mkPerms(full(), mngr(), mngr(), admin()) },
  { group: 'Secretaria', name: 'Perfil do Membro',       key: 'member_profile',    permissions: mkPerms(full(), mngr(), mngr(), admin()) },
  { group: 'Secretaria', name: 'Importação de Membros',  key: 'member_import',     permissions: mkPerms(admin(), admin(), admin(), admin()) },
  { group: 'Secretaria', name: 'Serviços e Ocorrências', key: 'services',          permissions: mkPerms(full(), mngr(), mngr(), admin()) },
  { group: 'Secretaria', name: 'Requerimentos',          key: 'requirements',      permissions: mkPerms(full(), mngr(), mngr(), admin()) },
  { group: 'Secretaria', name: 'Batismo',                key: 'baptism',           permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'Secretaria', name: 'Consagração',            key: 'consecration',      permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'Secretaria', name: 'Transferência',          key: 'transfer',          permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'Secretaria', name: 'Credenciais',            key: 'credentials',       permissions: mkPerms(full(), mngr(), mngr(), admin()) },
  { group: 'Secretaria', name: 'Modelos de Credencial',  key: 'credential_models', permissions: mkPerms(full(), mngr(), mngr(), admin()) },
  { group: 'Secretaria', name: 'Relatórios',             key: 'reports',           permissions: mkPerms(full(), mngr(), mngr(), mngr()) },
  { group: 'Secretaria', name: 'Documentos (Word)',      key: 'word_docs',         permissions: mkPerms(full(), mngr(), mngr(), admin()) },
  { group: 'Secretaria', name: 'Presença',               key: 'attendance',        permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'Secretaria', name: 'Aniversariantes',        key: 'birthdays',         permissions: mkPerms(full(), none(), none(), none()) },
  { group: 'Secretaria', name: 'Igrejas',                key: 'churches',          permissions: mkPerms(admin(), admin(), admin(), admin()) },
  { group: 'Secretaria', name: 'Pipeline (Secretaria)', key: 'crm_pipeline',      permissions: mkPerms(full(), mngr(), mngr(), admin()) },
  { group: 'Secretaria', name: 'Configurar Pipelines',  key: 'pipeline_config',   permissions: mkPerms(admin(), admin(), admin(), admin()) },

  // ── Gestão Pastoral ──────────────────────────────────────────────────────
  { group: 'Gestão Pastoral', name: 'Gestão',                key: 'pastoral_visits',   permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'Gestão Pastoral', name: 'Discipulado',           key: 'discipleship',       permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'Gestão Pastoral', name: 'Relatórios Pastorais',  key: 'pastoral_reports',  permissions: mkPerms(full(), mngr(), mngr(), mngr()) },
  { group: 'Gestão Pastoral', name: 'Aconselhamentos',       key: 'counseling',         permissions: mkPerms(mngr(), mngr(), mngr(), admin()) },
  { group: 'Gestão Pastoral', name: 'Pedidos de Oração',     key: 'prayer_requests',   permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'Gestão Pastoral', name: 'Follow-up',             key: 'followup',           permissions: mkPerms(full(), full(), full(), admin()) },

  // ── Ministérios ──────────────────────────────────────────────────────────
  { group: 'Ministérios', name: 'Todos os Ministérios', key: 'ministries',     permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'Ministérios', name: 'Equipes / Escalas',    key: 'ministry_teams', permissions: mkPerms(full(), full(), full(), admin()) },

  // ── GF (Grupos Familiares) ────────────────────────────────────────────────
  { group: 'GF (Grupos Familiares)', name: 'Todos os GF',          key: 'cells',       permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'GF (Grupos Familiares)', name: 'Relatórios de GF',     key: 'cell_reports', permissions: mkPerms(full(), full(), none(), none()) },

  // ── Comunicação ──────────────────────────────────────────────────────────
  { group: 'Comunicação', name: 'WhatsApp',          key: 'whatsapp',        permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'Comunicação', name: 'E-mail Campanhas',  key: 'email_campaigns', permissions: mkPerms(mngr(), mngr(), mngr(), admin()) },
  { group: 'Comunicação', name: 'SMS',               key: 'sms',             permissions: mkPerms(mngr(), mngr(), none(), none()) },

  // ── Eventos ───────────────────────────────────────────────────────────────
  { group: 'Eventos', name: 'Agenda',     key: 'events',      permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'Eventos', name: 'Pão Diário', key: 'daily_bread', permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'Eventos', name: 'Ingressos',  key: 'tickets',     permissions: mkPerms(full(), mngr(), mngr(), admin()) },
  { group: 'Eventos', name: 'Check-in',   key: 'checkin',     permissions: mkPerms(full(), full(), full(), admin()) },

  // ── App Móvel ─────────────────────────────────────────────────────────────
  { group: 'App Móvel', name: 'Dashboard App',        key: 'app_dashboard',    permissions: mkPerms(full(),  none(),  none(),  none()) },
  { group: 'App Móvel', name: 'Eventos com Ingressos', key: 'app_events',       permissions: mkPerms(full(),  mngr(),  mngr(),  admin()) },
  { group: 'App Móvel', name: 'Pedidos de Ingressos',  key: 'app_orders',       permissions: mkPerms(full(),  none(),  mngr(),  admin()) },
  { group: 'App Móvel', name: 'Check-in QR Code',      key: 'app_checkin',      permissions: mkPerms(full(),  none(),  full(),  admin()) },
  { group: 'App Móvel', name: 'Reembolsos',             key: 'app_refunds',      permissions: mkPerms(full(),  none(),  mngr(),  admin()) },
  { group: 'App Móvel', name: 'Programação da Sede',   key: 'app_hq_schedule',  permissions: mkPerms(full(),  mngr(),  mngr(),  admin()) },
  { group: 'App Móvel', name: 'Como Chegar (Acesso)',  key: 'app_hq_access',    permissions: mkPerms(full(),  mngr(),  mngr(),  admin()) },
  { group: 'App Móvel', name: 'Cadastros no App',      key: 'app_registrations', permissions: mkPerms(full(), none(),  mngr(),  admin()) },
  { group: 'App Móvel', name: 'Mídia / Pregações',     key: 'app_media',          permissions: mkPerms(full(), mngr(),  mngr(),  admin()) },
  { group: 'App Móvel', name: 'Notificações App',      key: 'app_notifications',  permissions: mkPerms(full(), mngr(),  mngr(),  admin()) },
  { group: 'App Móvel', name: 'Feed do App',           key: 'app_feed',           permissions: mkPerms(full(), mngr(),  mngr(),  admin()) },

  // ── (Contatos / Leads - futuro CRM) ─────────────────────────────────────
  { group: 'Secretaria', name: 'Contatos / Leads',      key: 'crm_leads',      permissions: mkPerms(full(), mngr(), mngr(), admin()) },

  // ── Finanças ─────────────────────────────────────────────────────────────
  // Tesouraria (geral) fica bloqueada para church também via canViewItem em AppUI.tsx
  { group: 'Finanças', name: 'Livro Caixa',            key: 'cashbook',        permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'Finanças', name: 'Lançamentos',             key: 'finance_entries', permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'Finanças', name: 'Fluxo de Caixa',         key: 'cash_flow',       permissions: mkPerms(full(), mngr(), none(), none()) },
  { group: 'Finanças', name: 'Planilhas',               key: 'spreadsheets',    permissions: mkPerms(full(), mngr(), mngr(), admin()) },
  { group: 'Finanças', name: 'Tesouraria (geral)',      key: 'finance',         permissions: mkPerms(mngr(), mngr(), mngr(), admin()) },
  { group: 'Finanças', name: 'Relatórios Financeiros', key: 'finance_reports', permissions: mkPerms(mngr(), mngr(), none(), none()) },

  // ── Gestão EBD ───────────────────────────────────────────────────────────
  { group: 'Gestão EBD', name: 'Dashboard EBD',          key: 'ebd_dashboard',    permissions: mkPerms(mngr(), mngr(), mngr(), admin()) },
  { group: 'Gestão EBD', name: 'Cadastros EBD',           key: 'ebd_cadastros',    permissions: mkPerms(mngr(), mngr(), mngr(), none()) },
  { group: 'Gestão EBD', name: 'Estoque EBD',             key: 'ebd_estoque',      permissions: mkPerms(mngr(), mngr(), mngr(), none()) },
  { group: 'Gestão EBD', name: 'Separação / Entrega',     key: 'ebd_entrega',      permissions: mkPerms(mngr(), mngr(), mngr(), admin()) },
  { group: 'Gestão EBD', name: 'Financeiro EBD',          key: 'ebd_financeiro',   permissions: mkPerms(mngr(), mngr(), mngr(), admin()) },
  { group: 'Gestão EBD', name: 'Negociações / Acordos',   key: 'ebd_negociacoes',  permissions: mkPerms(mngr(), mngr(), mngr(), admin()) },
  { group: 'Gestão EBD', name: 'Histórico EBD',           key: 'ebd_historico',    permissions: mkPerms(mngr(), mngr(), mngr(), admin()) },
  { group: 'Gestão EBD', name: 'Relatórios EBD',          key: 'ebd_relatorios',   permissions: mkPerms(mngr(), mngr(), mngr(), admin()) },

  // ── Pagamentos / Stripe ───────────────────────────────────────────────────
  { group: 'Pagamentos', name: 'Dashboard Pagamentos',    key: 'stripe_dashboard',      permissions: mkPerms(mngr(), mngr(), none(), none()) },
  { group: 'Pagamentos', name: 'Transações',               key: 'stripe_transacoes',     permissions: mkPerms(mngr(), mngr(), none(), none()) },
  { group: 'Pagamentos', name: 'Assinaturas',              key: 'stripe_assinaturas',    permissions: mkPerms(mngr(), mngr(), none(), none()) },
  { group: 'Pagamentos', name: 'Reembolsos',               key: 'stripe_reembolsos',     permissions: mkPerms(mngr(), mngr(), none(), none()) },
  { group: 'Pagamentos', name: 'Config. Stripe',           key: 'stripe_config',         permissions: mkPerms(admin(), admin(), none(), none()) },
  { group: 'Pagamentos', name: 'Meus Pagamentos (App)',    key: 'stripe_meus_pagamentos', permissions: mkPerms(full(), full(), full(), full()) },

  // ── Comunicação — WhatsApp (sub-permissões) ──────────────────────────────
  {
    group: 'Comunicação',
    name: 'Instâncias WhatsApp',
    key: 'whatsapp_instances',
    permissions: mkPerms(
      { master: true,  admin: true,  campo: false, church: false },
      { master: true,  admin: true,  campo: false, church: false },
      { master: true,  admin: true,  campo: false, church: false },
      { master: true,  admin: false, campo: false, church: false },
    ),
  },
  {
    group: 'Comunicação',
    name: 'Caixa de Entrada WhatsApp',
    key: 'whatsapp_inbox',
    permissions: mkPerms(
      { master: true, admin: true, campo: true, church: true },
      { master: true, admin: true, campo: true, church: true },
      { master: true, admin: true, campo: true, church: true },
      { master: false, admin: false, campo: false, church: false },
    ),
  },
  {
    group: 'Comunicação',
    name: 'Envio Automático WhatsApp',
    key: 'whatsapp_send',
    permissions: mkPerms(
      { master: true, admin: true, campo: true, church: true },
      { master: true, admin: true, campo: true, church: true },
      { master: true, admin: true, campo: true, church: true },
      { master: false, admin: false, campo: false, church: false },
    ),
  },

  // ── Sistema ───────────────────────────────────────────────────────────────
  { group: 'Sistema', name: 'Usuários',          key: 'system_users',    permissions: mkPerms(mngr(), mngr(), mngr(), none()) },
  {
    group: 'Sistema',
    name: 'Senha dos Campos',
    key: 'campo_passwords',
    permissions: mkPerms(
      { master: true, admin: false, campo: false, church: false },
      { master: true, admin: false, campo: false, church: false },
      { master: true, admin: false, campo: false, church: false },
      { master: true, admin: false, campo: false, church: false },
    ),
  },
  {
    group: 'Sistema',
    name: 'Funções',
    key: 'system_roles',
    permissions: mkPerms(
      { master: true, admin: false, campo: false, church: false },
      { master: true, admin: false, campo: false, church: false },
      { master: true, admin: false, campo: false, church: false },
      { master: true, admin: false, campo: false, church: false },
    ),
  },
  {
    group: 'Sistema',
    name: 'Permissões (Matriz)',
    key: 'system_permissions',
    permissions: mkPerms(
      { master: true, admin: false, campo: false, church: false },
      { master: true, admin: false, campo: false, church: false },
      { master: true, admin: false, campo: false, church: false },
      { master: true, admin: false, campo: false, church: false },
    ),
  },
  { group: 'Sistema', name: 'Configurações (página)', key: 'system_settings', permissions: mkPerms(admin(), admin(), none(), none()) },
  { group: 'Sistema', name: 'Log de Auditoria',        key: 'audit_log',      permissions: mkPerms(admin(), admin(), none(), none()) },
  {
    group: 'Sistema',
    name: 'Integrações / API',
    key: 'integrations',
    permissions: mkPerms(
      { master: true, admin: false, campo: false, church: false },
      { master: true, admin: false, campo: false, church: false },
      { master: true, admin: false, campo: false, church: false },
      { master: true, admin: false, campo: false, church: false },
    ),
  },

  // ── Configurações (cards da página de Configurações do Sistema) ───────────
  // Geral
  { group: 'Configurações', name: 'Informações da Igreja',      key: 'settings_church_info',     permissions: mkPerms(admin(), none(), admin(), none()) },
  { group: 'Configurações', name: 'Marca e Aparência',           key: 'settings_branding',         permissions: mkPerms(admin(), none(), admin(), none()) },
  { group: 'Configurações', name: 'Localização e Idioma',        key: 'settings_localization',     permissions: mkPerms(admin(), none(), admin(), none()) },
  // Segurança
  { group: 'Configurações', name: 'Configurações de Segurança',  key: 'settings_security',         permissions: mkPerms(admin(), none(), admin(), none()) },
  {
    group: 'Configurações',
    name: 'Chaves de API',
    key: 'settings_api_keys',
    permissions: mkPerms(
      { master: true, admin: false, campo: false, church: false },
      { master: true, admin: false, campo: false, church: false },
      { master: true, admin: false, campo: false, church: false },
      { master: true, admin: false, campo: false, church: false },
    ),
  },
  // Notificações
  { group: 'Configurações', name: 'Preferências de Notificação', key: 'settings_notifications',   permissions: mkPerms(admin(), none(), admin(), none()) },
  { group: 'Configurações', name: 'Templates de Notificação',    key: 'settings_templates',        permissions: mkPerms(admin(), admin(), admin(), admin()) },
  // Comunicação (configs)
  { group: 'Configurações', name: 'Configurações de Email',      key: 'settings_email_config',     permissions: mkPerms(admin(), none(), admin(), none()) },
  { group: 'Configurações', name: 'WhatsApp Business Config',    key: 'settings_whatsapp_config',  permissions: mkPerms(admin(), none(), admin(), none()) },
  { group: 'Configurações', name: 'SMS Config',                  key: 'settings_sms_config',       permissions: mkPerms(admin(), none(), admin(), none()) },
  // Integrações (configs)
  {
    group: 'Configurações',
    name: 'Webhooks',
    key: 'settings_webhooks',
    permissions: mkPerms(
      { master: true, admin: false, campo: false, church: false },
      { master: true, admin: false, campo: false, church: false },
      { master: true, admin: false, campo: false, church: false },
      { master: true, admin: false, campo: false, church: false },
    ),
  },
  {
    group: 'Configurações',
    name: 'API (docs e acesso)',
    key: 'settings_api',
    permissions: mkPerms(
      { master: true, admin: false, campo: false, church: false },
      { master: true, admin: false, campo: false, church: false },
      { master: true, admin: false, campo: false, church: false },
      { master: true, admin: false, campo: false, church: false },
    ),
  },
  // Dados
  { group: 'Configurações', name: 'Importação de Dados',         key: 'settings_import',           permissions: mkPerms(admin(), admin(), none(), none()) },
  { group: 'Configurações', name: 'Exportação de Dados',         key: 'settings_export',           permissions: mkPerms(admin(), admin(), none(), none()) },
  {
    group: 'Configurações',
    name: 'Backup',
    key: 'settings_backup',
    permissions: mkPerms(
      { master: true, admin: false, campo: false, church: false },
      { master: true, admin: false, campo: false, church: false },
      { master: true, admin: false, campo: false, church: false },
      { master: true, admin: false, campo: false, church: false },
    ),
  },
  // Documentação Técnica
  {
    group: 'Configurações',
    name: 'Documentação Técnica',
    key: 'settings_docs',
    permissions: mkPerms(
      { master: true, admin: false, campo: false, church: false },
      { master: true, admin: false, campo: false, church: false },
      { master: true, admin: false, campo: false, church: false },
      { master: true, admin: false, campo: false, church: false },
    ),
  },
];

export const ROLE_PERMISSION_ACTIONS: { key: Action; label: string }[] = [
  { key: 'view', label: 'Ver' },
  { key: 'create', label: 'Criar' },
  { key: 'edit', label: 'Editar' },
  { key: 'delete', label: 'Excluir' },
];

export const ROLE_PERMISSION_CATEGORIES = Array.from(
  DEFAULT_PERMISSION_MODULES.reduce((categories, module) => {
    if (!categories.has(module.group)) {
      categories.set(module.group, []);
    }

    const entries = ROLE_PERMISSION_ACTIONS.map((action) => ({
      id: `${module.key}.${action.key}`,
      name: `${action.label} ${module.name}`,
    }));

    categories.get(module.group)?.push(...entries);
    return categories;
  }, new Map<string, { id: string; name: string }[]>()),
).map(([name, permissions]) => ({ name, permissions }));

export const PERMISSION_GROUPS = Array.from(new Set(DEFAULT_PERMISSION_MODULES.map((module) => module.group)));