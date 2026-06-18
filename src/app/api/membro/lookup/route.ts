import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { signToken, maskPhone, validateCpf } from '@/lib/membroJwt'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { rol, cpf, phone } = body as { rol?: unknown; cpf?: unknown; phone?: unknown }

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

  const cpfDigits = cpfStr.replace(/\D/g, '')

  // Find by ROL first, then verify CPF comparing digits only (handles any stored format)
  const candidates = await prisma.member.findMany({
    where: { rol: rolNum, deletedAt: null },
    select: {
      id: true,
      fullName: true,
      photoUrl: true,
      phone: true,
      mobile: true,
      membershipStatus: true,
      cpf: true,
    },
  })

  const member = candidates.find(m => m.cpf && m.cpf.replace(/\D/g, '') === cpfDigits) ?? null

  if (!member) {
    return NextResponse.json({ error: 'Membro não encontrado. Verifique o ROL e o CPF.' }, { status: 404 })
  }

  // Determine which phone to use
  let resolvedPhone: string
  if (phone) {
    // User-provided phone — use it directly (they know their number)
    resolvedPhone = String(phone).replace(/\D/g, '')
    if (resolvedPhone.length < 10) {
      return NextResponse.json({ error: 'Celular inválido. Digite com DDD.' }, { status: 400 })
    }
  } else {
    // Fallback to stored phone
    resolvedPhone = (member.mobile || member.phone || '').replace(/\D/g, '')
    if (!resolvedPhone) {
      return NextResponse.json({
        error: 'Nenhum telefone cadastrado. Contate a secretaria da sua igreja.',
      }, { status: 422 })
    }
  }

  const challengeToken = signToken(
    { member_id: member.id, phone: resolvedPhone },
    10 * 60 // 10 minutes
  )

  return NextResponse.json({
    challenge_token: challengeToken,
    name: member.fullName,
    photo_url: member.photoUrl,
    phone_masked: maskPhone(resolvedPhone),
  })
}
