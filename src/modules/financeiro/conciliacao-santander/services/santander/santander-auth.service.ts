import https from 'https'
import crypto from 'crypto'
import { santanderTokenCache } from './santander-token-cache.service'
import { santanderCertificateService } from './santander-certificate.service'

// Geração de Access Token Santander via OAuth2 + mTLS
// Refs:
//   Token sandbox:    POST https://trust-sandbox.api.santander.com.br/auth/oauth/v2/token
//   Token produção:   POST https://trust-open.api.santander.com.br/auth/oauth/v2/token
// Token JWT válido por 900s (15 min). Cache em memória por 840s.

const TOKEN_URLS = {
  sandbox:  'https://trust-sandbox.api.santander.com.br/auth/oauth/v2/token',
  producao: 'https://trust-open.api.santander.com.br/auth/oauth/v2/token',
} as const

interface CredentialConfig {
  id: string
  ambiente: 'sandbox' | 'producao'
  client_id: string
  client_secret_encrypted: string
  client_secret_iv: string
  certificate_public_path: string
  certificate_private_ref: string
  certificate_expires_at: Date | null
}

class SantanderAuthService {
  // Lazy: a chave só é carregada quando realmente usada, não no startup
  private _encryptionKey: Buffer | null = null

  private get encryptionKey(): Buffer {
    if (this._encryptionKey) return this._encryptionKey
    const keyHex = process.env.SANTANDER_ENCRYPTION_KEY
    if (!keyHex || keyHex.length !== 64) {
      throw new Error('SANTANDER_ENCRYPTION_KEY inválida: deve ser 32 bytes hex (64 chars)')
    }
    this._encryptionKey = Buffer.from(keyHex, 'hex')
    return this._encryptionKey
  }

  /** Retorna token válido para a credencial. Usa cache ou renova automaticamente. */
  async getToken(credential: CredentialConfig): Promise<string> {
    return santanderTokenCache.getOrGenerate(credential.id, () =>
      this.generateToken(credential),
    )
  }

  /** Gera novo token na API Santander via OAuth2 client_credentials + mTLS */
  private async generateToken(credential: CredentialConfig): Promise<string> {
    this.validateCertificate(credential)

    const clientSecret = this.decryptSecret(
      credential.client_secret_encrypted,
      credential.client_secret_iv,
    )

    const { cert, key } = santanderCertificateService.loadCertificate(
      credential.certificate_public_path,
      credential.certificate_private_ref,
    )

    const agent = new https.Agent({
      cert,
      key,
      rejectUnauthorized: true, // NUNCA false em produção
    })

    const body = new URLSearchParams({
      client_id: credential.client_id,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    })

    const tokenUrl = TOKEN_URLS[credential.ambiente]

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      // @ts-expect-error Node.js fetch aceita dispatcher/agent via undici
      dispatcher: agent,
    })

    if (!response.ok) {
      // Não logar corpo da resposta — pode conter informações sensíveis
      throw Object.assign(
        new Error(`Autenticação Santander falhou: HTTP ${response.status}`),
        { code: 'SANTANDER_AUTH_FAILED', status: response.status },
      )
    }

    const data = await response.json() as { access_token?: string }

    if (!data.access_token) {
      throw Object.assign(
        new Error('Resposta da API Santander não contém access_token'),
        { code: 'SANTANDER_AUTH_FAILED' },
      )
    }

    return data.access_token
  }

  /** Descriptografa Client Secret usando AES-256-CBC */
  private decryptSecret(encryptedHex: string, ivHex: string): string {
    const iv = Buffer.from(ivHex, 'hex')
    const encrypted = Buffer.from(encryptedHex, 'hex')
    const decipher = crypto.createDecipheriv('aes-256-cbc', this.encryptionKey, iv)
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf-8')
  }

  /** Criptografa Client Secret para armazenamento seguro */
  encryptSecret(plaintext: string): { encrypted: string; iv: string } {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv)
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()])
    return {
      encrypted: encrypted.toString('hex'),
      iv: iv.toString('hex'),
    }
  }

  /** Valida se o certificado ainda é válido antes de tentar autenticar */
  private validateCertificate(credential: CredentialConfig): void {
    if (!credential.certificate_expires_at) return

    const info = santanderCertificateService.checkStatus(
      credential.certificate_public_path,
      credential.certificate_private_ref,
      credential.certificate_expires_at,
    )

    if (info.isExpired) {
      throw Object.assign(
        new Error('Certificado Santander vencido. Renove o certificado para continuar.'),
        { code: 'SANTANDER_CERT_EXPIRED' },
      )
    }
  }
}

export const santanderAuthService = new SantanderAuthService()
