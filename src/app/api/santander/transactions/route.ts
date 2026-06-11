import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { conciliacaoService } from '@/modules/financeiro/conciliacao-santander/backend/conciliacao.service'
import { santanderMovimentosRepo } from '@/modules/financeiro/conciliacao-santander/repositories/santander-movimentos.repository'

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const { searchParams } = new URL(req.url)
    const credential_id = searchParams.get('credential_id')
    const account_id = searchParams.get('account_id')
    const from = searchParams.get('from')
    const to = searchParams.get('to') ?? undefined
    const pixOnly = searchParams.get('pix') === 'true'
    const rawType = searchParams.get('type') as 'all' | 'credit' | 'debit' | null
    const type: 'all' | 'credit' | 'debit' | 'pix' = pixOnly ? 'pix' : (rawType ?? 'all')
    const status = searchParams.get('status') ?? undefined
    const page = parseInt(searchParams.get('page') ?? '1', 10)
    const limit = parseInt(searchParams.get('limit') ?? '50', 10)
    const sync = searchParams.get('sync') === 'true'

    if (!credential_id || !account_id || !from) {
      return NextResponse.json({ error: 'Parâmetros obrigatórios: credential_id, account_id, from' }, { status: 400 })
    }

    if (!user.permissions?.['financeiro.santander.consultar']) {
      return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
    }

    try {
      if (sync) {
        // Buscar na API Santander e importar
        const result = await conciliacaoService.importarTransacoes(
          { credential_id, account_id, from, to, type, status: status as never, page, limit },
          user.email ?? 'sistema',
        )
        return NextResponse.json(result)
      }

      // Apenas consultar banco local (sem chamada ao Santander)
      const { rows, total } = await santanderMovimentosRepo.findMany({
        santander_account_id: account_id,
        from,
        to: to ?? new Date().toISOString().split('T')[0],
        type,
        status: status as never,
        page,
        limit,
      })

      const summary = await santanderMovimentosRepo.getSummary(
        account_id,
        from,
        to ?? new Date().toISOString().split('T')[0],
      )

      return NextResponse.json({
        movimentos: rows,
        summary,
        pagination: { page, limit, total, hasMore: page * limit < total },
      })
    } catch (err) {
      const error = err as { code?: string; message?: string; status?: number }
      return NextResponse.json(
        { error: error.message ?? 'Erro interno', code: error.code },
        { status: error.status ?? 500 },
      )
    }
  })
}
