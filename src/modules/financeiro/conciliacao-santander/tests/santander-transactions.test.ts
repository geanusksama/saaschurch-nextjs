import { santanderTransactionsService } from '../services/santander/santander-transactions.service'

describe('SantanderTransactionsService - generateHash', () => {
  const base = {
    accountId: '0001.000010331607',
    transactionDate: '2026-06-10',
    amount: 1500.00,
    creditDebitType: 'C',
    documentNumber: '123456',
    historyCode: '0001',
  }

  it('deve gerar hash SHA-256 de 64 chars', () => {
    const hash = santanderTransactionsService.generateHash(
      base.accountId, base.transactionDate, base.amount,
      base.creditDebitType, base.documentNumber, base.historyCode,
    )
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('deve gerar hash diferente para valores diferentes', () => {
    const h1 = santanderTransactionsService.generateHash(
      base.accountId, base.transactionDate, 1500.00, 'C', '123456', '0001',
    )
    const h2 = santanderTransactionsService.generateHash(
      base.accountId, base.transactionDate, 1500.01, 'C', '123456', '0001',
    )
    expect(h1).not.toBe(h2)
  })

  it('deve gerar hash diferente para tipos diferentes (C vs D)', () => {
    const hCredit = santanderTransactionsService.generateHash(
      base.accountId, base.transactionDate, base.amount, 'C', null, null,
    )
    const hDebit = santanderTransactionsService.generateHash(
      base.accountId, base.transactionDate, base.amount, 'D', null, null,
    )
    expect(hCredit).not.toBe(hDebit)
  })

  it('deve gerar hash idêntico para mesmos dados (determinístico)', () => {
    const h1 = santanderTransactionsService.generateHash(
      base.accountId, base.transactionDate, base.amount,
      base.creditDebitType, base.documentNumber, base.historyCode,
    )
    const h2 = santanderTransactionsService.generateHash(
      base.accountId, base.transactionDate, base.amount,
      base.creditDebitType, base.documentNumber, base.historyCode,
    )
    expect(h1).toBe(h2)
  })

  it('deve lidar com documentNumber e historyCode nulos', () => {
    const hash = santanderTransactionsService.generateHash(
      base.accountId, base.transactionDate, base.amount, 'C', null, undefined,
    )
    expect(hash).toHaveLength(64)
  })
})
