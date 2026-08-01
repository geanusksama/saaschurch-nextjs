/**
 * Simulação ponta a ponta do módulo GF (Grupos Familiares).
 *
 * Percorre o caminho real: cria o GF com endereço estruturado e coordenadas →
 * a tag do GF nasce junto → anexa um membro → anexa um contato de lista
 * importada → tenta anexar as mesmas pessoas em um segundo GF (deve BLOQUEAR)
 * → transfere com força → gera o link público do resumo → monta os fatos da
 * conversa que alimentam o parecer em PDF.
 *
 * Importa `cellGroupService.ts`, `geo.ts` e `gfContactReportService.ts` de
 * verdade — roda em cima do código de produção. A parte de IA do parecer NÃO é
 * exercitada (depende de chave e de crédito); o que se testa aqui é o cálculo
 * dos fatos: tentativas sem resposta, links enviados e situação no GF.
 *
 * Roda contra o banco de verdade, mas cria o próprio campo, regional, igreja,
 * membros, GFs e lote de importação com prefixo [E2E]; nenhum registro real é
 * tocado. Tudo é apagado no fim (--keep preserva para inspeção).
 *
 * Uso: npx tsx scripts/e2e-gf.mjs
 */

import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })

import { PrismaClient } from '@prisma/client'
import { buildAddressLabel, buildMapEmbedUrl, normalizeZipcode } from '../src/lib/geo.ts'
import {
  assignCellGroupTag,
  cellGroupDataFromBody,
  ensureCellGroupTag,
  removeCellGroupTag,
} from '../src/lib/cellGroupService.ts'
import { loadConversationFacts, loadGfSituation } from '../src/lib/gfContactReportService.ts'
import { gfResumoPublicUrl } from '../src/lib/cellGroupNotify.ts'

const prisma = new PrismaClient()
const KEEP = process.argv.includes('--keep')
const exec = (q) => prisma.$executeRawUnsafe(q)
const sql = (q) => prisma.$queryRawUnsafe(q)

let passed = 0, failed = 0
const falhas = []
function check(label, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { failed++; falhas.push(label); console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}
const step = (n, t) => console.log(`\n${'─'.repeat(72)}\n${n}. ${t}\n${'─'.repeat(72)}`)

const criado = {
  campoId: null, regionalId: null, churchId: null,
  cellIds: [], batchId: null, conversationId: null, instanceId: null, shareTokens: [],
}

async function limpar() {
  console.log('\n🧹 limpando os dados do teste...')
  for (const t of criado.shareTokens) {
    await exec(`DELETE FROM cell_group_share_links WHERE token = '${t}'::uuid`).catch(() => {})
  }
  if (criado.batchId) {
    await exec(`DELETE FROM whatsapp_import_batches WHERE id = '${criado.batchId}'::uuid`).catch(() => {})
  }
  if (criado.conversationId) {
    await exec(`DELETE FROM whatsapp_conversations WHERE id = '${criado.conversationId}'::uuid`).catch(() => {})
  }
  if (criado.instanceId) {
    await exec(`DELETE FROM whatsapp_instances WHERE id = '${criado.instanceId}'::uuid`).catch(() => {})
  }
  for (const id of criado.cellIds) {
    await exec(`DELETE FROM cell_groups WHERE id = '${id}'::uuid`).catch(() => {})
  }
  if (criado.churchId) {
    const c = `'${criado.churchId}'::uuid`
    await exec(`DELETE FROM member_tag_assignments WHERE member_id IN (SELECT id FROM members WHERE church_id = ${c})`).catch(() => {})
    await exec(`DELETE FROM member_tags WHERE church_id = ${c}`).catch(() => {})
    await exec(`DELETE FROM members WHERE church_id = ${c}`).catch(() => {})
    await exec(`DELETE FROM churches WHERE id = ${c}`).catch(() => {})
  }
  if (criado.regionalId) await exec(`DELETE FROM regionais WHERE id = '${criado.regionalId}'::uuid`).catch(() => {})
  if (criado.campoId) await exec(`DELETE FROM campos WHERE id = '${criado.campoId}'::uuid`).catch(() => {})
  console.log('   pronto — banco no estado anterior.')
}

/**
 * Reproduz a regra da rota POST /api/cell-groups/[id]/members para membro.
 * O e2e não sobe o servidor: o que precisa ser verdade é a REGRA, e ela é a
 * mesma dos dois lados (409 sem force, transferência com force).
 */
async function anexarMembro(cellGroupId, memberId, { force = false } = {}) {
  const atual = await prisma.cellGroupMember.findFirst({
    where: { memberId, isActive: true },
    include: { cellGroup: { select: { id: true, name: true } } },
  })
  if (atual?.cellGroupId === cellGroupId) return { erro: 'ja_neste_gf' }
  if (atual && !force) return { erro: 'ja_em_outro_gf', gf: atual.cellGroup.name }
  if (atual) {
    await prisma.cellGroupMember.update({
      where: { id: atual.id },
      data: { isActive: false, leftAt: new Date() },
    })
    await removeCellGroupTag(atual.cellGroupId, memberId)
  }
  const link = await prisma.cellGroupMember.create({
    data: { cellGroupId, memberId, role: 'member', joinedAt: new Date() },
  })
  await assignCellGroupTag(cellGroupId, memberId)
  return { link }
}

async function anexarImport(cellGroupId, rowId, { force = false } = {}) {
  const [row] = await sql(`SELECT cell_group_id FROM whatsapp_import_rows WHERE id = '${rowId}'::uuid`)
  if (row?.cell_group_id === cellGroupId) return { erro: 'ja_neste_gf' }
  if (row?.cell_group_id && !force) return { erro: 'ja_em_outro_gf' }
  await exec(
    `UPDATE whatsapp_import_rows SET cell_group_id = '${cellGroupId}'::uuid, cell_group_assigned_at = now() WHERE id = '${rowId}'::uuid`
  )
  return { ok: true }
}

// ═══════════════════════════════════════════════════════════════════════════
async function main() {
  console.log('\n🏠 E2E — Módulo GF (Grupos Familiares)\n')

  // ── 1. cenário ────────────────────────────────────────────────────────────
  step(1, 'Montar o cenário: campo, regional, igreja, líder e membro')

  const stamp = Date.now() % 100000
  const campo = await prisma.campo.create({ data: { name: '[E2E] Campo GF', code: `E2EGC${stamp}` } })
  criado.campoId = campo.id

  const regional = await prisma.regional.create({
    data: { name: '[E2E] Regional GF', code: `E2EGR${stamp}`, campoId: campo.id },
  })
  criado.regionalId = regional.id

  const igreja = await prisma.church.create({
    data: { name: '[E2E] Igreja GF', code: `E2EGI${stamp}`, regionalId: regional.id },
  })
  criado.churchId = igreja.id

  const lider = await prisma.member.create({
    data: { churchId: igreja.id, fullName: '[E2E] Pedro Líder', mobile: '19999990101', membershipStatus: 'ATIVO' },
  })
  const membro = await prisma.member.create({
    data: { churchId: igreja.id, fullName: '[E2E] Marta Membro', mobile: '19999990102', membershipStatus: 'ATIVO' },
  })
  check('cenário criado', !!lider.id && !!membro.id)

  // ── 2. cadastro com endereço estruturado ──────────────────────────────────
  step(2, 'Cadastrar o GF com CEP, endereço estruturado e coordenadas')

  const corpo = {
    name: '[E2E] GF Central',
    network: 'Adultos',
    color: '#0EA5E9',
    leaderId: lider.id,
    addressZipcode: '13010-111',
    addressStreet: 'Rua Barão de Jaguara',
    addressNumber: '100',
    addressNeighborhood: 'Centro',
    addressCity: 'Campinas',
    addressState: 'SP',
    latitude: '-22.90556000',
    longitude: '-47.06083000',
    meetingDay: 'Quinta',
    meetingTime: '19:30',
  }

  const dados = cellGroupDataFromBody(corpo)
  check('CEP normalizado para 8 dígitos', normalizeZipcode(corpo.addressZipcode).length === 8)
  check('rótulo de endereço montado a partir dos campos', dados.address?.includes('Barão de Jaguara'), dados.address)
  check('horário virou Time', dados.meetingTime instanceof Date)
  check('rede virou cellType', dados.cellType === 'Adultos')

  const gf = await prisma.cellGroup.create({ data: { ...dados, churchId: igreja.id } })
  criado.cellIds.push(gf.id)
  check('GF gravado com coordenadas', Number(gf.latitude) !== 0 && gf.longitude != null, `${gf.latitude}, ${gf.longitude}`)
  check('mapa embed montado sem chave de API', buildMapEmbedUrl(gf).includes('output=embed'))
  check('endereço estruturado persistido', gf.addressCity === 'Campinas' && gf.addressZipcode === '13010-111')

  const gf2 = await prisma.cellGroup.create({
    data: { ...cellGroupDataFromBody({ ...corpo, name: '[E2E] GF Vila Nova' }), churchId: igreja.id },
  })
  criado.cellIds.push(gf2.id)

  // ── 3. tag do GF ──────────────────────────────────────────────────────────
  step(3, 'A tag do GF nasce junto com o grupo e vai para o perfil')

  const tag = await ensureCellGroupTag(gf.id)
  check('tag criada com o nome do GF', tag?.name === `GF ${gf.name}`, tag?.name)
  check('tag herdou a cor do GF', tag?.color === '#0EA5E9', tag?.color)

  const mesmaTag = await ensureCellGroupTag(gf.id)
  check('chamar de novo não duplica a tag', mesmaTag?.id === tag?.id)

  await assignCellGroupTag(gf.id, lider.id)
  const tagsDoLider = await prisma.memberTagAssignment.findMany({ where: { memberId: lider.id }, include: { tag: true } })
  check('líder recebeu a tag do GF', tagsDoLider.some((t) => t.tagId === tag.id))

  // ── 4. anexar membro e travar o GF único ──────────────────────────────────
  step(4, 'Anexar membro e bloquear a entrada em um segundo GF')

  const r1 = await anexarMembro(gf.id, membro.id)
  check('membro anexado ao primeiro GF', !!r1.link)

  const tagsDoMembro = await prisma.memberTagAssignment.findMany({ where: { memberId: membro.id } })
  check('membro anexado recebeu a tag do GF', tagsDoMembro.some((t) => t.tagId === tag.id))

  const r2 = await anexarMembro(gf.id, membro.id)
  check('anexar duas vezes no MESMO GF é bloqueado', r2.erro === 'ja_neste_gf')

  const r3 = await anexarMembro(gf2.id, membro.id)
  check('anexar em OUTRO GF sem confirmar é bloqueado', r3.erro === 'ja_em_outro_gf', r3.gf)

  const r4 = await anexarMembro(gf2.id, membro.id, { force: true })
  check('com force, transfere de GF', !!r4.link)

  const vinculos = await prisma.cellGroupMember.findMany({ where: { memberId: membro.id } })
  const ativos = vinculos.filter((v) => v.isActive)
  check('só sobra UM vínculo ativo depois da transferência', ativos.length === 1)
  check('vínculo ativo é o do GF novo', ativos[0]?.cellGroupId === gf2.id)
  check('vínculo antigo guardou a data de saída', vinculos.some((v) => !v.isActive && v.leftAt))

  const tagsPosTransferencia = await prisma.memberTagAssignment.findMany({ where: { memberId: membro.id } })
  check('tag do GF antigo saiu do perfil', !tagsPosTransferencia.some((t) => t.tagId === tag.id))

  // devolve o membro para o primeiro GF, que é o cenário do resto do teste
  await anexarMembro(gf.id, membro.id, { force: true })

  // ── 5. contato de lista importada ─────────────────────────────────────────
  step(5, 'Anexar contato de lista importada e travar o GF único dele também')

  const [batch] = await sql(`
    INSERT INTO whatsapp_import_batches (church_id, owner_user_id, filename, total_rows, valid_rows, status)
    VALUES ('${igreja.id}'::uuid, 'e2e-gf', '[E2E] lista-gf.csv', 2, 2, 'analyzed')
    RETURNING id
  `)
  criado.batchId = batch.id

  const TELEFONE = '5519999990203'
  const [row] = await sql(`
    INSERT INTO whatsapp_import_rows (batch_id, row_number, raw, name, phone, match_status, decision)
    VALUES ('${batch.id}'::uuid, 1, '{}'::jsonb, '[E2E] Joana Visitante', '${TELEFONE}', 'new', 'send')
    RETURNING id
  `)

  const i1 = await anexarImport(gf.id, row.id)
  check('contato importado anexado ao GF', i1.ok === true)

  const i2 = await anexarImport(gf.id, row.id)
  check('anexar o mesmo contato no MESMO GF é bloqueado', i2.erro === 'ja_neste_gf')

  const i3 = await anexarImport(gf2.id, row.id)
  check('anexar o contato em OUTRO GF sem confirmar é bloqueado', i3.erro === 'ja_em_outro_gf')

  const [semGf] = await sql(`
    SELECT count(*)::int AS n FROM whatsapp_import_rows
    WHERE batch_id = '${batch.id}'::uuid AND cell_group_id IS NULL
  `)
  check('filtro "sem GF" enxerga quem ainda não foi encaminhado', Number(semGf.n) === 0, `${semGf.n} sem GF`)

  // ── 6. link público do resumo ─────────────────────────────────────────────
  step(6, 'Gerar o link público que o líder recebe no WhatsApp')

  const [share] = await sql(`
    INSERT INTO cell_group_share_links (cell_group_id, import_row_id, contact_name, contact_phone, created_by)
    VALUES ('${gf.id}'::uuid, '${row.id}'::uuid, '[E2E] Joana Visitante', '${TELEFONE}', 'e2e-gf')
    RETURNING token
  `)
  criado.shareTokens.push(share.token)

  const url = gfResumoPublicUrl(share.token)
  check('link público aponta para /gf-resumo/<token>', url.includes(`/gf-resumo/${share.token}`), url)

  // Quem recebe é uma pessoa de verdade: link de localhost não abre no celular
  // dela, então anexar rodando local tem que gerar o domínio público mesmo.
  const deLocal = gfResumoPublicUrl(share.token, 'http://localhost:3000')
  check('anexar pelo localhost NÃO gera link de localhost', !deLocal.includes('localhost'), deLocal)
  check('link do localhost cai no domínio público', deLocal.startsWith('http') && deLocal.includes('/gf-resumo/'))

  const dePreview = gfResumoPublicUrl(share.token, 'https://preview-abc.vercel.app')
  check('preview mantém o próprio domínio', dePreview.startsWith('https://preview-abc.vercel.app/gf-resumo/'), dePreview)

  const [porToken] = await sql(`SELECT contact_phone FROM cell_group_share_links WHERE token = '${share.token}'::uuid`)
  check('token abre exatamente um contato', porToken?.contact_phone === TELEFONE)

  // ── 7. fatos da conversa que alimentam o parecer ──────────────────────────
  step(7, 'Calcular os fatos da conversa usados no parecer em PDF')

  const [instancia] = await sql(`
    INSERT INTO whatsapp_instances (name, instance_id, token, owner_user_id, status, is_active)
    VALUES ('[E2E] Instancia GF', 'e2e-${stamp}', 'e2e-token', 'e2e-gf', 'connected', true)
    RETURNING id
  `)
  criado.instanceId = instancia.id

  const [conversa] = await sql(`
    INSERT INTO whatsapp_conversations (instance_id, phone, contact_name, owner_user_id)
    VALUES ('${instancia.id}'::uuid, '${TELEFONE}', '[E2E] Joana Visitante', 'e2e-gf')
    RETURNING id
  `)
  criado.conversationId = conversa.id

  // igreja fala, a pessoa responde, e depois a igreja tenta 2x sem retorno
  const mensagens = [
    ['outbound', 'Paz do Senhor, Joana! Seja bem-vinda.'],
    ['inbound', 'Obrigada! Gostei muito do culto.'],
    ['outbound', 'Que alegria! Nosso endereço: https://maps.google.com/?q=igreja'],
    ['outbound', 'Podemos te esperar no domingo?'],
  ]
  for (let i = 0; i < mensagens.length; i++) {
    const [dir, texto] = mensagens[i]
    await exec(`
      INSERT INTO whatsapp_messages (conversation_id, content, direction, status, created_at)
      VALUES ('${conversa.id}'::uuid, '${texto.replace(/'/g, "''")}', '${dir}', 'sent', now() + interval '${i} second')
    `)
  }

  const fatos = await loadConversationFacts(conversa.id)
  check('contou todas as mensagens', fatos.totalMessages === 4, String(fatos.totalMessages))
  check('reconheceu que a pessoa respondeu', fatos.respondeu === true)
  check('contou as tentativas sem resposta no fim', fatos.tentativasSemResposta === 2, String(fatos.tentativasSemResposta))
  check('extraiu o link enviado', fatos.linksEnviados.length === 1, fatos.linksEnviados[0])
  check('link de mapa detectado (endereço enviado)', /maps\./.test(fatos.linksEnviados[0] ?? ''))

  const situacaoImport = await loadGfSituation({ importRowId: row.id })
  check('situação do contato importado aponta o GF certo', situacaoImport.cellGroupName === gf.name, situacaoImport.cellGroupName)
  check('situação traz o nome do líder', situacaoImport.leaderName === lider.fullName, situacaoImport.leaderName)

  const situacaoMembro = await loadGfSituation({ memberId: membro.id })
  check('situação do membro aponta o GF ativo', situacaoMembro.cellGroupName === gf.name, situacaoMembro.cellGroupName)

  const semGrupo = await loadGfSituation({ memberId: lider.id })
  check('quem não está em GF nenhum aparece sem grupo', semGrupo.cellGroupName === null)

  // ── 8. desanexar ──────────────────────────────────────────────────────────
  step(8, 'Desanexar devolve a pessoa para a fila de quem está sem GF')

  await prisma.cellGroupMember.updateMany({
    where: { cellGroupId: gf.id, memberId: membro.id, isActive: true },
    data: { isActive: false, leftAt: new Date() },
  })
  await removeCellGroupTag(gf.id, membro.id)
  const restantes = await prisma.cellGroupMember.count({ where: { memberId: membro.id, isActive: true } })
  check('membro ficou sem GF ativo', restantes === 0)

  const tagsFinal = await prisma.memberTagAssignment.count({ where: { memberId: membro.id, tagId: tag.id } })
  check('tag do GF saiu do perfil ao desanexar', tagsFinal === 0)

  await exec(`UPDATE whatsapp_import_rows SET cell_group_id = NULL WHERE id = '${row.id}'::uuid`)
  const [semGfDepois] = await sql(`
    SELECT count(*)::int AS n FROM whatsapp_import_rows
    WHERE batch_id = '${batch.id}'::uuid AND cell_group_id IS NULL
  `)
  check('contato importado volta para a lista de "sem GF"', Number(semGfDepois.n) === 1)
}

main()
  .catch((err) => {
    failed++
    falhas.push(`exceção: ${err.message}`)
    console.error('\n💥', err)
  })
  .finally(async () => {
    if (!KEEP) await limpar()
    else console.log('\n⚠️  --keep: dados do teste preservados no banco.')

    console.log(`\n${'═'.repeat(72)}`)
    console.log(`  ${passed} passou · ${failed} falhou`)
    if (falhas.length) {
      console.log('\n  falhas:')
      for (const f of falhas) console.log(`   · ${f}`)
    }
    console.log(`${'═'.repeat(72)}\n`)

    await prisma.$disconnect()
    process.exit(failed ? 1 : 0)
  })
