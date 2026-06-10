import https from 'https'
import { santanderCertificateService } from './santander-certificate.service'

// Cliente HTTP base para todas as chamadas à API Santander
// Aplica mTLS, headers obrigatórios e rate limiting (10 TPS)

const BASE_URLS = {
  sandbox:  'https://trust-sandbox.api.santander.com.br',
  producao: 'https://trust-open.api.santander.com.br',
} as const

// Rate limiter: máximo 10 req/s (limite global Santander)
class RateLimiter {
  private readonly maxPerSecond = 10
  private tokens: number
  private lastRefill: number

  constructor() {
    this.tokens = this.maxPerSecond
    this.lastRefill = Date.now()
  }

  async acquire(): Promise<void> {
    this.refill()
    if (this.tokens > 0) {
      this.tokens--
      return
    }
    // Aguardar até próximo token disponível
    await new Promise<void>((resolve) => setTimeout(resolve, 1000 / this.maxPerSecond))
    return this.acquire()
  }

  private refill(): void {
    const now = Date.now()
    const elapsed = now - this.lastRefill
    const newTokens = Math.floor((elapsed / 1000) * this.maxPerSecond)
    if (newTokens > 0) {
      this.tokens = Math.min(this.maxPerSecond, this.tokens + newTokens)
      this.lastRefill = now
    }
  }
}

const rateLimiter = new RateLimiter()

export interface SantanderRequestConfig {
  ambiente: 'sandbox' | 'producao'
  accessToken: string
  clientId: string
  certificatePublicPath: string
  certificatePrivateRef: string
}

export interface SantanderApiError {
  _errorCode?: string
  _message?: string
  _details?: string
  _timestamp?: string
  _traceId?: string
  _errors?: Array<{ _code: number; _field: string; _message: string }>
}

export async function santanderGet<T>(
  config: SantanderRequestConfig,
  path: string,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  await rateLimiter.acquire()

  const { cert, key } = santanderCertificateService.loadCertificate(
    config.certificatePublicPath,
    config.certificatePrivateRef,
  )

  const agent = new https.Agent({
    cert,
    key,
    rejectUnauthorized: true,
  })

  const baseUrl = BASE_URLS[config.ambiente]
  const url = new URL(`${baseUrl}${path}`)

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v))
    }
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${config.accessToken}`,
      'X-Application-Key': config.clientId,
      'Content-Type': 'application/json',
    },
    // @ts-expect-error Node.js fetch via undici
    dispatcher: agent,
  })

  if (!response.ok) {
    let errorBody: SantanderApiError = {}
    try {
      errorBody = await response.json() as SantanderApiError
    } catch {
      // ignore parse error
    }

    const code = response.status === 401 ? 'SANTANDER_AUTH_FAILED'
      : response.status === 429 ? 'SANTANDER_RATE_LIMIT'
      : response.status === 404 ? 'SANTANDER_ACCOUNT_NOT_FOUND'
      : 'SANTANDER_API_ERROR'

    throw Object.assign(
      new Error(errorBody._message ?? `API Santander retornou HTTP ${response.status}`),
      { code, status: response.status, traceId: errorBody._traceId },
    )
  }

  return response.json() as Promise<T>
}
