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

export type LookupFieldType = "text" | "boolean" | "select";

export type LookupField = {
  key: string;
  label: string;
  type: LookupFieldType;
  required?: boolean;
  /** Opções para type: 'select'. */
  options?: { value: string; label: string }[];
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
};

export const LOOKUP_LIST = Object.values(LOOKUPS);

export function getLookup(key: string): LookupConfig | null {
  return LOOKUPS[key] ?? null;
}
