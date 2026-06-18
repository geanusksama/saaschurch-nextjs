import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/membroJwt'
import { prisma } from '@/lib/prisma'
import { serializeBigInts } from '@/lib/helpers'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { token, cursor, limit = 15, search } = body as {
    token?: string
    cursor?: string
    limit?: number
    search?: string
  }

  if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  const payload = verifyToken<{ sub: string; campo_id?: string }>(token)
  if (!payload) return NextResponse.json({ error: 'Token inválido.' }, { status: 401 })

  const campoId = payload.campo_id
  if (!campoId) return NextResponse.json({ error: 'Campo não identificado.' }, { status: 400 })

  try {
    const take = Math.min(Number(limit) || 20, 60)

    const members = await prisma.member.findMany({
      where: {
        campoId,
        deletedAt: null,
        membershipStatus: { not: 'inactive' },
        AND: [
          ...(search ? [{ fullName: { contains: search.toUpperCase() } }] : []),
          { fullName: { not: { contains: '/' } } },
          { fullName: { not: { startsWith: '(' } } },
          { fullName: { not: { startsWith: '.' } } },
          { fullName: { not: { startsWith: '0' } } },
          { fullName: { not: { startsWith: '1' } } },
          { fullName: { not: { startsWith: '2' } } },
          { fullName: { not: { startsWith: '3' } } },
          { fullName: { not: { startsWith: '4' } } },
          { fullName: { not: { startsWith: '5' } } },
          { fullName: { not: { startsWith: '6' } } },
          { fullName: { not: { startsWith: '7' } } },
          { fullName: { not: { startsWith: '8' } } },
          { fullName: { not: { startsWith: '9' } } },
          { fullName: { not: { contains: 'LTDA' } } },
          { fullName: { not: { contains: 'EIRELI' } } },
          { fullName: { not: { contains: 'SERVICO' } } },
          { fullName: { not: { contains: 'COMERCIO' } } },
          { fullName: { not: { contains: 'LAVAGEM' } } },
          { fullName: { not: { contains: 'LOCACAO' } } },
          { fullName: { not: { contains: 'TABELIAO' } } },
          { fullName: { not: { contains: 'CARTORIO' } } },
        ],
      },
      select: {
        id: true,
        fullName: true,
        preferredName: true,
        photoUrl: true,
        ecclesiasticalTitle: true,
        membershipStatus: true,
        membershipDate: true,
        rol: true,
        church: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { fullName: 'asc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    const hasMore = members.length > take
    const items = hasMore ? members.slice(0, take) : members
    const nextCursor = hasMore ? items[items.length - 1].id : null

    return NextResponse.json(serializeBigInts({ items, nextCursor, hasMore }))
  } catch (err) {
    console.error('[membro/membros]', err)
    return NextResponse.json({ error: 'Erro ao buscar membros.' }, { status: 500 })
  }
}
