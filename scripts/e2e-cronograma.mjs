/**
 * Simulação ponta a ponta do Cronograma de Acompanhamento.
 *
 * Percorre o caminho real de 3 pessoas que chegaram pela home — um novo
 * convertido, um vindo de outra igreja e um reconciliado — do card criado até
 * o card em CONCLUÍDO com o certificado emitido.
 *
 * Roda contra o banco de verdade, MAS:
 *  - PASTORAL_JOURNEY_DRY_RUN=1 impede qualquer chamada à Z-API (nada é
 *    enviado para número nenhum);
 *  - os telefones são da faixa de teste 5519999990001-3, que não existe;
 *  - tudo que é criado leva o prefixo [E2E] e é apagado no fim.
 *
 * Uso:  npx tsx scripts/e2e-cronograma.mjs
 *       (adicione --keep para não limpar e inspecionar na tela)
 */

process.env.PASTORAL_JOURNEY_DRY_RUN = '1'

import { config as loadEnv } from 'dotenv'
// .env.local tem prioridade (é onde ficam as chaves do Supabase)
loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })

import { PrismaClient } from '@prisma/client'
import { writeFileSync } from 'node:fs'

const prisma = new PrismaClient()
const KEEP = process.argv.includes('--keep')

// ── util de saída ────────────────────────────────────────────────────────────
let passed = 0
let failed = 0
const fail = []

function check(label, condition, detail = '') {
  if (condition) {
    passed++
    console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed++
    fail.push(label)
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function step(n, title) {
  console.log(`\n${'─'.repeat(70)}\n${n}. ${title}\n${'─'.repeat(70)}`)
}

const sql = (q, ...a) => prisma.$queryRawUnsafe(q, ...a)
const exec = (q, ...a) => prisma.$executeRawUnsafe(q, ...a)

// ── as 3 pessoas ─────────────────────────────────────────────────────────────
const PESSOAS = [
  { nome: '[E2E] Ana Novo Convertida', tel: '5519999990001', perfil: 'novo_convertido' },
  { nome: '[E2E] Bruno Outra Igreja', tel: '5519999990002', perfil: 'outra_igreja' },
  { nome: '[E2E] Carla Reconciliada', tel: '5519999990003', perfil: 'reconciliado' },
]

const criado = { attendanceIds: [], enrollmentIds: [], journeyId: null, conversationIds: [] }

async function limpar() {
  if (!criado.attendanceIds.length && !criado.journeyId) return
  console.log('\n🧹 limpando os dados do teste...')
  const ids = criado.attendanceIds.map(i => `'${i}'`).join(',')
  if (ids) {
    for (const t of [
      'pastoral_attendance_activities',
      'pastoral_attendance_notes',
      'pastoral_attendance_timeline',
      'pastoral_attendance_participants',
    ]) {
      await exec(`DELETE FROM ${t} WHERE attendance_id IN (${ids}::uuid)`).catch(() => {})
    }
    await exec(`DELETE FROM pastoral_attendances WHERE id IN (${ids}::uuid)`).catch(() => {})
  }
  // a jornada de teste leva junto steps/messages/enrollments/sends por cascade
  if (criado.journeyId) {
    await exec(`DELETE FROM pastoral_journeys WHERE id = '${criado.journeyId}'::uuid`).catch(() => {})
  }
  const tels = PESSOAS.map(p => `'${p.tel}'`).join(',')
  const convs = await sql(`SELECT id FROM whatsapp_conversations WHERE phone IN (${tels})`)
  for (const c of convs) {
    await exec(`DELETE FROM whatsapp_messages WHERE conversation_id = '${c.id}'::uuid`).catch(() => {})
    await exec(`DELETE FROM whatsapp_conversations WHERE id = '${c.id}'::uuid`).catch(() => {})
  }
  console.log('   pronto — banco no estado anterior.')
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗')
  console.log('║  E2E — Cronograma de Acompanhamento (modo simulação, sem Z-API)  ║')
  console.log('╚══════════════════════════════════════════════════════════════════╝')

  // ── 0. ambiente ───────────────────────────────────────────────────────────
  step(0, 'Ambiente')
  const [igreja] = await sql(
    `SELECT id, name FROM churches WHERE id = '6d2688df-5249-4bd2-89cc-0cd8c324b3d8'::uuid`
  )
  check('igreja sede encontrada', !!igreja, igreja?.name)
  const churchId = igreja.id

  const colunas = await sql(
    `SELECT c.id, c.name, c.column_key FROM pastoral_pipeline_columns c
     WHERE c.church_id = '${churchId}'::uuid ORDER BY c.position`
  )
  const colTodo = colunas.find(c => c.column_key === 'todo')
  const colDoing = colunas.find(c => c.column_key === 'doing')
  const colDone = colunas.find(c => c.column_key === 'done')
  check('colunas do pipeline', !!colTodo && !!colDoing && !!colDone,
    colunas.map(c => c.name).join(' → '))

  const [inst] = await sql(
    `SELECT id, name, instance_id, status FROM whatsapp_instances
     WHERE is_active = true AND status = 'connected' ORDER BY created_at LIMIT 1`
  )
  check('instância WhatsApp conectada', !!inst, inst?.name)
  if (!inst) throw new Error('sem instância conectada — o tick não teria por onde enviar')

  // ── 1. chegada pela home ──────────────────────────────────────────────────
  step(1, 'Chegada pela home — 3 pessoas criam card em POR FAZER')
  for (const p of PESSOAS) {
    const [row] = await sql(
      `INSERT INTO pastoral_attendances
         (church_id, column_id, visitor_name, phone, attendance_type, status, priority, started_at, tags, notes)
       VALUES ('${churchId}'::uuid, '${colTodo.id}'::uuid, $1, $2, 'quero_ser_membro', 'open', 'normal', now(), '{}', 'criado pelo teste E2E')
       RETURNING id`,
      p.nome, p.tel
    )
    criado.attendanceIds.push(row.id)
    p.attendanceId = row.id
  }
  check('3 cards criados em POR FAZER', criado.attendanceIds.length === 3)

  // antiduplicidade: a mesma pessoa tentando de novo
  const { findLiveAttendance } = await import('../src/lib/pastoralDuplicateCheck.ts')
    .catch(() => ({ findLiveAttendance: null }))
  if (findLiveAttendance) {
    const dup = await findLiveAttendance({
      churchId, phone: PESSOAS[0].tel, attendanceType: 'quero_ser_membro',
    })
    check('antiduplicidade barra o 2º envio da mesma pessoa', !!dup, `fase: ${dup?.stage}`)
  }

  // ── 2. classificação + movimentação para FAZENDO ──────────────────────────
  step(2, 'Secretaria classifica o grupo e move para FAZENDO')
  for (const p of PESSOAS) {
    await exec(
      `UPDATE pastoral_attendances
       SET person_profile = $1, column_id = '${colDoing.id}'::uuid, status = 'doing'
       WHERE id = '${p.attendanceId}'::uuid`,
      p.perfil
    )
  }
  const emFazendo = await sql(
    `SELECT visitor_name, person_profile FROM pastoral_attendances
     WHERE id IN (${criado.attendanceIds.map(i => `'${i}'`).join(',')}::uuid)
       AND column_id = '${colDoing.id}'::uuid`
  )
  check('3 cards em FAZENDO com grupo classificado', emFazendo.length === 3,
    emFazendo.map(c => c.person_profile).join(', '))

  // ── 3. cronograma com varredura automática ────────────────────────────────
  step(3, 'Cronograma criado com a matriz padrão e varredura ligada')
  const { seedJourneySteps, autoEnrollFromColumn, processJourneyTick,
          stopFinishedEnrollments, computeScheduledAt } =
    await import('../src/lib/pastoralJourneyService.ts')

  const [journey] = await sql(
    `INSERT INTO pastoral_journeys
       (church_id, name, description, interval_seconds, window_start, window_end,
        auto_enroll, auto_enroll_column_key, max_per_person_per_day, ai_polish,
        issue_certificate, complete_card_on_finish)
     VALUES ('${churchId}'::uuid, '[E2E] Cronograma de Teste', 'simulação', 5,
             '00:00', '23:59', true, 'doing', 0, false, true, true)
     RETURNING *`
  )
  criado.journeyId = journey.id
  await seedJourneySteps(journey.id)

  const [{ n: nEtapas }] = await sql(
    `SELECT count(*)::int n FROM pastoral_journey_steps WHERE journey_id = '${journey.id}'::uuid`
  )
  const [{ n: nMsgs }] = await sql(
    `SELECT count(*)::int n FROM pastoral_journey_messages m
     JOIN pastoral_journey_steps s ON s.id = m.step_id
     WHERE s.journey_id = '${journey.id}'::uuid`
  )
  check('matriz semeada com 13 etapas', nEtapas === 13, `${nEtapas} etapas`)
  check('3 mensagens por etapa (uma por grupo)', nMsgs === 39, `${nMsgs} mensagens`)

  await exec(
    `INSERT INTO pastoral_journey_instances (journey_id, instance_id)
     VALUES ('${journey.id}'::uuid, '${inst.id}'::uuid)`
  )

  // ── 4. varredura adota sozinha ────────────────────────────────────────────
  step(4, 'O cron varre a coluna FAZENDO e adota quem ainda não tem jornada')
  const [journeyRow] = await sql(`SELECT * FROM pastoral_journeys WHERE id = '${journey.id}'::uuid`)
  const adocao = await autoEnrollFromColumn(journeyRow)
  check('3 pessoas adotadas automaticamente', adocao.enrolled === 3,
    `adotadas: ${adocao.enrolled} · sem classificação: ${adocao.unclassified} · sem telefone: ${adocao.noPhone}`)

  const enrollments = await sql(
    `SELECT e.id, e.name, e.profile, e.status, e.enrolled_at
     FROM pastoral_journey_enrollments e
     WHERE e.journey_id = '${journey.id}'::uuid ORDER BY e.name`
  )
  criado.enrollmentIds = enrollments.map(e => e.id)
  check('inscrições ativas', enrollments.every(e => e.status === 'active'))
  check('cada pessoa no seu grupo',
    new Set(enrollments.map(e => e.profile)).size === 3,
    enrollments.map(e => `${e.name.replace('[E2E] ', '')}=${e.profile}`).join(' · '))

  const agenda = await sql(
    `SELECT s.enrollment_id, s.sequence, s.total_steps, s.status, s.scheduled_at, st.moment_label
     FROM pastoral_journey_sends s
     JOIN pastoral_journey_steps st ON st.id = s.step_id
     WHERE s.journey_id = '${journey.id}'::uuid
     ORDER BY s.enrollment_id, s.sequence`
  )
  check('agenda materializada: 13 mensagens por pessoa', agenda.length === 39,
    `${agenda.length} linhas na fila`)
  check('histórico numerado (1..13 de 13)',
    agenda.every(a => a.sequence >= 1 && a.sequence <= 13 && a.total_steps === 13))

  const primeira = agenda.filter(a => a.sequence === 1)
  check('mensagens de grupos diferentes são textos diferentes',
    new Set(
      (await sql(`SELECT message FROM pastoral_journey_sends
                  WHERE journey_id = '${journey.id}'::uuid AND sequence = 1`)).map(r => r.message)
    ).size === 3)

  // a jornada tem que tocar na ordem: boas-vindas antes de tudo
  const foraDeOrdem = []
  for (const e of enrollments) {
    const lista = agenda.filter(a => a.enrollment_id === e.id)
    for (let i = 1; i < lista.length; i++) {
      if (new Date(lista[i].scheduled_at) < new Date(lista[i - 1].scheduled_at)) {
        foraDeOrdem.push(`${e.name}: ${lista[i].sequence} antes de ${lista[i - 1].sequence}`)
      }
    }
  }
  check('agenda em ordem cronológica (nº 1 nunca depois do nº 2)',
    foraDeOrdem.length === 0, foraDeOrdem.join(' | ') || 'todas as 13 em ordem')

  console.log('\n   Agenda da 1ª pessoa (datas calculadas do acolhimento):')
  const a1 = agenda.filter(a => a.enrollment_id === enrollments[0].id)
  for (const a of a1.slice(0, 5)) {
    const d = new Date(a.scheduled_at)
    console.log(`     ${String(a.sequence).padStart(2)}/13  ${d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}  ${a.moment_label}`)
  }
  console.log(`     ... e mais ${a1.length - 5} etapas até o fim do mês`)

  // ── 5. cron dispara o que venceu ──────────────────────────────────────────
  step(5, 'O cron dispara — só o que já venceu, nada do futuro')
  const t1 = await processJourneyTick({ maxMs: 20_000 })
  check('nenhuma mensagem futura foi antecipada', t1.sent === 0,
    `enviadas: ${t1.sent} · na fila: ${t1.pending}`)

  // vence a 1ª de cada pessoa (o cron do dia seguinte veria isso)
  await exec(
    `UPDATE pastoral_journey_sends SET scheduled_at = now() - interval '1 minute'
     WHERE journey_id = '${journey.id}'::uuid AND sequence = 1`
  )
  const t2 = await processJourneyTick({ maxMs: 30_000 })
  check('as 3 boas-vindas saíram', t2.sent === 3, `enviadas: ${t2.sent} · erros: ${t2.errors}`)

  const enviadas = await sql(
    `SELECT s.sequence, s.status, s.sent_at, s.conversation_id, s.wa_message_id, e.name
     FROM pastoral_journey_sends s JOIN pastoral_journey_enrollments e ON e.id = s.enrollment_id
     WHERE s.journey_id = '${journey.id}'::uuid AND s.status = 'sent' ORDER BY e.name`
  )
  check('histórico gravou status/sent_at', enviadas.every(e => e.status === 'sent' && e.sent_at))
  check('conversa criada no WhatsApp para cada pessoa',
    enviadas.every(e => e.conversation_id), `${enviadas.length} conversas`)

  const [{ n: nMsgWa }] = await sql(
    `SELECT count(*)::int n FROM whatsapp_messages
     WHERE conversation_id IN (${enviadas.map(e => `'${e.conversation_id}'`).join(',')}::uuid)
       AND direction = 'outbound'`
  )
  check('mensagens registradas na caixa de entrada', nMsgWa >= 3, `${nMsgWa} outbound`)

  // ── 6. idempotência ───────────────────────────────────────────────────────
  step(6, 'O cron roda de novo no minuto seguinte — não pode reenviar')
  const t3 = await processJourneyTick({ maxMs: 15_000 })
  check('nada foi reenviado', t3.sent === 0, `enviadas: ${t3.sent}`)
  const adocao2 = await autoEnrollFromColumn(journeyRow)
  check('varredura não readota quem já tem jornada', adocao2.enrolled === 0)

  // ── 7. mês inteiro ────────────────────────────────────────────────────────
  step(7, 'Avanço do mês — todas as 13 etapas de cada pessoa')
  let rodadas = 0
  while (rodadas < 20) {
    const [{ n: restam }] = await sql(
      `SELECT count(*)::int n FROM pastoral_journey_sends
       WHERE journey_id = '${journey.id}'::uuid AND status = 'pending'`
    )
    if (!restam) break
    await exec(
      `UPDATE pastoral_journey_sends SET scheduled_at = now() - interval '1 minute'
       WHERE journey_id = '${journey.id}'::uuid AND status = 'pending'`
    )
    const t = await processJourneyTick({ maxMs: 30_000 })
    rodadas++
    if (t.sent === 0 && t.errors === 0 && t.deferred === 0) break
  }

  const final = await sql(
    `SELECT status, count(*)::int n FROM pastoral_journey_sends
     WHERE journey_id = '${journey.id}'::uuid GROUP BY status`
  )
  const porStatus = Object.fromEntries(final.map(f => [f.status, f.n]))
  check('as 39 mensagens saíram (13 × 3 pessoas)', porStatus.sent === 39,
    JSON.stringify(porStatus))

  // ── 8. fechamento do ciclo ────────────────────────────────────────────────
  step(8, 'Fechamento — card em CONCLUÍDO e certificado emitido')
  const fim = await sql(
    `SELECT e.id, e.name, e.status, e.completed_at, e.certificate_issued_at,
            a.status AS card_status, c.name AS coluna
     FROM pastoral_journey_enrollments e
     LEFT JOIN pastoral_attendances a ON a.id = e.attendance_id
     LEFT JOIN pastoral_pipeline_columns c ON c.id = a.column_id
     WHERE e.journey_id = '${journey.id}'::uuid ORDER BY e.name`
  )
  check('3 acompanhamentos concluídos', fim.every(f => f.status === 'completed'))
  check('3 cards movidos para CONCLUÍDO',
    fim.every(f => f.coluna === colDone.name && f.card_status === 'done'),
    fim.map(f => f.coluna).join(', '))
  check('certificado emitido para cada um', fim.every(f => f.certificate_issued_at))

  const [{ n: nCert }] = await sql(
    `SELECT count(*)::int n FROM pastoral_attendance_timeline
     WHERE attendance_id IN (${criado.attendanceIds.map(i => `'${i}'`).join(',')}::uuid)
       AND event_type = 'certificate'`
  )
  check('timeline do card registra o certificado', nCert === 3, `${nCert} eventos`)

  // ── 9. o PDF ──────────────────────────────────────────────────────────────
  step(9, 'Certificado em PDF — geração real')
  const { buildCertificatePdf } = await import('../src/lib/pastoralCertificate.ts')
  const alvo = fim[0]
  const etapas = await sql(
    `SELECT st.program_label, s.sent_at FROM pastoral_journey_sends s
     JOIN pastoral_journey_steps st ON st.id = s.step_id
     WHERE s.enrollment_id = '${alvo.id}'::uuid AND s.status = 'sent'
     ORDER BY s.sequence`
  )
  const [enr] = await sql(
    `SELECT enrolled_at, profile FROM pastoral_journey_enrollments WHERE id = '${alvo.id}'::uuid`
  )
  const pdf = buildCertificatePdf({
    personName: alvo.name.replace('[E2E] ', ''),
    churchName: igreja.name,
    profileLabel: 'Novo Convertido',
    startedAt: new Date(enr.enrolled_at),
    finishedAt: new Date(alvo.completed_at),
    steps: etapas.map(e => ({ label: e.program_label, date: e.sent_at ? new Date(e.sent_at) : null })),
  })
  const buf = Buffer.from(pdf)
  check('PDF gerado', buf.length > 3000, `${(buf.length / 1024).toFixed(1)} KB`)
  check('arquivo é um PDF válido', buf.subarray(0, 5).toString() === '%PDF-')
  const out = 'docs/certificado-exemplo-e2e.pdf'
  writeFileSync(out, buf)
  console.log(`  📄 amostra salva em ${out} — abra para conferir o layout`)
  console.log(`  🔗 na produção o link é /api/public/pastoral/certificate/${alvo.id}?download=1`)

  // ── 10. encerramento por conclusão manual ────────────────────────────────
  step(10, 'Card concluído na mão no meio do mês encerra o acompanhamento')
  const [p4] = await sql(
    `INSERT INTO pastoral_attendances
       (church_id, column_id, visitor_name, phone, attendance_type, person_profile, status, priority, started_at, tags)
     VALUES ('${churchId}'::uuid, '${colDoing.id}'::uuid, '[E2E] Davi Meio do Mes', '5519999990004',
             'quero_ser_membro', 'novo_convertido', 'doing', 'normal', now(), '{}')
     RETURNING id`
  )
  criado.attendanceIds.push(p4.id)
  await autoEnrollFromColumn(journeyRow)
  const [e4] = await sql(
    `SELECT id FROM pastoral_journey_enrollments
     WHERE attendance_id = '${p4.id}'::uuid`
  )
  check('4ª pessoa adotada pela varredura', !!e4)

  await exec(`UPDATE pastoral_attendances SET status = 'done' WHERE id = '${p4.id}'::uuid`)
  const parados = await stopFinishedEnrollments()
  const [e4final] = await sql(
    `SELECT status FROM pastoral_journey_enrollments WHERE id = '${e4.id}'::uuid`
  )
  const [{ n: pend4 }] = await sql(
    `SELECT count(*)::int n FROM pastoral_journey_sends
     WHERE enrollment_id = '${e4.id}'::uuid AND status = 'pending'`
  )
  check('acompanhamento encerrado ao concluir o card', e4final.status === 'cancelled',
    `${parados} encerrado(s)`)
  check('fila da pessoa esvaziada (não recebe mais nada)', pend4 === 0)

  // ── resultado ─────────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(70)}`)
  console.log(`RESULTADO: ${passed} passaram · ${failed} falharam`)
  if (failed) console.log(`Falhas: ${fail.join(' | ')}`)
  console.log('═'.repeat(70))
}

main()
  .catch(e => { console.error('\n💥 ERRO NA SIMULAÇÃO:\n', e); failed++ })
  .finally(async () => {
    if (KEEP) console.log('\n⚠️  --keep: os dados do teste FICARAM no banco.')
    else await limpar().catch(e => console.error('falha na limpeza:', e))
    await prisma.$disconnect()
    process.exit(failed ? 1 : 0)
  })
