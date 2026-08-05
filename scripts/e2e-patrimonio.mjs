/**
 * Simulação ponta a ponta do módulo Patrimônio.
 *
 * Percorre o caminho real: cria um bem manualmente (código sequencial + QR
 * gerados) → importa outros dois via CSV (um válido, um sem nome — deve ser
 * rejeitado) → inicia um inventário na igreja → escaneia o QR de um bem (bate
 * o local cadastrado) → escaneia outro reportando divergência de local → o bem
 * que não foi lido aparece como faltante → finaliza o inventário e confere os
 * totais do relatório.
 *
 * Importa `assetService.ts` de verdade — roda em cima do código de produção.
 * Reproduz a regra da rota de scan (POST /api/asset-inventories/[id]/scan)
 * porque o e2e não sobe o servidor Next; a regra em si (normalizeQrToken) vem
 * do mesmo módulo compartilhado que a rota usa.
 *
 * Roda contra o banco de verdade, mas cria o próprio campo, regional, igreja
 * e usuário com prefixo [E2E]; nenhum registro real é tocado. Tudo é apagado
 * no fim (--keep preserva para inspeção).
 *
 * Uso: npx tsx scripts/e2e-patrimonio.mjs
 */

import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })

import { PrismaClient } from '@prisma/client'
import { nextAssetCode } from '../src/lib/assetService.ts'
import { assetDataFromBody, locationLabel, normalizeQrToken } from '../src/lib/assetLocationOptions.ts'

const prisma = new PrismaClient()
const KEEP = process.argv.includes('--keep')
const exec = (q) => prisma.$executeRawUnsafe(q)

let passed = 0, failed = 0
const falhas = []
function check(label, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { failed++; falhas.push(label); console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}
const step = (n, t) => console.log(`\n${'─'.repeat(72)}\n${n}. ${t}\n${'─'.repeat(72)}`)

const criado = { campoId: null, regionalId: null, churchId: null, userId: null, assetIds: [], inventoryId: null }

async function limpar() {
  console.log('\n🧹 limpando os dados do teste...')
  if (criado.inventoryId) {
    await exec(`DELETE FROM asset_inventory_items WHERE inventory_id = '${criado.inventoryId}'::uuid`).catch(() => {})
    await exec(`DELETE FROM asset_inventories WHERE id = '${criado.inventoryId}'::uuid`).catch(() => {})
  }
  for (const id of criado.assetIds) {
    await exec(`DELETE FROM assets WHERE id = '${id}'::uuid`).catch(() => {})
  }
  if (criado.churchId) {
    await exec(`DELETE FROM assets WHERE church_id = '${criado.churchId}'::uuid`).catch(() => {})
  }
  if (criado.userId) await exec(`DELETE FROM users WHERE id = '${criado.userId}'::uuid`).catch(() => {})
  if (criado.churchId) await exec(`DELETE FROM churches WHERE id = '${criado.churchId}'::uuid`).catch(() => {})
  if (criado.regionalId) await exec(`DELETE FROM regionais WHERE id = '${criado.regionalId}'::uuid`).catch(() => {})
  if (criado.campoId) await exec(`DELETE FROM campos WHERE id = '${criado.campoId}'::uuid`).catch(() => {})
  console.log('   pronto — banco no estado anterior.')
}

/** Reproduz a regra da rota POST /api/asset-inventories/[id]/scan. */
async function escanear(inventoryId, churchId, rawCode, extra = {}) {
  const qrToken = normalizeQrToken(rawCode)
  if (!qrToken) return { erro: 'codigo_invalido' }
  const asset = await prisma.asset.findFirst({ where: { qrToken, churchId, deletedAt: null } })
  if (!asset) return { erro: 'nao_encontrado' }
  const locationMatch = extra.locationFound ? false : true
  const item = await prisma.assetInventoryItem.upsert({
    where: { inventoryId_assetId: { inventoryId, assetId: asset.id } },
    create: { inventoryId, assetId: asset.id, locationMatch, locationFound: extra.locationFound || null, observation: extra.observation || null },
    update: { locationMatch, locationFound: extra.locationFound || null, observation: extra.observation || null, scannedAt: new Date() },
  })
  return { asset, item, registeredLocationLabel: locationLabel(asset.locationType, asset.locationDetail) }
}

async function main() {
  console.log('\n📦 E2E — Módulo Patrimônio\n')

  // ── 1. cenário ────────────────────────────────────────────────────────────
  step(1, 'Montar o cenário: campo, regional, igreja e usuário responsável')

  const stamp = Date.now() % 100000
  const campo = await prisma.campo.create({ data: { name: '[E2E] Campo Patrimônio', code: `E2EPC${stamp}` } })
  criado.campoId = campo.id

  const regional = await prisma.regional.create({
    data: { name: '[E2E] Regional Patrimônio', code: `E2EPR${stamp}`, campoId: campo.id },
  })
  criado.regionalId = regional.id

  const igreja = await prisma.church.create({
    data: { name: '[E2E] Igreja Patrimônio', code: `E2EPI${stamp}`, regionalId: regional.id, currentLeaderName: '[E2E] Dirigente Teste' },
  })
  criado.churchId = igreja.id

  const usuario = await prisma.user.create({
    data: { email: `e2e-patrimonio-${stamp}@teste.local`, fullName: '[E2E] Usuário Patrimônio', profileType: 'church', churchId: igreja.id, campoId: campo.id, regionalId: regional.id },
  })
  criado.userId = usuario.id
  check('cenário criado', !!igreja.id && !!usuario.id)

  // ── 2. cadastro manual: código sequencial + QR ────────────────────────────
  step(2, 'Cadastro manual de bem — código sequencial e QR gerados sozinhos')

  const code1 = await nextAssetCode()
  const data1 = assetDataFromBody({ name: '[E2E] Cadeira plástica', category: 'Mobiliário', sector: 'Louvor', locationType: 'SALA', locationDetail: 'Sala 3' })
  const bem1 = await prisma.asset.create({ data: { ...data1, code: code1, churchId: igreja.id } })
  criado.assetIds.push(bem1.id)
  check('código sequencial gerado', /^PAT-\d{6}$/.test(bem1.code), bem1.code)
  check('qr_token gerado automaticamente', !!bem1.qrToken)

  const code2 = await nextAssetCode()
  check('próximo código é sequencial', code2 !== code1)
  const bem2 = await prisma.asset.create({
    data: { ...assetDataFromBody({ name: '[E2E] Caixa de som', category: 'Eletrônico', sector: 'Louvor', locationType: 'NAVE' }), code: code2, churchId: igreja.id },
  })
  criado.assetIds.push(bem2.id)

  const bem3 = await prisma.asset.create({
    data: { ...assetDataFromBody({ name: '[E2E] Microfone sem fio', category: 'Eletrônico', sector: 'Louvor', locationType: 'SALA', locationDetail: 'Sala de som' }), code: await nextAssetCode(), churchId: igreja.id },
  })
  criado.assetIds.push(bem3.id)

  // ── 3. importação CSV — validação linha a linha ───────────────────────────
  step(3, 'Importação CSV — reproduz a regra de POST /api/assets/import-csv/execute')

  const linhasCsv = [
    { name: '[E2E] Ventilador de teto', category: 'Eletrônico', sector: 'Manutenção', locationType: 'OUTRO', locationDetail: 'Depósito' },
    { name: '', category: 'Sem nome deveria falhar' }, // linha inválida
  ]
  let importados = 0
  const errosImport = []
  for (let i = 0; i < linhasCsv.length; i++) {
    const row = linhasCsv[i]
    if (!row.name?.trim()) { errosImport.push({ row: i + 1, message: "Campo 'nome' é obrigatório." }); continue }
    const code = await nextAssetCode()
    const bem = await prisma.asset.create({ data: { ...assetDataFromBody(row), code, churchId: igreja.id } })
    criado.assetIds.push(bem.id)
    importados++
  }
  check('linha válida importada', importados === 1)
  check('linha sem nome rejeitada', errosImport.length === 1)

  // ── 4. inicia inventário — dirigente auto-preenchido ──────────────────────
  step(4, 'Iniciar inventário — dirigente vem do cadastro da igreja')

  const inventario = await prisma.assetInventory.create({
    data: { churchId: igreja.id, startedByUserId: usuario.id, leaderName: igreja.currentLeaderName },
  })
  criado.inventoryId = inventario.id
  check('inventário criado em andamento', inventario.status === 'in_progress')
  check('dirigente auto-preenchido', inventario.leaderName === '[E2E] Dirigente Teste')

  // ── 5. leitura do QR — bate com o local cadastrado ────────────────────────
  step(5, 'Escanear bem 1 — local bate com o cadastro')

  const leitura1 = await escanear(inventario.id, igreja.id, bem1.qrToken)
  check('bem 1 encontrado pelo QR', leitura1.asset?.id === bem1.id)
  check('local bate (sem divergência)', leitura1.item?.locationMatch === true)
  check('rótulo do local cadastrado', leitura1.registeredLocationLabel === 'Sala (genérica) — Sala 3', leitura1.registeredLocationLabel)

  // ── 6. leitura com divergência de local ───────────────────────────────────
  step(6, 'Escanear bem 2 — encontrado em local diferente do cadastrado')

  const leitura2 = await escanear(inventario.id, igreja.id, bem2.qrToken, { locationFound: 'Cozinha', observation: '[E2E] estava na cozinha, não na nave' })
  check('bem 2 encontrado pelo QR', leitura2.asset?.id === bem2.id)
  check('divergência registrada', leitura2.item?.locationMatch === false)
  check('local informado salvo', leitura2.item?.locationFound === 'Cozinha')

  // Reler o mesmo QR não deve duplicar (upsert idempotente)
  await escanear(inventario.id, igreja.id, bem1.qrToken)
  const totalItensBem1 = await prisma.assetInventoryItem.count({ where: { inventoryId: inventario.id, assetId: bem1.id } })
  check('reler o mesmo bem não duplica', totalItensBem1 === 1)

  // ── 7. QR de outra igreja não deve ser aceito ─────────────────────────────
  step(7, 'Segurança — QR de um bem de outra igreja não é aceito neste inventário')

  const outraIgreja = await prisma.church.create({ data: { name: '[E2E] Outra Igreja', code: `E2EOI${stamp}`, regionalId: regional.id } })
  const bemDeFora = await prisma.asset.create({ data: { ...assetDataFromBody({ name: '[E2E] Bem de outra igreja' }), code: await nextAssetCode(), churchId: outraIgreja.id } })
  const leituraFora = await escanear(inventario.id, igreja.id, bemDeFora.qrToken)
  check('bem de outra igreja rejeitado', leituraFora.erro === 'nao_encontrado')
  await exec(`DELETE FROM assets WHERE id = '${bemDeFora.id}'::uuid`).catch(() => {})
  await exec(`DELETE FROM churches WHERE id = '${outraIgreja.id}'::uuid`).catch(() => {})

  // ── 8. totais do relatório — encontrados / faltando ───────────────────────
  step(8, 'Totais do relatório — bem 3, o de manutenção e o do CSV nunca foram lidos')

  const todosAtivos = await prisma.asset.findMany({ where: { churchId: igreja.id, deletedAt: null, status: 'active' }, select: { id: true } })
  const itensLidos = await prisma.assetInventoryItem.findMany({ where: { inventoryId: inventario.id }, select: { assetId: true, locationMatch: true } })
  const encontradosIds = new Set(itensLidos.map((i) => i.assetId))
  const faltando = todosAtivos.filter((a) => !encontradosIds.has(a.id))
  const divergentes = itensLidos.filter((i) => !i.locationMatch)

  check('esperados = 4 bens cadastrados na igreja (3 manuais + 1 do CSV)', todosAtivos.length === 4, String(todosAtivos.length))
  check('encontrados = 2 (bem 1 e bem 2)', itensLidos.length === 2, String(itensLidos.length))
  check('faltando = 2 (bem 3 + CSV)', faltando.length === 2, String(faltando.length))
  check('divergências = 1 (bem 2)', divergentes.length === 1, String(divergentes.length))

  // ── 9. finaliza inventário ─────────────────────────────────────────────────
  step(9, 'Finalizar inventário com observação')

  const finalizado = await prisma.assetInventory.update({
    where: { id: inventario.id },
    data: { status: 'completed', finishedAt: new Date(), observation: '[E2E] inventário concluído no teste automatizado' },
  })
  check('status finalizado', finalizado.status === 'completed')
  check('finishedAt preenchido', !!finalizado.finishedAt)

  // ── resumo ──────────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(72)}`)
  console.log(`RESULTADO: ${passed} passaram, ${failed} falharam`)
  if (failed) console.log('Falhas:', falhas.join(', '))
  console.log('═'.repeat(72))
}

main()
  .catch((e) => { console.error('\n💥 erro inesperado:', e); failed++ })
  .finally(async () => {
    if (!KEEP) await limpar()
    else console.log('\n(--keep) dados preservados para inspeção.')
    await prisma.$disconnect()
    process.exit(failed > 0 ? 1 : 0)
  })
