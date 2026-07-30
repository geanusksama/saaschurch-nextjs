/**
 * Leitura da mensagem recebida da Z-API.
 *
 * O webhook antigo só entendia texto, e as mídias na prática não chegavam: ele
 * procurava `image.url`, `document.url`, `video.url`, `sticker.url`, mas a Z-API
 * envia `image.imageUrl`, `document.documentUrl`, `video.videoUrl` e
 * `sticker.stickerUrl` (o único com `url` era o áudio, por acidente do
 * fallback). Resultado: foto, PDF, vídeo, figurinha, localização, contato,
 * resposta de botão e de lista chegavam e eram descartadas — a conversa no
 * sistema ficava com buracos em relação ao WhatsApp de verdade.
 *
 * Aqui a mensagem é traduzida uma única vez, para o formato que a tabela
 * whatsapp_messages guarda, aceitando as duas grafias de cada campo (a Z-API
 * mudou nomes ao longo das versões e há instâncias antigas em produção).
 *
 * Campos por tipo conforme https://developer.z-api.io/webhooks/on-message-received-examples
 *
 * Função pura: nada de banco, nada de rede — dá para testar com o JSON da doc
 * (ver scripts/e2e-zapi-inbound.mjs).
 */

import type { ZApiWebhookPayload } from '@/types/whatsapp'

/** Tipos que a conversa sabe exibir. */
export type InboundType =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contact'
  | 'button_reply'
  | 'list_reply'
  | 'reaction'
  | 'poll'
  | 'poll_vote'
  | 'unsupported'

export interface ParsedInbound {
  type: InboundType
  /** texto da mensagem, legenda da mídia ou rótulo do que foi escolhido */
  content: string | null
  mediaUrl: string | null
  mediaMime: string | null
  /** o que vai em conversations.last_message (a prévia da lista) */
  preview: string
  /**
   * Detalhes que só fazem sentido em alguns tipos, guardados em
   * whatsapp_messages.metadata (jsonb) — sem coluna nova para cada um.
   */
  extra: Record<string, unknown>
}

const first = <T>(...values: Array<T | null | undefined>): T | null => {
  for (const v of values) if (v !== undefined && v !== null && v !== '') return v as T
  return null
}

/** Rótulo humano do tipo, para a prévia da lista de conversas. */
const PREVIEW_LABEL: Record<InboundType, string> = {
  text: '',
  image: '📷 Foto',
  audio: '🎤 Áudio',
  video: '🎬 Vídeo',
  document: '📄 Documento',
  sticker: '🌟 Figurinha',
  location: '📍 Localização',
  contact: '👤 Contato',
  button_reply: '',
  list_reply: '',
  reaction: '',
  poll: '📊 Enquete',
  poll_vote: '📊 Voto na enquete',
  unsupported: '📎 Mensagem não suportada',
}

export function parseInbound(payload: ZApiWebhookPayload): ParsedInbound {
  const p = payload as ZApiWebhookPayload & Record<string, unknown>

  const base = (type: InboundType, over: Partial<ParsedInbound> = {}): ParsedInbound => {
    const content = over.content ?? null
    return {
      type,
      content,
      mediaUrl: over.mediaUrl ?? null,
      mediaMime: over.mediaMime ?? null,
      preview: over.preview ?? (content || PREVIEW_LABEL[type] || `[${type}]`),
      extra: {
        ...(p.referenceMessageId ? { referenceMessageId: p.referenceMessageId } : {}),
        ...(p.forwarded ? { forwarded: true } : {}),
        ...(p.isEdit ? { isEdit: true } : {}),
        ...(over.extra ?? {}),
      },
    }
  }

  // ── texto (inclui link com prévia) ──
  if (p.text?.message) {
    return base('text', {
      content: p.text.message,
      extra: {
        ...(p.text.url ? { linkUrl: p.text.url, linkTitle: p.text.title ?? null } : {}),
      },
    })
  }

  // ── imagem ──
  const imageUrl = first<string>(p.image?.imageUrl, p.image?.url)
  if (imageUrl) {
    const caption = first<string>(p.image?.caption)
    return base('image', {
      content: caption,
      mediaUrl: imageUrl,
      mediaMime: p.image?.mimeType ?? 'image/jpeg',
      preview: caption ? `📷 ${caption}` : PREVIEW_LABEL.image,
      extra: {
        ...(p.image?.thumbnailUrl ? { thumbnailUrl: p.image.thumbnailUrl } : {}),
        ...(p.image?.viewOnce ? { viewOnce: true } : {}),
      },
    })
  }

  // ── áudio (ptt = mensagem de voz) ──
  const audioUrl = first<string>(
    p.audio?.audioUrl,
    p.audio?.url,
    p.ptt?.audioUrl,
    p.ptt?.url
  )
  if (audioUrl) {
    const ptt = Boolean(p.audio?.ptt ?? p.ptt)
    return base('audio', {
      mediaUrl: audioUrl,
      mediaMime: first<string>(p.audio?.mimeType, p.ptt?.mimeType) ?? 'audio/ogg',
      preview: ptt ? '🎤 Mensagem de voz' : PREVIEW_LABEL.audio,
      extra: {
        ptt,
        ...(p.audio?.seconds ? { seconds: p.audio.seconds } : {}),
      },
    })
  }

  // ── vídeo ──
  const videoUrl = first<string>(p.video?.videoUrl, p.video?.url)
  if (videoUrl) {
    const caption = first<string>(p.video?.caption)
    return base('video', {
      content: caption,
      mediaUrl: videoUrl,
      mediaMime: p.video?.mimeType ?? 'video/mp4',
      preview: caption ? `🎬 ${caption}` : PREVIEW_LABEL.video,
      extra: { ...(p.video?.seconds ? { seconds: p.video.seconds } : {}) },
    })
  }

  // ── documento ──
  const documentUrl = first<string>(p.document?.documentUrl, p.document?.url)
  if (documentUrl) {
    const fileName = first<string>(p.document?.fileName, p.document?.title)
    const caption = first<string>(p.document?.caption)
    return base('document', {
      content: caption ?? fileName,
      mediaUrl: documentUrl,
      mediaMime: p.document?.mimeType ?? null,
      preview: `📄 ${fileName ?? 'Documento'}`,
      extra: {
        ...(fileName ? { fileName } : {}),
        ...(p.document?.pageCount ? { pageCount: p.document.pageCount } : {}),
      },
    })
  }

  // ── figurinha ──
  const stickerUrl = first<string>(p.sticker?.stickerUrl, p.sticker?.url)
  if (stickerUrl) {
    return base('sticker', { mediaUrl: stickerUrl, mediaMime: p.sticker?.mimeType ?? 'image/webp' })
  }

  // ── localização ──
  if (p.location && (p.location.latitude != null || p.location.longitude != null)) {
    const { latitude, longitude, address, url } = p.location
    const mapa = url || `https://www.google.com/maps?q=${latitude},${longitude}`
    return base('location', {
      content: address || mapa,
      preview: address ? `📍 ${address}` : PREVIEW_LABEL.location,
      extra: { latitude, longitude, address: address ?? null, mapUrl: mapa },
    })
  }

  // ── contato compartilhado ──
  if (p.contact?.displayName || p.contact?.vCard) {
    const nome = p.contact.displayName ?? 'Contato'
    const telefones: string[] = Array.isArray(p.contact.phones)
      ? p.contact.phones.map((t: unknown) => String(t))
      : []
    return base('contact', {
      content: telefones.length ? `${nome} · ${telefones.join(', ')}` : nome,
      preview: `👤 ${nome}`,
      extra: { displayName: nome, phones: telefones, vCard: p.contact.vCard ?? null },
    })
  }

  // ── resposta de botão ──
  if (p.buttonsResponseMessage?.message || p.buttonsResponseMessage?.buttonId) {
    const escolha = p.buttonsResponseMessage.message ?? p.buttonsResponseMessage.buttonId
    return base('button_reply', {
      content: escolha,
      preview: `🔘 ${escolha}`,
      extra: {
        buttonId: p.buttonsResponseMessage.buttonId ?? null,
        buttonLabel: p.buttonsResponseMessage.message ?? null,
      },
    })
  }

  // ── resposta de lista ──
  if (p.listResponseMessage?.message || p.listResponseMessage?.title) {
    const escolha = first<string>(p.listResponseMessage.title, p.listResponseMessage.message)!
    return base('list_reply', {
      content: p.listResponseMessage.message ?? escolha,
      preview: `📋 ${escolha}`,
      extra: {
        title: p.listResponseMessage.title ?? null,
        selectedRowId: p.listResponseMessage.selectedRowId ?? null,
      },
    })
  }

  // ── reação a uma mensagem ──
  if (p.reaction?.value) {
    return base('reaction', {
      content: p.reaction.value,
      preview: `Reagiu com ${p.reaction.value}`,
      extra: {
        emoji: p.reaction.value,
        reactionBy: p.reaction.reactionBy ?? null,
        referencedMessageId: p.reaction.referencedMessage?.messageId ?? null,
      },
    })
  }

  // ── enquete e voto ──
  if (p.poll?.question) {
    const opcoes: string[] = Array.isArray(p.poll.options)
      ? p.poll.options.map((o) => String(o?.name ?? o))
      : []
    return base('poll', {
      content: p.poll.question,
      preview: `📊 ${p.poll.question}`,
      extra: { question: p.poll.question, options: opcoes },
    })
  }
  if (p.pollVote?.options) {
    const votos: string[] = Array.isArray(p.pollVote.options)
      ? p.pollVote.options.map((o) => String(o?.name ?? o))
      : []
    return base('poll_vote', {
      content: votos.join(', ') || null,
      preview: `📊 Votou: ${votos.join(', ') || '—'}`,
      extra: { pollMessageId: p.pollVote.pollMessageId ?? null, options: votos },
    })
  }

  // Chegou algo que ainda não sabemos exibir: registra em vez de sumir com a
  // mensagem, para a conversa não ficar com um vão inexplicável.
  return base('unsupported', {
    content: null,
    extra: { rawType: p.type ?? null },
  })
}
