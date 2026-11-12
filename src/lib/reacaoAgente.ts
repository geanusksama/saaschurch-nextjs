/**
 * Reação do agente à mensagem da pessoa (emoji na própria mensagem dela, como
 * no WhatsApp). O texto do agente nunca leva emoji — a reação é o único lugar.
 *
 * O agente pede com [[REAGIR]]🙏[[/REAGIR]]; o sistema tira o bloco e manda a
 * reação pela Z-API (POST send-reaction: phone, reaction, messageId) antes da
 * resposta. Só emojis da lista; qualquer outro é ignorado.
 */

export const MARCA_REAGIR_INICIO = '[[REAGIR]]'
export const MARCA_REAGIR_FIM = '[[/REAGIR]]'
// só as formais (pedido do dono): nada de risada ou que quebre a formalidade
export const REACOES_PERMITIDAS = ['🙏', '👍']

const ZAPI_BASE = 'https://api.z-api.io'

export function extrairReacao(texto: string): { texto: string; reacao: string | null } {
  const i = texto.indexOf(MARCA_REAGIR_INICIO)
  if (i < 0) return { texto, reacao: null }
  const f = texto.indexOf(MARCA_REAGIR_FIM, i)
  const bruto = texto.slice(i + MARCA_REAGIR_INICIO.length, f < 0 ? undefined : f).trim()
  const limpo = (texto.slice(0, i) + (f < 0 ? '' : texto.slice(f + MARCA_REAGIR_FIM.length))).trim()
  const reacao = REACOES_PERMITIDAS.find(r => bruto.includes(r)) ?? null
  return { texto: limpo, reacao }
}

/** Tira qualquer emoji do texto (o agente de recepção não escreve emoji). */
export function semEmoji(texto: string): string {
  return texto
    .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}]/gu, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

export async function enviarReacao(
  instance: { instance_id: string; token: string; client_token: string },
  phone: string,
  messageId: string,
  reacao: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${ZAPI_BASE}/instances/${instance.instance_id}/token/${instance.token}/send-reaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Client-Token': instance.client_token },
      body: JSON.stringify({ phone, reaction: reacao, messageId }),
    })
    return res.ok
  } catch (err) {
    console.error('[reacaoAgente] send-reaction falhou', err)
    return false
  }
}
