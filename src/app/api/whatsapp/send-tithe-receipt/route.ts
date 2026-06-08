import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { quickSendWhatsApp } from '@/lib/whatsappSendService'
import { supabaseAdmin } from '@/lib/supabase-admin'

// POST /api/whatsapp/send-tithe-receipt
// Body: { memberName, phone, valor, referencia?, churchName?, dataLancamento? }
// Envia recibo de dízimo/oferta ao membro via WhatsApp
export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}))
    const { memberName, phone, valor, referencia, churchName, dataLancamento, instanceId } = body

    if (!memberName || !phone || !valor) {
      return NextResponse.json({ error: 'memberName, phone e valor são obrigatórios' }, { status: 400 })
    }

    if (instanceId) {
      // Check permission for specific instance
      const { data: inst } = await supabaseAdmin
        .from('whatsapp_instances')
        .select('id, owner_user_id')
        .eq('id', instanceId)
        .eq('is_active', true)
        .eq('status', 'connected')
        .single()

      if (!inst) {
        return NextResponse.json({ error: 'Instância não conectada ou indisponível' }, { status: 404 })
      }

      if (user.profileType !== 'master' && inst.owner_user_id !== user.id) {
        const { data: shared } = await supabaseAdmin
          .from('whatsapp_instance_users')
          .select('id')
          .eq('instance_id', instanceId)
          .eq('user_id', user.id)
          .maybeSingle()

        if (!shared) {
          return NextResponse.json({ error: 'Você não está autorizado a utilizar esta instância' }, { status: 403 })
        }
      }
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
      instanceId,
    })

    if (result.status === 'error') {
      return NextResponse.json({ error: result.error ?? 'Falha ao enviar' }, { status: 500 })
    }

    return NextResponse.json({ success: true, messageId: result.messageId })
  })
}
