/**
 * Simulação ponta a ponta da matriz na admissão de membros.
 *
 * Cobre os dois caminhos que criam membro e que precisam terminar iguais no
 * perfil:
 *   - botão "Novo Membro" → card de Cadastro aberto em "Pendente";
 *   - ficha do "Quero ser Membro" aprovada → card aberto e JÁ movido para
 *     "Aprovado", que é o furo que existia: o membro nascia ATIVO na mão, sem
 *     ocorrência nenhuma e com o título errado.
 *
 * Importa openAdmissionCard de verdade — o teste roda em cima do código de
 * produção, não de uma cópia.
 *
 * Roda contra o banco de verdade, mas cria a própria igreja e os próprios
 * membros com prefixo [E2E] — nenhum registro real é tocado. Tudo é apagado no
 * fim (--keep preserva).
 *
 * Uso: npx tsx scripts/e2e-admissao-matriz.mjs
 */

import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })

import { PrismaClient } from '@prisma/client'
import { openAdmissionCard } from '../src/lib/memberAdmission.ts'

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

const criado = { churchId: null, cardIds: [] }

async function limpar() {
  console.log('\n🧹 limpando os dados do teste...')
  if (criado.cardIds.length) {
    const uuids = criado.cardIds.map((id) => `'${id}'::uuid`).join(',')
    const textos = criado.cardIds.map((id) => `'${id}'`).join(',')
    await exec(`DELETE FROM notifications WHERE data->>'cardId' IN (${textos})`).catch(() => {})
    await exec(`DELETE FROM member_event_history WHERE card_id IN (${uuids})`).catch(() => {})
    await exec(`DELETE FROM member_title_history WHERE card_id IN (${uuids})`).catch(() => {})
    await exec(`DELETE FROM kan_cards WHERE id IN (${uuids})`).catch(() => {})
  }
  if (criado.churchId) {
    const c = `'${criado.churchId}'::uuid`
    await exec(`DELETE FROM member_event_history WHERE church_id = ${c}`).catch(() => {})
    await exec(`DELETE FROM member_title_history WHERE church_id = ${c}`).catch(() => {})
    await exec(`DELETE FROM kan_cards WHERE church_id = ${c}`).catch(() => {})
    await exec(`DELETE FROM members WHERE church_id = ${c}`).catch(() => {})
    await exec(`DELETE FROM churches WHERE id = ${c}`).catch(() => {})
  }
  console.log('   pronto — banco no estado anterior.')
}

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗')
  console.log('║  E2E — Matriz na admissão de membros                           ║')
  console.log('╚═══════════════════════════════════════════════════════════════╝')

  // ── 0. ambiente ──
  step(0, 'Ambiente')
  const [regional] = await sql(`SELECT id, name FROM regionais WHERE deleted_at IS NULL ORDER BY name LIMIT 1`)
  check('regional encontrada', !!regional, regional?.name)
  if (!regional) throw new Error('sem regional')

  const servico = await prisma.kanService.findFirst({ where: { isActive: true, sigla: 'CAD' } })
  check('serviço de Cadastro existe', !!servico, servico?.description)

  const regras = await prisma.kanMatrixRule.findMany({ where: { serviceId: servico.id }, orderBy: { columnIndex: 'asc' } })
  const regra1 = regras.find((r) => r.columnIndex === 1)
  const regra2 = regras.find((r) => r.columnIndex === 2)
  check('matriz tem regra para Pendente', !!regra1, `${regra1?.newTitle} / ${regra1?.newStatus}`)
  check('matriz tem regra para Aprovado', !!regra2, `${regra2?.newTitle} / ${regra2?.newStatus}`)

  const stamp = Date.now().toString().slice(-6)
  const igreja = await prisma.church.create({
    data: { regionalId: regional.id, name: '[E2E] Igreja da Adesao', code: `E2E-AD${stamp}` },
    select: { id: true },
  })
  criado.churchId = igreja.id

  const operador = await prisma.user.findFirst({ where: { deletedAt: null }, select: { id: true, campoId: true } })

  /** Cria o membro cru, do jeito que cada rota cria antes de chamar o helper. */
  const novoMembro = (nome, dados = {}) => prisma.member.create({
    data: { churchId: igreja.id, fullName: `[E2E] ${nome}`, ...dados },
    select: { id: true, churchId: true, fullName: true, ecclesiasticalTitle: true, membershipStatus: true },
  })

  const perfil = (id) => prisma.member.findUnique({
    where: { id },
    select: { ecclesiasticalTitle: true, ecclesiasticalTitleId: true, membershipStatus: true },
  })
  const ocorrencias = (id) => prisma.memberEventHistory.findMany({
    where: { memberId: id }, orderBy: { createdAt: 'asc' },
    select: { action: true, columnIndex: true, notes: true, serviceGroup: true },
  })

  // ── 1. botão Novo Membro ──
  step(1, 'Novo Membro abre o card em "Pendente" e aplica a regra da coluna 1?')
  const direto = await novoMembro('Cadastro Direto')
  const cardDireto = await openAdmissionCard({ member: direto, user: operador || { id: null } })
  if (cardDireto) criado.cardIds.push(cardDireto.cardId)
  check('card aberto', !!cardDireto, cardDireto?.protocol)
  check('parou em Pendente', cardDireto?.columnIndex === 1)

  const p1 = await perfil(direto.id)
  check('título veio da matriz', p1.ecclesiasticalTitle === regra1.newTitle, p1.ecclesiasticalTitle)
  check('situação veio da matriz', p1.membershipStatus === regra1.newStatus.toUpperCase(), p1.membershipStatus)
  const o1 = await ocorrencias(direto.id)
  check('uma ocorrência no perfil', o1.length === 1, o1.map((o) => o.action).join(' | '))
  check('ocorrência é a da coluna 1', o1[0]?.action === regra1.occurrenceName, o1[0]?.action)

  // ── 2. ficha aprovada ──
  step(2, 'Aprovar a ficha leva o card até "Aprovado" e ativa o membro?')
  // Reproduz o insert da rota de review: ATIVO na mão e sem passar pela matriz.
  // O título "CONGREGADO" que aparecia no perfil vinha do DEFAULT da coluna, não
  // de processo nenhum — por isso o membro ficava sem histórico.
  const ficha = await novoMembro('Adesao Pela Ficha', { membershipStatus: 'ATIVO' })
  check('antes: título é só o default da coluna', ficha.ecclesiasticalTitle === 'CONGREGADO', ficha.ecclesiasticalTitle)
  check('antes: nenhuma ocorrência no perfil', (await ocorrencias(ficha.id)).length === 0)

  const cardFicha = await openAdmissionCard({
    member: ficha,
    user: operador || { id: null },
    upToColumnIndex: 2,
    note: 'Adesão aprovada pela ficha do "Quero ser Membro".',
  })
  if (cardFicha) criado.cardIds.push(cardFicha.cardId)
  check('card aberto e movido', cardFicha?.columnIndex === 2, cardFicha?.protocol)

  const p2 = await perfil(ficha.id)
  check('título final é o da coluna 2', p2.ecclesiasticalTitle === regra2.newTitle, p2.ecclesiasticalTitle)
  check('situação final é a da coluna 2', p2.membershipStatus === regra2.newStatus.toUpperCase(), p2.membershipStatus)
  check('título ficou vinculado ao cadastro de títulos', !!p2.ecclesiasticalTitleId)

  const o2 = await ocorrencias(ficha.id)
  check('duas ocorrências, na ordem do pipeline', o2.length === 2, o2.map((o) => o.action).join(' → '))
  check('primeira é a da coluna 1', o2[0]?.action === regra1.occurrenceName && o2[0]?.columnIndex === 1, o2[0]?.action)
  check('segunda é a da coluna 2', o2[1]?.action === regra2.occurrenceName && o2[1]?.columnIndex === 2, o2[1]?.action)
  check('ocorrência diz que veio da ficha', (o2[1]?.notes || '').includes('Quero ser Membro'), o2[1]?.notes)

  const titulo = await prisma.memberTitleHistory.findMany({
    where: { memberId: ficha.id }, orderBy: { createdAt: 'asc' },
    select: { previousTitle: true, newTitle: true, source: true },
  })
  check('troca de título registrada nas duas etapas', titulo.length === 2,
    titulo.map((t) => `${t.previousTitle || '—'}→${t.newTitle}`).join(' | '))
  check('histórico de título marcado como MATRIZ', titulo.every((t) => t.source === 'MATRIZ'))

  const cardNoBanco = await prisma.kanCard.findUnique({
    where: { id: cardFicha.cardId },
    select: { columnIndex: true, statusLabel: true, approvedAt: true, closedAt: true, memberId: true, stage: { select: { columns: { select: { id: true } } } } },
  })
  check('card aparece no pipeline em Aprovado', cardNoBanco.columnIndex === 2, cardNoBanco.statusLabel)
  check('card vinculado ao membro', cardNoBanco.memberId === ficha.id)
  check('aprovação carimbada', !!cardNoBanco.approvedAt)
  check('não encerrou antes da última coluna', !cardNoBanco.closedAt,
    `coluna 2 de ${cardNoBanco.stage.columns.length}`)

  if (operador) {
    const aviso = await sql(`SELECT title FROM notifications WHERE data->>'cardId' = '${cardFicha.cardId}' LIMIT 1`)
    check('notificação de movimento criada', aviso.length === 1, aviso[0]?.title)
  }

  // ── 3. os dois caminhos terminam iguais ──
  step(3, 'Quem entra pela ficha fica igual a quem foi aprovado no pipeline?')
  const noPipeline = await novoMembro('Aprovado No Pipeline')
  const cardPipe = await openAdmissionCard({ member: noPipeline, user: operador || { id: null }, upToColumnIndex: 2 })
  if (cardPipe) criado.cardIds.push(cardPipe.cardId)
  const pPipe = await perfil(noPipeline.id)
  check('mesmo título', pPipe.ecclesiasticalTitle === p2.ecclesiasticalTitle, `${pPipe.ecclesiasticalTitle} = ${p2.ecclesiasticalTitle}`)
  check('mesma situação', pPipe.membershipStatus === p2.membershipStatus, pPipe.membershipStatus)
  check('mesma quantidade de ocorrências', (await ocorrencias(noPipeline.id)).length === o2.length)

  // ── 4. o cadastro não pode quebrar por causa do pipeline ──
  step(4, 'Se o pipeline falhar, o cadastro do membro sobrevive?')
  const semCard = await openAdmissionCard({ member: { id: '00000000-0000-0000-0000-000000000000', churchId: igreja.id, fullName: '[E2E] Inexistente' }, user: { id: null } })
  check('helper devolve null em vez de estourar', semCard === null)

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
