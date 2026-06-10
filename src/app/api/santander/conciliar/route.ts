import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { conciliacaoService } from '@/modules/financeiro/conciliacao-santander/backend/conciliacao.service'
import { santanderConciliacoesRepo } from '@/modules/financeiro/conciliacao-santander/repositories/santander-conciliacoes.repository'
import type { ConciliarDto } from '@/modules/financeiro/conciliacao-santander/dtos/santander.dto'

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (!user.permissions?.includes('financeiro.santander.conciliar')) {
      return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
    }

    const body: ConciliarDto = await req.json()

    if (!body.santander_movimento_id || !body.livro_caixa_id) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: santander_movimento_id, livro_caixa_id' },
        { status: 400 },
      )
    }

    try {
      const result = await conciliacaoService.conciliar(body, user.email ?? 'sistema')
      return NextResponse.json(result)
    } catch (err) {
      const error = err as { code?: string; message?: string }
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })
    }
  })
}

export async function DELETE(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (!user.permissions?.includes('financeiro.santander.conciliar')) {
      return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

    try {
      await santanderConciliacoesRepo.desfazer(id, user.email ?? 'sistema')
      return NextResponse.json({ message: 'Conciliação desfeita com sucesso' })
    } catch (err) {
      const error = err as { message?: string }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  })
}
