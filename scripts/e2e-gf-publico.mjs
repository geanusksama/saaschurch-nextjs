/**
 * E2E — Grupos Familiares na home pública (lista, líder, mapa e distância).
 *
 * Cria dois GFs [E2E] ATIVOS sob a sede pública do site (DEFAULT_SEDE_ID de
 * gfPublicListService.ts) e um GF [E2E] INATIVO, para provar que:
 *  - listPublicGfs() (a mesma função usada por /api/public/gf-list) traz os
 *    GFs ativos da sede com líder/telefone/foto/endereço/coordenadas;
 *  - GF inativo ou de outra igreja NÃO aparece na lista pública;
 *  - o cálculo de distância (Haversine, mesmo lib/geo.ts do formulário de
 *    membro) e a ordenação "mais perto primeiro" batem com o esperado;
 *  - o link/embed do mapa sai sem chave de API, igual ao resto do site.
 *
 * Roda contra o banco de verdade, mas os GFs e o membro-líder são criados com
 * prefixo [E2E] sob a igreja sede real (não muta nenhum registro existente) e
 * apagados no fim (--keep preserva para inspeção).
 *
 * Uso: npx tsx scripts/e2e-gf-publico.mjs
 */

import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })

import { PrismaClient } from '@prisma/client'
import { listPublicGfs, getPublicSede, DEFAULT_SEDE_ID } from '../src/lib/gfPublicListService.ts'
import { syncCellGroupLeaders } from '../src/lib/cellGroupService.ts'
import { haversineKm, buildMapEmbedUrl, buildMapsLink } from '../src/lib/geo.ts'

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

const criado = { leaderId: null, leaderId2: null, cellIds: [], outraIgrejaId: null, outroCellId: null, regionalId: null, campoId: null }

async function limpar() {
  console.log('\n🧹 limpando os dados do teste...')
  for (const id of criado.cellIds) {
    await exec(`DELETE FROM cell_groups WHERE id = '${id}'::uuid`).catch(() => {})
  }
  if (criado.outroCellId) {
    await exec(`DELETE FROM cell_groups WHERE id = '${criado.outroCellId}'::uuid`).catch(() => {})
  }
  for (const id of [criado.leaderId, criado.leaderId2]) {
    if (id) await exec(`DELETE FROM members WHERE id = '${id}'::uuid`).catch(() => {})
  }
  if (criado.outraIgrejaId) {
    await exec(`DELETE FROM churches WHERE id = '${criado.outraIgrejaId}'::uuid`).catch(() => {})
  }
  if (criado.regionalId) await exec(`DELETE FROM regionais WHERE id = '${criado.regionalId}'::uuid`).catch(() => {})
  if (criado.campoId) await exec(`DELETE FROM campos WHERE id = '${criado.campoId}'::uuid`).catch(() => {})
  console.log('   pronto — banco no estado anterior.')
}

/** Mesma ordenação usada em GfPublicList.tsx (sortedGroups), reproduzida aqui
 * porque é lógica de componente React — o que se testa é a REGRA. */
function ordenarPorDistancia(groups, origin) {
  const withDistance = groups.map((g) => ({
    ...g,
    distanceKm: haversineKm({ latitude: origin.lat, longitude: origin.lon }, { latitude: g.latitude, longitude: g.longitude }),
  }))
  return [...withDistance].sort((a, b) => {
    if (a.distanceKm === null && b.distanceKm === null) return 0
    if (a.distanceKm === null) return 1
    if (b.distanceKm === null) return -1
    return a.distanceKm - b.distanceKm
  })
}

async function main() {
  console.log('\n🏠 E2E — Grupos Familiares na home pública\n')

  step(1, 'Confirmar que a sede pública existe (senão o teste não faz sentido)')
  const sede = await prisma.church.findUnique({ where: { id: DEFAULT_SEDE_ID }, select: { id: true, name: true } })
  check('DEFAULT_SEDE_ID aponta para uma igreja real', !!sede, sede?.name ?? 'não encontrada')
  if (!sede) throw new Error('Sede pública (DEFAULT_SEDE_ID) não existe no banco — abortando.')

  step(2, 'Criar dois GFs ATIVOS na sede, um GF INATIVO e um GF de OUTRA igreja')

  const stamp = Date.now() % 100000
  const lider = await prisma.member.create({
    data: { churchId: sede.id, fullName: '[E2E] Líder GF Público', mobile: '19999990301', membershipStatus: 'ATIVO' },
  })
  criado.leaderId = lider.id

  // GF perto (Centro de Campinas) e GF longe (litoral) — para provar a ordenação
  const gfPerto = await prisma.cellGroup.create({
    data: {
      churchId: sede.id, name: '[E2E] GF Centro', cellType: 'Adultos', status: 'active',
      leaderId: lider.id, color: '#22c55e', photo: 'https://example.com/capa-centro.jpg',
      meetingDay: 'Quinta', meetingTime: new Date('1970-01-01T19:50:00Z'),
      addressStreet: 'Rua Barão de Jaguara', addressNumber: '100', addressNeighborhood: 'Centro',
      addressCity: 'Campinas', addressState: 'SP', addressZipcode: '13010-111',
      latitude: '-22.90556000', longitude: '-47.06083000',
    },
  })
  criado.cellIds.push(gfPerto.id)

  const gfLonge = await prisma.cellGroup.create({
    data: {
      churchId: sede.id, name: '[E2E] GF Litoral', cellType: 'Jovens', status: 'active',
      leaderId: lider.id, color: '#38bdf8', photo: null,
      meetingDay: 'Sexta', meetingTime: new Date('1970-01-01T20:00:00Z'),
      addressStreet: 'Av. Beira Mar', addressNumber: '500', addressNeighborhood: 'Praia',
      addressCity: 'Santos', addressState: 'SP', addressZipcode: '11030-000',
      latitude: '-23.96083000', longitude: '-46.33361000',
    },
  })
  criado.cellIds.push(gfLonge.id)

  const gfInativo = await prisma.cellGroup.create({
    data: {
      churchId: sede.id, name: '[E2E] GF Encerrado', status: 'inactive', leaderId: lider.id,
      addressCity: 'Campinas', latitude: '-22.90000000', longitude: '-47.06000000',
    },
  })
  criado.cellIds.push(gfInativo.id)

  const campo = await prisma.campo.create({ data: { name: '[E2E] Campo GF Pub', code: `E2EGPC${stamp}` } })
  criado.campoId = campo.id
  const regional = await prisma.regional.create({
    data: { name: '[E2E] Regional GF Pub', code: `E2EGPR${stamp}`, campoId: campo.id },
  })
  criado.regionalId = regional.id
  const outraIgreja = await prisma.church.create({
    data: { name: '[E2E] Outra Igreja', code: `E2EGPI${stamp}`, regionalId: regional.id },
  })
  criado.outraIgrejaId = outraIgreja.id
  const gfOutraIgreja = await prisma.cellGroup.create({
    data: { churchId: outraIgreja.id, name: '[E2E] GF de Outra Igreja', status: 'active' },
  })
  criado.outroCellId = gfOutraIgreja.id

  check('cenário montado', !!gfPerto.id && !!gfLonge.id && !!gfInativo.id && !!gfOutraIgreja.id)

  // ── 3. a função pública real ────────────────────────────────────────────
  step(3, 'listPublicGfs() — a mesma função usada por /api/public/gf-list')

  const lista = await listPublicGfs()
  const porNome = Object.fromEntries(lista.map((g) => [g.name, g]))

  check('GF ativo da sede aparece na lista', !!porNome['[E2E] GF Centro'])
  check('segundo GF ativo da sede aparece', !!porNome['[E2E] GF Litoral'])
  check('GF INATIVO não aparece na lista pública', !porNome['[E2E] GF Encerrado'])
  check('GF de OUTRA igreja não aparece (lista é só da sede)', !porNome['[E2E] GF de Outra Igreja'])

  const centro = porNome['[E2E] GF Centro']
  check('líder do GF veio com nome', centro?.leaderName === lider.fullName, centro?.leaderName)
  check('telefone do líder veio (mobile de preferência)', centro?.leaderPhone === '19999990301', centro?.leaderPhone)
  check('foto de capa veio', centro?.photo === 'https://example.com/capa-centro.jpg')
  check('cor do GF veio', centro?.color === '#22c55e')
  check('horário veio só HH:mm (não o DateTime cru)', centro?.meetingTime === '19:50', centro?.meetingTime)
  check('dia da reunião veio', centro?.meetingDay === 'Quinta')
  check('endereço estruturado veio completo', centro?.addressCity === 'Campinas' && centro?.addressZipcode === '13010-111')
  check('coordenadas vieram como número', typeof centro?.latitude === 'number' && typeof centro?.longitude === 'number')

  const litoral = porNome['[E2E] GF Litoral']
  check('GF sem foto veio com photo null (frontend usa fallback de cor)', litoral?.photo === null)

  // ── 4. distância e ordenação ("mais perto de você") ────────────────────
  step(4, 'Calcular distância a partir de um endereço e ordenar "mais perto primeiro"')

  // origem: perto do Centro de Campinas — mesma lat/lon usada no e2e-gf.mjs
  const origem = { lat: -22.9056, lon: -47.0608, label: '[E2E] origem em Campinas' }
  const gfsDaSede = lista.filter((g) => g.name.startsWith('[E2E] GF Centro') || g.name.startsWith('[E2E] GF Litoral'))
  const ordenado = ordenarPorDistancia(gfsDaSede, origem)

  check('GF Centro calculou distância pequena (poucos km)', ordenado[0]?.name === '[E2E] GF Centro', `1º: ${ordenado[0]?.name} (${ordenado[0]?.distanceKm} km)`)
  check('GF Litoral (Santos) ficou mais longe e por último', ordenado[1]?.name === '[E2E] GF Litoral', `2º: ${ordenado[1]?.name} (${ordenado[1]?.distanceKm} km)`)
  check('distância do GF Litoral é grande (~130-150 km em linha reta)', ordenado[1]?.distanceKm > 130 && ordenado[1]?.distanceKm < 150, `${ordenado[1]?.distanceKm} km`)
  check('distância do GF Centro é pequena (menos de 1 km da origem)', ordenado[0]?.distanceKm < 1, `${ordenado[0]?.distanceKm} km`)

  const semCoordenadas = ordenarPorDistancia([...gfsDaSede, { name: '[E2E] Sem coordenadas', latitude: null, longitude: null }], origem)
  check('GF sem coordenadas cai para o fim da lista, não quebra a ordenação', semCoordenadas[semCoordenadas.length - 1]?.name === '[E2E] Sem coordenadas')

  // ── 5. mapa sem chave de API ─────────────────────────────────────────────
  // ── GF com casal de líderes ───────────────────────────────────────────
  step(5, 'GF com DOIS líderes (casal): ordem, principal e troca de principal')

  const esposa = await prisma.member.create({
    data: { churchId: sede.id, fullName: '[E2E] Esposa Líder', mobile: '19999990302', membershipStatus: 'ATIVO' },
  })
  criado.leaderId2 = esposa.id

  // mesma regra da rota: a lista manda, e o primeiro vira o leader_id
  await syncCellGroupLeaders(gfPerto.id, [lider.id, esposa.id])

  const comCasal = (await listPublicGfs()).find((g) => g.name === '[E2E] GF Centro')
  check('os dois líderes aparecem na lista pública', comCasal?.leaders.length === 2, String(comCasal?.leaders.length))
  check('a ordem é a que foi enviada', comCasal?.leaders[0]?.name === lider.fullName, comCasal?.leaders[0]?.name)
  check('o principal é o primeiro da lista', comCasal?.leaderName === lider.fullName, comCasal?.leaderName)
  check('o telefone do aviso é o do principal', comCasal?.leaderPhone === '19999990301', comCasal?.leaderPhone)

  const noBanco = await prisma.cellGroup.findUnique({ where: { id: gfPerto.id }, select: { leaderId: true } })
  check('cell_groups.leader_id acompanha o principal', noBanco?.leaderId === lider.id)

  // inverter a ordem tem que trocar quem recebe a mensagem
  await syncCellGroupLeaders(gfPerto.id, [esposa.id, lider.id])
  const invertido = (await listPublicGfs()).find((g) => g.name === '[E2E] GF Centro')
  check('trocar a ordem troca o principal', invertido?.leaderName === esposa.fullName, invertido?.leaderName)
  check('e troca o telefone do aviso junto', invertido?.leaderPhone === '19999990302', invertido?.leaderPhone)
  check('continua com os dois líderes (não duplicou)', invertido?.leaders.length === 2, String(invertido?.leaders.length))

  // remover um líder não pode deixar o GF órfão
  await syncCellGroupLeaders(gfPerto.id, [esposa.id])
  const soUm = (await listPublicGfs()).find((g) => g.name === '[E2E] GF Centro')
  check('remover um líder deixa só o outro', soUm?.leaders.length === 1, String(soUm?.leaders.length))
  const aposRemocao = await prisma.cellGroup.findUnique({ where: { id: gfPerto.id }, select: { leaderId: true } })
  check('leader_id passa a ser quem sobrou', aposRemocao?.leaderId === esposa.id)

  // volta ao estado que o resto do teste espera
  await syncCellGroupLeaders(gfPerto.id, [lider.id])

  step(6, 'A SEDE que fica no centro da estrela')

  const sedePublica = await getPublicSede()
  check('getPublicSede() devolve a igreja sede', sedePublica?.id === DEFAULT_SEDE_ID, sedePublica?.name)
  check('sede tem nome para mostrar no card central', !!sedePublica?.name)
  // O cadastro da sede está sem endereço hoje; o front cobre isso com um
  // fallback. O teste registra o estado real para a falta não passar batida.
  console.log(`     · endereço da sede no banco: ${sedePublica?.addressStreet ?? '(vazio — front usa fallback)'}`)
  check('coordenadas da sede vêm como número ou null (nunca Decimal)',
    sedePublica?.latitude === null || typeof sedePublica?.latitude === 'number',
    String(sedePublica?.latitude))

  step(7, 'Endereço clicável abre o mapa embutido, sem chave de API')

  check('mapa embed usa coordenadas e output=embed', buildMapEmbedUrl(centro).includes('output=embed') && buildMapEmbedUrl(centro).includes('-22.90556'))
  check('link "abrir no Google Maps" também sai sem chave', buildMapsLink(centro).startsWith('https://www.google.com/maps?q='))
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
