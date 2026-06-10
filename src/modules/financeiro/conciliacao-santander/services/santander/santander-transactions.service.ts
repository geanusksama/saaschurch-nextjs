import crypto from 'crypto'
import { santanderGet, type SantanderRequestConfig } from './santander-api-client'
import type { SantanderApiMovimento } from '../../dtos/santander.dto'

// Consulta extrato de movimentos Santander (efetivados + provisionados)
//
// Efetivados:   GET /bank_account_information/v1/transactions/{transaction_id}
// Provisionados: GET /bank_account_information/v1/provisioneds/{provisioned_id}
//
// transaction_id / provisioned_id: LPAD(branch, 4) + '.' + LPAD(account, 12)
// Paginação: _limit (1-750), _nextPage (cursor da resposta anterior)

interface ApiTransaction {
  creditDebitType?: string
  transactionName?: string
  amount?: number
  transactionDate?: string
  accountingDate?: string
  categoryCode?: string
  historyCode?: string
  historyDescription?: string
  documentNumber?: string
  complement?: string
}

interface TransactionsApiResponse {
  _content?: ApiTransaction[]
  _pageable?: {
    _totalRecords?: number
    paging?: string
  }
}

class SantanderTransactionsService {
  private readonly PAGE_SIZE = 750

  /** Busca todos os movimentos efetivados de um período (paginação automática) */
  async getEffective(
    config: SantanderRequestConfig,
    branchCode: string,
    accountNumber: string,
    initialDate: string,
    finalDate: string,
  ): Promise<SantanderApiMovimento[]> {
    const transactionId = this.buildId(branchCode, accountNumber)
    return this.fetchAll(config, 'transactions', transactionId, initialDate, finalDate)
  }

  /** Busca todos os movimentos provisionados de um período */
  async getProvisioned(
    config: SantanderRequestConfig,
    branchCode: string,
    accountNumber: string,
    initialDate: string,
    finalDate: string,
  ): Promise<SantanderApiMovimento[]> {
    const provisionedId = this.buildId(branchCode, accountNumber)
    return this.fetchAll(config, 'provisioneds', provisionedId, initialDate, finalDate)
  }

  /** Busca efetivados + provisionados unificados */
  async getAll(
    config: SantanderRequestConfig,
    branchCode: string,
    accountNumber: string,
    initialDate: string,
    finalDate: string,
  ): Promise<SantanderApiMovimento[]> {
    const [effective, provisioned] = await Promise.all([
      this.getEffective(config, branchCode, accountNumber, initialDate, finalDate),
      this.getProvisioned(config, branchCode, accountNumber, initialDate, finalDate),
    ])

    return [...effective, ...provisioned]
  }

  /** Gera hash SHA-256 único para deduplicação de movimentos */
  generateHash(
    accountId: string,
    transactionDate: string,
    amount: number,
    creditDebitType: string,
    documentNumber: string | null | undefined,
    historyCode: string | null | undefined,
  ): string {
    const data = [
      accountId,
      transactionDate,
      amount.toFixed(2),
      creditDebitType,
      documentNumber ?? '',
      historyCode ?? '',
    ].join('|')

    return crypto.createHash('sha256').update(data, 'utf-8').digest('hex')
  }

  private buildId(branchCode: string, accountNumber: string): string {
    return `${branchCode.padStart(4, '0')}.${accountNumber.padStart(12, '0')}`
  }

  private async fetchAll(
    config: SantanderRequestConfig,
    endpoint: 'transactions' | 'provisioneds',
    id: string,
    initialDate: string,
    finalDate: string,
  ): Promise<SantanderApiMovimento[]> {
    const results: SantanderApiMovimento[] = []
    let nextPage: string | undefined

    do {
      const params: Record<string, string | number | undefined> = {
        initialDate,
        finalDate,
        _limit: this.PAGE_SIZE,
        _nextPage: nextPage,
      }

      const response = await santanderGet<TransactionsApiResponse>(
        config,
        `/bank_account_information/v1/${endpoint}/${id}`,
        params,
      )

      const items = response._content ?? []
      results.push(...items.map(this.normalize))

      nextPage = response._pageable?.paging
    } while (nextPage)

    return results
  }

  private normalize(tx: ApiTransaction): SantanderApiMovimento {
    return {
      transactionDate: tx.transactionDate ?? new Date().toISOString().split('T')[0],
      accountingDate: tx.accountingDate,
      amount: Math.abs(tx.amount ?? 0),
      creditDebitType: (tx.creditDebitType === 'D' ? 'D' : 'C') as 'C' | 'D',
      transactionName: tx.transactionName,
      categoryCode: tx.categoryCode,
      historyCode: tx.historyCode,
      historyDescription: tx.historyDescription,
      documentNumber: tx.documentNumber,
      complement: tx.complement,
      // raw_payload sanitizado: sem tokens
      rawPayload: { transactionName: tx.transactionName, amount: tx.amount, creditDebitType: tx.creditDebitType },
    }
  }
}

export const santanderTransactionsService = new SantanderTransactionsService()
