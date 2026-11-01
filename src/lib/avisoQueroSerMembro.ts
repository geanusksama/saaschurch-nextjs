/**
 * Aviso de novos "Quero ser Membro" — site (dados básicos ou ficha completa)
 * e agente do WhatsApp, todos caem em new_member_requests.
 *
 * Roda no cron /api/cron/whatsapp-ai (a cada minuto). Para cada instância
 * conectada com recepcao.avisoQueroSerMembro preenchido, manda aos contatos a
 * mensagem da "Secretária Virtual da Sede" com os pedidos criados desde a
 * última passada. A marca fica em metadata.recepcao_aviso_qsm_desde, FORA de
 * metadata.recepcao, para a tela de configuração não sobrescrevê-la.
 *
 * Primeira passada só grava a marca (agora): não despeja o histórico antigo.
 */

import { supabaseAdmin } from '@/lib/supabase-admin'
import { ensureConversation, persistOutboundMessage, sendTextViaZApi } from '@/lib/whatsappSendService'
import { lerRecepcao } from '@/lib/recepcaoWhatsapp'
import { publicBaseUrl } from '@/lib/publicUrl'
import { ASSINATURA_SECRETARIA } from '@/lib/encaminharLider'

const MARCA = 'recepcao_aviso_qsm_desde'

interface PedidoNovo {
  id: string
  name: string | null
  whatsapp: string | null
  scheduled_date: string | null
  form_data: unknown
  pipeline_card_id: string | null
  created_at: string
}

function formatarTelefone(t: string | null): string {
  const d = String(t ?? '').replace(/\D/g, '')
  const local = d.startsWith('55') && d.length > 11 ? d.slice(2) : d
  return local.length >= 10 ? `(${local.slice(0, 2)}) ${local.slice(2, -4)}-${local.slice(-4)}` : (t ?? '')
}

export function montarAvisoQsm(p: PedidoNovo, destinatario: string): string {
  const base = publicBaseUrl()
  const data = p.scheduled_date ? p.scheduled_date.slice(0, 10).split('-').reverse().join('/') : 'não agendada'
  const digitos = String(p.whatsapp ?? '').replace(/\D/g, '')
  const wa = digitos ? (digitos.length <= 11 ? `55${digitos}` : digitos) : ''
  return [
    `*${ASSINATURA_SECRETARIA}*`,
    '',
    `A paz do Senhor${destinatario ? `, ${destinatario}` : ''}. Quem envia esta mensagem é a ${ASSINATURA_SECRETARIA}.`,
    `Chegou um novo pedido *Quero ser Membro* (${p.form_data ? 'ficha completa' : 'dados básicos'}).`,
    '',
    `Nome: ${p.name || 'não informado'}`,
    `WhatsApp: ${formatarTelefone(p.whatsapp)}${wa ? ` — https://wa.me/${wa}` : ''}`,
    `Entrevista: ${data}`,
    ...(p.pipeline_card_id ? [`Histórico do pedido: ${base}/pastoral/timeline/${p.pipeline_card_id}`] : []),
    '',
    'Quando puder, envie o resultado dessa conversa para ser apresentado em relatório. Deus abençoe.',
  ].join('\n')
}

export async function processarAvisosQueroSerMembro(): Promise<number> {
  let enviados = 0
  try {
    const { data: instancias } = await supabaseAdmin
      .from('whatsapp_instances')
      .select('id, instance_id, token, client_token, owner_user_id, status, metadata')
      .eq('is_active', true)
      .eq('status', 'connected')

    for (const inst of instancias ?? []) {
      const meta = (inst.metadata ?? {}) as Record<string, unknown>
      const cfg = lerRecepcao(meta)
      if (!cfg.avisoQueroSerMembro.length) continue

      const desde = typeof meta[MARCA] === 'string' ? (meta[MARCA] as string) : null
      if (!desde) {
        await supabaseAdmin.from('whatsapp_instances')
          .update({ metadata: { ...meta, [MARCA]: new Date().toISOString() } }).eq('id', inst.id)
        continue
      }

      const { data: novos } = await supabaseAdmin
        .from('new_member_requests')
        .select('id, name, whatsapp, scheduled_date, form_data, pipeline_card_id, created_at')
        .gt('created_at', desde)
        .order('created_at', { ascending: true })
        .limit(20)
      if (!novos?.length) continue

      // avança a marca ANTES de enviar: uma passada concorrente do cron não
      // pega os mesmos pedidos (melhor perder um aviso que mandar dois)
      const ultima = novos[novos.length - 1].created_at
      await supabaseAdmin.from('whatsapp_instances')
        .update({ metadata: { ...meta, [MARCA]: ultima } }).eq('id', inst.id)

      for (const p of novos as PedidoNovo[]) {
        for (const dest of cfg.avisoQueroSerMembro) {
          const texto = montarAvisoQsm(p, dest.nome)
          try {
            const r = await sendTextViaZApi(inst, dest.telefone, texto)
            if (r.status === 'sent') {
              enviados++
              if (inst.owner_user_id) {
                const cid = await ensureConversation(inst.id, inst.owner_user_id, dest.telefone, dest.nome)
                await persistOutboundMessage(cid, texto, r.messageId || undefined)
              }
            }
          } catch (err) {
            console.error('[avisoQueroSerMembro] envio falhou', dest.telefone, err)
          }
        }
      }
    }
  } catch (err) {
    console.error('[avisoQueroSerMembro]', err)
  }
  return enviados
}
