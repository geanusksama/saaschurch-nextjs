/**
 * Correção do dia citado nas mensagens do Cronograma de Acompanhamento.
 *
 * O problema que isto resolve: as etapas de véspera são agendadas para o dia
 * ANTERIOR ao culto (terça para o culto de ensino de quarta, sábado para o
 * domingo) e o texto da matriz diz "Amanhã tem culto de ensino". Só que a
 * mensagem não sai necessariamente no dia agendado — quem é inscrito numa terça
 * às 21h já tem o horário da terça vencido, e a fila só anda na manhã seguinte,
 * dentro da janela de envio. Resultado: na quarta a pessoa recebia "amanhã tem
 * culto", quando o culto era naquele mesmo dia.
 *
 * A correção é no momento do envio, não no agendamento: descobre-se QUE DIA o
 * texto está citando (a partir da data agendada) e reescreve-se a referência em
 * relação ao dia em que a mensagem está realmente saindo.
 *
 * Duas naturezas de referência, tratadas de forma diferente:
 *
 *   relativa ("Hoje"/"Amanhã") — só é verdade no dia exato. Qualquer desvio
 *     precisa de reescrita: agendada terça e enviada quarta vira "Hoje".
 *   nomeada ("Domingo", "Quarta") — continua verdade em qualquer dia anterior.
 *     "Domingo tem Escola Bíblica" enviada no sábado está correta e fica como
 *     está; só quando o domingo chega vira "Hoje".
 *
 * Se o dia citado já passou, a mensagem é marcada como vencida e o cron não
 * envia — avisar de um culto que já aconteceu é pior que não avisar.
 *
 * Por que mexer no texto e não usar um placeholder: a matriz é editada pela
 * secretaria em português corrente, e um `{{...}}` não resolvido vazaria para o
 * WhatsApp de uma pessoa real. O texto natural continua natural.
 *
 * Cultos da igreja: domingo e quarta (CULTO_WEEKDAYS). Nenhuma etapa padrão
 * convida para culto em outro dia.
 */

import { WEEKDAY_LABELS } from './pastoralJourneyDefault'

/** Dias com culto: 0 = domingo, 3 = quarta. */
export const CULTO_WEEKDAYS = [0, 3] as const

const BRT_OFFSET_MIN = -180
const DAY_MS = 86_400_000

/** Dia do calendário em Brasília, normalizado à meia-noite UTC para contas. */
function brtCalendarDay(value: Date | string): Date {
  const date = value instanceof Date ? value : new Date(value)
  const shifted = new Date(date.getTime() + BRT_OFFSET_MIN * 60_000)
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()))
}

function addDays(day: Date, n: number): Date {
  return new Date(day.getTime() + n * DAY_MS)
}

/** Primeira ocorrência de `weekday` em ou após `from`. */
function nextWeekday(from: Date, weekday: number): Date {
  const alvo = ((weekday % 7) + 7) % 7
  return addDays(from, (alvo - from.getUTCDay() + 7) % 7)
}

/**
 * Referência de dia encontrada na mensagem. Só a primeira interessa: é a que dá
 * o tom ("Amanhã tem culto...", "Domingo tem Escola Bíblica...").
 */
interface FoundRef {
  /** trecho exato encontrado no texto, para substituir preservando o resto */
  matched: string
  index: number
  /** dia citado, resolvido a partir da data agendada */
  referred: Date
  kind: 'relativa' | 'nomeada'
}

/**
 * Palavra inteira, tolerante a acento. `\b` não serve aqui: em JS a fronteira de
 * palavra é ASCII e, em "Amanhã tem", não existe fronteira depois do "ã" — era
 * por isso que a primeira versão desta regra nunca casava com o texto da matriz.
 */
function wordRe(alternativas: string): RegExp {
  return new RegExp(`(?<!\\p{L})(?:${alternativas})(?!\\p{L})`, 'iu')
}

const HOJE_RE = wordRe('hoje')
const AMANHA_RE = wordRe('amanh[ãa]')

/** Remove acentos para casar "Sabado" com "Sábado" na matriz editada à mão. */
function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

function findDayReference(message: string, scheduledDay: Date): FoundRef | null {
  const candidates: FoundRef[] = []

  const hoje = HOJE_RE.exec(message)
  if (hoje) {
    candidates.push({ matched: hoje[0], index: hoje.index, referred: scheduledDay, kind: 'relativa' })
  }

  const amanha = AMANHA_RE.exec(message)
  if (amanha) {
    candidates.push({
      matched: amanha[0],
      index: amanha.index,
      referred: addDays(scheduledDay, 1),
      kind: 'relativa',
    })
  }

  WEEKDAY_LABELS.forEach((label, weekday) => {
    const hit = wordRe(`${label}|${semAcento(label)}`).exec(message)
    if (hit) {
      candidates.push({
        matched: hit[0],
        index: hit.index,
        referred: nextWeekday(scheduledDay, weekday),
        kind: 'nomeada',
      })
    }
  })

  if (!candidates.length) return null
  return candidates.sort((a, b) => a.index - b.index)[0]
}

/** Mantém a caixa do trecho original: "Amanhã" → "Hoje", "amanhã" → "hoje". */
function matchCase(sample: string, replacement: string): string {
  const primeiraMaiuscula = sample[0] === sample[0]?.toUpperCase()
  return primeiraMaiuscula
    ? replacement[0].toUpperCase() + replacement.slice(1)
    : replacement[0].toLowerCase() + replacement.slice(1)
}

export interface DayRefResult {
  /** texto pronto para enviar (igual ao original quando nada muda) */
  message: string
  changed: boolean
  /** o dia citado já passou — não enviar */
  stale: boolean
  /** dias entre o dia citado e o dia do envio (negativo = passou) */
  deltaDays: number | null
  /** dia da semana citado (0=domingo), quando foi possível identificar */
  referredWeekday: number | null
}

/**
 * Reescreve a referência de dia da mensagem para a verdade do dia do envio.
 *
 *   "Amanhã" agendado terça, enviado terça   → intacto
 *   "Amanhã" agendado terça, enviado quarta  → "Hoje"
 *   "Amanhã" agendado terça, enviado segunda → "Quarta"
 *   "Amanhã" agendado terça, enviado quinta  → vencida (não enviar)
 *   "Domingo" agendado sábado, enviado sábado  → intacto (segue verdade)
 *   "Domingo" agendado sábado, enviado domingo → "Hoje"
 *   "Domingo" agendado sábado, enviado segunda → vencida
 *   sem referência de dia no texto → intacto, nunca vencida
 */
export function adjustDayReference(
  message: string,
  opts: { scheduledAt: Date | string; sentAt: Date | string }
): DayRefResult {
  const original = String(message ?? '')
  const scheduledDay = brtCalendarDay(opts.scheduledAt)
  const sendDay = brtCalendarDay(opts.sentAt)

  const ref = findDayReference(original, scheduledDay)
  if (!ref) {
    return { message: original, changed: false, stale: false, deltaDays: null, referredWeekday: null }
  }

  const deltaDays = Math.round((ref.referred.getTime() - sendDay.getTime()) / DAY_MS)
  const referredWeekday = ref.referred.getUTCDay()
  const intacto = { message: original, changed: false, stale: false, deltaDays, referredWeekday }

  // o dia citado já passou: o convite perdeu o sentido
  if (deltaDays < 0) {
    return { ...intacto, stale: true }
  }

  // dia nomeado a mais de um dia de distância continua correto como está
  if (ref.kind === 'nomeada' && deltaDays > 0) return intacto

  const alvo =
    deltaDays === 0 ? 'Hoje' : deltaDays === 1 ? 'Amanhã' : WEEKDAY_LABELS[referredWeekday]

  // já diz a coisa certa
  if (semAcento(alvo).toLowerCase() === semAcento(ref.matched).toLowerCase()) return intacto

  const replacement = matchCase(ref.matched, alvo)
  return {
    message:
      original.slice(0, ref.index) + replacement + original.slice(ref.index + ref.matched.length),
    changed: true,
    stale: false,
    deltaDays,
    referredWeekday,
  }
}
