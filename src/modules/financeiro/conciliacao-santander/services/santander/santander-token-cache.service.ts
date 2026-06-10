// Cache seguro de Access Tokens Santander em memória
// Tokens NUNCA são armazenados em banco ou retornados ao frontend
// TTL = 840s (14 min) — 1 min de margem antes do vencimento real de 900s (15 min)

const TOKEN_TTL_MS = 840_000

interface CachedToken {
  token: string
  expiresAt: number // Date.now() + TOKEN_TTL_MS
}

// Mutex simples por credentialId para evitar race condition
// em chamadas simultâneas que tentariam gerar token ao mesmo tempo
interface PendingRequest {
  promise: Promise<string>
}

class SantanderTokenCache {
  private readonly cache = new Map<string, CachedToken>()
  private readonly pending = new Map<string, PendingRequest>()

  get(credentialId: string): string | null {
    const entry = this.cache.get(credentialId)
    if (!entry) return null
    if (Date.now() >= entry.expiresAt) {
      this.cache.delete(credentialId)
      return null
    }
    return entry.token
  }

  set(credentialId: string, token: string): void {
    this.cache.set(credentialId, {
      token,
      expiresAt: Date.now() + TOKEN_TTL_MS,
    })
  }

  invalidate(credentialId: string): void {
    this.cache.delete(credentialId)
    this.pending.delete(credentialId)
  }

  /** Executa fn para obter token com proteção contra chamadas simultâneas */
  async getOrGenerate(
    credentialId: string,
    generator: () => Promise<string>,
  ): Promise<string> {
    const cached = this.get(credentialId)
    if (cached) return cached

    // Se já há uma geração em andamento para este credentialId, aguardar a mesma
    const existing = this.pending.get(credentialId)
    if (existing) return existing.promise

    const promise = generator().then((token) => {
      this.set(credentialId, token)
      this.pending.delete(credentialId)
      return token
    }).catch((err) => {
      this.pending.delete(credentialId)
      throw err
    })

    this.pending.set(credentialId, { promise })
    return promise
  }

  // Para testes e limpeza
  clear(): void {
    this.cache.clear()
    this.pending.clear()
  }
}

// Singleton: uma instância por processo Node.js
export const santanderTokenCache = new SantanderTokenCache()
