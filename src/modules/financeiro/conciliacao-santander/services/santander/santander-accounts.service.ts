import { santanderGet, type SantanderRequestConfig } from './santander-api-client'

// Consulta lista de contas bancárias via API Santander
// GET /bank_account_information/v1/banks/{bank_id}/accounts
// Paginação: _limit (1-50), _offset

interface SantanderApiAccount {
  compeCode?: string
  branchCode: string
  number: string
  accountId: string
  digit?: string
}

interface AccountsResponse {
  _content?: SantanderApiAccount[]
  _pageable?: {
    _totalRecords?: number
  }
}

export interface NormalizedAccount {
  account_id: string
  compe_code: string | null
  branch_code: string
  account_number: string
  account_digit: string | null
  /** Formato: LPAD(branch, 4) + '.' + LPAD(account, 12) */
  statement_id: string
}

class SantanderAccountsService {
  private readonly PAGE_SIZE = 50

  /** Busca todas as contas de uma credencial (paginação automática) */
  async listAllAccounts(
    config: SantanderRequestConfig,
    bankId: string,
  ): Promise<NormalizedAccount[]> {
    const accounts: NormalizedAccount[] = []
    let offset = 0
    let hasMore = true

    while (hasMore) {
      const response = await santanderGet<AccountsResponse>(
        config,
        `/bank_account_information/v1/banks/${bankId}/accounts`,
        { _limit: this.PAGE_SIZE, _offset: offset },
      )

      const items = response._content ?? []
      accounts.push(...items.map(this.normalize))

      const total = response._pageable?._totalRecords ?? 0
      offset += items.length
      hasMore = items.length === this.PAGE_SIZE && offset < total
    }

    return accounts
  }

  private normalize(account: SantanderApiAccount): NormalizedAccount {
    const branchPadded = account.branchCode.padStart(4, '0')
    const accountPadded = account.number.padStart(12, '0')
    return {
      account_id: account.accountId,
      compe_code: account.compeCode ?? null,
      branch_code: branchPadded,
      account_number: accountPadded,
      account_digit: account.digit ?? null,
      statement_id: `${branchPadded}.${accountPadded}`,
    }
  }
}

export const santanderAccountsService = new SantanderAccountsService()
