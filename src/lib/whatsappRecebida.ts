/**
 * Registro de mensagem recebida no WhatsApp — ligação real (Supabase, Prisma, fila do
 * agente, ElevenLabs, after) do núcleo em whatsappRecebidaNucleo.ts. Usado pelo webhook
 * da Z-API e pelo do número oficial da Meta: as duas caem nas mesmas
 * whatsapp_conversations/whatsapp_messages e no mesmo agente de IA.
 */
import { after } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { enqueueReply, drenarQuandoVencer } from '@/lib/aiReplyQueue'
import { prisma } from '@/lib/prisma'
import { elevenLabsPronta, getElevenLabsConfig } from '@/lib/elevenlabs'
import { registrarMensagemRecebidaCom, type DepsRecebida, type EntradaRecebida } from '@/lib/whatsappRecebidaNucleo'

export type { EntradaRecebida, MensagemRecebida } from '@/lib/whatsappRecebidaNucleo'

export function depsRecebidaPadrao(rotulo?: string): DepsRecebida {
  return {
    rotulo,
    async buscarConversa(instanciaId, telefone) {
      const { data } = await supabaseAdmin
        .from('whatsapp_conversations')
        .select('id, unread_count')
        .eq('instance_id', instanciaId)
        .eq('phone', telefone)
        .single()
      return data ?? null
    },
    async criarConversa(linha) {
      const { data: created } = await supabaseAdmin
        .from('whatsapp_conversations')
        .insert(linha)
        .select('id')
        .single()
      return created!.id
    },
    async mensagemExiste(conversationId, chave, id) {
      const { data } = await supabaseAdmin
        .from('whatsapp_messages')
        .select('id')
        .eq('conversation_id', conversationId)
        .eq(`metadata->>${chave}`, id)
        .limit(1)
      return !!data?.length
    },
    async inserirMensagem(linha) {
      const { data } = await supabaseAdmin.from('whatsapp_messages').insert(linha).select('created_at').single()
      return data ?? null
    },
    async atualizarConversa(id, patch) {
      await supabaseAdmin.from('whatsapp_conversations').update(patch).eq('id', id)
    },
    async lerConversaRecepcao(id) {
      const { data } = await supabaseAdmin
        .from('whatsapp_conversations')
        .select('ai_agent_id, metadata')
        .eq('id', id)
        .single()
      return data ?? null
    },
    async contarMensagensDesde(conversationId, desdeIso) {
      const { count } = await supabaseAdmin
        .from('whatsapp_messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', conversationId)
        .gte('created_at', desdeIso)
      return count
    },
    async lerConversaIa(id) {
      const { data } = await supabaseAdmin
        .from('whatsapp_conversations')
        .select('ai_enabled, ai_agent_id')
        .eq('id', id)
        .single()
      return data ?? null
    },
    async audioPodeResponder(agentId) {
      const agente = await prisma.aiAgent.findFirst({ where: { id: agentId }, select: { campoId: true } })
      return elevenLabsPronta(await getElevenLabsConfig(agente?.campoId ?? null))
    },
    enfileirarResposta: (p) => enqueueReply(p),
    drenarDepois(conversationId) {
      after(() => drenarQuandoVencer(conversationId))
    },
  }
}

/**
 * Grava a mensagem recebida (conversa, prévia, não lidas, recepção por QR, fila do agente).
 * Idempotente por metadata->>chaveId para a Meta. Devolve false se já estava gravada.
 */
export function registrarMensagemRecebida(entrada: EntradaRecebida, rotulo?: string): Promise<boolean> {
  return registrarMensagemRecebidaCom(depsRecebidaPadrao(rotulo), entrada)
}
