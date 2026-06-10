import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { conciliacaoService } from '@/modules/financeiro/conciliacao-santander/backend/conciliacao.service'

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (!user.permissions?.includes('financeiro.santander.importar')) {
      return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const credential_id = formData.get('credential_id') as string | null
    const account_id = formData.get('account_id') as string | null
    const preview = formData.get('preview') === 'true'

    if (!file || !credential_id || !account_id) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: file, credential_id, account_id' },
        { status: 400 },
      )
    }

    // Validar extensão do arquivo
    if (!file.name.endsWith('.txt') && !file.name.endsWith('.rem') && !file.name.endsWith('.ret')) {
      return NextResponse.json(
        { error: 'Formato inválido. Envie arquivo .txt do layout FEBRABAN 240.' },
        { status: 400 },
      )
    }

    // Limitar tamanho: máximo 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Arquivo muito grande (máximo 10MB)' }, { status: 400 })
    }

    const content = await file.text()

    try {
      const result = await conciliacaoService.importarFebraban240(
        content,
        credential_id,
        account_id,
        user.email ?? 'sistema',
        preview,
      )
      return NextResponse.json(result, { status: preview ? 200 : 201 })
    } catch (err) {
      const error = err as { code?: string; message?: string }
      return NextResponse.json({ error: error.message, code: error.code }, { status: 422 })
    }
  })
}
