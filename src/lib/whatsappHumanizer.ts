/**
 * whatsappHumanizer — ritmo humano nas respostas do agente de IA.
 *
 * Baseado no que a Z-API oferece (developer.z-api.io):
 *  - send-text aceita `delayTyping` e `delayMessage` (1..15 s cada). O
 *    delayTyping é o "digitando..." de verdade, exibido no aparelho do contato.
 *  - o webhook on-chat-presence avisa quando o contato está `composing`.
 *
 * O que um robô entrega e um humano não:
 *  - responde em 300 ms;
 *  - responde três vezes porque a pessoa mandou três mensagens;
 *  - responde enquanto a pessoa ainda está digitando;
 *  - nunca lê a mensagem (fica sem os tiques azuis);
 *  - enche de emoji.
 */

/** Janela de silêncio antes de responder: 10 a 15 s (pedido do produto). */
export const REPLY_WINDOW_MIN_MS = 10_000
export const REPLY_WINDOW_MAX_MS = 15_000

/** Enquanto o contato digita, adia a resposta — ninguém responde por cima. */
export const TYPING_POSTPONE_MS = 8_000

/**
 * Teto absoluto: mesmo com a pessoa digitando sem parar, respondemos em até
 * 2 min. Sem o teto uma pessoa "escrevendo um livro" travaria o atendimento.
 */
export const MAX_WAIT_MS = 120_000

/** Espera aleatória — sempre o mesmo intervalo também é assinatura de robô. */
export function replyDelayMs(): number {
  return REPLY_WINDOW_MIN_MS + Math.random() * (REPLY_WINDOW_MAX_MS - REPLY_WINDOW_MIN_MS)
}

/**
 * Tempo de "digitando..." proporcional ao tamanho do texto.
 * ~35 caracteres/s é datilografia rápida de celular; o limite da Z-API é 15 s.
 */
export function typingSecondsFor(text: string): number {
  const seconds = Math.ceil((text?.length ?? 0) / 35)
  return Math.max(3, Math.min(15, seconds))
}

/** Pequena hesitação antes de começar a digitar (1..3 s). */
export function preTypingSeconds(): number {
  return 1 + Math.floor(Math.random() * 3)
}

/**
 * Regra de emoji para o prompt do agente: presença leve, nunca decoração.
 * Fica aqui para que o texto seja o mesmo em toda geração de resposta.
 */
export const EMOJI_GUIDANCE =
  'Use emoji com muita parcimônia: no máximo um por mensagem, e só quando ' +
  'somar de verdade (uma saudação calorosa, um agradecimento). Muitas respostas ' +
  'não levam emoji nenhum — texto limpo é o normal. Nunca use emoji em sequência ' +
  'nem para enfeitar cada frase.'

/**
 * Regra de consolidação: a pessoa pode ter escrito em várias mensagens, e o
 * agente responde UMA vez, ao conjunto.
 */
export const CONSOLIDATION_GUIDANCE =
  'O contato pode ter enviado várias mensagens seguidas — trate todas como uma ' +
  'fala só e responda UMA única vez, cobrindo o conjunto. Não responda mensagem ' +
  'por mensagem e não repita o que já foi respondido antes na conversa.'
