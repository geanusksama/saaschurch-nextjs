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
  { group: 'Secretaria', name: 'Presença',               key: 'attendance',        permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'Secretaria', name: 'Aniversariantes',        key: 'birthdays',         permissions: mkPerms(full(), none(), none(), none()) },
  { group: 'Secretaria', name: 'Igrejas',                key: 'churches',          permissions: mkPerms(admin(), admin(), admin(), admin()) },

  // ── Gestão Pastoral ──────────────────────────────────────────────────────
  { group: 'Gestão Pastoral', name: 'Gestão Pastoral',       key: 'pastoral_visits',   permissions: mkPerms(full(), full(), full(), admin()) },
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
  { group: 'Eventos', name: 'Agenda de Eventos', key: 'events',      permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'Eventos', name: 'Pão Diário',        key: 'daily_bread', permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'Eventos', name: 'Ingressos',         key: 'tickets',     permissions: mkPerms(full(), mngr(), mngr(), admin()) },
  { group: 'Eventos', name: 'Check-in',          key: 'checkin',     permissions: mkPerms(full(), full(), full(), admin()) },

  // ── CRM / Pipeline ───────────────────────────────────────────────────────
  { group: 'CRM / Pipeline', name: 'Pipeline de Visitantes', key: 'crm_pipeline',   permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'CRM / Pipeline', name: 'Configurar Pipelines',   key: 'pipeline_config', permissions: mkPerms(admin(), admin(), admin(), admin()) },
  { group: 'CRM / Pipeline', name: 'Contatos / Leads',       key: 'crm_leads',      permissions: mkPerms(full(), full(), full(), admin()) },

  // ── Finanças ─────────────────────────────────────────────────────────────
  { group: 'Finanças', name: 'Livro Caixa',            key: 'cashbook',        permissions: mkPerms(mngr(), mngr(), mngr(), admin()) },
  { group: 'Finanças', name: 'Lançamentos',             key: 'finance_entries', permissions: mkPerms(mngr(), mngr(), mngr(), admin()) },
  { group: 'Finanças', name: 'Fluxo de Caixa',         key: 'cash_flow',       permissions: mkPerms(mngr(), mngr(), none(), none()) },
  { group: 'Finanças', name: 'Planilhas',               key: 'spreadsheets',    permissions: mkPerms(mngr(), mngr(), mngr(), admin()) },
  { group: 'Finanças', name: 'Tesouraria (geral)',      key: 'finance',         permissions: mkPerms(mngr(), mngr(), mngr(), admin()) },
  { group: 'Finanças', name: 'Relatórios Financeiros', key: 'finance_reports', permissions: mkPerms(mngr(), mngr(), none(), none()) },

  // ── Sistema ───────────────────────────────────────────────────────────────
  { group: 'Sistema', name: 'Usuários',          key: 'system_users',    permissions: mkPerms(admin(), admin(), none(), none()) },
  { group: 'Sistema', name: 'Senha dos Campos',  key: 'campo_passwords', permissions: mkPerms(admin(), admin(), none(), none()) },
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
  { group: 'Sistema', name: 'Log de Auditoria', key: 'audit_log',    permissions: mkPerms(admin(), admin(), none(), none()) },
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