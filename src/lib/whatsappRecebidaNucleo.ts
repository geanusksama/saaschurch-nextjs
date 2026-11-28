/**
 * Núcleo do registro de mensagem RECEBIDA no WhatsApp (Z-API e número oficial da Meta).
 *
 * Extraído, sem mudança de comportamento, do webhook da Z-API
 * (src/app/api/whatsapp/webhook/route.ts): busca/cria a conversa, grava a mensagem,
 * atualiza prévia e não lidas, entrega à recepção por QR e enfileira a resposta do
 * agente de IA. Banco, fila e ElevenLabs vêm injetados (DepsRecebida) para testar sem
 * Next/Prisma; a ligação real está em src/lib/whatsappRecebida.ts.
 *
 * Idempotência: com chaveId 'meta_message_id' (a Meta reenvia o webhook), o mesmo
 * idExterno na mesma conversa não grava de novo nem soma não lida. Com 'zapi_message_id'
 * não há checagem — é o comportamento de antes do webhook da Z-API, mantido igual.
 */
import { lerRecepcao, mensagemEhDaRecepcao, RECEPCAO_JANELA_HORAS } from './recepcaoWhatsapp.ts'

export type MensagemRecebida = {
  type: string
  content: string | null
  preview: string
  mediaUrl: string | null
  mediaMime: string | null
  extra: Record<string, unknown>
}

export type EntradaRecebida = {
  instancia: { id: string; owner_user_id: string; metadata: unknown }
  telefone: string
  nomeRemetente: string | null
  mensagem: MensagemRecebida
  /** id da mensagem no provedor; 'synthetic_...' quando o provedor não mandou */
  idExterno: string
  chaveId: 'zapi_message_id' | 'meta_message_id'
  /**
   * true = só grava (conversa, mensagem, prévia, não lida): sem recepção por QR e sem
   * resposta do agente. Usado no pedido de SAIR pela Meta. Padrão false (Z-API igual).
   */
  semAgente?: boolean
}

export type DepsRecebida = {
  /** select id, unread_count ... .single() (0 ou 2+ linhas ⇒ null, como antes) */
  buscarConversa(instanciaId: string, telefone: string): Promise<{ id: string; unread_count: number | null } | null>
  /** insert ... select id .single(); devolve o id (lança se não criou, como o `created!.id` de antes) */
  criarConversa(linha: { instance_id: string; phone: string; contact_name: string | null; owner_user_id: string; status: 'open' }): Promise<string>
  /** Já existe mensagem com metadata->>chave = id nessa conversa? */
  mensagemExiste(conversationId: string, chave: string, id: string): Promise<boolean>
  /** insert ... select created_at .single() */
  inserirMensagem(linha: Record<string, unknown>): Promise<{ created_at: string } | null>
  atualizarConversa(id: string, patch: Record<string, unknown>): Promise<void>
  lerConversaRecepcao(id: string): Promise<{ ai_agent_id: string | null; metadata: unknown } | null>
  contarMensagensDesde(conversationId: string, desdeIso: string): Promise<number | null>
  lerConversaIa(id: string): Promise<{ ai_enabled: boolean | null; ai_agent_id: string | null } | null>
  /** áudio: a ElevenLabs está pronta no campo do agente? */
  audioPodeResponder(agentId: string): Promise<boolean>
  enfileirarResposta(p: { conversationId: string; instanceId: string; phone: string; messageId: string | null }): Promise<void>
  /** after(() => drenarQuandoVencer(conversationId)) */
  drenarDepois(conversationId: string): void
  agora?: () => Date
  /** prefixo dos logs (padrão o do webhook da Z-API) */
  rotulo?: string
}

const ehFala = (t: string) => t === 'text' || t === 'button_reply' || t === 'list_reply'

/** Devolve false quando a mensagem já estava gravada (repetição da Meta) e nada foi feito. */
export async function registrarMensagemRecebidaCom(deps: DepsRecebida, e: EntradaRecebida): Promise<boolean> {
  const agora = deps.agora ?? (() => new Date())
  const rotulo = deps.rotulo ?? '[whatsapp/webhook]'
  const { instancia, telefone: phone, mensagem: parsed } = e

  // Busca ou cria conversa
  const existingConv = await deps.buscarConversa(instancia.id, phone)

  let conversationId: string
  let currentUnread = 0
  const conversaNova = !existingConv

  if (existingConv) {
    conversationId = existingConv.id
    currentUnread = existingConv.unread_count ?? 0
    if (e.chaveId === 'meta_message_id' && (await deps.mensagemExiste(conversationId, e.chaveId, e.idExterno))) {
      return false
    }
  } else {
    conversationId = await deps.criarConversa({
      instance_id: instancia.id,
      phone,
      contact_name: e.nomeRemetente ?? null,
      owner_user_id: instancia.owner_user_id,
      status: 'open',
    })
  }

  const msgType = parsed.type

  // Salva mensagem inbound
  const msgSalva = await deps.inserirMensagem({
    conversation_id: conversationId,
    content: parsed.content,
    type: msgType,
    direction: 'inbound',
    status: 'delivered',
    sender_name: e.nomeRemetente ?? null,
    media_url: parsed.mediaUrl,
    media_mime_type: parsed.mediaMime,
    metadata: { [e.chaveId]: e.idExterno, ...parsed.extra },
  })

  // Atualiza conversa
  await deps.atualizarConversa(conversationId, {
    last_message: parsed.preview,
    last_message_at: agora().toISOString(),
    unread_count: currentUnread + 1,
    updated_at: agora().toISOString(),
  })

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
  if (e.semAgente) return true

  if (ehFala(msgType)) {
    try {
      const recepcao = lerRecepcao(instancia.metadata)
      const novaSemChave =
        conversaNova && recepcao.ativo && !!recepcao.agentId && recepcao.todasNovas
      if (novaSemChave || mensagemEhDaRecepcao(recepcao, parsed.content)) {
        let entregar = conversaNova
        const conv = await deps.lerConversaRecepcao(conversationId)
        if (!entregar) {
          if (!conv?.ai_agent_id) {
            const desde = new Date(agora().getTime() - RECEPCAO_JANELA_HORAS * 3_600_000).toISOString()
            const count = await deps.contarMensagensDesde(conversationId, desde)
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
          meta.recepcao_inicio = msgSalva?.created_at ?? agora().toISOString()
          delete meta.resumo_auto_em
          delete meta.encaminhados
          await deps.atualizarConversa(conversationId, { ai_enabled: true, ai_agent_id: recepcao.agentId, metadata: meta })
        }
      }
    } catch (recErr) {
      console.error(`${rotulo} recepção por QR falhou`, recErr)
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
  // Mensagem de voz também: o agente entende pela transcrição (ElevenLabs,
  // feita na fila) e responde com áudio — ver src/lib/respostaEmAudio.ts.
  const pedeResposta =
    (ehFala(msgType) && !!parsed.content) ||
    (msgType === 'audio' && !!parsed.mediaUrl)

  if (pedeResposta) {
    try {
      const conv = await deps.lerConversaIa(conversationId)

      // áudio só chama a IA onde a ElevenLabs está ligada para o campo do
      // agente — sem ela, o comportamento de antes (áudio não responde)
      let podeResponder = !!(conv?.ai_enabled && conv.ai_agent_id)
      if (podeResponder && msgType === 'audio') {
        podeResponder = await deps.audioPodeResponder(conv!.ai_agent_id!)
      }

      if (podeResponder) {
        await deps.enfileirarResposta({
          conversationId,
          instanceId: instancia.id,
          phone,
          // id sintético nunca vai para a fila (antes: payload.messageId ?? null)
          messageId: e.idExterno.startsWith('synthetic_') ? null : e.idExterno,
        })
        // responde no tempo certo (10–15 s após a última mensagem) sem
        // depender do cron: after() segura a função viva depois do 200
        deps.drenarDepois(conversationId)
      }
    } catch (aiErr) {
      // nunca deixar a IA derrubar o webhook (precisa sempre responder 200)
      console.error(`${rotulo} enfileiramento da IA falhou`, aiErr)
    }
  }
  return true
}
