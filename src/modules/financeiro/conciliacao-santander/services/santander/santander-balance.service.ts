import { santanderGet, type SantanderRequestConfig } from './santander-api-client'

// Consulta saldo de conta bancária Santander
// GET /bank_account_information/v1/banks/banks/{bank_id}/balances/{balance_id}
// balance_id: LPAD(branch_code, 4) + '.' + LPAD(account_number, 12)
// Ex: 0001.000010331607

interface BalanceResponse {
  availableAmount?: number
  blockedAmount?: number
  automaticallyInvestedAmount?: number
}

export interface SantanderBalance {
  balance_id: string
  available_amount: number
  blocked_amount: number
  automatically_invested_amount: number
  queried_at: Date
}

class SantanderBalanceService {
  async getBalance(
    config: SantanderRequestConfig,
    bankId: string,
    branchCode: string,
    accountNumber: string,
  ): Promise<SantanderBalance> {
    const balanceId = `${branchCode.padStart(4, '0')}.${accountNumber.padStart(12, '0')}`

    const response = await santanderGet<BalanceResponse>(
      config,
      `/bank_account_information/v1/banks/banks/${bankId}/balances/${balanceId}`,
    )

    return {
      balance_id: balanceId,
      available_amount: response.availableAmount ?? 0,
      blocked_amount: response.blockedAmount ?? 0,
      automatically_invested_amount: response.automaticallyInvestedAmount ?? 0,
      queried_at: new Date(),
    }
  }
}

export const santanderBalanceService = new SantanderBalanceService()
