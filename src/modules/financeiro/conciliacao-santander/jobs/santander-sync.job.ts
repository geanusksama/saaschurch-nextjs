import { prisma } from '@/lib/prisma'
import { conciliacaoService } from '../backend/conciliacao.service'
import { santanderCertificateService } from '../services/santander/santander-certificate.service'

// Job de sincronização automática Santander
// NÃO ativado por padrão — requer configuração explícita pelo admin financeiro
// Executado via cron externo (Vercel Cron Jobs, BullMQ, etc.)

interface SyncJobOptions {
  credentialId?: string   // se não especificado, sincroniza todas as credenciais ativas
  daysBack?: number       // quantos dias de extrato buscar (padrão: 1)
  notifyOnError?: boolean
}

class SantanderSyncJob {
  async run(options: SyncJobOptions = {}) {
    const { daysBack = 1, credentialId } = options

    const where = credentialId
      ? `WHERE sc.id = '${credentialId}'::uuid AND sc.ativo = true`
      : 'WHERE sc.ativo = true'

    const credentials = await prisma.$queryRawUnsafe<{
      credential_id: string
      account_uuid: string
      account_id: string
      email: string
    }[]>(`
      SELECT sc.id as credential_id, sa.id as account_uuid, sa.account_id, 'sistema' as email
      FROM santander_credentials sc
      JOIN santander_accounts sa ON sa.credential_id = sc.id AND sa.ativa = true
      ${where}
    `)

    const today = new Date()
    const from = new Date(today.getTime() - daysBack * 86400_000)
      .toISOString()
      .split('T')[0]
    const to = today.toISOString().split('T')[0]

    let totalSynced = 0
    const errors: string[] = []

    for (const cred of credentials) {
      try {
        await this.checkCertificate(cred.credential_id)

        await conciliacaoService.importarTransacoes(
          {
            credential_id: cred.credential_id,
            account_id: cred.account_uuid,
            from,
            to,
          },
          'job:santander-sync',
        )
        totalSynced++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`${cred.account_id}: ${msg}`)
        // Log erro sem expor secrets
        console.error(`[SantanderSync] Erro em ${cred.account_id.slice(-4)}: ${msg}`)
      }
    }

    return {
      total: credentials.length,
      synced: totalSynced,
      errors: errors.length,
      messages: errors,
    }
  }

  /** Verifica certificado e emite alerta se próximo do vencimento */
  private async checkCertificate(credentialId: string) {
    const [cred] = await prisma.$queryRaw<{
      certificate_public_path: string
      certificate_private_ref: string
      certificate_expires_at: string | null
    }[]>`
      SELECT certificate_public_path, certificate_private_ref, certificate_expires_at
      FROM santander_credentials WHERE id = ${credentialId}::uuid
    `

    if (!cred) return

    const info = santanderCertificateService.checkStatus(
      cred.certificate_public_path,
      cred.certificate_private_ref,
      cred.certificate_expires_at ? new Date(cred.certificate_expires_at) : null,
    )

    if (info.isExpired) {
      throw new Error(`Certificado vencido em ${info.expiresAt?.toLocaleDateString('pt-BR')}`)
    }

    if (info.isCritical) {
      console.warn(`[SantanderSync] CRÍTICO: Certificado vence em ${info.daysUntilExpiry} dias`)
      // TODO: Enviar notificação ao admin financeiro
    } else if (info.isNearExpiry) {
      console.warn(`[SantanderSync] ALERTA: Certificado vence em ${info.daysUntilExpiry} dias`)
      // TODO: Enviar notificação ao admin financeiro
    }
  }
}

export const santanderSyncJob = new SantanderSyncJob()
