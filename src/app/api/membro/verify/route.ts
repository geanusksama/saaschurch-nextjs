import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, signToken, hashCode } from '@/lib/membroJwt'
import { prisma } from '@/lib/prisma'
import { serializeBigInts } from '@/lib/helpers'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { otp_token, code } = body as { otp_token?: string; code?: string }

  if (!otp_token || !code) {
    return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
  }

  const payload = verifyToken<{ member_id: string; code_hash: string }>(otp_token)
  if (!payload) {
    return NextResponse.json({ error: 'Código expirado. Solicite um novo código.' }, { status: 401 })
  }

  if (hashCode(code.trim()) !== payload.code_hash) {
    return NextResponse.json({ error: 'Código incorreto. Verifique e tente novamente.' }, { status: 401 })
  }

  const member = await prisma.member.findUnique({
    where: { id: payload.member_id, deletedAt: null },
    select: {
      id: true,
      fullName: true,
      preferredName: true,
      photoUrl: true,
      coverPhotoUrl: true,
      ecclesiasticalTitle: true,
      membershipStatus: true,
      membershipDate: true,
      baptismDate: true,
      rol: true,
      phone: true,
      mobile: true,
      email: true,
      birthDate: true,
      gender: true,
      churchId: true,
      regionalId: true,
      campoId: true,
      church: {
        select: {
          id: true,
          name: true,
          regional: {
            select: {
              id: true,
              name: true,
              campo: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  })

  if (!member) {
    return NextResponse.json({ error: 'Membro não encontrado.' }, { status: 404 })
  }

  const memberToken = signToken(
    {
      sub: member.id,
      name: member.fullName,
      photo_url: member.photoUrl,
      church_id: member.churchId,
      campo_id: member.campoId,
      rol: member.rol,
    },
    7 * 24 * 60 * 60 // 7 days
  )

  return NextResponse.json(
    serializeBigInts({
      member_token: memberToken,
      member,
    })
  )
}
