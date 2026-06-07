import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { quickSendWhatsApp } from '@/lib/whatsappSendService'

// POST /api/whatsapp/send-tithe-receipt
// Body: { memberName, phone, valor, referencia?, churchName?, dataLancamento? }
// Envia recibo de dízimo/oferta ao membro via WhatsApp
export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}))
    const { memberName, phone, valor, referencia, churchName, dataLancamento } = body

    if (!memberName || !phone || !valor) {
      return NextResponse.json({ error: 'memberName, phone e valor são obrigatórios' }, { status: 400 })
    }

    const firstName = String(memberName).split(' ')[0]
    const valorFormatado = Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    const dataFormatada = dataLancamento
      ? new Date(dataLancamento).toLocaleDateString('pt-BR')
      : new Date().toLocaleDateString('pt-BR')
    const igrejaTexto = churchName ? `\n🏛 Igreja: ${churchName}` : ''
    const referenciaTexto = referencia ? `\n📅 Referência: ${referencia}` : ''

    const message = [
      `✅ *Recibo de Lançamento*`,
      ``,
      `Olá, ${firstName}! Seu lançamento foi registrado com sucesso.`,
      ``,
      `📋 *Detalhes:*`,
      `👤 Nome: ${memberName}`,
      `💰 Valor: ${valorFormatado}`,
      `📆 Data: ${dataFormatada}${igrejaTexto}${referenciaTexto}`,
      ``,
      `_Este é um recibo automático do sistema MRM SaasChurch._`,
      `_Guarde esta mensagem como comprovante._`,
      ``,
      `Deus abençoe! 🙏`,
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
