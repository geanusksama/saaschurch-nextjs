import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { santanderAuthService } from '@/modules/financeiro/conciliacao-santander/services/santander/santander-auth.service'
import { santanderAccountsService } from '@/modules/financeiro/conciliacao-santander/services/santander/santander-accounts.service'
import { santanderCredentialsRepo } from '@/modules/financeiro/conciliacao-santander/repositories/santander-credentials.repository'

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (!user.permissions?.includes('financeiro.santander.visualizar')) {
      return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const credential_id = searchParams.get('credential_id')
    const sync = searchParams.get('sync') === 'true'

    if (!credential_id) {
      return NextResponse.json({ error: 'credential_id obrigatório' }, { status: 400 })
    }

    if (sync) {
      // Sincronizar contas com a API Santander
      const credential = await santanderCredentialsRepo.findFullById(credential_id)
      if (!credential) return NextResponse.json({ error: 'Credencial não encontrada' }, { status: 404 })

      try {
        const cred = credential as Record<string, unknown>
        const token = await santanderAuthService.getToken({
          id: cred.id as string,
          ambiente: cred.ambiente as 'sandbox' | 'producao',
          client_id: cred.client_id as string,
          client_secret_encrypted: cred.client_secret_encrypted as string,
          client_secret_iv: cred.client_secret_iv as string,
          certificate_public_path: cred.certificate_public_path as string,
          certificate_private_ref: cred.certificate_private_ref as string,
          certificate_expires_at: cred.certificate_expires_at ? new Date(cred.certificate_expires_at as string) : null,
        })

        const apiConfig = {
          ambiente: cred.ambiente as 'sandbox' | 'producao',
          accessToken: token,
          clientId: cred.client_id as string,
          certificatePublicPath: cred.certificate_public_path as string,
          certificatePrivateRef: cred.certificate_private_ref as string,
        }

        const apiAccounts = await santanderAccountsService.listAllAccounts(apiConfig, cred.bank_id as string)

        // Upsert contas locais
        for (const acc of apiAccounts) {
          await prisma.$executeRaw`
            INSERT INTO santander_accounts (credential_id, account_id, bank_id, branch_code, account_number, account_digit, display_name)
            VALUES (${credential_id}::uuid, ${acc.account_id}, ${cred.bank_id as string}, ${acc.branch_code}, ${acc.account_number}, ${acc.account_digit}, ${acc.statement_id})
            ON CONFLICT (credential_id, branch_code, account_number) DO UPDATE SET
              account_id = EXCLUDED.account_id,
              updated_at = now()
          `
        }
      } catch (err) {
        const error = err as { code?: string; message?: string }
        return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })
      }
    }

    const accounts = await prisma.$queryRaw`
      SELECT id, account_id, bank_id, branch_code, account_number, account_digit, display_name, igreja_id, ativa
      FROM santander_accounts
      WHERE credential_id = ${credential_id}::uuid AND ativa = true
      ORDER BY display_name
    `

    return NextResponse.json({ accounts, total: (accounts as unknown[]).length })
  })
}
