import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { quickSendWhatsApp } from '@/lib/whatsappSendService'
import { supabaseAdmin } from '@/lib/supabase-admin'

// POST /api/whatsapp/send-birthday
// Body: { memberName, phone, age?, message?, instanceId? }
// Envia mensagem de feliz aniversário ao membro (com suporte a customização e instância)
export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}))
    const { memberName, phone, age, message: customMessage, instanceId } = body

    if (!memberName || !phone) {
      return NextResponse.json({ error: 'memberName e phone são obrigatórios' }, { status: 400 })
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
    const ageText = age ? String(age) : ''

    let message = ''
    if (customMessage) {
      message = String(customMessage)
        .replace(/{nome}/g, memberName)
        .replace(/{primeironome}/g, firstName)
        .replace(/{idade}/g, ageText)
    } else {
      const ageTextFmt = age ? `, completando ${age} anos,` : ''
      message = [
        `🎉 *Feliz Aniversário, ${firstName}!*`,
        ``,
        `Em nome de toda a família da nossa igreja, queremos desejar a você${ageTextFmt} um dia repleto de bênçãos, alegria e a presença de Deus em cada momento.`,
        ``,
        `_"Que o SENHOR te abençoe e te guarde; que o SENHOR faça resplandecer o seu rosto sobre ti e te conceda a sua graça."_ — Nm 6:24-25`,
        ``,
        `Com carinho,`,
        `Equipe Pastoral 🙏`,
      ].join('\n')
    }

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

