/**
 * Resumo de conversa de recepção que ficou parada.
 *
 * O agente manda o resumo ao líder só ao encerrar a conversa (ou quando a
 * pessoa pede para falar com alguém). Quem some sem se despedir nunca
 * geraria resumo — então, depois de 2 h sem mensagem, este job (cron
 * /api/cron/whatsapp-ai) gera o resumo e encaminha para as áreas anotadas na
 * memória do atendimento, ou para a área padrão se não houver nenhuma.
 *
 * Uma vez por conversa (metadata.resumo_auto_em). Só conversas que vieram do
 * QR (metadata.origem = recepcao_qr), com agente ligado, paradas há 2–48 h.
 */

import { prisma } from '@/lib/prisma'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateAiText, loadConversationHistory } from '@/lib/aiReplyService'
import { conversaReservada, encaminharParaLideres } from '@/lib/encaminharLider'
import { AREA_RESERVADA_ROTULO, areaPadrao, lerRecepcao, normalizarTexto } from '@/lib/recepcaoWhatsapp'

const PARADA_MS = 2 * 3_600_000
const JANELA_MS = 48 * 3_600_000

export async function processarConversasParadas(): Promise<number> {
  let resumidas = 0
  try {
    const { data: instancias } = await supabaseAdmin
      .from('whatsapp_instances')
      .select('id, metadata')
      .eq('is_active', true)
      .eq('status', 'connected')

    for (const inst of instancias ?? []) {
      const cfg = lerRecepcao(inst.metadata)
      if (!cfg.encaminhamentos.length) continue
      const padrao = areaPadrao(cfg)
      const areas = new Map(cfg.encaminhamentos.map(e => [normalizarTexto(e.interesse), e.interesse]))

      const agora = Date.now()
      const { data: convs } = await supabaseAdmin
        .from('whatsapp_conversations')
        .select('id, phone, ai_agent_id, metadata, last_message_at')
        .eq('instance_id', inst.id)
        .eq('ai_enabled', true)
        .eq('metadata->>origem', 'recepcao_qr')
        .lt('last_message_at', new Date(agora - PARADA_MS).toISOString())
        .gt('last_message_at', new Date(agora - JANELA_MS).toISOString())
        .limit(10)

      for (const c of convs ?? []) {
        const meta = (c.metadata ?? {}) as Record<string, unknown>
        if (meta.resumo_auto_em) continue
        // só atendimento iniciado depois desta regra (marca recepcao_inicio no
        // webhook): conversas antigas não disparam resumo em massa aos líderes
        const inicio = typeof meta.recepcao_inicio === 'string' ? meta.recepcao_inicio : null
        if (!inicio) continue
        if (Object.keys((meta.encaminhados ?? {}) as Record<string, string>).length) continue

        // marca antes: uma passada concorrente do cron não resume duas vezes
        await supabaseAdmin
          .from('whatsapp_conversations')
          .update({ metadata: { ...meta, resumo_auto_em: new Date().toISOString() } })
          .eq('id', c.id)

        const historico = await loadConversationHistory(c.id, 80, inicio)
        if (!historico.some(m => m.role === 'user')) continue

        const estado = (meta.recepcao_estado ?? {}) as Record<string, unknown>
        const anotadas = (Array.isArray(estado.interesses) ? estado.interesses : [])
          .map(x => areas.get(normalizarTexto(String(x))))
          .filter((x): x is string => !!x)
        const interesses = [...new Set([...anotadas, ...(estado.pediuHumano && padrao ? [padrao] : [])])]
        // assunto reservado (denúncia, reclamação...): o resumo vai só para o
        // contato reservado — encaminharParaLideres decide isso pela marca
        const reservado = conversaReservada(null, meta)
        if (reservado) interesses.unshift(AREA_RESERVADA_ROTULO)
        // sem área anotada: vai para os líderes padrão do sexo da pessoa
        if (!interesses.length && padrao) interesses.push(padrao)
        if (!interesses.length) continue

        const agente = c.ai_agent_id
          ? await prisma.aiAgent.findFirst({ where: { id: c.ai_agent_id }, select: { campoId: true } })
          : null
        const transcricao = historico.map(m => `${m.role === 'user' ? 'PESSOA' : 'IGREJA'}: ${m.content}`).join('\n')
        let resumo = ''
        try {
          resumo = (await generateAiText(
            agente?.campoId ?? null,
            'Você resume conversas de WhatsApp da recepção de uma igreja para o líder que vai dar continuidade. ' +
              'Responda só o resumo, em texto simples, sem markdown e sem emoji, em até 6 linhas: nome da pessoa, de onde ' +
              'veio, igreja anterior, interesses, pedido especial (se ela compartilhou), data de visita (se houver), se pediu ' +
              'para falar com alguém, e que a conversa parou sem despedida. Não invente nada que não esteja na conversa.',
            [{ role: 'user', content: transcricao }],
          )).trim()
        } catch (err) {
          console.error('[resumoConversaParada] resumo falhou', c.id, err)
          resumo = 'A pessoa iniciou o atendimento pelo QR da recepção e parou de responder. Veja a conversa na Caixa de Entrada.'
        }

        const r = await encaminharParaLideres({
          instanceId: inst.id,
          conversationId: c.id,
          telefoneContato: c.phone,
          dados: { interesses, sexo: String(estado.sexo ?? ''), resumo, ...(reservado ? { reservado: true } : {}) },
        })
        if (r.enviados) resumidas++
      }
    }
  } catch (err) {
    console.error('[resumoConversaParada]', err)
  }
  return resumidas
}
