/**
 * Opções clicáveis nas mensagens do agente (botões e lista do WhatsApp).
 *
 * Quando a pergunta tem respostas fechadas (sim/não, departamentos, datas da
 * visita, forma do cadastro, estado civil), o agente acrescenta
 *   [[OPCOES]]{"opcoes":["Sim","Não"],"botao":"Ver opções"}[[/OPCOES]]
 * O sistema tira o bloco e envia a pergunta com as opções pela Z-API:
 *  - até 3 opções curtas → POST send-button-list  (buttonList.buttons[].label/id)
 *  - mais que isso       → POST send-option-list  (optionList.title/buttonLabel/options[])
 * Se a Z-API recusar, a mesma pergunta sai como texto com as opções em lista,
 * para a pessoa nunca ficar sem a pergunta.
 *
 * A resposta da pessoa chega como button_reply/list_reply (src/lib/zapiInbound.ts)
 * com o texto da opção — o agente lê como uma mensagem normal.
 */

import type { SendMessageResult } from '@/types/whatsapp'
import { enforceRateLimit, sendTextViaZApi } from '@/lib/whatsappSendService'

export const MARCA_OPCOES_INICIO = '[[OPCOES]]'
export const MARCA_OPCOES_FIM = '[[/OPCOES]]'

const ZAPI_BASE = 'https://api.z-api.io'
// limites do WhatsApp: botão até 20 caracteres; linha da lista até 24; 10 linhas
const MAX_BOTOES = 3
const MAX_ROTULO_BOTAO = 20
const MAX_TITULO_LINHA = 24
const MAX_LINHAS = 10

export interface Opcao {
  titulo: string
  descricao?: string
}

export interface OpcoesMensagem {
  opcoes: Opcao[]
  /** texto do botão que abre a lista (só na lista) */
  botao: string
}

function corta(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + '…'
}

/** Tira o bloco de opções do texto. Bloco quebrado some e volta null. */
export function extrairOpcoes(texto: string): { texto: string; opcoes: OpcoesMensagem | null } {
  const i = texto.indexOf(MARCA_OPCOES_INICIO)
  if (i < 0) return { texto, opcoes: null }
  const f = texto.indexOf(MARCA_OPCOES_FIM, i)
  const bruto = texto.slice(i + MARCA_OPCOES_INICIO.length, f < 0 ? undefined : f)
  const limpo = (texto.slice(0, i) + (f < 0 ? '' : texto.slice(f + MARCA_OPCOES_FIM.length))).trim()
  try {
    const j = JSON.parse(bruto.replace(/^[\s`]*(json)?/i, '').replace(/[\s`]*$/, ''))
    const lista: unknown[] = Array.isArray(j?.opcoes) ? j.opcoes : []
    const opcoes: Opcao[] = lista
      .map(o => (typeof o === 'string'
        ? { titulo: o.trim() }
        : { titulo: String((o as { titulo?: unknown })?.titulo ?? '').trim(), descricao: String((o as { descricao?: unknown })?.descricao ?? '').trim() || undefined }))
      .filter(o => o.titulo)
      .slice(0, MAX_LINHAS)
    if (opcoes.length < 2) return { texto: limpo, opcoes: null }
    const botao = String(j?.botao ?? '').trim() || 'Ver opções'
    return { texto: limpo, opcoes: { opcoes, botao: corta(botao, 20) } }
  } catch {
    console.error('[opcoesAgente] bloco inválido', bruto.slice(0, 300))
    return { texto: limpo, opcoes: null }
  }
}

/** Como a mensagem fica registrada na Caixa de Entrada (e no histórico da IA). */
export function textoComOpcoes(texto: string, o: OpcoesMensagem): string {
  return [texto, '', ...o.opcoes.map(x => `- ${x.titulo}`)].join('\n').trim()
}

function usaBotoes(o: OpcoesMensagem): boolean {
  return o.opcoes.length <= MAX_BOTOES && o.opcoes.every(x => x.titulo.length <= MAX_ROTULO_BOTAO && !x.descricao)
}

async function parse(res: Response): Promise<SendMessageResult> {
  if (!res.ok) return { messageId: '', status: 'error', error: (await res.text().catch(() => '')) || `HTTP ${res.status}` }
  const j = await res.json().catch(() => null) as { messageId?: string; id?: string; zaapId?: string; error?: string } | null
  if (!j) return { messageId: '', status: 'error', error: 'resposta inválida da Z-API' }
  if (j.error) return { messageId: '', status: 'error', error: j.error }
  const id = j.messageId || j.id || j.zaapId || ''
  return id ? { messageId: id, status: 'sent' } : { messageId: '', status: 'error', error: 'Z-API sem messageId' }
}

/**
 * Envia a pergunta com as opções clicáveis. Se a Z-API recusar, cai para
 * texto (com as opções listadas) — nunca deixa a pessoa sem a pergunta.
 */
export async function enviarComOpcoes(
  instance: { instance_id: string; token: string; client_token: string },
  phone: string,
  texto: string,
  o: OpcoesMensagem,
  delayTyping?: number,
): Promise<SendMessageResult> {
  const message = texto.trim() || 'Escolha uma opção:'
  const base = `${ZAPI_BASE}/instances/${instance.instance_id}/token/${instance.token}`
  const headers = { 'Content-Type': 'application/json', 'Client-Token': instance.client_token }
  const body = usaBotoes(o)
    ? {
        url: `${base}/send-button-list`,
        json: {
          phone, message,
          buttonList: { buttons: o.opcoes.map((x, n) => ({ id: String(n + 1), label: x.titulo })) },
        },
      }
    : {
        url: `${base}/send-option-list`,
        json: {
          phone, message,
          optionList: {
            title: 'Opções',
            buttonLabel: o.botao,
            options: o.opcoes.map((x, n) => {
              // "EBD (Escola Bíblica Dominical)" não cabe em 24: o parêntese
              // vira a descrição da linha em vez de ser cortado
              const p = x.titulo.match(/^(.+?)\s*\((.+)\)\s*$/)
              const [titulo, descricao] = x.titulo.length > MAX_TITULO_LINHA && p
                ? [p[1], x.descricao || p[2]]
                : [x.titulo, x.descricao]
              return {
                id: String(n + 1),
                title: corta(titulo, MAX_TITULO_LINHA),
                ...(descricao ? { description: corta(descricao, 72) } : {}),
              }
            }),
          },
        },
      }
  try {
    await enforceRateLimit(instance.instance_id)
    const r = await parse(await fetch(body.url, { method: 'POST', headers, body: JSON.stringify(body.json) }))
    if (r.status === 'sent') return r
    console.error('[opcoesAgente] Z-API recusou opções, enviando texto', r.error)
  } catch (err) {
    console.error('[opcoesAgente] envio com opções falhou, enviando texto', err)
  }
  return sendTextViaZApi(instance, phone, textoComOpcoes(message, o), { delayTyping })
}
