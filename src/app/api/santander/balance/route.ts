import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { santanderAuthService } from '@/modules/financeiro/conciliacao-santander/services/santander/santander-auth.service'
import { santanderBalanceService } from '@/modules/financeiro/conciliacao-santander/services/santander/santander-balance.service'
import { santanderCredentialsRepo } from '@/modules/financeiro/conciliacao-santander/repositories/santander-credentials.repository'

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (!user.permissions?.includes('financeiro.santander.consultar')) {
      return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const credential_id = searchParams.get('credential_id')
    const account_id = searchParams.get('account_id')

    if (!credential_id || !account_id) {
      return NextResponse.json({ error: 'credential_id e account_id são obrigatórios' }, { status: 400 })
    }

    const credential = await santanderCredentialsRepo.findFullById(credential_id)
    if (!credential) return NextResponse.json({ error: 'Credencial não encontrada' }, { status: 404 })

    const [account] = await prisma.$queryRaw<{ branch_code: string; account_number: string }[]>`
      SELECT branch_code, account_number FROM santander_accounts
      WHERE id = ${account_id}::uuid AND credential_id = ${credential_id}::uuid
    `
    if (!account) return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 })

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

      const balance = await santanderBalanceService.getBalance(
        {
          ambiente: cred.ambiente as 'sandbox' | 'producao',
          accessToken: token,
          clientId: cred.client_id as string,
          certificatePublicPath: cred.certificate_public_path as string,
          certificatePrivateRef: cred.certificate_private_ref as string,
        },
        cred.bank_id as string,
        account.branch_code,
        account.account_number,
      )

      return NextResponse.json(balance)
    } catch (err) {
      const error = err as { code?: string; message?: string; status?: number }
      return NextResponse.json(
        { error: error.message ?? 'Erro ao consultar saldo', code: error.code },
        { status: error.status ?? 500 },
      )
    }
  })
}
