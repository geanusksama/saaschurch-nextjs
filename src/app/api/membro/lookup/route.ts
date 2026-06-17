import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { signToken, maskPhone, normalizeCpf, validateCpf } from '@/lib/membroJwt'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { rol, cpf } = body as { rol?: unknown; cpf?: unknown }

  if (!rol || !cpf) {
    return NextResponse.json({ error: 'ROL e CPF são obrigatórios.' }, { status: 400 })
  }

  const rolNum = parseInt(String(rol))
  if (isNaN(rolNum) || rolNum <= 0) {
    return NextResponse.json({ error: 'ROL inválido.' }, { status: 400 })
  }

  const cpfStr = String(cpf)
  if (!validateCpf(cpfStr)) {
    return NextResponse.json({ error: 'CPF inválido.' }, { status: 400 })
  }

  const cpfNorm = normalizeCpf(cpfStr)

  const member = await prisma.member.findFirst({
    where: { rol: rolNum, cpf: cpfNorm, deletedAt: null },
    select: {
      id: true,
      fullName: true,
      photoUrl: true,
      phone: true,
      mobile: true,
      membershipStatus: true,
    },
  })

  if (!member) {
    return NextResponse.json({ error: 'Membro não encontrado. Verifique o ROL e o CPF.' }, { status: 404 })
  }

  const phone = member.mobile || member.phone || ''
  if (!phone) {
    return NextResponse.json({
      error: 'Nenhum telefone cadastrado para este membro. Contate a secretaria da sua igreja.',
    }, { status: 422 })
  }

  const challengeToken = signToken(
    { member_id: member.id, phone },
    10 * 60 // 10 minutes
  )

  return NextResponse.json({
    challenge_token: challengeToken,
    name: member.fullName,
    photo_url: member.photoUrl,
    phone_masked: maskPhone(phone),
  })
}
