import { prisma } from '@/lib/prisma'
import { santanderAuthService } from '../services/santander/santander-auth.service'
import { santanderCertificateService } from '../services/santander/santander-certificate.service'
import type { CreateCredentialDto } from '../dtos/santander.dto'
import path from 'path'
import fs from 'fs'

const CERT_BASE_DIR = process.env.SANTANDER_CERT_BASE_DIR || '/app/secure/certs'

class SantanderCredentialsRepository {
  /** Lista credenciais sem retornar secrets */
  async findByCampo(campo: string) {
    return prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT
        id, empresa_id, campo, apelido, ambiente,
        CONCAT(LEFT(client_id, 4), '****', RIGHT(client_id, 4)) as client_id_masked,
        bank_id, certificate_expires_at, tolerance_days, ativo, created_at, updated_at, created_by
      FROM santander_credentials
      WHERE campo = ${campo}
      ORDER BY apelido
    `
  }

  /** Carrega credencial completa (apenas para uso interno no backend) */
  async findFullById(id: string) {
    const [row] = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT *
      FROM santander_credentials
      WHERE id = ${id}::uuid AND ativo = true
    `
    return row ?? null
  }

  async create(data: CreateCredentialDto, createdBy: string): Promise<{ id: string }> {
    const { encrypted, iv } = santanderAuthService.encryptSecret(data.client_secret)

    // Determinar campo a partir da empresa_id (usa empresa_id como campo se não especificado)
    const campo = (data as unknown as Record<string, unknown>).campo as string ?? data.empresa_id

    // Salvar certificado público em arquivo seguro
    const publicPath = path.join(CERT_BASE_DIR, `${data.empresa_id}_${data.ambiente}_public.pem`)
    const privatePath = path.join(CERT_BASE_DIR, `${data.empresa_id}_${data.ambiente}_private.key`)

    fs.mkdirSync(CERT_BASE_DIR, { recursive: true })
    fs.writeFileSync(publicPath, data.certificate_public, { mode: 0o600 })
    fs.writeFileSync(privatePath, data.certificate_private, { mode: 0o600 })

    // Extrair data de vencimento do certificado
    const expiresAt = santanderCertificateService.extractExpiryFromPem(data.certificate_public)
      ?? (data.certificate_expires_at ? new Date(data.certificate_expires_at) : null)

    const [row] = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO santander_credentials (
        empresa_id, campo, apelido, ambiente, client_id,
        client_secret_encrypted, client_secret_iv, bank_id,
        certificate_public_path, certificate_private_ref,
        certificate_expires_at, tolerance_days, created_by
      ) VALUES (
        ${data.empresa_id}, ${campo}, ${data.apelido}, ${data.ambiente}, ${data.client_id},
        ${encrypted}, ${iv}, ${data.bank_id},
        ${publicPath}, ${privatePath},
        ${expiresAt?.toISOString() ?? null}::timestamptz,
        ${data.tolerance_days ?? 2}, ${createdBy}
      )
      RETURNING id
    `

    return { id: row.id }
  }

  async setAtivo(id: string, ativo: boolean): Promise<void> {
    await prisma.$executeRaw`
      UPDATE santander_credentials SET ativo = ${ativo}, updated_at = now() WHERE id = ${id}::uuid
    `
  }
}

export const santanderCredentialsRepo = new SantanderCredentialsRepository()
