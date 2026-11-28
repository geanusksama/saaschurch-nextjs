/**
 * Mensagem RECEBIDA pelo número oficial (webhook da Meta Cloud API) traduzida para o
 * mesmo formato que parseInbound (src/lib/zapiInbound.ts) devolve para a Z-API — assim as
 * duas caem iguais em whatsapp_messages e no agente de IA (registrarMensagemRecebida).
 *
 * Mídia: a Meta manda só o id (`image.id`, `audio.id`...). Aqui a mensagem sai com
 * mediaUrl null e `extra.meta_media_id`; baixarMidiaMeta busca o arquivo depois
 * (GET /{media_id} com o token do campo ⇒ URL que também exige o token) e o guarda no
 * storage 'dados', o mesmo dos anexos do WhatsApp.
 *
 * Também: status das mensagens livres (sent/delivered/read/failed) para
 * whatsapp_messages, sem regredir (a Meta pode entregar "read" antes de "delivered").
 *
 * Funções puras ou com dependências injetadas: nada de Next/Prisma (testável em Node).
 * Formato conforme developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components.
 */
import type { Graph } from './graph.ts'
import { normalizarNumeroBrasil } from '../numeroBrasil.ts'

export type MensagemConvertida = {
  type: string
  content: string | null
  preview: string
  mediaUrl: string | null
  mediaMime: string | null
  extra: Record<string, unknown>
}

export type RecebidaMeta = {
  telefone: string
  nomeRemetente: string | null
  mensagem: MensagemConvertida
  idExterno: string
}

export const PREVIEW_NAO_SUPORTADA = '[mensagem não suportada]'

/** Mesmos rótulos de prévia do parseInbound (Z-API). */
const ROTULO: Record<string, string> = {
  image: '📷 Foto',
  audio: '🎤 Áudio',
  video: '🎬 Vídeo',
  document: '📄 Documento',
  sticker: '🌟 Figurinha',
  location: '📍 Localização',
  contact: '👤 Contato',
}

const ehObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const txt = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)

/** Telefone do wa_id no formato das conversas (13 dígitos para celular BR); fora do Brasil, os dígitos. */
export function telefoneDaMeta(waId: unknown): string {
  const d = String(waId ?? '').replace(/\D/g, '')
  return normalizarNumeroBrasil(d) || d
}

function nomeDoContato(contatos: unknown, waId: string): string | null {
  if (!Array.isArray(contatos)) return null
  const lista = contatos.filter(ehObj)
  const c = lista.find((x) => x.wa_id === waId) ?? lista[0]
  return c && ehObj(c.profile) ? txt(c.profile.name) : null
}

/**
 * Converte uma mensagem de `value.messages[]`. null = nada a registrar (sem remetente,
 * reação removida).
 */
export function converterMensagemMeta(msg: unknown, contatos: unknown): RecebidaMeta | null {
  if (!ehObj(msg)) return null
  const from = txt(msg.from)
  if (!from) return null
  const telefone = telefoneDaMeta(from)
  if (!telefone) return null
  const idExterno = txt(msg.id) ?? `synthetic_${Date.now()}_${Math.random().toString(36).slice(2)}`
  const ctx = ehObj(msg.context) ? msg.context : null
  const tipo = txt(msg.type) ?? ''

  const base = (type: string, over: Partial<MensagemConvertida> = {}): RecebidaMeta => {
    const content = over.content ?? null
    return {
      telefone,
      nomeRemetente: nomeDoContato(contatos, from),
      idExterno,
      mensagem: {
        type,
        content,
        mediaUrl: null,
        mediaMime: over.mediaMime ?? null,
        preview: over.preview ?? (content || ROTULO[type] || `[${type}]`),
        extra: {
          ...(ctx && txt(ctx.id) ? { referenceMessageId: ctx.id } : {}),
          ...(ctx && (ctx.forwarded || ctx.frequently_forwarded) ? { forwarded: true } : {}),
          ...(over.extra ?? {}),
        },
      },
    }
  }
  const corpo = ehObj(msg[tipo]) ? (msg[tipo] as Record<string, unknown>) : {}
  const midia = (type: string, over: Partial<MensagemConvertida>) => {
    const mediaId = txt(corpo.id)
    return base(type, { ...over, extra: { ...(mediaId ? { meta_media_id: mediaId } : {}), ...(over.extra ?? {}) } })
  }

  switch (tipo) {
    case 'text': {
      const body = txt(corpo.body)
      if (body) return base('text', { content: body })
      break
    }
    case 'image': {
      const caption = txt(corpo.caption)
      return midia('image', {
        content: caption, mediaMime: txt(corpo.mime_type) ?? 'image/jpeg',
        preview: caption ? `📷 ${caption}` : ROTULO.image,
      })
    }
    case 'audio': {
      const ptt = corpo.voice === true
      return midia('audio', {
        mediaMime: txt(corpo.mime_type) ?? 'audio/ogg',
        preview: ptt ? '🎤 Mensagem de voz' : ROTULO.audio,
        extra: { ptt },
      })
    }
    case 'video': {
      const caption = txt(corpo.caption)
      return midia('video', {
        content: caption, mediaMime: txt(corpo.mime_type) ?? 'video/mp4',
        preview: caption ? `🎬 ${caption}` : ROTULO.video,
      })
    }
    case 'document': {
      const fileName = txt(corpo.filename)
      const caption = txt(corpo.caption)
      return midia('document', {
        content: caption ?? fileName, mediaMime: txt(corpo.mime_type),
        preview: `📄 ${fileName ?? 'Documento'}`,
        extra: fileName ? { fileName } : {},
      })
    }
    case 'sticker':
      return midia('sticker', { mediaMime: txt(corpo.mime_type) ?? 'image/webp' })
    case 'location': {
      const latitude = typeof corpo.latitude === 'number' ? corpo.latitude : null
      const longitude = typeof corpo.longitude === 'number' ? corpo.longitude : null
      if (latitude == null && longitude == null) break
      const address = txt(corpo.address) ?? txt(corpo.name)
      const mapa = txt(corpo.url) ?? `https://www.google.com/maps?q=${latitude},${longitude}`
      return base('location', {
        content: address || mapa,
        preview: address ? `📍 ${address}` : ROTULO.location,
        extra: { latitude, longitude, address: address ?? null, mapUrl: mapa },
      })
    }
    case 'contacts': {
      const c = Array.isArray(msg.contacts) && ehObj(msg.contacts[0]) ? msg.contacts[0] : null
      if (!c) break
      const nome = (ehObj(c.name) ? txt(c.name.formatted_name) : null) ?? 'Contato'
      const telefones = Array.isArray(c.phones)
        ? c.phones.filter(ehObj).map((t) => String(t.phone ?? t.wa_id ?? '')).filter(Boolean)
        : []
      return base('contact', {
        content: telefones.length ? `${nome} · ${telefones.join(', ')}` : nome,
        preview: `👤 ${nome}`,
        extra: { displayName: nome, phones: telefones, vCard: null },
      })
    }
    case 'button': {
      // resposta rápida de um modelo (template)
      const escolha = txt(corpo.text) ?? txt(corpo.payload)
      if (!escolha) break
      return base('button_reply', {
        content: escolha, preview: `🔘 ${escolha}`,
        extra: { buttonId: txt(corpo.payload), buttonLabel: txt(corpo.text) },
      })
    }
    case 'interactive': {
      if (corpo.type === 'button_reply' && ehObj(corpo.button_reply)) {
        const b = corpo.button_reply
        const escolha = txt(b.title) ?? txt(b.id)
        if (!escolha) break
        return base('button_reply', {
          content: escolha, preview: `🔘 ${escolha}`,
          extra: { buttonId: txt(b.id), buttonLabel: txt(b.title) },
        })
      }
      if (corpo.type === 'list_reply' && ehObj(corpo.list_reply)) {
        const l = corpo.list_reply
        const escolha = txt(l.title) ?? txt(l.description)
        if (!escolha) break
        return base('list_reply', {
          content: escolha, preview: `📋 ${escolha}`,
          extra: { title: txt(l.title), selectedRowId: txt(l.id) },
        })
      }
      break
    }
    case 'reaction': {
      const emoji = txt(corpo.emoji)
      // emoji vazio = a pessoa tirou a reação: nada a registrar
      if (!emoji) return null
      return base('reaction', {
        content: emoji, preview: `Reagiu com ${emoji}`,
        extra: { emoji, reactionBy: null, referencedMessageId: txt(corpo.message_id) },
      })
    }
  }

  // Chegou algo que ainda não sabemos exibir: registra em vez de sumir com a mensagem.
  return base('unsupported', { content: null, preview: PREVIEW_NAO_SUPORTADA, extra: { rawType: tipo || null } })
}

// ---------- extração do payload ----------

/** `entry[].changes[].value.messages[]` com os contatos e o phone_number_id de cada um. */
export function extrairRecebidasMeta(payload: unknown): Array<{ phoneNumberId: string; msg: unknown; contatos: unknown }> {
  const saida: Array<{ phoneNumberId: string; msg: unknown; contatos: unknown }> = []
  if (!ehObj(payload) || !Array.isArray(payload.entry)) return saida
  for (const entry of payload.entry) {
    if (!ehObj(entry) || !Array.isArray(entry.changes)) continue
    for (const ch of entry.changes) {
      if (!ehObj(ch) || !ehObj(ch.value)) continue
      const v = ch.value
      const pn = ehObj(v.metadata) ? txt(v.metadata.phone_number_id) : null
      if (!pn || !Array.isArray(v.messages)) continue
      for (const m of v.messages) if (ehObj(m)) saida.push({ phoneNumberId: pn, msg: m, contatos: v.contacts })
    }
  }
  return saida
}

export type StatusConversa = { phoneNumberId: string; wamid: string; status: 'sent' | 'delivered' | 'read' | 'failed'; telefone: string }

const STATUS_CONVERSA = new Set(['sent', 'delivered', 'read', 'failed'])

/** `statuses[]` com o telefone do destinatário (recipient_id), para achar a conversa. */
export function extrairStatusesConversa(payload: unknown): StatusConversa[] {
  const saida: StatusConversa[] = []
  if (!ehObj(payload) || !Array.isArray(payload.entry)) return saida
  for (const entry of payload.entry) {
    if (!ehObj(entry) || !Array.isArray(entry.changes)) continue
    for (const ch of entry.changes) {
      if (!ehObj(ch) || !ehObj(ch.value)) continue
      const v = ch.value
      const pn = ehObj(v.metadata) ? txt(v.metadata.phone_number_id) : null
      if (!pn || !Array.isArray(v.statuses)) continue
      for (const s of v.statuses) {
        if (!ehObj(s) || !txt(s.id) || !STATUS_CONVERSA.has(String(s.status))) continue
        const telefone = telefoneDaMeta(s.recipient_id)
        if (!telefone) continue
        saida.push({ phoneNumberId: pn, wamid: String(s.id), status: s.status as StatusConversa['status'], telefone })
      }
    }
  }
  return saida
}

const ORDEM_STATUS: Record<string, number> = { pending: 0, sent: 1, delivered: 2, read: 3 }

/** O status da mensagem na conversa só avança; "failed" só antes de entregue. */
export function statusConversaAvanca(atual: string | null | undefined, novo: string): boolean {
  const a = ORDEM_STATUS[atual ?? 'pending']
  if (novo === 'failed') return atual == null || a === 0 || a === 1
  const n = ORDEM_STATUS[novo]
  if (n === undefined) return false
  // de failed só sai para delivered/read (a Meta só manda esses se de fato entregou)
  if (atual === 'failed') return n >= ORDEM_STATUS.delivered
  return a === undefined || n > a
}

// ---------- mídia ----------

export const LIMITE_MIDIA_BYTES = 16 * 1024 * 1024 // o mesmo do upload de anexos do WhatsApp

export type DepsMidiaMeta = {
  graph: Pick<Graph, 'get'>
  /** GET da URL devolvida pela Meta com Authorization: Bearer (ela exige o token). */
  baixar: (url: string, token: string) => Promise<{ ok: boolean; status: number; bytes: Uint8Array; tipo: string | null }>
  /** Sobe no storage e devolve a URL pública (null se falhou). */
  guardar: (caminho: string, bytes: Uint8Array, mime: string) => Promise<string | null>
  limiteBytes?: number
  agora?: () => number
  aleatorio?: () => string
}

const EXTENSAO: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/amr': 'amr',
  'video/mp4': 'mp4', 'video/3gpp': '3gp',
  'application/pdf': 'pdf', 'text/plain': 'txt',
}

export function extensaoDaMidia(mime: string | null, nomeArquivo?: string | null): string {
  const base = (mime ?? '').split(';')[0].trim().toLowerCase()
  if (EXTENSAO[base]) return EXTENSAO[base]
  const m = /\.([a-z0-9]{1,8})$/i.exec(nomeArquivo ?? '')
  return m ? m[1].toLowerCase() : 'bin'
}

/**
 * Baixa a mídia da Meta e guarda no storage. Nunca lança: falha = null (a mensagem é
 * gravada mesmo assim, com o meta_media_id no metadata). Nunca registra o token.
 */
export async function baixarMidiaMeta(
  deps: DepsMidiaMeta, mediaId: string, token: string, dica: { mime?: string | null; nomeArquivo?: string | null } = {},
): Promise<{ url: string; mime: string } | null> {
  const limite = deps.limiteBytes ?? LIMITE_MIDIA_BYTES
  try {
    const info = await deps.graph.get(encodeURIComponent(mediaId), undefined, token)
    const url = txt(info?.url)
    if (!url || !/^https:\/\//i.test(url)) return null
    if (typeof info?.file_size === 'number' && info.file_size > limite) {
      console.warn('[meta/midia] arquivo acima do limite, não baixado', info.file_size)
      return null
    }
    const r = await deps.baixar(url, token)
    if (!r.ok || !r.bytes?.length) {
      console.warn('[meta/midia] download recusado', r.status)
      return null
    }
    if (r.bytes.length > limite) return null
    const mime = txt(info?.mime_type) ?? dica.mime ?? r.tipo ?? 'application/octet-stream'
    const agora = (deps.agora ?? Date.now)()
    const rnd = (deps.aleatorio ?? (() => Math.random().toString(36).slice(2)))()
    const caminho = `whatsapp/recebidas/${agora}-${rnd}.${extensaoDaMidia(mime, dica.nomeArquivo)}`
    const publica = await deps.guardar(caminho, r.bytes, mime)
    return publica ? { url: publica, mime } : null
  } catch (e) {
    console.warn('[meta/midia] falha ao baixar a mídia', (e as Error)?.name, (e as Error)?.message?.slice(0, 120))
    return null
  }
}
