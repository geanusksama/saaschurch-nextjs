/**
 * GET /api/membro/presencas?token=<member_token>&inicio=AAAA-MM-DD&fim=AAAA-MM-DD&pagina=1
 *
 * Presenças do membro logado, filtradas por período e paginadas. Ficam fora do
 * /api/membro/atividades porque a lista cresce sem parar (uma linha por
 * passagem no leitor facial) — lá vai só a contagem, para o selinho do ícone.
 *
 * Igual às demais rotas do portal, o id vem do `sub` assinado do token.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/membroJwt'
import { getMembroPresencas } from '@/lib/membroAtividadesService'
import { serializeBigInts } from '@/lib/helpers'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')
    if (!token) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const payload = verifyToken<{ sub: string }>(token)
    if (!payload?.sub) {
      return NextResponse.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401 })
    }

    const pagina = Number(searchParams.get('pagina') ?? '1')
    const dados = await getMembroPresencas(payload.sub, {
      inicio: searchParams.get('inicio'),
      fim: searchParams.get('fim'),
      pagina: Number.isFinite(pagina) ? pagina : 1,
    })
    if (!dados) {
      return NextResponse.json({ error: 'Membro não encontrado.' }, { status: 404 })
    }

    return NextResponse.json(serializeBigInts(dados))
  } catch (err) {
    console.error('[membro/presencas]', (err as Error)?.message)
    return NextResponse.json({ error: 'Não foi possível carregar suas presenças.' }, { status: 500 })
  }
}
