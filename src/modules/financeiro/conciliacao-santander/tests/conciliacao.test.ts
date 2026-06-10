// Testes de integração básicos para o módulo de conciliação
// Para testes completos com banco: usar environment de teste com banco separado

describe('Permissões Santander', () => {
  const ALL_PERMISSIONS = [
    'financeiro.santander.visualizar',
    'financeiro.santander.configurar',
    'financeiro.santander.consultar',
    'financeiro.santander.importar',
    'financeiro.santander.conciliar',
    'financeiro.santander.lancar_livro_caixa',
    'financeiro.santander.ignorar',
    'financeiro.santander.exportar',
    'financeiro.santander.auditoria',
  ]

  it('deve ter 9 permissões distintas definidas', () => {
    expect(ALL_PERMISSIONS).toHaveLength(9)
  })

  it('todas as permissões devem iniciar com financeiro.santander.', () => {
    ALL_PERMISSIONS.forEach((p) => {
      expect(p.startsWith('financeiro.santander.')).toBe(true)
    })
  })
})

describe('Regras de Conciliação', () => {
  function calcScore(
    bankDate: string,
    lcDate: string,
    bankAmount: number,
    lcAmount: number,
    toleranceDays: number,
  ): number {
    const diffDays = Math.abs(
      (new Date(bankDate).getTime() - new Date(lcDate).getTime()) / 86400000,
    )
    const sameValue = Math.abs(bankAmount - lcAmount) < 0.01
    if (!sameValue) return 0
    if (diffDays === 0) return 100
    if (diffDays <= toleranceDays) return Math.round(90 - (diffDays * 15))
    return 0
  }

  it('deve retornar score 100 para match exato (mesma data e valor)', () => {
    expect(calcScore('2026-06-10', '2026-06-10', 1500.00, 1500.00, 2)).toBe(100)
  })

  it('deve retornar score < 100 para match com diferença de 1 dia', () => {
    const score = calcScore('2026-06-10', '2026-06-11', 1500.00, 1500.00, 2)
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(100)
  })

  it('deve retornar score 0 para valor diferente', () => {
    expect(calcScore('2026-06-10', '2026-06-10', 1500.00, 1500.01, 2)).toBe(0)
  })

  it('deve retornar score 0 para data fora da tolerância', () => {
    expect(calcScore('2026-06-10', '2026-06-15', 1500.00, 1500.00, 2)).toBe(0)
  })
})

describe('Geração de hash de deduplicação', () => {
  it('campos nulos não devem causar erro na geração de hash', () => {
    const { santanderTransactionsService } = require('../services/santander/santander-transactions.service')
    expect(() =>
      santanderTransactionsService.generateHash('acc-1', '2026-06-10', 0.01, 'C', null, null),
    ).not.toThrow()
  })
})

describe('Parser FEBRABAN 240 - casos extremos', () => {
  const { febraban240Parser } = require('../services/febraban240/febraban240-parser.service')

  it('não deve lançar erro para arquivo vazio', () => {
    expect(() => febraban240Parser.parse('')).not.toThrow()
  })

  it('não deve lançar erro para arquivo com apenas whitespace', () => {
    expect(() => febraban240Parser.parse('   \n   \n')).not.toThrow()
  })

  it('deve converter valor zero corretamente', () => {
    expect(febraban240Parser.parseValor('000000000000000000')).toBe(0)
  })

  it('deve converter datas inválidas para null', () => {
    expect(febraban240Parser.parseData('')).toBeNull()
    expect(febraban240Parser.parseData('00000000')).toBeNull()
  })
})
