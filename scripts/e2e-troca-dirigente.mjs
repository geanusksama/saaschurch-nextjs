/**
 * Simulação ponta a ponta da Troca de Dirigente.
 *
 * Percorre o caminho real da aba "Trocar Dirigente": posse do 1º dirigente →
 * ocorrência no perfil dele → troca para o 2º → encerramento do anterior e da
 * movimentação antiga → edição com data de término manual → exclusão limpando
 * as ocorrências → dados do relatório.
 *
 * Roda contra o banco de verdade, mas cria a própria igreja e os próprios
 * membros com prefixo [E2E] — nenhum registro real é tocado. Tudo é apagado no
 * fim (--keep preserva).
 *
 * Uso: npx tsx scripts/e2e-troca-dirigente.mjs
 */

import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const KEEP = process.argv.includes('--keep')
const sql = (q) => prisma.$queryRawUnsafe(q)
const exec = (q) => prisma.$executeRawUnsafe(q)

let passed = 0, failed = 0
const falhas = []
function check(label, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { failed++; falhas.push(label); console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}
const step = (n, t) => console.log(`\n${'─'.repeat(70)}\n${n}. ${t}\n${'─'.repeat(70)}`)

const TX = { timeout: 20000, maxWait: 10000 }
const criado = { churchId: null, memberIds: [] }

async function limpar() {
  console.log('\n🧹 limpando os dados do teste...')
  if (criado.churchId) {
    const c = `'${criado.churchId}'::uuid`
    await exec(`DELETE FROM member_event_history WHERE church_id = ${c}`).catch(() => {})
    await exec(`DELETE FROM church_leader_history WHERE church_id = ${c}`).catch(() => {})
    await exec(`DELETE FROM church_function_history WHERE church_id = ${c}`).catch(() => {})
    await exec(`DELETE FROM members WHERE church_id = ${c}`).catch(() => {})
    await exec(`DELETE FROM churches WHERE id = ${c}`).catch(() => {})
  }
  console.log('   pronto — banco no estado anterior.')
}

/** Reproduz a transação da rota POST /churches/[id]/leader-change. */
async function trocarDirigente({ churchId, memberId, functionId, entryDate, exitDate = null, previousExitDate = null, indicatedBy, changeReason, totalMembers = null, totalWorkers = null, averageIncome = null, averageExpense = null }) {
  const saidaAnterior = previousExitDate ?? entryDate
  return prisma.$transaction(async (tx) => {
    const ativas = await tx.churchFunctionHistory.findMany({
      where: { churchId, deletedAt: null, endDate: null, isActive: true, function: { isLeaderRole: true } },
      include: { member: { select: { id: true, fullName: true } }, function: { select: { id: true, name: true } } },
      orderBy: { startDate: 'desc' },
    })
    if (ativas.length) {
      await tx.churchFunctionHistory.updateMany({ where: { id: { in: ativas.map((r) => r.id) } }, data: { endDate: saidaAnterior, isActive: false } })
    }
    await tx.churchLeaderHistory.updateMany({ where: { churchId, exitDate: null }, data: { exitDate: saidaAnterior } })
    await tx.churchFunctionHistory.create({
      data: { churchId, memberId, functionId, startDate: entryDate, endDate: exitDate, isActive: !exitDate },
    })
    const anterior = ativas[0]?.member || null
    const mov = await tx.churchLeaderHistory.create({
      data: {
        churchId, previousLeaderMemberId: anterior?.id, newLeaderMemberId: memberId, functionId,
        indicatedBy, changeReason, entryDate, previousExitDate: ativas[0] ? saidaAnterior : null, exitDate,
        totalMembers, totalWorkers, averageIncome, averageExpense,
      },
    })
    const evento = (memberIdEvt, action, data, extra = {}) => tx.memberEventHistory.create({
      data: {
        memberId: memberIdEvt, churchId, serviceGroup: 'DIRIGENTE', serviceName: 'Troca de Dirigente',
        action, notes: `[E2E] ${action}`,
        metadata: { source: 'TROCA_DIRIGENTE', leaderHistoryId: mov.id, ...extra },
      },
    })
    await evento(memberId, 'ASSUMIU A DIRIGENCIA', entryDate, { movement: 'ENTRADA' })
    if (exitDate) await evento(memberId, 'DEIXOU A DIRIGENCIA', exitDate, { movement: 'SAIDA' })
    if (anterior) await evento(anterior.id, 'DEIXOU A DIRIGENCIA', saidaAnterior, { movement: 'SAIDA' })

    const m = await tx.member.findUnique({ where: { id: memberId }, select: { fullName: true, rol: true } })
    await tx.church.update({
      where: { id: churchId },
      data: {
        currentLeaderName: exitDate ? null : m.fullName,
        currentLeaderRoleDate: exitDate ? null : entryDate,
        leaderRoll: exitDate || m.rol == null ? null : String(m.rol),
      },
    })
    return mov
  }, TX)
}

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗')
  console.log('║  E2E — Troca de Dirigente (posse → ocorrências → relatório)    ║')
  console.log('╚═══════════════════════════════════════════════════════════════╝')

  step(0, 'Ambiente')
  const [regional] = await sql(`SELECT id, name FROM regionais WHERE deleted_at IS NULL ORDER BY name LIMIT 1`)
  check('regional encontrada', !!regional, regional?.name)
  const funcao = await prisma.churchFunctionCatalog.findFirst({ where: { isLeaderRole: true }, select: { id: true, name: true } })
  check('função de dirigente no catálogo', !!funcao, funcao?.name)
  if (!regional || !funcao) throw new Error('ambiente insuficiente')

  const igreja = await prisma.church.create({
    data: { regionalId: regional.id, name: '[E2E] Igreja Troca Dirigente', code: `E2E-TD-${Date.now().toString().slice(-6)}` },
    select: { id: true, name: true },
  })
  criado.churchId = igreja.id
  const membroA = await prisma.member.create({ data: { churchId: igreja.id, fullName: '[E2E] Dirigente Um', ecclesiasticalTitle: 'PR' }, select: { id: true, fullName: true, rol: true } })
  const membroB = await prisma.member.create({ data: { churchId: igreja.id, fullName: '[E2E] Dirigente Dois', ecclesiasticalTitle: 'EV' }, select: { id: true, fullName: true, rol: true } })
  criado.memberIds = [membroA.id, membroB.id]
  check('igreja e 2 membros de teste criados', !!igreja.id && !!membroA.id && !!membroB.id, `ROL ${membroA.rol} e ${membroB.rol}`)

  // ── 1. primeira posse ──
  step(1, 'O primeiro dirigente assume — vira dirigente atual e ganha ocorrência?')
  const mov1 = await trocarDirigente({
    churchId: igreja.id, memberId: membroA.id, functionId: funcao.id,
    entryDate: new Date('2026-01-10'), indicatedBy: '[E2E] Pr. Indicante', changeReason: '[E2E] primeira posse',
    totalMembers: 120, totalWorkers: 14, averageIncome: 5863.81, averageExpense: 2877.03,
  })
  const igreja1 = await prisma.church.findUnique({ where: { id: igreja.id }, select: { currentLeaderName: true, leaderRoll: true } })
  check('igreja passa a ter dirigente atual', igreja1.currentLeaderName === membroA.fullName, igreja1.currentLeaderName)
  check('ROL do dirigente gravado na igreja', igreja1.leaderRoll === String(membroA.rol), igreja1.leaderRoll)
  check('movimentação fica "em exercício" (sem saída)', mov1.exitDate === null)
  check('sem dirigente anterior na primeira posse', mov1.previousLeaderMemberId === null)

  const evA = await prisma.memberEventHistory.findMany({ where: { memberId: membroA.id }, select: { action: true } })
  check('ocorrência ASSUMIU no perfil do 1º dirigente', evA.some((e) => e.action === 'ASSUMIU A DIRIGENCIA'), `${evA.length} ocorrência(s)`)

  const fnA = await prisma.churchFunctionHistory.findFirst({ where: { churchId: igreja.id, memberId: membroA.id }, select: { isActive: true, endDate: true } })
  check('função do 1º dirigente ativa na aba Funções', fnA?.isActive === true && fnA?.endDate === null)

  // ── 2. troca para o segundo ──
  step(2, 'O segundo assume — o primeiro é encerrado e a movimentação antiga fecha?')
  const mov2 = await trocarDirigente({
    churchId: igreja.id, memberId: membroB.id, functionId: funcao.id,
    entryDate: new Date('2026-06-01'), indicatedBy: '[E2E] Pr. Indicante 2', changeReason: '[E2E] indicado para outra congregação',
    totalMembers: 130, totalWorkers: 16,
  })
  check('novo registro aponta o dirigente anterior', mov2.previousLeaderMemberId === membroA.id)
  check('saída do anterior assume a data de entrada do novo', mov2.previousExitDate?.toISOString().slice(0, 10) === '2026-06-01')

  const mov1Depois = await prisma.churchLeaderHistory.findUnique({ where: { id: mov1.id }, select: { exitDate: true } })
  check('movimentação anterior deixa de ficar "em exercício"', mov1Depois.exitDate !== null, mov1Depois.exitDate?.toISOString().slice(0, 10))

  const abertas = await prisma.churchLeaderHistory.count({ where: { churchId: igreja.id, exitDate: null } })
  check('só uma movimentação em exercício por vez', abertas === 1, `${abertas} aberta(s)`)

  const fnADepois = await prisma.churchFunctionHistory.findFirst({ where: { churchId: igreja.id, memberId: membroA.id }, select: { isActive: true, endDate: true } })
  check('função do 1º dirigente encerrada', fnADepois.isActive === false && fnADepois.endDate !== null)

  const saidaA = await prisma.memberEventHistory.findMany({ where: { memberId: membroA.id, action: 'DEIXOU A DIRIGENCIA' } })
  check('ocorrência DEIXOU no perfil de quem saiu', saidaA.length === 1)
  const entradaB = await prisma.memberEventHistory.findMany({ where: { memberId: membroB.id, action: 'ASSUMIU A DIRIGENCIA' } })
  check('ocorrência ASSUMIU no perfil de quem entrou', entradaB.length === 1)

  // ── 3. data de término manual ──
  step(3, 'Definindo término manual, a igreja fica sem dirigente em exercício?')
  await prisma.$transaction(async (tx) => {
    await tx.churchLeaderHistory.update({ where: { id: mov2.id }, data: { exitDate: new Date('2026-07-20') } })
    await tx.churchFunctionHistory.updateMany({ where: { churchId: igreja.id, memberId: membroB.id }, data: { endDate: new Date('2026-07-20'), isActive: false } })
    await tx.memberEventHistory.create({
      data: {
        memberId: membroB.id, churchId: igreja.id, serviceGroup: 'DIRIGENTE', serviceName: 'Troca de Dirigente',
        action: 'DEIXOU A DIRIGENCIA', notes: '[E2E] termino manual',
        metadata: { source: 'TROCA_DIRIGENTE', movement: 'SAIDA', leaderHistoryId: mov2.id },
      },
    })
    const vigente = await tx.churchLeaderHistory.findFirst({ where: { churchId: igreja.id, exitDate: null }, orderBy: [{ entryDate: 'desc' }] })
    await tx.church.update({
      where: { id: igreja.id },
      data: { currentLeaderName: vigente ? undefined : null, currentLeaderRoleDate: vigente ? undefined : null, leaderRoll: vigente ? undefined : null },
    })
  }, TX)

  const igreja3 = await prisma.church.findUnique({ where: { id: igreja.id }, select: { currentLeaderName: true } })
  check('igreja sem dirigente em exercício após o término', igreja3.currentLeaderName === null)
  const abertas3 = await prisma.churchLeaderHistory.count({ where: { churchId: igreja.id, exitDate: null } })
  check('nenhuma movimentação em aberto', abertas3 === 0)
  const saidaB = await prisma.memberEventHistory.count({ where: { memberId: membroB.id, action: 'DEIXOU A DIRIGENCIA' } })
  check('ocorrência de saída gerada para o 2º dirigente', saidaB === 1)

  // ── 4. dados do relatório ──
  step(4, 'O relatório encontra tudo o que o card imprime?')
  const registros = await prisma.churchLeaderHistory.findMany({
    where: { churchId: igreja.id },
    include: {
      previousLeaderMember: { select: { fullName: true, rol: true, ecclesiasticalTitle: true } },
      newLeaderMember: { select: { fullName: true, rol: true, ecclesiasticalTitle: true } },
      function: { select: { name: true } },
    },
    orderBy: [{ entryDate: 'desc' }],
  })
  check('histórico traz as 2 movimentações', registros.length === 2, `${registros.length}`)
  check('card tem entrada e saída em R$', Number(registros[1].averageIncome) === 5863.81 && Number(registros[1].averageExpense) === 2877.03)
  check('card tem membros e obreiros', registros[1].totalMembers === 120 && registros[1].totalWorkers === 14)
  check('card tem indicante e motivo', !!registros[0].indicatedBy && !!registros[0].changeReason)
  check('card tem o dirigente anterior com ROL', registros[0].previousLeaderMember?.rol === membroA.rol)
  check('card tem a função', !!registros[0].function?.name, registros[0].function?.name)

  const irmas = await prisma.church.count({ where: { regionalId: regional.id, deletedAt: null } })
  check('congregações da regional disponíveis', irmas >= 1, `${irmas} igreja(s)`)

  // ── 5. exclusão limpa as ocorrências ──
  step(5, 'Excluir a movimentação apaga as ocorrências que ela gerou?')
  const antes = await prisma.memberEventHistory.count({ where: { churchId: igreja.id } })
  await prisma.$transaction(async (tx) => {
    await tx.memberEventHistory.deleteMany({
      where: { serviceGroup: 'DIRIGENTE', AND: [{ metadata: { path: ['leaderHistoryId'], equals: mov2.id } }] },
    })
    await tx.churchLeaderHistory.delete({ where: { id: mov2.id } })
  }, TX)
  const depois = await prisma.memberEventHistory.count({ where: { churchId: igreja.id } })
  check('ocorrências da movimentação excluída sumiram', depois < antes, `${antes} → ${depois}`)
  const orfas = await prisma.memberEventHistory.count({
    where: { serviceGroup: 'DIRIGENTE', AND: [{ metadata: { path: ['leaderHistoryId'], equals: mov2.id } }] },
  })
  check('nenhuma ocorrência órfã sobra', orfas === 0)
  const restantes = await prisma.memberEventHistory.count({
    where: { serviceGroup: 'DIRIGENTE', AND: [{ metadata: { path: ['leaderHistoryId'], equals: mov1.id } }] },
  })
  check('ocorrências da outra movimentação preservadas', restantes > 0, `${restantes}`)

  console.log(`\n${'═'.repeat(70)}`)
  console.log(`RESULTADO: ${passed} passaram · ${failed} falharam`)
  if (failed) console.log(`Falhas: ${falhas.join(' | ')}`)
  console.log('═'.repeat(70))
}

main()
  .catch((e) => { console.error('\n💥 ERRO:\n', e); failed++ })
  .finally(async () => {
    if (KEEP) console.log('\n⚠️  --keep: dados do teste MANTIDOS no banco.')
    else await limpar().catch((e) => console.error('falha na limpeza:', e))
    await prisma.$disconnect()
    process.exit(failed ? 1 : 0)
  })
