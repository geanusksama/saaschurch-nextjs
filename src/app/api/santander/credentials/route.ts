import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { santanderCredentialsRepo } from '@/modules/financeiro/conciliacao-santander/repositories/santander-credentials.repository'
import type { CreateCredentialDto } from '@/modules/financeiro/conciliacao-santander/dtos/santander.dto'

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (!user.permissions?.includes('financeiro.santander.configurar')) {
      return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
    }

    const campo = user.campoId ?? user.churchId ?? ''
    const credentials = await santanderCredentialsRepo.findByCampo(campo)
    return NextResponse.json({ credentials })
  })
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (!user.permissions?.includes('financeiro.santander.configurar')) {
      return NextResponse.json({ error: 'Permissão negada' }, { status: 403 })
    }

    const body: CreateCredentialDto = await req.json()

    if (!body.client_id || !body.client_secret || !body.certificate_public || !body.certificate_private) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 })
    }

    if (!['sandbox', 'producao'].includes(body.ambiente)) {
      return NextResponse.json({ error: 'Ambiente inválido. Use sandbox ou producao.' }, { status: 400 })
    }

    try {
      const result = await santanderCredentialsRepo.create(body, user.email ?? 'sistema')
      // Retornar apenas id — sem secret, sem paths
      return NextResponse.json({ id: result.id, message: 'Credencial cadastrada com sucesso' }, { status: 201 })
    } catch (err) {
      const error = err as { message?: string }
      return NextResponse.json({ error: error.message ?? 'Erro ao salvar credencial' }, { status: 500 })
    }
  })
}
