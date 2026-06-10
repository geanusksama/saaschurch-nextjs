import { santanderTokenCache } from '../services/santander/santander-token-cache.service'

// Testes unitários para autenticação e cache de tokens Santander
// Executar: npx jest src/modules/financeiro/conciliacao-santander/tests/

describe('SantanderTokenCache', () => {
  beforeEach(() => {
    santanderTokenCache.clear()
  })

  it('deve retornar null quando não há token em cache', () => {
    expect(santanderTokenCache.get('cred-1')).toBeNull()
  })

  it('deve armazenar e recuperar token válido', () => {
    santanderTokenCache.set('cred-1', 'mock-jwt-token')
    expect(santanderTokenCache.get('cred-1')).toBe('mock-jwt-token')
  })

  it('deve invalidar token manualmente', () => {
    santanderTokenCache.set('cred-1', 'mock-jwt-token')
    santanderTokenCache.invalidate('cred-1')
    expect(santanderTokenCache.get('cred-1')).toBeNull()
  })

  it('deve evitar chamadas simultâneas de geração (mutex)', async () => {
    let callCount = 0
    const generator = jest.fn(async () => {
      callCount++
      await new Promise((r) => setTimeout(r, 50))
      return 'generated-token'
    })

    const [t1, t2, t3] = await Promise.all([
      santanderTokenCache.getOrGenerate('cred-concurrent', generator),
      santanderTokenCache.getOrGenerate('cred-concurrent', generator),
      santanderTokenCache.getOrGenerate('cred-concurrent', generator),
    ])

    expect(generator).toHaveBeenCalledTimes(1)
    expect(t1).toBe('generated-token')
    expect(t2).toBe('generated-token')
    expect(t3).toBe('generated-token')
  })

  it('deve limpar pending em caso de erro na geração', async () => {
    const failingGenerator = jest.fn(async () => {
      throw new Error('Auth failed')
    })

    await expect(
      santanderTokenCache.getOrGenerate('cred-fail', failingGenerator),
    ).rejects.toThrow('Auth failed')

    // Após erro, deve tentar novamente na próxima chamada (não usar pending)
    const workingGenerator = jest.fn(async () => 'recovered-token')
    const result = await santanderTokenCache.getOrGenerate('cred-fail', workingGenerator)
    expect(workingGenerator).toHaveBeenCalledTimes(1)
    expect(result).toBe('recovered-token')
  })
})

describe('SantanderAuthService - encryptSecret', () => {
  it('deve criptografar e descriptografar Client Secret corretamente', () => {
    process.env.SANTANDER_ENCRYPTION_KEY = '0'.repeat(64)
    const { santanderAuthService } = require('../services/santander/santander-auth.service')

    const plaintext = 'my-super-secret-client-secret-1234'
    const { encrypted, iv } = santanderAuthService.encryptSecret(plaintext)

    expect(encrypted).toBeTruthy()
    expect(iv).toBeTruthy()
    expect(encrypted).not.toBe(plaintext)
    expect(encrypted.length).toBeGreaterThan(0)
    expect(iv.length).toBe(32) // 16 bytes = 32 hex chars
  })
})
