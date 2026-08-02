/**
 * GET /api/membro/atividades?token=<member_token>
 *
 * O que abre nos ícones do perfil: filhos, presenças e inscrições em eventos.
 * Igual ao /api/membro/perfil, o id vem do `sub` assinado — a pessoa só vê a
 * própria vida na igreja.
 *
 * Fica separada do /perfil de propósito: o perfil abre na hora e isto só é
 * buscado quando o membro toca num dos ícones.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/membroJwt'
import { getMembroAtividades } from '@/lib/membroAtividadesService'
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

    const atividades = await getMembroAtividades(payload.sub)
    if (!atividades) {
      return NextResponse.json({ error: 'Membro não encontrado.' }, { status: 404 })
    }

    return NextResponse.json(serializeBigInts(atividades))
  } catch (err) {
    console.error('[membro/atividades]', (err as Error)?.message)
    return NextResponse.json({ error: 'Não foi possível carregar suas atividades.' }, { status: 500 })
  }
}
