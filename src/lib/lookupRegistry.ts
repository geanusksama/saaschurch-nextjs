/**
 * Registro das "listas auxiliares" (lookups) que alimentam dropdowns do sistema.
 *
 * Cada entrada descreve a tabela e os campos editáveis. É usado tanto pela API
 * genérica (`/api/lookups/[key]`) quanto pela tela genérica de CRUD, então o
 * cadastro de uma lista nova é feito num lugar só.
 *
 * IMPORTANTE: o nome da tabela e das colunas vêm SEMPRE deste arquivo (allowlist).
 * Nada que venha do cliente é interpolado em SQL.
 */

/**
 * `number` existe porque o Postgres recusa gravar texto em coluna integer
 * ("column ordem is of type integer but expression is of type text"). Campo
 * numérico é enviado com cast explícito na query.
 */
export type LookupFieldType = "text" | "boolean" | "select" | "number";

export type LookupField = {
  key: string;
  label: string;
  type: LookupFieldType;
  required?: boolean;
  /** Opções fixas para type: 'select'. Prefira `optionsFrom`. */
  options?: { value: string; label: string }[];
  /**
   * Opções vindas de OUTRA lista cadastrada (também registrada aqui).
   *
   * É o caminho preferido: nenhum dropdown do sistema deve ter opção fixa no
   * código — a igreja precisa poder criar, renomear e desativar item sem
   * depender de deploy. `valueField` é o que fica gravado no registro (em geral
   * `codigo`, estável) e `labelField` é o que o usuário lê.
   */
  optionsFrom?: { lookupKey: string; valueField?: string; labelField?: string };
  /** Mostrar como coluna na listagem. */
  inList?: boolean;
  help?: string;
};

export type LookupConfig = {
  /** Chave usada na URL: /api/lookups/<key> e /app-ui/config/<key> */
  key: string;
  table: string;
  label: string;
  description: string;
  /** Coluna(s) de ordenação na listagem. */
  orderBy: string;
  fields: LookupField[];
  /** Coluna booleana que representa "ativo" (para o toggle rápido). */
  activeField?: string;
  /** Quando true, a tabela tem deleted_at e a exclusão é lógica. */
  softDelete?: boolean;
  /** Aviso exibido na tela (ex.: vínculo histórico por nome). */
  warning?: string;
  /** Chave de permissão. */
  permKey: string;
  /**
   * Coluna de isolamento por campo (normalmente `campo_id`).
   *
   * Quando presente, a listagem só devolve os itens do campo ativo do usuário e
   * a criação carimba esse campo — o banco de um campo não aparece para outro.
   * Lista sem esta coluna é global (plano de contas, formas de pagamento).
   */
  campoField?: string;
};

const TIPO_OPTIONS = [
  { value: "RECEITA", label: "Receita" },
  { value: "DESPESA", label: "Despesa" },
];

export const LOOKUPS: Record<string, LookupConfig> = {
  "chart-of-accounts": {
    key: "chart-of-accounts",
    table: "plano_de_contas",
    label: "Plano de Contas",
    description: "Categorias de receita e despesa usadas nos lançamentos.",
    orderBy: "codigo NULLS LAST, nome",
    permKey: "settings_chart_of_accounts",
    activeField: "ativo",
    warning:
      "O Livro Caixa grava o plano de contas pelo NOME. Renomear um item não altera os lançamentos já registrados — prefira desativar e criar um novo.",
    fields: [
      { key: "codigo", label: "Código", type: "text", inList: true },
      { key: "nome", label: "Nome", type: "text", required: true, inList: true },
      { key: "tipo", label: "Tipo", type: "select", required: true, options: TIPO_OPTIONS, inList: true },
      { key: "ativo", label: "Ativo", type: "boolean", inList: true },
      { key: "considera_dizimo", label: "Considera dízimo", type: "boolean", help: "Entra nos relatórios de dizimistas." },
      { key: "disponivel_igreja", label: "Disponível p/ Igreja", type: "boolean" },
      { key: "disponivel_membro", label: "Disponível p/ Membro", type: "boolean" },
      { key: "disponivel_pf", label: "Disponível p/ PF", type: "boolean" },
      { key: "disponivel_pj", label: "Disponível p/ PJ", type: "boolean" },
    ],
  },

  "payment-methods": {
    key: "payment-methods",
    table: "forma_pagamento",
    label: "Formas de Pagamento",
    description: "Formas de pagamento disponíveis nos lançamentos financeiros.",
    orderBy: "nome",
    permKey: "settings_payment_methods",
    activeField: "mostrar",
    warning:
      "O Livro Caixa grava a forma de pagamento pelo NOME. Renomear não altera lançamentos já registrados.",
    fields: [
      { key: "nome", label: "Nome", type: "text", required: true, inList: true },
      { key: "mostrar", label: "Ativa", type: "boolean", inList: true, help: "Só as ativas aparecem no dropdown." },
    ],
  },

  "document-types": {
    key: "document-types",
    table: "tipo_documento",
    label: "Tipos de Documento",
    description: "Tipos de documento de receita e despesa.",
    orderBy: "nome",
    permKey: "settings_document_types",
    activeField: "ativo",
    fields: [
      { key: "nome", label: "Nome", type: "text", required: true, inList: true },
      { key: "sigla", label: "Sigla", type: "text", inList: true },
      { key: "disponivel_receita", label: "Disponível em Receita", type: "boolean", inList: true },
      { key: "disponivel_despesa", label: "Disponível em Despesa", type: "boolean", inList: true },
      { key: "ativo", label: "Ativo", type: "boolean", inList: true },
    ],
  },

  "cost-centers": {
    key: "cost-centers",
    table: "centro_de_custo",
    label: "Centros de Custo",
    description: "Centros de custo usados na classificação de lançamentos.",
    orderBy: "nome",
    permKey: "settings_cost_centers",
    activeField: "mostrar",
    fields: [
      { key: "nome", label: "Nome", type: "text", required: true, inList: true },
      { key: "mostrar", label: "Ativo", type: "boolean", inList: true },
    ],
  },

  bancos: {
    key: "bancos",
    table: "bancos",
    label: "Bancos",
    description:
      "Contas bancárias e caixas da igreja. Usados no lançamento do Livro Caixa e no pagamento de contas.",
    orderBy: "codigo NULLS LAST, nome",
    permKey: "settings_bancos",
    activeField: "ativo",
    campoField: "campo_id",
    warning:
      "Marque apenas UM banco como padrão — é ele que vem pré-selecionado nos lançamentos novos. O código é único dentro do campo.",
    fields: [
      { key: "codigo", label: "Código", type: "text", inList: true, help: "Código curto de busca: 01, 02... Aparece no dropdown como \"01 - Bradesco\"." },
      { key: "nome", label: "Nome", type: "text", required: true, inList: true, help: "Ex.: Banco do Brasil — C/C 12345-6" },
      { key: "codigo_febraban", label: "Código FEBRABAN", type: "text", help: "Número da instituição: 001 (BB), 033 (Santander), 341 (Itaú)." },
      { key: "agencia", label: "Agência", type: "text", inList: true },
      { key: "conta", label: "Conta", type: "text", inList: true },
      {
        key: "tipo_conta",
        label: "Tipo de conta",
        type: "select",
        inList: true,
        optionsFrom: { lookupKey: "tipos-conta-bancaria" },
      },
      { key: "chave_pix", label: "Chave PIX", type: "text" },
      { key: "titular", label: "Titular", type: "text" },
      { key: "ativo", label: "Ativo", type: "boolean", inList: true },
      { key: "is_default", label: "Padrão", type: "boolean", inList: true, help: "Pré-selecionado em lançamentos novos." },
    ],
  },

  "tipos-culto": {
    key: "tipos-culto",
    table: "tipo_culto",
    label: "Tipos de Culto",
    description:
      "Culto, EBD, oração, jovens, vigília... Alimenta o dropdown do fechamento pós-culto (Gestão de Culto).",
    orderBy: "ordem, nome",
    permKey: "culto_gestao",
    activeField: "ativo",
    campoField: "campo_id",
    softDelete: true,
    warning:
      "O código é o que fica gravado no culto — renomear o nome é seguro, mudar o código desliga o vínculo dos cultos já lançados.",
    fields: [
      { key: "codigo", label: "Código", type: "text", required: true, inList: true, help: "Estável, sem acento: CULTO, EBD, ORACAO. É o que fica gravado no registro." },
      { key: "nome", label: "Nome", type: "text", required: true, inList: true, help: "O que o usuário lê no dropdown." },
      { key: "descricao", label: "Descrição", type: "text" },
      { key: "ordem", label: "Ordem", type: "number", inList: true, help: "Ordem no dropdown." },
      { key: "ativo", label: "Ativo", type: "boolean", inList: true, help: "Só os ativos aparecem no dropdown." },
      { key: "is_default", label: "Padrão", type: "boolean", inList: true, help: "Pré-selecionado no formulário de lançamento." },
    ],
  },

  departamentos: {
    key: "departamentos",
    table: "departamentos",
    label: "Departamentos",
    description:
      "Para onde o dinheiro vai: Missões, campanhas, obra do templo, infantil. Classifica lançamentos e contas a pagar.",
    orderBy: "codigo NULLS LAST, ordem, nome",
    permKey: "settings_departamentos",
    activeField: "ativo",
    campoField: "campo_id",
    warning:
      "Lançamentos anteriores a este cadastro ficam sem departamento e aparecem como \"Não informado\" nos relatórios — é dado histórico, não erro. O código é único dentro do campo.",
    fields: [
      { key: "codigo", label: "Código", type: "text", inList: true, help: "Código curto de busca: 01, 02... Aparece no dropdown como \"01 - Missões\"." },
      { key: "nome", label: "Nome", type: "text", required: true, inList: true },
      {
        key: "tipo",
        label: "Tipo",
        type: "select",
        inList: true,
        optionsFrom: { lookupKey: "tipos-departamento" },
      },
      { key: "descricao", label: "Descrição", type: "text" },
      { key: "cor", label: "Cor", type: "text", help: "Hex usado nos gráficos, ex.: #8b5cf6" },
      { key: "ordem", label: "Ordem", type: "number", help: "Define a posição no dropdown." },
      { key: "ativo", label: "Ativo", type: "boolean", inList: true },
      { key: "is_default", label: "Padrão", type: "boolean", inList: true, help: "Pré-selecionado em lançamentos novos." },
    ],
  },

  // ── Listas que alimentam os selects do módulo Contas a Pagar ───────────────
  // Existem para que nenhum dropdown tenha opção fixa no código. O `codigo` é o
  // que fica gravado no registro de negócio; o `nome` é só rótulo, e pode ser
  // renomeado sem afetar o que já foi lançado.

  "tipos-credor": {
    key: "tipos-credor",
    table: "tipos_credor",
    label: "Tipos de Credor",
    description: "Classificação de quem recebe: pastor, obreiro, fornecedor, prestador, órgão público.",
    orderBy: "ordem, nome",
    permKey: "settings_tipos_credor",
    activeField: "ativo",
    warning: "O código é gravado nos credores. Renomeie o nome à vontade; mudar o código não altera cadastros existentes.",
    fields: [
      { key: "codigo", label: "Código", type: "text", required: true, inList: true, help: "Sem espaços, ex.: PASTOR." },
      { key: "nome", label: "Nome", type: "text", required: true, inList: true },
      { key: "ordem", label: "Ordem", type: "number", inList: true },
      { key: "ativo", label: "Ativo", type: "boolean", inList: true },
      { key: "is_default", label: "Padrão", type: "boolean", inList: true },
    ],
  },

  "naturezas-despesa": {
    key: "naturezas-despesa",
    table: "naturezas_despesa",
    label: "Naturezas de Despesa",
    description: "Fixa, variável, eventual — usada na classificação dos tipos de despesa.",
    orderBy: "ordem, nome",
    permKey: "settings_naturezas_despesa",
    activeField: "ativo",
    fields: [
      { key: "codigo", label: "Código", type: "text", required: true, inList: true },
      { key: "nome", label: "Nome", type: "text", required: true, inList: true },
      { key: "descricao", label: "Descrição", type: "text" },
      { key: "ordem", label: "Ordem", type: "number", inList: true },
      { key: "ativo", label: "Ativo", type: "boolean", inList: true },
      { key: "is_default", label: "Padrão", type: "boolean", inList: true },
    ],
  },

  "tipos-departamento": {
    key: "tipos-departamento",
    table: "tipos_departamento",
    label: "Tipos de Departamento",
    description: "Ministério, campanha, setor, obra, missões — classifica os departamentos.",
    orderBy: "ordem, nome",
    permKey: "settings_tipos_departamento",
    activeField: "ativo",
    fields: [
      { key: "codigo", label: "Código", type: "text", required: true, inList: true },
      { key: "nome", label: "Nome", type: "text", required: true, inList: true },
      { key: "ordem", label: "Ordem", type: "number", inList: true },
      { key: "ativo", label: "Ativo", type: "boolean", inList: true },
      { key: "is_default", label: "Padrão", type: "boolean", inList: true },
    ],
  },

  "tipos-conta-bancaria": {
    key: "tipos-conta-bancaria",
    table: "tipos_conta_bancaria",
    label: "Tipos de Conta Bancária",
    description: "Conta corrente, poupança, caixa em espécie, aplicação.",
    orderBy: "ordem, nome",
    permKey: "settings_tipos_conta_bancaria",
    activeField: "ativo",
    fields: [
      { key: "codigo", label: "Código", type: "text", required: true, inList: true },
      { key: "nome", label: "Nome", type: "text", required: true, inList: true },
      { key: "ordem", label: "Ordem", type: "number", inList: true },
      { key: "ativo", label: "Ativo", type: "boolean", inList: true },
      { key: "is_default", label: "Padrão", type: "boolean", inList: true },
    ],
  },

  "church-functions": {
    key: "church-functions",
    table: "church_function_catalog",
    label: "Funções da Igreja",
    description:
      "Catálogo de funções (Dirigente, Esposa de Dirigente, Líder de Jovens...) usado no perfil do membro e na igreja.",
    orderBy: "name",
    permKey: "settings_church_functions",
    activeField: "is_active",
    warning:
      "Funções já atribuídas a membros não podem ser excluídas — desative-as em vez de excluir.",
    fields: [
      { key: "name", label: "Nome", type: "text", required: true, inList: true },
      { key: "abbreviation", label: "Abreviação", type: "text", inList: true },
      { key: "is_active", label: "Ativa", type: "boolean", inList: true },
      { key: "is_leader_role", label: "É função de dirigente", type: "boolean", inList: true, help: "Só pode haver uma ativa por igreja." },
      { key: "is_board_role", label: "É função de diretoria", type: "boolean" },
      { key: "allow_men", label: "Permite homens", type: "boolean" },
      { key: "allow_women", label: "Permite mulheres", type: "boolean" },
    ],
  },

  "ecclesiastical-titles": {
    key: "ecclesiastical-titles",
    table: "ecclesiastical_titles",
    label: "Títulos Eclesiásticos",
    description: "Títulos como Membro, Diácono, Presbítero, Evangelista, Pastor.",
    orderBy: "display_order NULLS LAST, name",
    permKey: "settings_ecclesiastical_titles",
    activeField: "is_active",
    softDelete: true,
    fields: [
      { key: "name", label: "Nome", type: "text", required: true, inList: true },
      { key: "abbreviation", label: "Abreviação", type: "text", inList: true },
      { key: "is_active", label: "Ativo", type: "boolean", inList: true },
      { key: "allow_men", label: "Permite homens", type: "boolean" },
      { key: "allow_women", label: "Permite mulheres", type: "boolean" },
    ],
  },

  zonas: {
    key: "zonas",
    table: "zonas",
    label: "Zonas",
    description: "Zonas geográficas das igrejas: Zona Leste, Zona Sul, Centro...",
    orderBy: "display_order NULLS LAST, name",
    permKey: "settings_zonas",
    activeField: "is_active",
    softDelete: true,
    warning: "A igreja guarda o NOME da zona. Renomear aqui não renomeia nas igrejas já cadastradas.",
    fields: [
      { key: "name", label: "Nome", type: "text", required: true, inList: true },
      { key: "abbreviation", label: "Abreviação", type: "text", inList: true },
      { key: "display_order", label: "Ordem", type: "number", inList: true, help: "Define a posição no dropdown." },
      { key: "is_active", label: "Ativa", type: "boolean", inList: true },
    ],
  },
};

export const LOOKUP_LIST = Object.values(LOOKUPS);

export function getLookup(key: string): LookupConfig | null {
  return LOOKUPS[key] ?? null;
}
