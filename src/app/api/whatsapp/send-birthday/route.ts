import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { quickSendWhatsApp } from '@/lib/whatsappSendService'

// POST /api/whatsapp/send-birthday
// Body: { memberId, memberName, phone, age? }
// Envia mensagem de feliz aniversário ao membro
export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}))
    const { memberName, phone, age } = body

    if (!memberName || !phone) {
      return NextResponse.json({ error: 'memberName e phone são obrigatórios' }, { status: 400 })
    }

    const firstName = String(memberName).split(' ')[0]
    const ageText = age ? `, completando ${age} anos,` : ''

    const message = [
      `🎉 *Feliz Aniversário, ${firstName}!*`,
      ``,
      `Em nome de toda a família da nossa igreja, queremos desejar a você${ageText} um dia repleto de bênçãos, alegria e a presença de Deus em cada momento.`,
      ``,
      `_"Que o SENHOR te abençoe e te guarde; que o SENHOR faça resplandecer o seu rosto sobre ti e te conceda a sua graça."_ — Nm 6:24-25`,
      ``,
      `Com carinho,`,
      `Equipe Pastoral 🙏`,
    ].join('\n')

    const result = await quickSendWhatsApp({
      ownerUserId: user.id!,
      profileType: user.profileType,
      phone,
      message,
      contactName: memberName,
    })

    if (result.status === 'error') {
      return NextResponse.json({ error: result.error ?? 'Falha ao enviar' }, { status: 500 })
    }

    return NextResponse.json({ success: true, messageId: result.messageId })
  })
}
