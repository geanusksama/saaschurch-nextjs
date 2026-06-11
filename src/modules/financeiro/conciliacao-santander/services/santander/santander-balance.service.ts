import { santanderGet, type SantanderRequestConfig } from './santander-api-client'

// Consulta saldo de conta bancária Santander
// GET /bank_account_information/v1/banks/{bank_id}/balances/{balance_id}
//
// balance_id : LPAD(branchCode,4) + '.' + LPAD(accountNumber,12)
//              ex: "0770.000013001496"
// bank_id    : "0033" para Santander
//
// ATENÇÃO: a API retorna amounts como STRING ("100.00"), não número.

interface BalanceResponse {
  availableAmount?: string | number
  availableAmountCurrency?: string
  blockedAmount?: string | number
  blockedAmountCurrency?: string
  automaticallyInvestedAmount?: string | number
  automaticallyInvestedAmountCurrency?: string
}

export interface SantanderBalance {
  balance_id: string
  available_amount: number
  blocked_amount: number
  automatically_invested_amount: number
  queried_at: Date
}

function toFloat(value: string | number | undefined): number {
  if (value === undefined || value === null) return 0
  return typeof value === 'string' ? parseFloat(value) : value
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
      // Caminho correto: /banks/{bank_id}/balances/{balance_id}
      // (não /banks/banks — era typo na versão anterior)
      `/bank_account_information/v1/banks/${bankId}/balances/${balanceId}`,
    )

    return {
      balance_id: balanceId,
      available_amount:              toFloat(response.availableAmount),
      blocked_amount:                toFloat(response.blockedAmount),
      automatically_invested_amount: toFloat(response.automaticallyInvestedAmount),
      queried_at: new Date(),
    }
  }
}

export const santanderBalanceService = new SantanderBalanceService()
