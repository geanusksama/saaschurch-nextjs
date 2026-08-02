/**
 * GET /api/membro/perfil?token=<member_token>
 *
 * Devolve o perfil enriquecido do membro logado (GF, funções, ministérios,
 * batismo). O token é o mesmo member_token de 7 dias emitido pelo /verify —
 * a pessoa só enxerga o próprio perfil, o id vem do `sub` assinado e nunca da
 * query.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/membroJwt'
import { getMembroPerfil } from '@/lib/membroPerfilService'
import { serializeBigInts } from '@/lib/helpers'

export async function GET(req: NextRequest) {
  try {
    const token = new URL(req.url).searchParams.get('token')
    if (!token) {
      return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const payload = verifyToken<{ sub: string }>(token)
    if (!payload?.sub) {
      return NextResponse.json({ error: 'Sessão expirada. Entre novamente.' }, { status: 401 })
    }

    const perfil = await getMembroPerfil(payload.sub)
    if (!perfil) {
      return NextResponse.json({ error: 'Membro não encontrado.' }, { status: 404 })
    }

    return NextResponse.json(serializeBigInts(perfil))
  } catch (err) {
    console.error('[membro/perfil]', (err as Error)?.message)
    return NextResponse.json({ error: 'Não foi possível carregar o perfil.' }, { status: 500 })
  }
}
