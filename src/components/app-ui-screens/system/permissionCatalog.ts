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
  { group: 'Principal', name: 'Dashboard', key: 'dashboard', permissions: mkPerms(full(), none(), none(), none()) },
  { group: 'Principal', name: 'Notificações', key: 'notifications', permissions: mkPerms(full(), none(), none(), none()) },

  { group: 'Secretaria', name: 'Lista de Membros', key: 'members', permissions: mkPerms(full(), mngr(), mngr(), admin()) },
  { group: 'Secretaria', name: 'Perfil do Membro', key: 'member_profile', permissions: mkPerms(full(), mngr(), mngr(), admin()) },
  { group: 'Secretaria', name: 'Importação de Membros', key: 'member_import', permissions: mkPerms(admin(), admin(), admin(), admin()) },
  { group: 'Secretaria', name: 'Batismo', key: 'baptism', permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'Secretaria', name: 'Consagração', key: 'consecration', permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'Secretaria', name: 'Transferência', key: 'transfer', permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'Secretaria', name: 'Credenciais', key: 'credentials', permissions: mkPerms(full(), mngr(), mngr(), admin()) },
  { group: 'Secretaria', name: 'Relatórios', key: 'reports', permissions: mkPerms(full(), mngr(), mngr(), mngr()) },
  { group: 'Secretaria', name: 'Presença', key: 'attendance', permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'Secretaria', name: 'Aniversariantes', key: 'birthdays', permissions: mkPerms(full(), none(), none(), none()) },

  { group: 'Pastoral', name: 'Visitas Pastorais', key: 'pastoral_visits', permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'Pastoral', name: 'Aconselhamentos', key: 'counseling', permissions: mkPerms(mngr(), mngr(), mngr(), admin()) },
  { group: 'Pastoral', name: 'Pedidos de Oração', key: 'prayer_requests', permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'Pastoral', name: 'Follow-up', key: 'followup', permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'Pastoral', name: 'Discipulado', key: 'discipleship', permissions: mkPerms(full(), full(), full(), admin()) },

  { group: 'Ministérios', name: 'Todos os Ministérios', key: 'ministries', permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'Ministérios', name: 'Equipes / Escalas', key: 'ministry_teams', permissions: mkPerms(full(), full(), full(), admin()) },

  { group: 'Células', name: 'Lista de Células', key: 'cells', permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'Células', name: 'Relatórios de Células', key: 'cell_reports', permissions: mkPerms(full(), full(), none(), none()) },

  { group: 'Comunicação', name: 'WhatsApp', key: 'whatsapp', permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'Comunicação', name: 'E-mail Campanhas', key: 'email_campaigns', permissions: mkPerms(mngr(), mngr(), mngr(), admin()) },
  { group: 'Comunicação', name: 'SMS', key: 'sms', permissions: mkPerms(mngr(), mngr(), none(), none()) },

  { group: 'Eventos', name: 'Agenda de Eventos', key: 'events',      permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'Eventos', name: 'Pão Diário',        key: 'daily_bread', permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'Eventos', name: 'Ingressos',         key: 'tickets',     permissions: mkPerms(full(), mngr(), mngr(), admin()) },
  { group: 'Eventos', name: 'Check-in',          key: 'checkin',     permissions: mkPerms(full(), full(), full(), admin()) },

  { group: 'App Móvel', name: 'Dashboard App',         key: 'app_dashboard',     permissions: mkPerms(full(),  none(),  none(),  none()) },
  { group: 'App Móvel', name: 'Eventos com Ingressos',  key: 'app_events',        permissions: mkPerms(full(),  mngr(),  mngr(),  admin()) },
  { group: 'App Móvel', name: 'Pedidos de Ingressos',   key: 'app_orders',        permissions: mkPerms(full(),  none(),  mngr(),  admin()) },
  { group: 'App Móvel', name: 'Check-in QR Code',       key: 'app_checkin',       permissions: mkPerms(full(),  none(),  full(),  admin()) },
  { group: 'App Móvel', name: 'Reembolsos',              key: 'app_refunds',       permissions: mkPerms(full(),  none(),  mngr(),  admin()) },
  { group: 'App Móvel', name: 'Programação da Sede',    key: 'app_hq_schedule',   permissions: mkPerms(full(),  mngr(),  mngr(),  admin()) },
  { group: 'App Móvel', name: 'Como Chegar (Acesso)',   key: 'app_hq_access',     permissions: mkPerms(full(),  mngr(),  mngr(),  admin()) },
  { group: 'App Móvel', name: 'Cadastros no App',       key: 'app_registrations', permissions: mkPerms(full(),  none(),  mngr(),  admin()) },
  { group: 'App Móvel', name: 'Mídia / Pregações',     key: 'app_media',          permissions: mkPerms(full(),  mngr(),  mngr(),  admin()) },
  { group: 'App Móvel', name: 'Notificações App',      key: 'app_notifications',  permissions: mkPerms(full(),  mngr(),  mngr(),  admin()) },
  { group: 'App Móvel', name: 'Feed do App',           key: 'app_feed',           permissions: mkPerms(full(),  mngr(),  mngr(),  admin()) },

  { group: 'CRM / Pipeline', name: 'Pipeline de Visitantes', key: 'crm_pipeline', permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'CRM / Pipeline', name: 'Contatos / Leads', key: 'crm_leads', permissions: mkPerms(full(), full(), full(), admin()) },

  { group: 'Finanças', name: 'Livro Caixa',             key: 'cashbook',        permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'Finanças', name: 'Lançamentos',              key: 'finance_entries', permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'Finanças', name: 'Fluxo de Caixa',          key: 'cash_flow',       permissions: mkPerms(full(), mngr(), none(), none()) },
  { group: 'Finanças', name: 'Planilhas',                key: 'spreadsheets',    permissions: mkPerms(full(), mngr(), mngr(), admin()) },
  { group: 'Finanças', name: 'Tesouraria (geral)',       key: 'finance',         permissions: mkPerms(mngr(), mngr(), mngr(), admin()) },
  { group: 'Finanças', name: 'Relatórios Financeiros',  key: 'finance_reports', permissions: mkPerms(mngr(), mngr(), none(), none()) },

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
  { group: 'Pagamentos', name: 'Dashboard Pagamentos',  key: 'stripe_dashboard',       permissions: mkPerms(mngr(), mngr(), none(), none()) },
  { group: 'Pagamentos', name: 'Transações',             key: 'stripe_transacoes',      permissions: mkPerms(mngr(), mngr(), none(), none()) },
  { group: 'Pagamentos', name: 'Assinaturas',            key: 'stripe_assinaturas',     permissions: mkPerms(mngr(), mngr(), none(), none()) },
  { group: 'Pagamentos', name: 'Reembolsos',             key: 'stripe_reembolsos',      permissions: mkPerms(mngr(), mngr(), none(), none()) },
  { group: 'Pagamentos', name: 'Config. Stripe',         key: 'stripe_config',          permissions: mkPerms(admin(), admin(), none(), none()) },
  { group: 'Pagamentos', name: 'Meus Pagamentos (App)', key: 'stripe_meus_pagamentos', permissions: mkPerms(full(), full(), full(), full()) },

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
  { group: 'Sistema', name: 'Usuários', key: 'system_users', permissions: mkPerms(mngr(), mngr(), none(), none()) },
  {
    group: 'Sistema',
    name: 'Funções e Permissões',
    key: 'system_roles',
    permissions: mkPerms(
      { master: true, admin: false, campo: false, church: false },
      { master: true, admin: false, campo: false, church: false },
      { master: true, admin: false, campo: false, church: false },
      { master: true, admin: false, campo: false, church: false },
    ),
  },
  { group: 'Sistema', name: 'Configurações', key: 'system_settings', permissions: mkPerms(admin(), admin(), none(), none()) },
  { group: 'Sistema', name: 'Log de Auditoria', key: 'audit_log', permissions: mkPerms(admin(), admin(), none(), none()) },
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