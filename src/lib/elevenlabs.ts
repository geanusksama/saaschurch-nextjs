/**
 * Integração ElevenLabs — entender e responder mensagens de voz no WhatsApp.
 *
 *  - Transcrição (speech-to-text, modelo scribe_v1): o áudio que a pessoa
 *    manda vira texto SÓ para o agente entender. Fica em
 *    whatsapp_messages.metadata.transcricao e não aparece na conversa.
 *  - Voz (text-to-speech): quando a pessoa fala por áudio, o agente responde
 *    por áudio — voz masculina se a pessoa é homem, senão feminina (o
 *    atendente tem o mesmo sexo da pessoa; ver PROMPT_AGENTE_RECEPCAO).
 *
 * Configuração por campo em settings (setting_key = 'elevenlabs_configuration'),
 * separada de 'ai_configuration' porque a tela de IA regrava aquele JSON
 * inteiro a cada "Salvar" e apagaria estes campos. Sem coluna nova.
 *
 * Endpoints conferidos em elevenlabs.io/docs em 12/11/2026:
 *   POST /v1/speech-to-text (multipart: model_id, file, language_code)
 *   POST /v1/text-to-speech/{voice_id}?output_format=... (json: text, model_id)
 *   GET  /v1/voices
 */

import { prisma } from '@/lib/prisma'

export const ELEVENLABS_SETTING_KEY = 'elevenlabs_configuration'
const API = 'https://api.elevenlabs.io/v1'

export interface ElevenLabsConfig {
  ativo: boolean
  apiKey: string
  /** voz usada quando a pessoa é homem */
  vozMasculina: string
  /** voz usada quando a pessoa é mulher ou o sexo não é conhecido */
  vozFeminina: string
  /** modelo de voz (text-to-speech) */
  modelo: string
  /** áudio recebido em conversa com agente é respondido com áudio */
  responderComAudio: boolean
}

/** Vozes brasileiras da biblioteca da conta (conferidas em /v1/voices em 12/11/2026). */
export const ELEVENLABS_PADRAO: ElevenLabsConfig = {
  ativo: false,
  apiKey: '',
  vozMasculina: 'GIuLCSVfgJaUuh7hYOY8', // Lucas — masculina, pt-BR
  vozFeminina: '33B4UnXyTNbgLmdEDh5P', // Keren — feminina, pt-BR
  modelo: 'eleven_multilingual_v2',
  responderComAudio: true,
}

export function lerConfigElevenLabs(valor: unknown): ElevenLabsConfig {
  let raw: Record<string, unknown> = {}
  try {
    raw = (typeof valor === 'string' ? JSON.parse(valor) : valor) as Record<string, unknown> ?? {}
  } catch { raw = {} }
  const txt = (v: unknown, padrao: string) => (typeof v === 'string' && v.trim() ? v.trim() : padrao)
  return {
    ativo: raw.ativo === true,
    apiKey: txt(raw.apiKey, ''),
    vozMasculina: txt(raw.vozMasculina, ELEVENLABS_PADRAO.vozMasculina),
    vozFeminina: txt(raw.vozFeminina, ELEVENLABS_PADRAO.vozFeminina),
    modelo: txt(raw.modelo, ELEVENLABS_PADRAO.modelo),
    responderComAudio: raw.responderComAudio !== false,
  }
}

/** Config do campo; sem registro do campo, usa o global (campo nulo), como getAiConfig. */
export async function getElevenLabsConfig(campoId: string | null): Promise<ElevenLabsConfig> {
  try {
    let row = await prisma.setting.findFirst({ where: { settingKey: ELEVENLABS_SETTING_KEY, campoId } })
    if (!row && campoId) {
      row = await prisma.setting.findFirst({ where: { settingKey: ELEVENLABS_SETTING_KEY, campoId: null } })
    }
    return lerConfigElevenLabs(row?.settingValue ?? null)
  } catch (e) {
    console.error('[elevenlabs] erro ao ler configuração', e)
    return { ...ELEVENLABS_PADRAO }
  }
}

/** Pronta para uso: ligada e com chave. */
export function elevenLabsPronta(cfg: ElevenLabsConfig): boolean {
  return cfg.ativo && !!cfg.apiKey
}

// ── Transcrição ──────────────────────────────────────────────────────────────

/** Baixa o áudio (link da Z-API) e devolve o texto falado. Nunca lança: falha = null. */
export async function transcreverAudio(apiKey: string, audioUrl: string, mime?: string | null): Promise<string | null> {
  try {
    const baixado = await fetch(audioUrl, { signal: AbortSignal.timeout(12_000) })
    if (!baixado.ok) {
      console.error('[elevenlabs] não baixou o áudio', baixado.status)
      return null
    }
    const tipo = mime || baixado.headers.get('content-type') || 'audio/ogg'
    const blob = new Blob([await baixado.arrayBuffer()], { type: tipo })
    const form = new FormData()
    form.append('model_id', 'scribe_v1')
    form.append('language_code', 'por')
    form.append('file', blob, `audio.${extensao(tipo)}`)
    const r = await fetch(`${API}/speech-to-text`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey },
      body: form,
      // a fila trava a conversa por 120 s e o webhook vive 60 s: tetos curtos
      signal: AbortSignal.timeout(25_000),
    })
    if (!r.ok) {
      console.error('[elevenlabs] transcrição falhou', r.status, (await r.text().catch(() => '')).slice(0, 300))
      return null
    }
    const d = await r.json()
    const texto = String(d?.text ?? '').trim()
    return texto || null
  } catch (err) {
    console.error('[elevenlabs] transcrição falhou', err)
    return null
  }
}

function extensao(mime: string): string {
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3'
  if (mime.includes('mp4') || mime.includes('m4a') || mime.includes('aac')) return 'm4a'
  if (mime.includes('wav')) return 'wav'
  if (mime.includes('webm')) return 'webm'
  return 'ogg'
}

// ── Voz ──────────────────────────────────────────────────────────────────────

/** Abreviações de título que a voz leria letra por letra. */
const TITULOS: Array<[RegExp, string]> = [
  [/\bPra\.\s*/g, 'Pastora '],
  [/\bPr\.\s*/g, 'Pastor '],
  [/\bEv\.\s*/g, 'Evangelista '],
  [/\bMiss\.\s*/g, 'Missionária '],
  [/\bPb\.\s*/g, 'Presbítero '],
  [/\bDc\.\s*/g, 'Diácono '],
  [/\bDiac\.\s*/g, 'Diaconisa '],
]

const RE_LINK = /(https?:\/\/\S+|www\.\S+)/gi

/**
 * Texto que vai virar fala: sem links (vão por escrito), sem marcação do
 * WhatsApp (*negrito*, _itálico_, ~riscado~) e com títulos por extenso.
 */
export function textoParaFala(texto: string): string {
  let t = texto.replace(RE_LINK, '')
  for (const [re, por] of TITULOS) t = t.replace(re, por)
  return t
    .replace(/[*_~`]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 2_500)
}

/**
 * A resposta precisa ir também por escrito? Links (a pessoa precisa tocar) e
 * o questionário numerado do cadastro (precisa ler e responder item a item).
 */
export function precisaTextoEscrito(texto: string): boolean {
  RE_LINK.lastIndex = 0
  const temLink = RE_LINK.test(texto)
  RE_LINK.lastIndex = 0
  const questionario = (texto.match(/^\s*\d+[.)]\s/gm) ?? []).length >= 3
  return temLink || questionario
}

/** "Gravando áudio..." proporcional à fala (~14 caracteres/s), de 3 a 15 s (teto da Z-API). */
export function segundosGravando(fala: string): number {
  return Math.max(3, Math.min(15, Math.ceil((fala?.length ?? 0) / 14)))
}

/** Voz pelo sexo da pessoa: homem → masculina; mulher ou desconhecido → feminina. */
export function vozPara(cfg: ElevenLabsConfig, sexo: string | null | undefined): string {
  return sexo === 'M' ? cfg.vozMasculina : cfg.vozFeminina
}

/** Gera o MP3 da fala. Nunca lança: falha = null (a resposta sai por escrito). */
export async function sintetizarFala(cfg: ElevenLabsConfig, fala: string, sexo: string | null | undefined): Promise<Buffer | null> {
  if (!fala.trim()) return null
  try {
    const r = await fetch(`${API}/text-to-speech/${encodeURIComponent(vozPara(cfg, sexo))}?output_format=mp3_44100_64`, {
      method: 'POST',
      headers: { 'xi-api-key': cfg.apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text: fala, model_id: cfg.modelo }),
      signal: AbortSignal.timeout(25_000),
    })
    if (!r.ok) {
      console.error('[elevenlabs] voz falhou', r.status, (await r.text().catch(() => '')).slice(0, 300))
      return null
    }
    const buf = Buffer.from(await r.arrayBuffer())
    return buf.length > 0 ? buf : null
  } catch (err) {
    console.error('[elevenlabs] voz falhou', err)
    return null
  }
}

export interface VozElevenLabs {
  id: string
  nome: string
  sexo: string
  idioma: string
}

/** Vozes da conta (para a tela escolher). Lança com a mensagem da ElevenLabs. */
export async function listarVozes(apiKey: string): Promise<VozElevenLabs[]> {
  const r = await fetch(`${API}/voices`, { headers: { 'xi-api-key': apiKey }, signal: AbortSignal.timeout(15_000) })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) {
    const det = d?.detail
    throw new Error(typeof det === 'string' ? det : det?.message ?? `ElevenLabs respondeu ${r.status}`)
  }
  return (Array.isArray(d?.voices) ? d.voices : []).map((v: Record<string, unknown>) => {
    const l = (v.labels ?? {}) as Record<string, unknown>
    return {
      id: String(v.voice_id ?? ''),
      nome: String(v.name ?? ''),
      sexo: String(l.gender ?? ''),
      idioma: String(l.language ?? l.accent ?? ''),
    }
  }).filter((v: VozElevenLabs) => v.id)
}
