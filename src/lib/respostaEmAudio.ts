/**
 * Resposta do agente em áudio (a pessoa falou por mensagem de voz).
 *
 * 1. texto da resposta → fala (ElevenLabs, voz do sexo da pessoa);
 * 2. MP3 publicado no storage 'dados' (whatsapp/agente-voz/...), o mesmo
 *    bucket dos anexos do WhatsApp — a Caixa de Entrada toca o áudio por ele.
 *    Conversa com ASSUNTO RESERVADO não vai para o storage (link público):
 *    o áudio segue direto para a Z-API em base64 e não fica guardado;
 * 3. Z-API send-audio com delayTyping: a pessoa vê "Gravando áudio..." antes;
 * 4. se a resposta tem link, questionário ou opções clicáveis, o texto vai
 *    também por escrito logo depois (não dá para tocar num link falado).
 *
 * Retorno: true = o áudio SAIU (mesmo que o texto complementar falhe — a fila
 * não pode reenviar a resposta inteira). false = nada saiu; a fila manda por
 * escrito, como sempre fez.
 */

import { supabaseAdmin } from '@/lib/supabase-admin'
import {
  getElevenLabsConfig,
  precisaTextoEscrito,
  segundosGravando,
  sintetizarFala,
  textoParaFala,
} from '@/lib/elevenlabs'
import { persistOutboundMessage, sendAudioViaZApi, sendTextViaZApi } from '@/lib/whatsappSendService'
import { enviarComOpcoes, textoComOpcoes, type OpcoesMensagem } from '@/lib/opcoesAgente'

type Instancia = { id: string; instance_id: string; token: string; client_token: string }

export async function enviarRespostaEmAudio(p: {
  instance: Instancia
  conversationId: string
  phone: string
  texto: string
  opcoes: OpcoesMensagem | null
  campoId: string | null
  sexo: string
  /** assunto reservado: áudio sem link público */
  reservado: boolean
  /** conferência final (a pessoa voltou a escrever? outro worker assumiu?) — false = não envia */
  aindaPode: () => Promise<boolean>
}): Promise<boolean> {
  let audioMessageId: string | null = null
  let audioUrl: string | null = null
  let fala = ''
  try {
    const cfg = await getElevenLabsConfig(p.campoId)
    fala = textoParaFala(p.texto)
    if (!fala) return false

    const mp3 = await sintetizarFala(cfg, fala, p.sexo)
    if (!mp3) return false

    let audio: string
    if (p.reservado) {
      audio = `data:audio/mpeg;base64,${mp3.toString('base64')}`
    } else {
      const caminho = `whatsapp/agente-voz/${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`
      const { error } = await supabaseAdmin.storage.from('dados').upload(caminho, mp3, { contentType: 'audio/mpeg', upsert: false })
      if (error) {
        console.error('[respostaEmAudio] upload falhou', error.message)
        return false
      }
      audioUrl = supabaseAdmin.storage.from('dados').getPublicUrl(caminho).data.publicUrl
      audio = audioUrl
    }

    // a voz leva alguns segundos: confere de novo antes de sair
    if (!(await p.aindaPode())) return false

    const r = await sendAudioViaZApi(p.instance, p.phone, audio, { gravandoSegundos: segundosGravando(fala) })
    if (r.status !== 'sent') {
      console.error('[respostaEmAudio] Z-API não enviou o áudio', r)
      return false
    }
    audioMessageId = r.messageId ?? null
  } catch (err) {
    console.error('[respostaEmAudio] falhou antes do envio', err)
    return false
  }

  // daqui em diante o áudio JÁ SAIU: qualquer falha só é registrada
  try {
    // na conversa aparece o áudio; o texto falado fica no metadata (o agente
    // lê no histórico, a tela não mostra)
    await supabaseAdmin.from('whatsapp_messages').insert({
      conversation_id: p.conversationId,
      content: null,
      type: 'audio',
      direction: 'outbound',
      status: 'sent',
      media_url: audioUrl,
      media_mime_type: 'audio/mpeg',
      metadata: { zapi_message_id: audioMessageId, ptt: true, texto_falado: p.texto, voz: p.sexo === 'M' ? 'masculina' : 'feminina' },
    })
    await supabaseAdmin
      .from('whatsapp_conversations')
      .update({ last_message: '🎤 Mensagem de voz', last_message_at: new Date().toISOString() })
      .eq('id', p.conversationId)
  } catch (err) {
    console.error('[respostaEmAudio] áudio enviado, mas não registrado', err)
  }

  try {
    // link, questionário ou opções: vai também por escrito, em seguida
    if (p.opcoes) {
      const t = await enviarComOpcoes(p.instance, p.phone, p.texto, p.opcoes, 2)
      if (t.status === 'sent') await persistOutboundMessage(p.conversationId, textoComOpcoes(p.texto, p.opcoes), t.messageId || undefined)
    } else if (precisaTextoEscrito(p.texto)) {
      const t = await sendTextViaZApi(p.instance, p.phone, p.texto, { delayTyping: 2, delayMessage: 2 })
      if (t.status === 'sent') await persistOutboundMessage(p.conversationId, p.texto, t.messageId || undefined)
    }
  } catch (err) {
    console.error('[respostaEmAudio] áudio enviado; o texto complementar falhou', err)
  }
  return true
}
