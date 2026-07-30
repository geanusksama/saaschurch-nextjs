/**
 * Simulação ponta a ponta da correção do dia citado no Cronograma.
 *
 * Reproduz o caso real que apareceu em produção: a Gislane foi inscrita na
 * terça 28/07/2026 às 21h43, a etapa "véspera do culto de ensino" estava
 * agendada para terça 09h00 (horário já vencido) e a fila só andou na manhã de
 * quarta 29/07 — o dia do culto. A mensagem que saiu dizia "Amanhã tem culto de
 * ensino" quando devia dizer "Hoje tem culto de ensino".
 *
 * Usa computeScheduledAt e adjustDayReference de produção, e as mensagens reais
 * de DEFAULT_JOURNEY_STEPS — não há cópia de texto nem de regra aqui.
 *
 * Não escreve nada no banco: agendamento e reescrita de texto são lógica pura.
 * O que depende de banco (fila, instância, Z-API) é coberto por
 * scripts/e2e-cronograma.mjs.
 *
 * Uso: npx tsx scripts/e2e-cronograma-dia.mjs
 */

import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })

import { adjustDayReference, CULTO_WEEKDAYS } from '../src/lib/pastoralJourneyDayRef.ts'
import { DEFAULT_JOURNEY_STEPS, WEEKDAY_LABELS } from '../src/lib/pastoralJourneyDefault.ts'

// import dinâmico: pastoralJourneyService puxa supabase-admin, que exige as
// variáveis de ambiente já carregadas — um import estático seria avaliado antes
// do loadEnv acima.
const { computeScheduledAt } = await import('../src/lib/pastoralJourneyService.ts')

let passed = 0, failed = 0
const falhas = []
function check(label, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { failed++; falhas.push(label); console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}
const step = (n, t) => console.log(`\n${'─'.repeat(70)}\n${n}. ${t}\n${'─'.repeat(70)}`)

/** Dia da semana em Brasília de um instante UTC. */
const diaBrt = (d) => new Date(new Date(d).getTime() - 180 * 60_000).getUTCDay()
/** Data-hora de parede em Brasília → instante UTC. */
const brt = (iso) => new Date(`${iso}-03:00`)

const stepPorCodigo = (code) => {
  const s = DEFAULT_JOURNEY_STEPS.find(x => x.code === code)
  return {
    week_number: s.weekNumber,
    weekday: s.weekday,
    min_offset_days: s.minOffsetDays,
    send_time: s.sendTime,
    _msg: s.messages,
    _label: s.momentLabel,
  }
}

console.log('\n📅 E2E — dia citado nas mensagens do Cronograma\n')

// ── 1. A matriz padrão só convida para culto em dia de culto ──
step(1, 'As etapas padrão respeitam os dias de culto (domingo e quarta)?')
check('domingo e quarta são os dias de culto', CULTO_WEEKDAYS.join(',') === '0,3')

const vesperas = DEFAULT_JOURNEY_STEPS.filter(s => /culto de ensino|domingo/i.test(s.momentLabel))
check('há etapas de véspera na matriz', vesperas.length > 0, `${vesperas.length} etapas`)

for (const s of vesperas) {
  const cultoEsperado = /ensino/i.test(s.momentLabel) ? 3 : 0 // quarta ou domingo
  const diaCitado = (s.weekday + 1) % 7 // véspera → o dia seguinte é o do culto
  check(
    `"${s.code}" avisa na véspera (${WEEKDAY_LABELS[s.weekday]}) de um dia de culto`,
    diaCitado === cultoEsperado,
    `cita ${WEEKDAY_LABELS[diaCitado]}`
  )
}

// ── 2. O caso da Gislane ──
step(2, 'Caso real: inscrita terça 28/07 21h43, fila andou quarta 29/07 10h13')
const acolhimento = brt('2026-07-28T21:43:46')
check('28/07/2026 é terça', diaBrt(acolhimento) === 2, WEEKDAY_LABELS[diaBrt(acolhimento)])

const ensino = stepPorCodigo('s1_ensino')
const agendado = computeScheduledAt(acolhimento, ensino)
check('a véspera do culto de ensino é agendada para terça', diaBrt(agendado) === 2,
  agendado.toISOString())
check('o agendamento ficou no passado (era 09h, ela entrou 21h43)', agendado < acolhimento)

const envioReal = brt('2026-07-29T10:13:00')
check('29/07/2026 é quarta (dia do culto)', diaBrt(envioReal) === 3, WEEKDAY_LABELS[diaBrt(envioReal)])

const textoMatriz = ensino._msg.novo_convertido
check('o texto da matriz diz "Amanhã"', /^Amanhã tem culto de ensino/.test(textoMatriz))

const corrigido = adjustDayReference(textoMatriz, { scheduledAt: agendado, sentAt: envioReal })
check('o envio na quarta vira "Hoje tem culto de ensino"',
  corrigido.message.startsWith('Hoje tem culto de ensino'), corrigido.message.slice(0, 42))
check('marcado como alterado', corrigido.changed === true)
check('não está vencida', corrigido.stale === false)
check('o versículo foi preservado', corrigido.message.includes('(Salmos 86:11)'))
check('só a palavra do dia mudou',
  corrigido.message.slice(4) === textoMatriz.slice(6),
  `${textoMatriz.length} → ${corrigido.message.length} caracteres`)

// ── 3. Enviada no dia certo: nada muda ──
step(3, 'Enviada na terça, como planejado — o texto continua igual?')
const naTerca = adjustDayReference(textoMatriz, {
  scheduledAt: agendado,
  sentAt: brt('2026-07-28T09:00:00'),
})
check('segue dizendo "Amanhã"', naTerca.message === textoMatriz)
check('nada foi alterado', naTerca.changed === false && naTerca.stale === false)

// ── 4. Atrasada demais: o culto já passou ──
step(4, 'A fila só andou na quinta — o culto de quarta já passou')
const naQuinta = adjustDayReference(textoMatriz, {
  scheduledAt: agendado,
  sentAt: brt('2026-07-30T09:00:00'),
})
check('marcada como vencida', naQuinta.stale === true, `delta ${naQuinta.deltaDays} dia(s)`)
check('o texto não é reescrito quando vence', naQuinta.message === textoMatriz)

// ── 5. Etapa de domingo ──
step(5, 'Véspera de domingo: sábado, domingo e segunda')
const domingoStep = stepPorCodigo('s1_domingo')
const agendadoSab = computeScheduledAt(brt('2026-07-28T21:43:46'), domingoStep)
check('agendada para sábado', diaBrt(agendadoSab) === 6, agendadoSab.toISOString())

const textoDomingo = domingoStep._msg.novo_convertido
check('o texto cita "Domingo"', /^Domingo tem Escola Bíblica/.test(textoDomingo))

const noSabado = adjustDayReference(textoDomingo, { scheduledAt: agendadoSab, sentAt: brt('2026-08-01T09:00:00') })
check('enviada no sábado continua "Domingo"', noSabado.changed === false, noSabado.message.slice(0, 30))

const noDomingo = adjustDayReference(textoDomingo, { scheduledAt: agendadoSab, sentAt: brt('2026-08-02T09:00:00') })
check('enviada no domingo vira "Hoje"', noDomingo.message.startsWith('Hoje tem Escola Bíblica'),
  noDomingo.message.slice(0, 30))

const naSegunda = adjustDayReference(textoDomingo, { scheduledAt: agendadoSab, sentAt: brt('2026-08-03T09:00:00') })
check('enviada na segunda está vencida', naSegunda.stale === true, `delta ${naSegunda.deltaDays}`)

// ── 6. Antecipada: nomeia o dia em vez de mentir ──
step(6, 'Enviada com antecedência — nomeia o dia da semana')
const doisDiasAntes = adjustDayReference(textoMatriz, {
  scheduledAt: agendado,
  sentAt: brt('2026-07-27T09:00:00'), // segunda
})
check('vira "Quarta tem culto de ensino"',
  doisDiasAntes.message.startsWith('Quarta tem culto de ensino'), doisDiasAntes.message.slice(0, 30))

// ── 7. Mensagens sem referência de dia passam intactas ──
step(7, 'Mensagens que não citam dia nenhum ficam intactas?')
const semDia = stepPorCodigo('d1')._msg.novo_convertido
const boasVindas = adjustDayReference(semDia, { scheduledAt: agendado, sentAt: envioReal })
check('boas-vindas não é tocada', boasVindas.message === semDia && boasVindas.changed === false)
check('e não é marcada como vencida', boasVindas.stale === false)

const digital = stepPorCodigo('s2_digital')._msg.novo_convertido
const videoIntacto = adjustDayReference(digital, { scheduledAt: agendado, sentAt: envioReal })
check('convite de vídeo não é tocado', videoIntacto.message === digital)

// ── 8. Todas as 13 etapas × 3 perfis sobrevivem à correção ──
step(8, 'Varredura: 13 etapas × 3 perfis, enviadas no dia agendado')
let intactas = 0, alteradas = 0, vencidas = 0
for (const s of DEFAULT_JOURNEY_STEPS) {
  const st = stepPorCodigo(s.code)
  const quando = computeScheduledAt(acolhimento, st)
  for (const perfil of ['novo_convertido', 'reconciliado', 'outra_igreja']) {
    const r = adjustDayReference(s.messages[perfil], { scheduledAt: quando, sentAt: quando })
    if (r.stale) vencidas++
    else if (r.changed) alteradas++
    else intactas++
  }
}
check('nenhuma mensagem vence quando sai no dia agendado', vencidas === 0, `${vencidas} vencidas`)
check('nenhuma é reescrita sem motivo', alteradas === 0, `${alteradas} alteradas`)
check('as 39 mensagens passam intactas', intactas === 39, `${intactas} intactas`)

console.log(`\n${'═'.repeat(70)}`)
console.log(`RESULTADO: ${passed} passaram · ${failed} falharam`)
if (failed) console.log(`Falhas: ${falhas.join(' | ')}`)
console.log('═'.repeat(70))
process.exit(failed ? 1 : 0)
