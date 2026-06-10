import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

// Valida, carrega e monitora certificados digitais Santander
// Requisitos: ICP A1, PEM/CER/CRT, 2048 bits min, 90 dias min, cadeia completa

export interface CertificateInfo {
  publicPath: string
  privatePath: string
  expiresAt: Date | null
  daysUntilExpiry: number | null
  isExpired: boolean
  isNearExpiry: boolean // < 30 dias
  isCritical: boolean   // < 7 dias
}

export interface LoadedCertificate {
  cert: Buffer  // certificado público
  key: Buffer   // chave privada
}

class SantanderCertificateService {
  private readonly NEAR_EXPIRY_DAYS = 30
  private readonly CRITICAL_EXPIRY_DAYS = 7

  /** Verifica status de um certificado a partir dos paths */
  checkStatus(publicPath: string, privateRef: string, expiresAt: Date | null): CertificateInfo {
    const now = new Date()
    let daysUntilExpiry: number | null = null
    let isExpired = false
    let isNearExpiry = false
    let isCritical = false

    if (expiresAt) {
      daysUntilExpiry = Math.floor(
        (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      )
      isExpired = daysUntilExpiry <= 0
      isNearExpiry = daysUntilExpiry <= this.NEAR_EXPIRY_DAYS
      isCritical = daysUntilExpiry <= this.CRITICAL_EXPIRY_DAYS
    }

    return {
      publicPath,
      privatePath: privateRef,
      expiresAt,
      daysUntilExpiry,
      isExpired,
      isNearExpiry,
      isCritical,
    }
  }

  /** Carrega o par de certificados para uso no mTLS */
  loadCertificate(publicPath: string, privateRef: string): LoadedCertificate {
    this.validatePaths(publicPath, privateRef)

    const resolvedPublic = path.resolve(publicPath)
    const resolvedPrivate = path.resolve(privateRef)

    if (!fs.existsSync(resolvedPublic)) {
      throw new Error(`Certificado público não encontrado: ${resolvedPublic}`)
    }
    if (!fs.existsSync(resolvedPrivate)) {
      throw new Error('Chave privada não encontrada no caminho referenciado')
    }

    const cert = fs.readFileSync(resolvedPublic)
    const key = fs.readFileSync(resolvedPrivate)

    this.validatePemFormat(cert, 'CERTIFICATE')
    this.validatePemFormat(key, 'PRIVATE KEY')

    return { cert, key }
  }

  /** Verifica se os paths não contêm path traversal */
  private validatePaths(publicPath: string, privatePath: string): void {
    const safePaths = [
      process.env.SANTANDER_CERT_BASE_DIR || '/app/secure/certs',
    ]

    const resolvedPublic = path.resolve(publicPath)
    const resolvedPrivate = path.resolve(privatePath)

    const isPublicSafe = safePaths.some((dir) => resolvedPublic.startsWith(dir))
    const isPrivateSafe = safePaths.some((dir) => resolvedPrivate.startsWith(dir))

    if (!isPublicSafe || !isPrivateSafe) {
      throw new Error('Path do certificado fora do diretório permitido')
    }
  }

  /** Valida que o buffer é um PEM válido do tipo esperado */
  private validatePemFormat(buffer: Buffer, type: 'CERTIFICATE' | 'PRIVATE KEY'): void {
    const content = buffer.toString('utf-8')
    if (!content.includes(`-----BEGIN ${type}-----`)) {
      throw new Error(`Formato inválido: esperado PEM ${type}`)
    }
  }

  /** Extrai a data de expiração de um PEM de certificado usando node:crypto */
  extractExpiryFromPem(pemContent: string): Date | null {
    try {
      const cert = new crypto.X509Certificate(pemContent)
      return new Date(cert.validTo)
    } catch {
      return null
    }
  }
}

export const santanderCertificateService = new SantanderCertificateService()
