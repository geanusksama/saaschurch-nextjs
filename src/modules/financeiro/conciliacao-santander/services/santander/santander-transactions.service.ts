import crypto from 'crypto'
import { santanderGet, type SantanderRequestConfig } from './santander-api-client'
import type { SantanderApiMovimento } from '../../dtos/santander.dto'

// Consulta extrato via endpoint /statements (API Open Banking Santander)
//
// GET /bank_account_information/v1/banks/{bank_id}/statements
//   ?branchCode=XXXX&accountNumber=XXXXXXXXXXXX&accountId=XXX&initialDate=YYYY-MM-DD&finalDate=YYYY-MM-DD
//
// bank_id  : "0033" para Santander ou CNPJ sem pontuação (14 dígitos)
// accountId: campo "accountId" retornado pelo endpoint /accounts
// Datas    : ISO YYYY-MM-DD, exatamente 10 chars
//
// Resposta: _pageable._moreElements (boolean) — sem cursor; reduza o período se true

interface StatementsApiItem {
  transactionId?: string
  completedAuthorisedPaymentType?: string   // ex: "TRANSACAO_EFETIVADA"
  creditDebitType?: string                  // "DEBITO" ou "CREDITO"
  transactionName?: string
  type?: string                             // "PIX", "TED", "DOC", "BOLETO", etc.
  amount?: number | string                  // pode vir como string "38.05" ou number -0.1
  transactionCurrency?: string
  transactionDate?: string                  // ISO YYYY-MM-DD
  accountingDate?: string
  partieCnpjCpf?: string
  partiePersonType?: string
  partieCompeCode?: string
  partieBranchCode?: string
  partieNumber?: string
  partieCheckDigit?: string
  // Campos do layout legado / FEBRABAN
  historicComplement?: string
  categoryCode?: string
  historyCode?: string
  documentNumber?: string
  complement?: string
}

interface StatementsApiResponse {
  _pageable?: {
    _moreElements?: boolean
  }
  _content?: StatementsApiItem[]
}

class SantanderTransactionsService {

  /**
   * Busca movimentos do extrato via endpoint /statements
   *
   * @param bankId       "0033" para Santander ou CNPJ (só dígitos, sem pontuação)
   * @param branchCode   Agência (4 dígitos, ex: "0770")
   * @param accountNumber Conta (sem dígito verificador)
   * @param santanderAccountId accountId retornado pelo endpoint /accounts
   * @param initialDate  YYYY-MM-DD
   * @param finalDate    YYYY-MM-DD
   */
  async getStatements(
    config: SantanderRequestConfig,
    bankId: string,
    branchCode: string,
    accountNumber: string,
    santanderAccountId: string,
    initialDate: string,
    finalDate: string,
  ): Promise<SantanderApiMovimento[]> {
    const response = await santanderGet<StatementsApiResponse>(
      config,
      `/bank_account_information/v1/banks/${bankId}/statements`,
      {
        branchCode:    branchCode.padStart(4, '0'),
        accountNumber: accountNumber.padStart(12, '0'),
        accountId:     santanderAccountId,
        initialDate,
        finalDate,
      },
    )

    const items = response._content ?? []

    if (response._pageable?._moreElements) {
      // API sinaliza que há mais registros do que retornou.
      // Reduza o intervalo de datas (ex: semanas em vez de meses) para obter todos.
      console.warn(
        `[Santander] _moreElements=true para período ${initialDate}→${finalDate}. ` +
        'Reduza o intervalo de datas para garantir completude do extrato.',
      )
    }

    return items.map((item) => this.normalize(item))
  }

  /** Alias para compatibilidade — usa getStatements internamente */
  async getAll(
    config: SantanderRequestConfig,
    branchCode: string,
    accountNumber: string,
    initialDate: string,
    finalDate: string,
    bankId = '0033',
    santanderAccountId = '',
  ): Promise<SantanderApiMovimento[]> {
    return this.getStatements(
      config, bankId, branchCode, accountNumber,
      santanderAccountId, initialDate, finalDate,
    )
  }

  /**
   * Gera hash SHA-256 para deduplicação.
   * Usa transactionId (API) ou historyCode (FEBRABAN) como discriminador.
   */
  generateHash(
    accountId: string,
    transactionDate: string,
    amount: number,
    creditDebitType: string,
    documentNumber: string | null | undefined,
    transactionIdOrHistoryCode: string | null | undefined,
  ): string {
    const data = [
      accountId,
      transactionDate,
      amount.toFixed(2),
      creditDebitType,
      documentNumber ?? '',
      transactionIdOrHistoryCode ?? '',
    ].join('|')
    return crypto.createHash('sha256').update(data, 'utf-8').digest('hex')
  }

  private normalize(item: StatementsApiItem): SantanderApiMovimento {
    // creditDebitType: API retorna "DEBITO" / "CREDITO" (palavras completas)
    const creditDebitType = item.creditDebitType === 'DEBITO' ? 'D' : 'C'

    // amount: pode ser string ("38.05") ou number negativo (-0.1 = débito)
    const rawAmount = typeof item.amount === 'string'
      ? parseFloat(item.amount)
      : (item.amount ?? 0)
    const amount = Math.abs(rawAmount)

    return {
      transactionDate:  item.transactionDate ?? new Date().toISOString().split('T')[0],
      accountingDate:   item.accountingDate,
      amount,
      creditDebitType,
      transactionName:  item.transactionName,
      categoryCode:     item.categoryCode,
      historyCode:      item.historyCode ?? item.transactionId,
      historyDescription: item.historicComplement,
      documentNumber:   item.documentNumber,
      complement:       item.complement ?? item.partieNumber,
      // Campos enriquecidos do Open Banking
      type:             item.type,
      transactionId:    item.transactionId,
      partieCnpjCpf:    item.partieCnpjCpf,
      completedAuthorisedPaymentType: item.completedAuthorisedPaymentType,
      rawPayload: {
        transactionId:    item.transactionId,
        type:             item.type,
        creditDebitType:  item.creditDebitType,
        transactionName:  item.transactionName,
        completedAuthorisedPaymentType: item.completedAuthorisedPaymentType,
        partieCnpjCpf:    item.partieCnpjCpf,
        partiePersonType: item.partiePersonType,
      },
    }
  }
}

export const santanderTransactionsService = new SantanderTransactionsService()
