// DTOs do módulo de Conciliação Bancária Santander
// Todos os tipos TypeScript para request/response e modelo interno

// ─── Enums ───────────────────────────────────────────────────────────────────

export type SantanderAmbiente = 'sandbox' | 'producao'

export type SantanderMovimentoStatus =
  | 'novo'
  | 'match_exato'
  | 'match_sugerido'
  | 'sem_lancamento'
  | 'sem_movimento_bancario'
  | 'conciliado'
  | 'ignorado'
  | 'lancado'
  | 'duplicado'

export type SantanderMovimentoSource = 'api' | 'febraban' | 'importacao'

export type SantanderCreditDebitType = 'C' | 'D'

export type SantanderConciliacaoTipo = 'automatico' | 'manual' | 'sugerido'

// ─── Credenciais ─────────────────────────────────────────────────────────────

/** Retorno público de credencial — sem secrets */
export interface SantanderCredentialDto {
  id: string
  empresa_id: string
  campo: string
  apelido: string
  ambiente: SantanderAmbiente
  client_id_masked: string // primeiros/últimos 4 chars visíveis
  bank_id: string
  certificate_expires_at: string | null
  tolerance_days: number
  ativo: boolean
  created_at: string
  updated_at: string
  created_by: string | null
}

/** Body para criar credencial */
export interface CreateCredentialDto {
  empresa_id: string
  apelido: string
  ambiente: SantanderAmbiente
  client_id: string
  client_secret: string       // recebido em claro, imediatamente criptografado no backend
  bank_id: string
  certificate_public: string  // conteúdo PEM do certificado público
  certificate_private: string // conteúdo PEM da chave privada — tratado no backend, nunca armazenado em DB
  certificate_expires_at?: string
  tolerance_days?: number
}

/** Body para atualizar credencial */
export type UpdateCredentialDto = Partial<Omit<CreateCredentialDto, 'ambiente'>>

// ─── Contas ───────────────────────────────────────────────────────────────────

export interface SantanderAccountDto {
  id: string
  credential_id: string
  account_id: string
  bank_id: string
  compe_code: string | null
  branch_code: string
  account_number: string
  account_digit: string | null
  display_name: string
  igreja_id: number | null
  statement_id: string // derivado: branch_code.account_number (padded)
  ativa: boolean
  created_at: string
}

// ─── Saldo ────────────────────────────────────────────────────────────────────

export interface SantanderBalanceDto {
  balance_id: string
  available_amount: number
  blocked_amount: number
  automatically_invested_amount: number
  queried_at: string
}

// ─── Movimentos ──────────────────────────────────────────────────────────────

export interface SantanderMovimentoDto {
  id: string
  credential_id: string
  santander_account_id: string
  account_id: string
  transaction_id: string | null
  transaction_date: string      // YYYY-MM-DD
  accounting_date: string | null
  amount: number
  credit_debit_type: SantanderCreditDebitType
  transaction_name: string | null
  category_code: string | null
  history_code: string | null
  history_description: string | null
  document_number: string | null
  complement: string | null
  source: SantanderMovimentoSource
  status: SantanderMovimentoStatus
  livro_caixa_id: number | null
  hash_unico: string
  created_at: string
  updated_at: string
  imported_by: string | null
}

/** Resposta normalizada de um movimento da API Santander (antes de salvar) */
export interface SantanderApiMovimento {
  transactionDate: string
  accountingDate?: string
  amount: number
  creditDebitType: SantanderCreditDebitType
  transactionName?: string
  categoryCode?: string
  historyCode?: string
  historyDescription?: string
  documentNumber?: string
  complement?: string
  rawPayload?: Record<string, unknown>
}

// ─── Consulta de Extrato ─────────────────────────────────────────────────────

export interface TransactionsQueryDto {
  credential_id: string
  account_id: string       // UUID da conta local
  from: string             // YYYY-MM-DD
  to?: string              // YYYY-MM-DD (padrão: hoje)
  type?: 'all' | 'credit' | 'debit'
  status?: SantanderMovimentoStatus
  page?: number
  limit?: number
}

export interface TransactionsResponseDto {
  movimentos: SantanderMovimentoDto[]
  summary: {
    total_credito: number
    total_debito: number
    saldo_periodo: number
    total_novo: number
    total_duplicado: number
    total_conciliado: number
    total_lancado: number
    total_ignorado: number
  }
  pagination: {
    page: number
    limit: number
    total: number
    hasMore: boolean
  }
  sync_log_id: string
}

// ─── Conciliação ─────────────────────────────────────────────────────────────

export interface SantanderConciliacaoDto {
  id: string
  santander_movimento_id: string
  livro_caixa_id: number
  tipo_match: SantanderConciliacaoTipo
  score_match: number | null
  status: 'ativo' | 'desfeito'
  observacao: string | null
  conciliado_por: string
  conciliado_em: string
  created_at: string
}

export interface ConciliarDto {
  santander_movimento_id: string
  livro_caixa_id: number
  tipo_match: SantanderConciliacaoTipo
  observacao?: string
}

export interface MatchSugestao {
  movimento: SantanderMovimentoDto
  candidatos: Array<{
    livro_caixa_id: number
    data_lancamento: string
    valor: number
    tipo: string
    favorecido: string | null
    plano_de_conta: string | null
    score: number
    diferencaDias: number
  }>
}

// ─── Lançamento no Livro Caixa ───────────────────────────────────────────────

export interface LancarNoLivroCaixaDto {
  santander_movimento_id: string
  church_id: string
  plano_de_conta: string
  centro_de_custo?: string
  favorecido_nome?: string
  favorecido_tipo?: 'MEMBRO' | 'NAO_MEMBRO' | 'PJ' | 'IGREJA'
  forma_pagamento?: string
  observacao?: string
  data_referencia?: string  // MM/AAAA
}

export interface LancarNoLivroCaixaResponseDto {
  livro_caixa_id: number
  santander_movimento_id: string
  conciliacao_id: string
  message: string
}

// ─── Sync Log ────────────────────────────────────────────────────────────────

export interface SantanderSyncLogDto {
  id: string
  credential_id: string
  account_id: string
  data_inicio: string
  data_fim: string
  status: 'sucesso' | 'erro' | 'parcial'
  source: SantanderMovimentoSource
  total_importado: number
  total_duplicado: number
  total_erro: number
  error_message: string | null
  started_at: string
  finished_at: string | null
  created_by: string | null
}

// ─── Exportação ──────────────────────────────────────────────────────────────

export type ExportType = 'espelho_santander' | 'espelho_livro_caixa' | 'conciliacao'
export type ExportFormat = 'pdf' | 'csv'

export interface ExportQueryDto {
  type: ExportType
  credential_id: string
  account_id: string
  from: string
  to: string
  format?: ExportFormat
}

// ─── Permissões ──────────────────────────────────────────────────────────────

export type SantanderPermission =
  | 'financeiro.santander.visualizar'
  | 'financeiro.santander.configurar'
  | 'financeiro.santander.consultar'
  | 'financeiro.santander.importar'
  | 'financeiro.santander.conciliar'
  | 'financeiro.santander.lancar_livro_caixa'
  | 'financeiro.santander.ignorar'
  | 'financeiro.santander.exportar'
  | 'financeiro.santander.auditoria'
