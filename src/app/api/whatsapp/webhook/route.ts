import { NextRequest, NextResponse, after } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { enqueueReply, drenarQuandoVencer } from '@/lib/aiReplyQueue'
import type { ZApiWebhookPayload } from '@/types/whatsapp'
import { parseInbound } from '@/lib/zapiInbound'
import { lerRecepcao, mensagemEhDaRecepcao, RECEPCAO_JANELA_HORAS } from '@/lib/recepcaoWhatsapp'

// a resposta do agente roda em after(): precisa de tempo além do 200
export const maxDuration = 60

// POST /api/whatsapp/webhook
// Chamado pela Z-API — sem autenticação (IP Z-API)
// REGRA: SEMPRE retornar 200, mesmo em erro (Z-API faz retry em 4xx/5xx)
export async function POST(req: NextRequest) {
  try {
    const payload: ZApiWebhookPayload = await req.json().catch(() => ({}))

    // Ignora mensagens enviadas por nós (previne loop infinito)
    // NUNCA remover esta verificação
    if (payload.fromMe === true) {
      return NextResponse.json({ ok: true })
    }

    if (!payload.instanceId) {
      return NextResponse.json({ ok: true })
    }

    // DeliveryCallback — atualiza status de mensagem outbound
    if (payload.type === 'DeliveryCallback' || payload.type === 'MessageStatusCallback') {
      if (payload.messageId && payload.status) {
        const statusMap: Record<string, string> = {
          SENT: 'sent',
          DELIVERED: 'delivered',
          READ: 'read',
          PLAYED: 'read',
        }
        const mapped = statusMap[payload.status.toUpperCase()] ?? payload.status.toLowerCase()
        await supabaseAdmin
          .from('whatsapp_messages')
          .update({ status: mapped })
          .eq('metadata->>zapi_message_id', payload.messageId)
      }
      return NextResponse.json({ ok: true })
    }

    // Ignora mensagens de grupo (phone termina em @g.us)
    if (payload.phone?.endsWith('@g.us')) {
      return NextResponse.json({ ok: true })
    }

    // Busca instância pelo instance_id Z-API
    const { data: instance } = await supabaseAdmin
      .from('whatsapp_instances')
      .select('id, owner_user_id, metadata')
      .eq('instance_id', payload.instanceId)
      .single()

    if (!instance) return NextResponse.json({ ok: true })

    // Normaliza número (remove @s.whatsapp.net e caracteres não numéricos)
    const phone = (payload.phone ?? '').replace('@s.whatsapp.net', '').replace(/\D/g, '')
    if (!phone) return NextResponse.json({ ok: true })

    // Busca ou cria conversa
    const { data: existingConv } = await supabaseAdmin
      .from('whatsapp_conversations')
      .select('id, unread_count')
      .eq('instance_id', instance.id)
      .eq('phone', phone)
      .single()

    let conversationId: string
    let currentUnread = 0
    const conversaNova = !existingConv

    if (existingConv) {
      conversationId = existingConv.id
      currentUnread = existingConv.unread_count ?? 0
    } else {
      const { data: created } = await supabaseAdmin
        .from('whatsapp_conversations')
        .insert({
          instance_id: instance.id,
          phone,
          contact_name: payload.senderName ?? null,
          owner_user_id: instance.owner_user_id,
          status: 'open',
        })
        .select('id')
        .single()

      conversationId = created!.id
    }

    // Tipo e conteúdo da mensagem — texto, mídia, localização, contato,
    // resposta de botão/lista, reação, enquete. Ver src/lib/zapiInbound.ts.
    const parsed = parseInbound(payload)
    const msgType = parsed.type

    const messageId = payload.messageId ?? `synthetic_${Date.now()}_${crypto.randomUUID()}`
    const preview = parsed.preview

    // Salva mensagem inbound
    const { data: msgSalva } = await supabaseAdmin.from('whatsapp_messages').insert({
      conversation_id: conversationId,
      content: parsed.content,
      type: msgType,
      direction: 'inbound',
      status: 'delivered',
      sender_name: payload.senderName ?? null,
      media_url: parsed.mediaUrl,
      media_mime_type: parsed.mediaMime,
      metadata: { zapi_message_id: messageId, ...parsed.extra },
    }).select('created_at').single()

    // Atualiza conversa
    await supabaseAdmin
      .from('whatsapp_conversations')
      .update({
        last_message: preview,
        last_message_at: new Date().toISOString(),
        unread_count: currentUnread + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)

    // ── Recepção por QR code ─────────────────────────────────────────────────
    // O QR da recepção abre o WhatsApp com uma mensagem pronta. Quando ela
    // chega, a conversa passa para o agente configurado na instância
    // (metadata.recepcao) — e o bloco abaixo enfileira a resposta normalmente.
    // Ver src/lib/recepcaoWhatsapp.ts.
    //
    // Nunca passa por cima de atendimento em curso: conversa que já tem agente
    // (Envios, outro fluxo) fica com ele; conversa sem agente só é entregue se
    // é nova ou se ficou RECEPCAO_JANELA_HORAS sem mensagem — senão é alguém
    // que a equipe "Assumiu" e que repetiu a frase do QR.
    //
    // Com "todasNovas" ligado, a PRIMEIRA mensagem de uma conversa nova também
    // entrega ao agente, mesmo sem a palavra-chave (quem lê o QR e manda "oi").
    if (msgType === 'text' || msgType === 'button_reply' || msgType === 'list_reply') {
      try {
        const recepcao = lerRecepcao(instance.metadata)
        const novaSemChave =
          conversaNova && recepcao.ativo && !!recepcao.agentId && recepcao.todasNovas
        if (novaSemChave || mensagemEhDaRecepcao(recepcao, parsed.content)) {
          let entregar = conversaNova
          const { data: conv } = await supabaseAdmin
            .from('whatsapp_conversations')
            .select('ai_agent_id, metadata')
            .eq('id', conversationId)
            .single()
          if (!entregar) {
            if (!conv?.ai_agent_id) {
              const desde = new Date(Date.now() - RECEPCAO_JANELA_HORAS * 3_600_000).toISOString()
              const { count } = await supabaseAdmin
                .from('whatsapp_messages')
                .select('id', { count: 'exact', head: true })
                .eq('conversation_id', conversationId)
                .gte('created_at', desde)
              // a própria mensagem que acabou de entrar conta 1
              entregar = (count ?? 0) <= 1
            }
          }
          if (entregar) {
            // origem marcada: o agente sabe de onde veio a conversa, e a memória
            // de um atendimento anterior não vaza para a visita nova
            const meta: Record<string, unknown> = { ...((conv?.metadata ?? {}) as Record<string, unknown>), origem: 'recepcao_qr' }
            delete meta.recepcao_estado
            delete meta.quero_ser_membro
            // atendimento novo: o agente e o resumo automático leem só daqui
            // em diante (mensagens de visitas/testes anteriores não entram)
            meta.recepcao_inicio = msgSalva?.created_at ?? new Date().toISOString()
            delete meta.resumo_auto_em
            delete meta.encaminhados
            await supabaseAdmin
              .from('whatsapp_conversations')
              .update({ ai_enabled: true, ai_agent_id: recepcao.agentId, metadata: meta })
              .eq('id', conversationId)
          }
        }
      } catch (recErr) {
        console.error('[whatsapp/webhook] recepção por QR falhou', recErr)
      }
    }

    // ── Agente de IA: responde automaticamente conversas marcadas ────────────
    // (ai_enabled + ai_agent_id — atribuídos na aba Envios do módulo em massa)
    //
    // A resposta NÃO sai daqui. Entra numa fila com 10-15 s de espera, que é
    // empurrada a cada mensagem nova e a cada "digitando..." do contato — assim
    // três mensagens seguidas viram UMA resposta, e nunca respondemos por cima
    // de quem ainda está escrevendo.
    // Resposta de botão e de lista também são a pessoa falando: a IA responde
    // igual, e é o que faz um fluxo com botões continuar sozinho.
    const pedeResposta =
      (msgType === 'text' || msgType === 'button_reply' || msgType === 'list_reply') &&
      !!parsed.content

    if (pedeResposta) {
      try {
        const { data: conv } = await supabaseAdmin
          .from('whatsapp_conversations')
          .select('ai_enabled, ai_agent_id')
          .eq('id', conversationId)
          .single()

        if (conv?.ai_enabled && conv.ai_agent_id) {
          await enqueueReply({
            conversationId,
            instanceId: instance.id,
            phone,
            messageId: payload.messageId ?? null,
          })
          // responde no tempo certo (10–15 s após a última mensagem) sem
          // depender do cron: after() segura a função viva depois do 200
          after(() => drenarQuandoVencer(conversationId))
        }
      } catch (aiErr) {
        // nunca deixar a IA derrubar o webhook (precisa sempre responder 200)
        console.error('[whatsapp/webhook] enfileiramento da IA falhou', aiErr)
      }
    }

  } catch (err) {
    console.error('[whatsapp/webhook] erro interno', err)
  }

  // SEMPRE retorna 200 (Z-API faz retry em qualquer outro status)
  return NextResponse.json({ ok: true })
}
