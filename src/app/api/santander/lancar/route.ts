import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { conciliacaoService } from '@/modules/financeiro/conciliacao-santander/backend/conciliacao.service'
import type { LancarNoLivroCaixaDto } from '@/modules/financeiro/conciliacao-santander/dtos/santander.dto'

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (!user.permissions?.includes('financeiro.santander.lancar_livro_caixa')) {
      return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
    }

    const body: LancarNoLivroCaixaDto = await req.json()

    if (!body.santander_movimento_id || !body.church_id || !body.plano_de_conta) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: santander_movimento_id, church_id, plano_de_conta' },
        { status: 400 },
      )
    }

    try {
      const result = await conciliacaoService.lancarNoLivroCaixa(body, user.email ?? 'sistema')
      return NextResponse.json(result, { status: 201 })
    } catch (err) {
      const error = err as { code?: string; message?: string; status?: number }
      return NextResponse.json(
        { error: error.message ?? 'Erro ao lançar no Livro Caixa', code: error.code },
        { status: error.status ?? 500 },
      )
    }
  })
}
