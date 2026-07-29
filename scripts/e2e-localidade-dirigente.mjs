/**
 * Simulação ponta a ponta da localidade do membro e da distância na troca de
 * dirigente.
 *
 * Percorre o caminho real: membro ganha coordenadas no cadastro → a troca de
 * dirigente calcula a distância até a igreja → o valor é CONGELADO na
 * movimentação → mudar o endereço do membro depois não mexe no que já foi
 * gravado → e o relatório lê esse valor congelado.
 *
 * Importa src/lib/geo.ts de verdade — o cálculo testado é o mesmo que roda na
 * tela, não uma cópia.
 *
 * Roda contra o banco de verdade, mas cria a própria igreja e os próprios
 * membros com prefixo [E2E] — nenhum registro real é tocado. Tudo é apagado no
 * fim (--keep preserva).
 *
 * Uso: npx tsx scripts/e2e-localidade-dirigente.mjs
 */

import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })

import { PrismaClient } from '@prisma/client'
import {
  buildAddressLabel,
  buildRouteEmbedUrl,
  formatKm,
  hasCoords,
  haversineKm,
  normalizeZipcode,
  formatZipcode,
} from '../src/lib/geo.ts'

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

const criado = { churchId: null, memberIds: [], historyIds: [] }

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

// Coordenadas reais, para a distância bater com algo verificável.
const CATEDRAL_CAMPINAS = { latitude: -22.9056, longitude: -47.0608 }
const VALINHOS = { latitude: -22.9709, longitude: -46.9958 }
const SAO_PAULO_SE = { latitude: -23.5505, longitude: -46.6333 }

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗')
  console.log('║  E2E — Localidade do membro e distância na troca de dirigente   ║')
  console.log('╚═══════════════════════════════════════════════════════════════╝')

  // ── 1. o cálculo puro ──
  step(1, 'O cálculo de distância está correto?')
  const campinasValinhos = haversineKm(CATEDRAL_CAMPINAS, VALINHOS)
  check('Campinas → Valinhos fica na casa dos 10 km', campinasValinhos > 8 && campinasValinhos < 14, `${campinasValinhos} km`)

  const campinasSp = haversineKm(CATEDRAL_CAMPINAS, SAO_PAULO_SE)
  check('Campinas → São Paulo fica na casa dos 90 km', campinasSp > 80 && campinasSp < 100, `${campinasSp} km`)

  check('mesma coordenada dá zero', haversineKm(CATEDRAL_CAMPINAS, CATEDRAL_CAMPINAS) === 0)
  check('distância é simétrica', haversineKm(VALINHOS, CATEDRAL_CAMPINAS) === campinasValinhos)
  check('sem coordenada devolve null', haversineKm({ latitude: null, longitude: null }, CATEDRAL_CAMPINAS) === null)
  check('coordenada inválida devolve null', haversineKm({ latitude: 'abc', longitude: 'def' }, CATEDRAL_CAMPINAS) === null)
  check('formata em pt-BR', formatKm(12.5) === '12,50 km', formatKm(12.5))
  check('formata vazio como travessão', formatKm(null) === '—')
  check('CEP normaliza e formata', normalizeZipcode('13.101-400') === '13101400' && formatZipcode('13101400') === '13101-400')

  // ── 2. ambiente ──
  step(2, 'Ambiente')
  const [regional] = await sql(`SELECT id, name FROM regionais WHERE deleted_at IS NULL ORDER BY name LIMIT 1`)
  check('regional encontrada', !!regional, regional?.name)
  if (!regional) throw new Error('sem regional')

  // Este catálogo não tem deletedAt nem isLeaderRole — o papel de dirigente é
  // identificado pelo nome, como a própria tela faz.
  const funcao = await prisma.churchFunctionCatalog.findFirst({
    where: { isActive: true, name: { contains: 'DIRIGENTE', mode: 'insensitive' } },
  }) || await prisma.churchFunctionCatalog.findFirst({ where: { isActive: true } })
  check('função de dirigente encontrada', !!funcao, funcao?.name)
  if (!funcao) throw new Error('sem função de dirigente')

  const stamp = Date.now().toString().slice(-6)
  const igreja = await prisma.church.create({
    data: {
      regionalId: regional.id,
      name: '[E2E] Igreja Central',
      code: `E2E-LOC${stamp}`,
      addressStreet: 'Rua Barão de Parnaíba',
      addressNumber: '149',
      addressCity: 'Campinas',
      addressState: 'SP',
      addressZipcode: '13101-400',
      latitude: CATEDRAL_CAMPINAS.latitude,
      longitude: CATEDRAL_CAMPINAS.longitude,
    },
    select: { id: true, latitude: true, longitude: true, addressStreet: true, addressNumber: true, addressCity: true, addressState: true, addressZipcode: true },
  })
  criado.churchId = igreja.id
  check('igreja criada com localidade', hasCoords(igreja), `${igreja.latitude}, ${igreja.longitude}`)

  // ── 3. localidade no cadastro do membro ──
  step(3, 'O membro guarda a própria localidade?')
  const perto = await prisma.member.create({
    data: {
      churchId: igreja.id, fullName: '[E2E] Dirigente de Valinhos',
      addressStreet: 'Rua das Flores', addressNumber: '10', addressCity: 'Valinhos', addressState: 'SP',
      latitude: VALINHOS.latitude, longitude: VALINHOS.longitude,
    },
    select: { id: true, fullName: true, latitude: true, longitude: true, addressStreet: true, addressNumber: true, addressCity: true, addressState: true, addressZipcode: true },
  })
  criado.memberIds.push(perto.id)
  check('coordenadas gravadas no membro', hasCoords(perto), `${perto.latitude}, ${perto.longitude}`)
  check('precisão preservada no banco', Number(perto.latitude).toFixed(4) === VALINHOS.latitude.toFixed(4),
    `${perto.latitude} ≈ ${VALINHOS.latitude}`)

  const semLocal = await prisma.member.create({
    data: { churchId: igreja.id, fullName: '[E2E] Dirigente Sem Localidade', addressCity: 'Campinas', addressState: 'SP' },
    select: { id: true, fullName: true, latitude: true, longitude: true, addressCity: true, addressState: true },
  })
  criado.memberIds.push(semLocal.id)
  check('membro sem localidade fica nulo, não zero', semLocal.latitude === null && semLocal.longitude === null)

  // ── 4. o que a tela mostra ──
  step(4, 'A tela consegue montar o trajeto?')
  const distancia = haversineKm(perto, igreja)
  check('distância membro → igreja calculada', distancia > 8 && distancia < 14, formatKm(distancia))
  check('endereço do membro vira rótulo legível', buildAddressLabel(perto).includes('Valinhos'), buildAddressLabel(perto))
  const rota = buildRouteEmbedUrl(perto, igreja)
  check('minimapa do trajeto montado', rota.startsWith('https://www.google.com/maps?saddr=') && rota.includes('daddr='))
  check('trajeto usa coordenadas, não texto', rota.includes(encodeURIComponent(`${perto.latitude},${perto.longitude}`)))
  check('sem coordenada o trajeto cai no endereço em texto',
    buildRouteEmbedUrl(semLocal, igreja).includes(encodeURIComponent('Campinas')))
  check('sem nenhum dado não monta trajeto', buildRouteEmbedUrl(null, igreja) === '')

  // ── 5. a distância grava na troca ──
  step(5, 'A troca de dirigente congela a distância?')
  const movimentacao = await prisma.churchLeaderHistory.create({
    data: {
      churchId: igreja.id,
      newLeaderMemberId: perto.id,
      functionId: funcao.id,
      indicatedBy: '[E2E] Pr. Indicante',
      changeReason: '[E2E] posse com distância',
      entryDate: new Date('2026-07-30'),
      distanceKm: distancia,
      totalMembers: 120,
    },
    select: { id: true, distanceKm: true },
  })
  criado.historyIds.push(movimentacao.id)
  check('distância gravada na movimentação', Number(movimentacao.distanceKm) === distancia, `${movimentacao.distanceKm}`)

  // ── 6. congelada mesmo ──
  step(6, 'Mudar o endereço do membro NÃO mexe no que já foi gravado?')
  await prisma.member.update({
    where: { id: perto.id },
    data: { addressCity: 'São Paulo', latitude: SAO_PAULO_SE.latitude, longitude: SAO_PAULO_SE.longitude },
  })
  const depois = await prisma.churchLeaderHistory.findUnique({ where: { id: movimentacao.id }, select: { distanceKm: true } })
  check('distância da posse antiga continua a mesma', Number(depois.distanceKm) === distancia,
    `${depois.distanceKm} (membro agora está a ${formatKm(haversineKm(SAO_PAULO_SE, igreja))})`)

  const novaDistancia = haversineKm(await prisma.member.findUnique({ where: { id: perto.id } }), igreja)
  check('uma posse nova hoje calcularia outro valor', novaDistancia > 80, formatKm(novaDistancia))

  // ── 7. o relatório lê o valor congelado ──
  step(7, 'O relatório enxerga a distância?')
  const doRelatorio = await prisma.churchLeaderHistory.findMany({
    where: { churchId: igreja.id },
    include: { newLeaderMember: { select: { fullName: true } }, function: { select: { name: true } } },
  })
  check('registro aparece no relatório', doRelatorio.length === 1)
  check('relatório traz a distância congelada', Number(doRelatorio[0].distanceKm) === distancia, formatKm(doRelatorio[0].distanceKm))
  check('relatório sem distância não quebra a formatação', formatKm(null) === '—')

  // ── 8. troca sem localidade ──
  step(8, 'Dá para trocar o dirigente mesmo sem localidade?')
  const semDistancia = await prisma.churchLeaderHistory.create({
    data: {
      churchId: igreja.id,
      newLeaderMemberId: semLocal.id,
      functionId: funcao.id,
      indicatedBy: '[E2E] Pr. Indicante',
      changeReason: '[E2E] posse sem coordenadas',
      entryDate: new Date('2026-07-31'),
      distanceKm: haversineKm(semLocal, igreja), // null — membro sem coordenada
    },
    select: { id: true, distanceKm: true },
  })
  criado.historyIds.push(semDistancia.id)
  check('posse gravada sem distância', semDistancia.distanceKm === null)
  check('cadastro não é bloqueado por falta de localidade', !!semDistancia.id)

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
