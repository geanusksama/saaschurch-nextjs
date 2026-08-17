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
const master = (): Record<ProfileKey, boolean> => ({ master: true, admin: false, campo: false, church: false });

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
  // Chat interno (ChatFAB, o balão flutuante no canto inferior direito).
  //  view   → exibe o ícone do chat
  //  create → pode enviar mensagem/arquivo/áudio
  //  delete → pode excluir mensagem de OUTRA pessoa (a própria sempre pode)
  // Está em OPT_OUT_PERMISSION_KEYS: ver comentário lá embaixo.
  { group: 'Principal', name: 'Chat Interno',      key: 'internal_chat', permissions: mkPerms(full(), full(), none(), master()) },

  // ── Secretaria ───────────────────────────────────────────────────────────
  { group: 'Secretaria', name: 'Lista de Membros',       key: 'members',           permissions: mkPerms(full(), mngr(), mngr(), admin()) },
  { group: 'Secretaria', name: 'Perfil do Membro',       key: 'member_profile',    permissions: mkPerms(full(), mngr(), mngr(), admin()) },
  { group: 'Secretaria', name: 'Importação de Membros',  key: 'member_import',     permissions: mkPerms(admin(), admin(), admin(), admin()) },
  // Campanhas: formulários dinâmicos enviados aos membros. `edit` é o que
  // libera aprovar/reprovar uma resposta (a aprovação grava no cadastro).
  { group: 'Secretaria', name: 'Campanhas',              key: 'secretaria_campanhas', permissions: mkPerms(full(), mngr(), mngr(), admin()) },
  // "Quero ser Membro": pedidos de adesão vindos do portal público.
  // Dividia a chave com `members`, então não dava para liberar (ou tirar) a
  // avaliação das fichas sem mexer no acesso à lista de membros inteira.
  //  view   → ver a lista de solicitações
  //  edit   → aprovar/reprovar a ficha (a aprovação cria o membro com ROL)
  //  create → reenviar o link da ficha pelo WhatsApp
  { group: 'Secretaria', name: 'Quero ser Membro',       key: 'membership_requests', permissions: mkPerms(full(), mngr(), mngr(), admin()) },
  { group: 'Secretaria', name: 'Serviços e Ocorrências', key: 'services',          permissions: mkPerms(full(), mngr(), mngr(), admin()) },
  { group: 'Secretaria', name: 'Requerimentos',          key: 'requirements',      permissions: mkPerms(full(), mngr(), mngr(), admin()) },
  { group: 'Secretaria', name: 'Batismo',                key: 'baptism',           permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'Secretaria', name: 'Consagração',            key: 'consecration',      permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'Secretaria', name: 'Ler QR Code',            key: 'qr_reader',         permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'Secretaria', name: 'Transferência',          key: 'transfer',          permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'Secretaria', name: 'Credenciais',            key: 'credentials',       permissions: mkPerms(full(), mngr(), mngr(), admin()) },
  { group: 'Secretaria', name: 'Modelos de Credencial',  key: 'credential_models', permissions: mkPerms(full(), mngr(), mngr(), admin()) },
  { group: 'Secretaria', name: 'Relatórios',             key: 'reports',           permissions: mkPerms(full(), mngr(), mngr(), mngr()) },
  { group: 'Secretaria', name: 'Documentos (Word)',      key: 'word_docs',         permissions: mkPerms(full(), mngr(), mngr(), admin()) },
  { group: 'Secretaria', name: 'Mala Direta (Word)',     key: 'word_mailmerge',    permissions: mkPerms(full(), mngr(), mngr(), admin()) },
  { group: 'Secretaria', name: 'Presença Facial',        key: 'attendance',        permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'Secretaria', name: 'Gerar Ticket',           key: 'presence_tickets',  permissions: mkPerms(full(), full(), full(), admin()) },
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
  { group: 'GF (Grupos Familiares)', name: 'Anexar Pessoas ao GF', key: 'cell_group_members', permissions: mkPerms(full(), full(), full(), admin()) }, // edit = anexar, delete = remover

  // ── Patrimônio ───────────────────────────────────────────────────────────
  { group: 'Patrimônio', name: 'Bens e Patrimônio',      key: 'assets',           permissions: mkPerms(full(), mngr(), mngr(), admin()) },
  { group: 'Patrimônio', name: 'Inventário de Patrimônio', key: 'asset_inventory', permissions: mkPerms(full(), mngr(), mngr(), admin()) },

  // ── Comunicação ──────────────────────────────────────────────────────────
  { group: 'Comunicação', name: 'WhatsApp',                   key: 'whatsapp',              permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'Comunicação', name: 'WhatsApp Campanhas/Broadcast', key: 'whatsapp_campaigns',  permissions: mkPerms(full(), mngr(), mngr(), admin()) },
  { group: 'Comunicação', name: 'E-mail Campanhas',           key: 'email_campaigns',       permissions: mkPerms(mngr(), mngr(), mngr(), admin()) },
  { group: 'Comunicação', name: 'SMS',                        key: 'sms',                   permissions: mkPerms(mngr(), mngr(), none(), none()) },

  // ── Eventos ───────────────────────────────────────────────────────────────
  { group: 'Eventos', name: 'Agenda',     key: 'events',      permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'Eventos', name: 'Pão Diário', key: 'daily_bread', permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'Eventos', name: 'Ingressos',  key: 'tickets',     permissions: mkPerms(full(), mngr(), mngr(), admin()) },
  { group: 'Eventos', name: 'Check-in',   key: 'checkin',     permissions: mkPerms(full(), full(), full(), admin()) },

  // ── Peniel ────────────────────────────────────────────────────────────────
  { group: 'Peniel', name: 'Gestão Peniel',   key: 'peniel',          permissions: mkPerms(mngr(), mngr(), mngr(), admin()) },
  { group: 'Peniel', name: 'Check-in (QR)',   key: 'peniel_checkin',  permissions: mkPerms(mngr(), none(), mngr(), none()) },

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
  { group: 'App Móvel', name: 'CMS Departamentos',     key: 'cms_departments',    permissions: mkPerms(full(), mngr(),  mngr(),  admin()) },

  // ── (Contatos / Leads - futuro CRM) ─────────────────────────────────────
  { group: 'Secretaria', name: 'Contatos / Leads',      key: 'crm_leads',      permissions: mkPerms(full(), mngr(), mngr(), admin()) },

  // ── Finanças ─────────────────────────────────────────────────────────────
  // Tesouraria (geral) fica bloqueada para church também via canViewItem em AppUI.tsx
  { group: 'Finanças', name: 'Livro Caixa',            key: 'cashbook',        permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'Finanças', name: 'Lançamentos',             key: 'finance_entries', permissions: mkPerms(full(), full(), full(), admin()) },
  { group: 'Finanças', name: 'Fluxo de Caixa',         key: 'cash_flow',       permissions: mkPerms(full(), mngr(), none(), none()) },
  { group: 'Finanças', name: 'Planilhas',               key: 'spreadsheets',    permissions: mkPerms(full(), mngr(), mngr(), admin()) },
  { group: 'Finanças', name: 'Tesouraria (geral)',      key: 'finance',         permissions: mkPerms(mngr(), mngr(), mngr(), admin()) },
  // Contas a Pagar. `view` abre a tela e os relatórios; `create` lança conta;
  // `edit` altera dados cadastrais; `delete` cancela a conta.
  { group: 'Finanças', name: 'Contas a Pagar',          key: 'contas_pagar',           permissions: mkPerms(full(), full(), mngr(), mngr()) },
  // Aprovar conta acima da alçada e registrar/estornar pagamento são da
  // tesouraria — separados de quem só lança a conta.
  { group: 'Finanças', name: 'Aprovar Contas a Pagar',  key: 'contas_pagar_aprovar',   permissions: mkPerms(mngr(), mngr(), mngr(), mngr()) },
  { group: 'Finanças', name: 'Pagar Contas a Pagar',    key: 'contas_pagar_pagar',     permissions: mkPerms(mngr(), mngr(), mngr(), mngr()) },
  { group: 'Finanças', name: 'Relatórios Financeiros', key: 'finance_reports', permissions: mkPerms(mngr(), mngr(), none(), none()) },
  { group: 'Finanças', name: 'Painel Executivo Financeiro', key: 'finance_executive', permissions: mkPerms(mngr(), mngr(), none(), none()) },

  // ── Banco / Santander ────────────────────────────────────────────────────
  // Acesso restrito: master, admin e campo — church NÃO tem acesso
  { group: 'Banco Santander', name: 'Visualizar Movimentos',        key: 'santander_view',     permissions: mkPerms(mngr(), none(), none(), none()) },
  { group: 'Banco Santander', name: 'Configurar Credenciais',       key: 'santander_config',   permissions: mkPerms(admin(), admin(), none(), none()) },
  { group: 'Banco Santander', name: 'Consultar / Sincronizar API',  key: 'santander_sync',     permissions: mkPerms(mngr(), mngr(), none(), none()) },
  { group: 'Banco Santander', name: 'Importar FEBRABAN 240',        key: 'santander_import',   permissions: mkPerms(mngr(), mngr(), none(), none()) },
  { group: 'Banco Santander', name: 'Conciliar Movimentos',         key: 'santander_conciliar', permissions: mkPerms(mngr(), mngr(), mngr(), none()) },
  { group: 'Banco Santander', name: 'Lançar no Livro Caixa',        key: 'santander_lancar',   permissions: mkPerms(mngr(), mngr(), mngr(), none()) },
  { group: 'Banco Santander', name: 'Ignorar Movimentos',           key: 'santander_ignorar',  permissions: mkPerms(mngr(), mngr(), none(), none()) },
  { group: 'Banco Santander', name: 'Exportar Dados',               key: 'santander_export',   permissions: mkPerms(mngr(), mngr(), none(), none()) },
  { group: 'Banco Santander', name: 'Log de Auditoria Santander',   key: 'santander_audit',    permissions: mkPerms(admin(), admin(), none(), none()) },

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
    // Exclusivo do master: as conversas trazem dados pessoais de quem escreve
    // para a igreja, entao nenhum outro perfil enxerga a tela.
    permissions: mkPerms(master(), master(), master(), master()),
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
  { group: 'Sistema', name: 'Log de Auditoria',        key: 'audit_log',      permissions: mkPerms(master(), master(), none(), none()) },
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
  // View liberada pra todo profileType na matriz — o filtro real de quem enxerga é a
  // FUNÇÃO (roleName): só "tesouraria" além de master/admin, "secretaria" nunca (ver
  // podeAcessarContabilidadeAgendamento em contabilidadeAgendamentoService.ts e o filtro
  // extra em SystemSettings.tsx).
  { group: 'Configurações', name: 'Contabilidade — Agendamento', key: 'contabilidade_agendamentos', permissions: mkPerms(full(), none(), full(), none()) },
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
  // Listas auxiliares (dropdowns) — CRUD genérico, ver src/lib/lookupRegistry.ts
  { group: 'Configurações', name: 'Plano de Contas',        key: 'settings_chart_of_accounts',      permissions: mkPerms(admin(), admin(), none(), none()) },
  { group: 'Configurações', name: 'Formas de Pagamento',    key: 'settings_payment_methods',        permissions: mkPerms(admin(), admin(), none(), none()) },
  { group: 'Configurações', name: 'Tipos de Documento',     key: 'settings_document_types',         permissions: mkPerms(admin(), admin(), none(), none()) },
  { group: 'Configurações', name: 'Centros de Custo',       key: 'settings_cost_centers',           permissions: mkPerms(admin(), admin(), none(), none()) },
  { group: 'Configurações', name: 'Bancos',                 key: 'settings_bancos',                 permissions: mkPerms(admin(), admin(), none(), none()) },
  { group: 'Configurações', name: 'Departamentos',          key: 'settings_departamentos',          permissions: mkPerms(admin(), admin(), none(), none()) },
  { group: 'Configurações', name: 'Tipos de Credor',        key: 'settings_tipos_credor',           permissions: mkPerms(admin(), admin(), none(), none()) },
  { group: 'Configurações', name: 'Naturezas de Despesa',   key: 'settings_naturezas_despesa',      permissions: mkPerms(admin(), admin(), none(), none()) },
  { group: 'Configurações', name: 'Tipos de Departamento',  key: 'settings_tipos_departamento',     permissions: mkPerms(admin(), admin(), none(), none()) },
  { group: 'Configurações', name: 'Tipos de Conta Bancária', key: 'settings_tipos_conta_bancaria',  permissions: mkPerms(admin(), admin(), none(), none()) },
  { group: 'Configurações', name: 'Funções da Igreja',      key: 'settings_church_functions',       permissions: mkPerms(admin(), admin(), none(), none()) },
  { group: 'Configurações', name: 'Títulos Eclesiásticos',  key: 'settings_ecclesiastical_titles',  permissions: mkPerms(admin(), admin(), none(), none()) },
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

/**
 * Chaves com semântica "opt-out": permitidas pelo padrão do perfil até que
 * exista uma sobrescrita EXPLÍCITA marcando vermelho.
 *
 * Por que existe: um usuário com FUNÇÃO (role) atribuída tem as permissões
 * tratadas como whitelist em usePermissions — tudo que não está na lista de
 * sobrescritas é negado. Quando uma chave nova entra no catálogo, nenhuma role
 * antiga a contém, então o recurso desaparece para esses usuários sem ninguém
 * ter pedido isso. Para recursos que já estavam visíveis para todos em produção
 * (caso do chat interno) esse desaparecimento é uma regressão, não uma decisão.
 *
 * Só entram aqui chaves de recursos "ambientais" (não são telas/rotas do menu),
 * que eram liberados para todo mundo antes de ganharem controle na matriz.
 * Bloquear continua possível: basta marcar vermelho na tela do usuário.
 */
export const OPT_OUT_PERMISSION_KEYS = new Set<string>(['internal_chat']);

/**
 * Mescla uma matriz salva (do banco/localStorage, possivelmente desatualizada)
 * com o catálogo atual: todos os módulos do catálogo ficam presentes (módulos
 * novos como Peniel entram com seus padrões), preservando os valores salvos
 * onde a key existir. Garante que novos módulos sejam exibidos e controláveis
 * sem exigir um re-save manual da matriz.
 */
export function mergeModules(saved?: PermissionModule[] | null): PermissionModule[] {
  if (!saved || !Array.isArray(saved)) return [...DEFAULT_PERMISSION_MODULES];
  const savedByKey = new Map(saved.map((m) => [m.key, m]));
  return DEFAULT_PERMISSION_MODULES.map((def) => savedByKey.get(def.key) ?? def);
}

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