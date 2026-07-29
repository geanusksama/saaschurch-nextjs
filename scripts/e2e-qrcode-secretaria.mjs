/**
 * Simulação ponta a ponta do leitor de QR Code da Secretaria.
 *
 * Percorre o caminho real do canhoto impresso: gera o QR do card → lê o código
 * como a câmera leria (URL, uuid puro e protocolo digitado) → confere os dados
 * → BATIZA aplicando a matriz (título/status do membro + ocorrência) → repete o
 * caminho do ABANDONO → e testa a trava da Consagração, que só libera na etapa
 * "Documentos Aprovados".
 *
 * Importa scanRules.ts e kanMatrix.ts de verdade — o teste roda em cima do
 * código de produção, não de uma cópia.
 *
 * Roda contra o banco de verdade, mas cria a própria igreja, os próprios
 * membros e os próprios cards com prefixo [E2E] — nenhum registro real é
 * tocado. Tudo é apagado no fim (--keep preserva).
 *
 * Uso: npx tsx scripts/e2e-qrcode-secretaria.mjs
 */

import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })

import { PrismaClient } from '@prisma/client'
import QRCode from 'qrcode'
import {
  confirmBlockedReason,
  detectMode,
  normalizeCode,
  targetColumns,
} from '../src/lib/scanRules.ts'
import { applyMatrixRule, notifyKanAction } from '../src/lib/kanMatrix.ts'

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

const criado = { churchId: null, memberIds: [], cardIds: [] }

async function limpar() {
  console.log('\n🧹 limpando os dados do teste...')
  if (criado.cardIds.length) {
    const lista = criado.cardIds.map((id) => `'${id}'::uuid`).join(',')
    const texto = criado.cardIds.map((id) => `'${id}'`).join(',')
    await exec(`DELETE FROM notifications WHERE data->>'cardId' IN (${texto})`).catch(() => {})
    await exec(`DELETE FROM member_event_history WHERE card_id IN (${lista})`).catch(() => {})
    await exec(`DELETE FROM member_title_history WHERE card_id IN (${lista})`).catch(() => {})
    await exec(`DELETE FROM kan_cards WHERE id IN (${lista})`).catch(() => {})
  }
  if (criado.churchId) {
    const c = `'${criado.churchId}'::uuid`
    await exec(`DELETE FROM member_event_history WHERE church_id = ${c}`).catch(() => {})
    await exec(`DELETE FROM member_title_history WHERE church_id = ${c}`).catch(() => {})
    await exec(`DELETE FROM members WHERE church_id = ${c}`).catch(() => {})
    await exec(`DELETE FROM churches WHERE id = ${c}`).catch(() => {})
  }
  console.log('   pronto — banco no estado anterior.')
}

/** URL gravada no QR impresso — o mesmo formato de src/lib/scanQr.ts. */
const qrUrlDoCard = (cardId) => `https://mrm.exemplo.app/app-ui/qr-reader?c=${cardId}`

/**
 * Reproduz o POST /api/ecclesiastical/scan: decide o destino pelas regras reais,
 * respeita os bloqueios e move o card aplicando a matriz — inclusive as travas
 * que o arrasto no pipeline tem (documento obrigatório) e a notificação.
 */
async function lerEAgir({ card, action, mode, user = { id: null } }) {
  const modo = detectMode(card.service)
  if (!modo) return { erro: 'Este QR Code não é de Batismo nem de Consagração.' }
  if (mode && mode !== modo) return { erro: 'QR de outro tipo — troque o modo do leitor.' }

  const colunas = card.stage?.columns || []
  const alvos = targetColumns(modo, colunas)
  const destino = action === 'confirm' ? alvos.confirm : alvos.abandon
  if (!destino) return { erro: 'Coluna de destino não configurada no pipeline.' }

  if (action === 'confirm') {
    const bloqueio = confirmBlockedReason(modo, card, alvos)
    if (bloqueio) return { erro: bloqueio, bloqueado: true }
  }

  const regra = await prisma.kanMatrixRule.findUnique({
    where: { serviceId_columnIndex: { serviceId: card.serviceId, columnIndex: destino.columnIndex } },
  })
  if (regra?.requireDocument) {
    const anexos = card.attachments
    const lista = Array.isArray(anexos) ? anexos : anexos ? Object.values(anexos) : []
    if (!lista.length) return { erro: `A etapa "${destino.name}" exige documento anexado no processo.`, bloqueado: true }
  }

  if (card.columnIndex === destino.columnIndex) return { jaEstava: true, destino }

  const atualizado = await prisma.kanCard.update({
    where: { id: card.id },
    data: {
      columnId: destino.id,
      columnIndex: destino.columnIndex,
      statusLabel: destino.name,
      updatedBy: user.id,
      // igual ao PATCH do pipeline: encerra só na última coluna, aprova da 2ª em diante
      ...(destino.columnIndex === colunas.length ? { closedAt: new Date() } : {}),
      ...(destino.columnIndex >= 2 ? { approvedBy: user.id, approvedAt: new Date() } : {}),
    },
    include: { service: true, member: { select: { fullName: true } } },
  })

  await applyMatrixRule({
    card: atualizado,
    serviceId: atualizado.serviceId,
    columnIndex: destino.columnIndex,
    user,
    extraMessage: action === 'confirm'
      ? 'Confirmado pelo leitor de QR Code.'
      : 'Desistência registrada pelo leitor de QR Code.',
  })

  await notifyKanAction({
    user,
    card: { id: atualizado.id, protocol: atualizado.protocol, churchId: atualizado.churchId },
    action: `Movido para "${destino.name}"`,
    message: atualizado.member?.fullName || null,
  })

  return { ok: true, destino, card: atualizado }
}

const CARD_INCLUDE = {
  service: { select: { id: true, sigla: true, description: true, serviceGroup: true } },
  column: { select: { id: true, name: true, columnIndex: true } },
  stage: { include: { columns: { orderBy: { columnIndex: 'asc' } } } },
}

const recarregar = (id) => prisma.kanCard.findUnique({ where: { id }, include: CARD_INCLUDE })

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗')
  console.log('║  E2E — Leitor de QR Code: Batismo e Consagração                ║')
  console.log('╚═══════════════════════════════════════════════════════════════╝')

  // ── 0. ambiente ──
  step(0, 'Ambiente')
  const [regional] = await sql(`SELECT id, name FROM regionais WHERE deleted_at IS NULL ORDER BY name LIMIT 1`)
  check('regional encontrada', !!regional, regional?.name)
  if (!regional) throw new Error('sem regional')

  const servicoBatismo = await prisma.kanService.findFirst({ where: { serviceGroup: 'BATISMO' } })
  check('serviço de Batismo existe na matriz', !!servicoBatismo, servicoBatismo?.description)
  if (!servicoBatismo) throw new Error('sem serviço de batismo')

  const stageBatismo = await prisma.kanStage.findFirst({
    where: { name: { contains: 'Batismo', mode: 'insensitive' } },
    include: { columns: { orderBy: { columnIndex: 'asc' } } },
  })
  check('pipeline de Batismo tem colunas', (stageBatismo?.columns?.length || 0) >= 3,
    stageBatismo?.columns?.map((c) => c.name).join(' → '))

  const stageConsagracao = await prisma.kanStage.findFirst({
    where: { name: { contains: 'Consagra', mode: 'insensitive' } },
    include: { columns: { orderBy: { columnIndex: 'asc' } } },
  })
  check('pipeline de Consagração tem colunas', (stageConsagracao?.columns?.length || 0) >= 4,
    stageConsagracao?.columns?.map((c) => c.name).join(' → '))

  const stamp = Date.now().toString().slice(-6)
  const igreja = await prisma.church.create({
    data: { regionalId: regional.id, name: '[E2E] Igreja do Tanque', code: `E2E-QR${stamp}` },
    select: { id: true, name: true },
  })
  criado.churchId = igreja.id

  const novoMembro = async (nome) => {
    const m = await prisma.member.create({
      data: { churchId: igreja.id, fullName: `[E2E] ${nome}`, ecclesiasticalTitle: 'CONGREGADO', membershipStatus: 'CONGREGADO' },
      select: { id: true, fullName: true, rol: true },
    })
    criado.memberIds.push(m.id)
    return m
  }
  const batizando = await novoMembro('Candidato Batismo')
  const desistente = await novoMembro('Candidato Desistente')
  check('igreja e 2 membros de teste criados', !!igreja.id && criado.memberIds.length === 2,
    `ROL ${batizando.rol} e ${desistente.rol}`)

  const novoCard = async (stage, servico, membro, columnIndex) => {
    const coluna = stage.columns.find((c) => c.columnIndex === columnIndex) || stage.columns[0]
    const card = await prisma.kanCard.create({
      data: {
        protocol: `E2E-${stamp}-${criado.cardIds.length + 1}`,
        stageId: stage.id,
        serviceId: servico.id,
        columnId: coluna.id,
        columnIndex: coluna.columnIndex,
        statusLabel: coluna.name,
        churchId: igreja.id,
        memberId: membro.id,
        candidateName: membro.fullName,
      },
      select: { id: true, protocol: true },
    })
    criado.cardIds.push(card.id)
    return card
  }

  // ── 1. QR impresso ──
  step(1, 'O QR impresso no canhoto volta a apontar para o card certo?')
  const cardBatismo = await novoCard(stageBatismo, servicoBatismo, batizando, 1)
  const url = qrUrlDoCard(cardBatismo.id)
  const dataUrl = await QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 0, width: 320 })
  check('QR gerado como imagem embutida', dataUrl.startsWith('data:image/png;base64,'), `${dataUrl.length} bytes`)
  check('URL do QR devolve o id do card', normalizeCode(url) === cardBatismo.id)
  check('uuid puro também é aceito', normalizeCode(cardBatismo.id) === cardBatismo.id)
  check('protocolo digitado à mão sobe em maiúsculas', normalizeCode(` ${cardBatismo.protocol.toLowerCase()} `) === cardBatismo.protocol.toUpperCase())
  check('código vazio não vira busca', normalizeCode('   ') === '')

  // ── 2. conferência ──
  step(2, 'A leitura mostra os dados certos e libera o botão Batizar?')
  let card = await recarregar(cardBatismo.id)
  check('modo detectado pelo serviço do card', detectMode(card.service) === 'baptism', card.service.serviceGroup)
  let alvos = targetColumns('baptism', card.stage.columns)
  check('coluna de confirmação resolvida', !!alvos.confirm, alvos.confirm?.name)
  check('coluna de abandono resolvida', !!alvos.abandon, alvos.abandon?.name)
  check('botão Batizar liberado na etapa inicial', confirmBlockedReason('baptism', card, alvos) === null)

  // ── 3. batizar ──
  step(3, 'Batizar aplica a matriz igual ao arrastar o card no pipeline?')
  const antesTitulo = (await prisma.member.findUnique({ where: { id: batizando.id }, select: { ecclesiasticalTitle: true } })).ecclesiasticalTitle
  const operador = await prisma.user.findFirst({ where: { deletedAt: null }, select: { id: true, campoId: true } })
  const res = await lerEAgir({ card, action: 'confirm', mode: 'baptism', user: operador || { id: null } })
  check('movimento aceito', res.ok === true, res.destino?.name)

  card = await recarregar(cardBatismo.id)
  check('card foi para a coluna de batizado', card.columnIndex === alvos.confirm.columnIndex, card.statusLabel)
  check('aprovação carimbada (coluna >= 2)', !!card.approvedAt)
  // O pipeline só encerra na ÚLTIMA coluna; o leitor tem que fazer igual.
  const ehUltima = alvos.confirm.columnIndex === card.stage.columns.length
  check('closedAt segue a regra do pipeline', ehUltima ? !!card.closedAt : !card.closedAt,
    `coluna ${alvos.confirm.columnIndex} de ${card.stage.columns.length}`)

  if (operador) {
    const aviso = await sql(`SELECT title, message FROM notifications WHERE data->>'cardId' = '${cardBatismo.id}' LIMIT 1`)
    check('notificação de movimento criada', aviso.length === 1, aviso[0]?.title)
    check('notificação cita o membro', (aviso[0]?.message || '').includes('Candidato Batismo'), aviso[0]?.message)
  }

  const membroDepois = await prisma.member.findUnique({
    where: { id: batizando.id },
    select: { ecclesiasticalTitle: true, membershipStatus: true },
  })
  const regra = await prisma.kanMatrixRule.findUnique({
    where: { serviceId_columnIndex: { serviceId: servicoBatismo.id, columnIndex: alvos.confirm.columnIndex } },
  })
  check('regra da matriz existe para a coluna', !!regra, regra?.occurrenceName)
  if (regra?.changeTitle) {
    check('título do membro mudou pela matriz', membroDepois.ecclesiasticalTitle === regra.newTitle,
      `${antesTitulo} → ${membroDepois.ecclesiasticalTitle}`)
    const titulo = await prisma.memberTitleHistory.findFirst({ where: { cardId: cardBatismo.id }, orderBy: { createdAt: 'desc' } })
    check('troca de título ficou no histórico', !!titulo && titulo.source === 'MATRIZ', titulo?.newTitle)
  }
  if (regra?.changeStatus) {
    check('status do membro mudou pela matriz', membroDepois.membershipStatus === regra.newStatus.toUpperCase(),
      membroDepois.membershipStatus)
  }

  const ocorrencia = await prisma.memberEventHistory.findFirst({
    where: { cardId: cardBatismo.id }, orderBy: { createdAt: 'desc' },
  })
  check('ocorrência gravada no perfil do membro', !!ocorrencia, ocorrencia?.action)
  check('ocorrência aponta o leitor como origem', (ocorrencia?.notes || '').includes('QR Code'), ocorrencia?.notes)
  check('ocorrência ficou no membro certo', ocorrencia?.memberId === batizando.id)

  // ── 4. reler o mesmo papel ──
  step(4, 'Ler duas vezes o mesmo canhoto não batiza de novo?')
  const relido = await lerEAgir({ card, action: 'confirm', mode: 'baptism' })
  check('segunda leitura é recusada como repetida', relido.jaEstava === true)
  const ocorrencias = await prisma.memberEventHistory.count({ where: { cardId: cardBatismo.id } })
  check('nenhuma ocorrência duplicada', ocorrencias === 1, `${ocorrencias} ocorrência(s)`)

  // ── 5. abandono ──
  step(5, 'Abandonar manda o candidato para a coluna de cancelamento?')
  const cardDesistente = await novoCard(stageBatismo, servicoBatismo, desistente, 1)
  let cardD = await recarregar(cardDesistente.id)
  const resD = await lerEAgir({ card: cardD, action: 'abandon', mode: 'baptism' })
  check('abandono aceito', resD.ok === true, resD.destino?.name)
  cardD = await recarregar(cardDesistente.id)
  check('card foi para a coluna de cancelado', cardD.columnIndex === alvos.abandon.columnIndex, cardD.statusLabel)
  const membroD = await prisma.member.findUnique({ where: { id: desistente.id }, select: { ecclesiasticalTitle: true } })
  check('quem desistiu NÃO virou membro batizado', membroD.ecclesiasticalTitle === 'CONGREGADO', membroD.ecclesiasticalTitle)

  const alvosD = targetColumns('baptism', cardD.stage.columns)
  check('card cancelado não pode mais ser confirmado', confirmBlockedReason('baptism', cardD, alvosD) !== null,
    confirmBlockedReason('baptism', cardD, alvosD))

  // ── 6. trava da consagração ──
  step(6, 'Consagração só libera em "Documentos Aprovados"?')
  if (!stageConsagracao) {
    check('pipeline de Consagração disponível para o teste', false)
  } else {
    const alvosC = targetColumns('consecration', stageConsagracao.columns)
    check('etapa exigida resolvida', !!alvosC.requiredBefore, alvosC.requiredBefore?.name)
    check('etapa exigida é a de documentos', /documento/i.test(alvosC.requiredBefore?.name || ''), alvosC.requiredBefore?.name)
    check('coluna de consagrado resolvida', /consagrad/i.test(alvosC.confirm?.name || ''), alvosC.confirm?.name)

    const fora = stageConsagracao.columns.filter(
      (c) => c.columnIndex !== alvosC.requiredBefore.columnIndex && c.columnIndex !== alvosC.confirm.columnIndex,
    )
    for (const coluna of fora) {
      const motivo = confirmBlockedReason('consecration', { columnIndex: coluna.columnIndex, statusLabel: coluna.name }, alvosC)
      check(`bloqueia em "${coluna.name}"`, typeof motivo === 'string' && motivo.length > 0)
      if (motivo && !/cancel/i.test(coluna.name)) {
        check(`  motivo cita a etapa exigida e a atual`, motivo.includes(alvosC.requiredBefore.name) && motivo.includes(coluna.name), motivo)
      }
    }

    const liberado = confirmBlockedReason(
      'consecration',
      { columnIndex: alvosC.requiredBefore.columnIndex, statusLabel: alvosC.requiredBefore.name },
      alvosC,
    )
    check('libera em "Documentos Aprovados"', liberado === null)

    const jaConsagrado = confirmBlockedReason(
      'consecration',
      { columnIndex: alvosC.confirm.columnIndex, statusLabel: alvosC.confirm.name },
      alvosC,
    )
    check('quem já está consagrado não é bloqueado por motivo de etapa', jaConsagrado === null)
  }

  // ── 6b. documento obrigatório ──
  step('6b', 'Coluna que exige documento barra o leitor igual barra o pipeline?')
  const regraConfirm = await prisma.kanMatrixRule.findUnique({
    where: { serviceId_columnIndex: { serviceId: servicoBatismo.id, columnIndex: alvos.confirm.columnIndex } },
  })
  const exigiaAntes = regraConfirm?.requireDocument ?? false
  const membroDoc = await novoMembro('Candidato Sem Documento')
  const cardDoc = await novoCard(stageBatismo, servicoBatismo, membroDoc, 1)
  try {
    await prisma.kanMatrixRule.update({ where: { id: regraConfirm.id }, data: { requireDocument: true } })
    const semAnexo = await lerEAgir({ card: await recarregar(cardDoc.id), action: 'confirm', mode: 'baptism' })
    check('sem anexo o leitor recusa', semAnexo.bloqueado === true, semAnexo.erro)
    check('card não saiu do lugar', (await recarregar(cardDoc.id)).columnIndex === 1)

    await prisma.kanCard.update({ where: { id: cardDoc.id }, data: { attachments: [{ nome: '[E2E] ficha.pdf' }] } })
    const comAnexo = await lerEAgir({ card: await recarregar(cardDoc.id), action: 'confirm', mode: 'baptism' })
    check('com anexo o leitor libera', comAnexo.ok === true, comAnexo.destino?.name)
  } finally {
    // devolve a regra da matriz ao estado original — é dado de produção
    await prisma.kanMatrixRule.update({ where: { id: regraConfirm.id }, data: { requireDocument: exigiaAntes } })
  }
  const regraVolta = await prisma.kanMatrixRule.findUnique({ where: { id: regraConfirm.id } })
  check('regra da matriz restaurada', (regraVolta.requireDocument ?? false) === exigiaAntes, `requireDocument=${regraVolta.requireDocument}`)

  // ── 7. QR de outro tipo ──
  step(7, 'Ler um QR de Batismo no modo Consagração é recusado?')
  const trocado = await lerEAgir({ card, action: 'confirm', mode: 'consecration' })
  check('leitor recusa o QR do tipo errado', !!trocado.erro, trocado.erro)
  check('detectMode ignora serviço desconhecido', detectMode({ serviceGroup: 'GERAL', description: 'Requerimento' }) === null)

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
