/**
 * Simulação ponta a ponta da numeração de dízimo por bloco.
 *
 * Percorre o caminho real da tesouraria: cadastro do bloco → cartela gerada →
 * gasto de um número num dízimo → tentativa de repetir o mesmo número →
 * número que não existe no talão → sobreposição de faixa → a corrida de dois
 * tesoureiros no mesmo número → reserva abandonada que volta a ficar livre →
 * e, o ponto do módulo, o ISOLAMENTO: o número 50 de uma igreja não serve nem
 * aparece na outra.
 *
 * Importa `dizimoNumeracao.ts` de verdade e reproduz o `where` das rotas com
 * os mesmos comandos que elas usam (`updateMany` condicional), porque o E2E
 * não sobe o servidor Next. O que se quer provar aqui é o comportamento do
 * BANCO sob concorrência, e isso não dá para simular com mock.
 *
 * Roda contra o banco de verdade, mas cria o próprio campo, regional e igrejas
 * com prefixo [E2E]; nenhum registro real é tocado. Tudo é apagado no fim
 * (--keep preserva para inspeção).
 *
 * Uso: npx tsx scripts/e2e-dizimo-numeracao.mjs [--keep]
 */

import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })

import { PrismaClient } from '@prisma/client'
import {
  MAX_NUMEROS_POR_BLOCO,
  STATUS_LIVRE,
  STATUS_RESERVADO,
  STATUS_USADO,
  parseNumeroRecibo,
  planoExigeNumeracaoDizimo,
  validarFaixa,
} from '../src/lib/dizimoNumeracao.ts'
import { escopoDeIgrejas } from '../src/lib/contasPagarScope.ts'

const prisma = new PrismaClient()
const KEEP = process.argv.includes('--keep')
const exec = (q) => prisma.$executeRawUnsafe(q)

let passed = 0, failed = 0
const falhas = []
function check(label, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { failed++; falhas.push(label); console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}
const step = (n, t) => console.log(`\n${'─'.repeat(74)}\n${n}. ${t}\n${'─'.repeat(74)}`)

const hoje = new Date().toISOString().slice(0, 10)
const criado = { campoId: null, regionalId: null, churchId: null, churchVizinhaId: null }

async function limpar() {
  console.log('\n🧹 limpando os dados do teste...')
  const igrejas = [criado.churchId, criado.churchVizinhaId].filter(Boolean)
  for (const id of igrejas) {
    const c = `'${id}'::uuid`
    await exec(`DELETE FROM dizimo_numeros WHERE church_id = ${c}`).catch(() => {})
    await exec(`DELETE FROM dizimo_blocos WHERE church_id = ${c}`).catch(() => {})
    await exec(`DELETE FROM dizimo_numeracao_config WHERE church_id = ${c}`).catch(() => {})
    await exec(`DELETE FROM livro_caixa WHERE church_id = ${c}`).catch(() => {})
  }
  for (const id of igrejas) await exec(`DELETE FROM churches WHERE id = '${id}'::uuid`).catch(() => {})
  if (criado.regionalId) await exec(`DELETE FROM regionais WHERE id = '${criado.regionalId}'::uuid`).catch(() => {})
  if (criado.campoId) await exec(`DELETE FROM campos WHERE id = '${criado.campoId}'::uuid`).catch(() => {})
  console.log('   pronto — banco no estado anterior.')
}

/** O mesmo que a rota POST /api/dizimo-blocos faz. */
async function cadastrarBloco({ churchId, numeroBloco, numeroInicial, numeroFinal }) {
  const erro = validarFaixa({ numeroInicial, numeroFinal })
  if (erro) return { erro }

  const conflito = await prisma.dizimoBloco.findFirst({
    where: {
      churchId, deletedAt: null,
      numeroInicial: { lte: numeroFinal },
      numeroFinal: { gte: numeroInicial },
    },
    select: { numeroBloco: true },
  })
  if (conflito) return { erro: `faixa encosta no bloco ${conflito.numeroBloco}` }

  const bloco = await prisma.dizimoBloco.create({
    data: { churchId, numeroBloco, numeroInicial, numeroFinal },
  })
  await prisma.dizimoNumero.createMany({
    data: Array.from({ length: numeroFinal - numeroInicial + 1 }, (_, i) => ({
      blocoId: bloco.id, churchId, numero: numeroInicial + i, status: STATUS_LIVRE,
    })),
  })
  return { bloco }
}

/** O mesmo `updateMany` condicional da rota — é ele que segura a corrida. */
async function reservar(churchId, numero) {
  const linha = await prisma.dizimoNumero.findUnique({
    where: { churchId_numero: { churchId, numero } },
    select: { id: true, status: true },
  })
  if (!linha) return { ok: false, motivo: 'FORA_DO_BLOCO' }
  if (linha.status === STATUS_USADO) return { ok: false, motivo: 'JA_USADO' }

  const { count } = await prisma.dizimoNumero.updateMany({
    where: { id: linha.id, churchId, status: STATUS_LIVRE, livroCaixaId: null },
    data: { status: STATUS_RESERVADO, usadoEm: new Date() },
  })
  return count === 1 ? { ok: true, numeroId: linha.id } : { ok: false, motivo: 'CORRIDA' }
}

async function confirmar(churchId, numeroId, livroCaixaId) {
  const { count } = await prisma.dizimoNumero.updateMany({
    where: { id: numeroId, churchId, status: STATUS_RESERVADO },
    data: { status: STATUS_USADO, livroCaixaId, usadoEm: new Date() },
  })
  return count === 1
}

async function liberar(churchId, numeroId) {
  const { count } = await prisma.dizimoNumero.updateMany({
    where: { id: numeroId, churchId, status: STATUS_RESERVADO, livroCaixaId: null },
    data: { status: STATUS_LIVRE, usadoEm: null, usadoPor: null },
  })
  return count === 1
}

/** Um dízimo no livro caixa, para o número ter onde se prender. */
function lancarDizimo(churchId, valor, favorecido) {
  return prisma.livroCaixa.create({
    data: {
      churchId, dataLancamento: new Date(`${hoje}T00:00:00Z`), tipo: 'RECEITA',
      valor, planoDeConta: '01.200 - DIZIMOS', favorecido, tipoPessoa: 'MEMBRO',
      referencia: '[E2E]',
    },
    select: { id: true },
  })
}

async function main() {
  console.log('\n🧾 E2E — Numeração de dízimo por bloco\n')

  // ── 1. regras puras (sem banco) ───────────────────────────────────────────
  step(1, 'Regras puras')

  check('plano "01.200 - DIZIMOS" exige número', planoExigeNumeracaoDizimo({ nome: '01.200 - DIZIMOS' }))
  check('plano "01.211 - OFERTAS" NÃO exige', !planoExigeNumeracaoDizimo({ nome: '01.211 - OFERTAS' }))
  check('"DIZIMOS E OFERTAS" não exige — caixa misturada não amarra a um recibo',
    !planoExigeNumeracaoDizimo({ nome: 'DIZIMOS E OFERTAS' }))
  check('sem acento também casa', planoExigeNumeracaoDizimo({ nome: 'Dízimo do mês' }))
  check('a flag do cadastro vence o nome (liga)',
    planoExigeNumeracaoDizimo({ nome: '01.211 - OFERTAS', exigeNumeracaoBloco: true }))
  check('a flag do cadastro vence o nome (desliga)',
    !planoExigeNumeracaoDizimo({ nome: '01.200 - DIZIMOS', exigeNumeracaoBloco: false }))
  check('flag NULL cai na regra do nome',
    planoExigeNumeracaoDizimo({ nome: '01.200 - DIZIMOS', exigeNumeracaoBloco: null }))

  check('"0100" vira 100', parseNumeroRecibo('0100') === 100)
  check('" 7 " vira 7', parseNumeroRecibo(' 7 ') === 7)
  check('"12a" é recusado', parseNumeroRecibo('12a') === null)
  check('zero é recusado', parseNumeroRecibo('0') === null)
  check('negativo é recusado', parseNumeroRecibo('-5') === null)

  check('faixa invertida é recusada', validarFaixa({ numeroInicial: 100, numeroFinal: 1 }) !== null)
  check('faixa de 1 número é válida', validarFaixa({ numeroInicial: 5, numeroFinal: 5 }) === null)
  check('faixa acima do teto é recusada',
    validarFaixa({ numeroInicial: 1, numeroFinal: MAX_NUMEROS_POR_BLOCO + 1 }) !== null)

  // ── 2. cenário ────────────────────────────────────────────────────────────
  step(2, 'Montando campo, regional e duas igrejas')

  const campo = await prisma.campo.create({
    data: { name: '[E2E] Campo Numeração', code: `E2ENUM${Date.now() % 100000}` },
  })
  criado.campoId = campo.id
  const regional = await prisma.regional.create({
    data: { campoId: campo.id, name: '[E2E] Regional Numeração', code: `E2ERN${Date.now() % 100000}` },
  })
  criado.regionalId = regional.id
  const igreja = await prisma.church.create({
    data: { regionalId: regional.id, name: '[E2E] Igreja Sede', code: 'E2E-1' },
  })
  criado.churchId = igreja.id
  const vizinha = await prisma.church.create({
    data: { regionalId: regional.id, name: '[E2E] Igreja Vizinha', code: 'E2E-2' },
  })
  criado.churchVizinhaId = vizinha.id
  check('campo, regional e duas igrejas criados', Boolean(igreja.id && vizinha.id))

  // ── 3. cadastro do bloco ──────────────────────────────────────────────────
  step(3, 'Cadastro do bloco — a cartela nasce inteira')

  const r1 = await cadastrarBloco({ churchId: igreja.id, numeroBloco: 100, numeroInicial: 1, numeroFinal: 50 })
  check('bloco 100 (1–50) cadastrado', Boolean(r1.bloco))

  const gerados = await prisma.dizimoNumero.count({ where: { blocoId: r1.bloco.id } })
  check('50 números materializados', gerados === 50, `${gerados}`)
  const livres = await prisma.dizimoNumero.count({ where: { blocoId: r1.bloco.id, status: STATUS_LIVRE } })
  check('todos nascem LIVRE', livres === 50, `${livres}`)

  const r2 = await cadastrarBloco({ churchId: igreja.id, numeroBloco: 200, numeroInicial: 25, numeroFinal: 80 })
  check('faixa sobreposta é recusada', Boolean(r2.erro), r2.erro ?? '')

  const r3 = await cadastrarBloco({ churchId: igreja.id, numeroBloco: 200, numeroInicial: 51, numeroFinal: 100 })
  check('faixa seguinte (51–100) é aceita', Boolean(r3.bloco))

  // ── 4. gastar um número ───────────────────────────────────────────────────
  step(4, 'Lançando um dízimo com o recibo 7')

  const reserva7 = await reservar(igreja.id, 7)
  check('número 7 reservado', reserva7.ok)

  const lanc = await lancarDizimo(igreja.id, 150.5, '[E2E] Irmão João')
  check('dízimo gravado no livro caixa', Boolean(lanc.id))
  check('reserva confirmada com o lançamento', await confirmar(igreja.id, reserva7.numeroId, lanc.id))

  const n7 = await prisma.dizimoNumero.findUnique({
    where: { churchId_numero: { churchId: igreja.id, numero: 7 } },
    select: { status: true, livroCaixaId: true },
  })
  check('o 7 ficou USADO e aponta para o lançamento',
    n7.status === STATUS_USADO && n7.livroCaixaId === lanc.id)

  const livresDepois = await prisma.dizimoNumero.count({
    where: { blocoId: r1.bloco.id, status: STATUS_LIVRE },
  })
  check('sobraram 49 livres no bloco 100', livresDepois === 49, `${livresDepois}`)

  // ── 5. repetir o número ───────────────────────────────────────────────────
  step(5, 'O mesmo recibo não pode sair duas vezes')

  const repetir = await reservar(igreja.id, 7)
  check('reservar o 7 de novo é recusado', !repetir.ok && repetir.motivo === 'JA_USADO', repetir.motivo ?? '')

  // ── 6. número fora do talão ───────────────────────────────────────────────
  step(6, 'Número que a igreja nunca recebeu')

  const fora = await reservar(igreja.id, 999)
  check('o 999 não existe em bloco algum desta igreja',
    !fora.ok && fora.motivo === 'FORA_DO_BLOCO', fora.motivo ?? '')

  // ── 7. corrida entre dois tesoureiros ─────────────────────────────────────
  step(7, 'Dois tesoureiros mandando salvar o MESMO número no mesmo instante')

  const [a, b] = await Promise.all([reservar(igreja.id, 12), reservar(igreja.id, 12)])
  const ganhou = [a, b].filter((r) => r.ok).length
  check('exatamente um levou o número', ganhou === 1, `${ganhou} reserva(s) bem-sucedida(s)`)
  check('o outro recebeu recusa', [a, b].some((r) => !r.ok))

  const vencedor = a.ok ? a : b
  const lanc12 = await lancarDizimo(igreja.id, 80, '[E2E] Irmã Maria')
  await confirmar(igreja.id, vencedor.numeroId, lanc12.id)
  const usados12 = await prisma.dizimoNumero.count({
    where: { churchId: igreja.id, numero: 12, status: STATUS_USADO },
  })
  check('o 12 aparece uma única vez como usado', usados12 === 1, `${usados12}`)

  // ── 8. gravação que falhou ────────────────────────────────────────────────
  step(8, 'A gravação do livro caixa falha — o número volta para a cartela')

  const reserva20 = await reservar(igreja.id, 20)
  check('número 20 reservado', reserva20.ok)
  check('liberar devolve para LIVRE', await liberar(igreja.id, reserva20.numeroId))
  const n20 = await prisma.dizimoNumero.findUnique({
    where: { churchId_numero: { churchId: igreja.id, numero: 20 } },
    select: { status: true, usadoEm: true },
  })
  check('o 20 está livre de novo', n20.status === STATUS_LIVRE && n20.usadoEm === null)

  // Cinto de segurança: número já confirmado não volta a ser livre por engano.
  const soltarConfirmado = await liberar(igreja.id, reserva7.numeroId)
  check('liberar um número já USADO não faz efeito', !soltarConfirmado)

  // ── 9. isolamento entre igrejas ───────────────────────────────────────────
  step(9, 'Isolamento — o talão de uma igreja não serve na outra')

  const rv = await cadastrarBloco({ churchId: vizinha.id, numeroBloco: 300, numeroInicial: 1, numeroFinal: 50 })
  check('a vizinha tem o próprio bloco 1–50', Boolean(rv.bloco))

  // Mesma faixa NUMÉRICA nas duas igrejas: é o caso normal, não um conflito.
  const dosDoisLados = await prisma.dizimoNumero.count({
    where: { numero: 7, churchId: { in: [igreja.id, vizinha.id] } },
  })
  check('o número 7 existe nas duas igrejas, separado', dosDoisLados === 2, `${dosDoisLados}`)

  const seteDaVizinha = await prisma.dizimoNumero.findUnique({
    where: { churchId_numero: { churchId: vizinha.id, numero: 7 } },
    select: { status: true },
  })
  check('o 7 da vizinha continua LIVRE mesmo com o 7 da sede gasto',
    seteDaVizinha.status === STATUS_LIVRE)

  const reservaVizinha = await reservar(vizinha.id, 7)
  check('a vizinha consegue usar o próprio 7', reservaVizinha.ok)

  // A consulta da lupa, com o mesmo where da rota: só números da igreja.
  const lupaSede = await prisma.dizimoNumero.findMany({
    where: { churchId: igreja.id, status: STATUS_LIVRE, bloco: { ativo: true, deletedAt: null } },
    select: { churchId: true },
    take: 500,
  })
  check('a lupa da sede não traz um único número da vizinha',
    lupaSede.every((n) => n.churchId === igreja.id), `${lupaSede.length} números`)

  const lupaVizinha = await prisma.dizimoNumero.count({
    where: { churchId: vizinha.id, status: STATUS_LIVRE },
  })
  check('a vizinha enxerga só os dela', lupaVizinha === 49, `${lupaVizinha}`)

  // O escopo do perfil restrito é o mesmo do Contas a Pagar.
  const escopo = escopoDeIgrejas(
    { profileType: 'church', campoId: campo.id, churchId: igreja.id, roleName: 'Tesouraria' },
    { churchId: vizinha.id }
  )
  check('filtro forçado pela igreja vizinha é sobrescrito pelo perfil',
    escopo.ok && escopo.churchWhere.id === igreja.id)

  // ── 10. o switch da exigência ─────────────────────────────────────────────
  step(10, 'O switch por igreja')

  const cfgInicial = await prisma.dizimoNumeracaoConfig.findUnique({ where: { churchId: igreja.id } })
  check('nasce sem config — ou seja, sem exigir', cfgInicial === null)

  await prisma.dizimoNumeracaoConfig.upsert({
    where: { churchId: igreja.id }, create: { churchId: igreja.id, exige: true }, update: { exige: true },
  })
  const cfgLigada = await prisma.dizimoNumeracaoConfig.findUnique({ where: { churchId: igreja.id } })
  check('ligada para a sede', cfgLigada.exige === true)

  const cfgVizinha = await prisma.dizimoNumeracaoConfig.findUnique({ where: { churchId: vizinha.id } })
  check('a vizinha continua livre — o switch é por igreja', cfgVizinha === null)

  // ── 11. exclusão do bloco ─────────────────────────────────────────────────
  step(11, 'Bloco preso a lançamento não pode sumir')

  // O MESMO `where` da rota DELETE. Ela olha o vínculo com o dinheiro
  // (`livro_caixa_id`), não o status da linha: número marcado como USADO mas
  // com o lançamento já apagado não segura o bloco, senão ele ficaria
  // impossível de limpar.
  const presosNoBloco100 = await prisma.dizimoNumero.count({
    where: { blocoId: r1.bloco.id, livroCaixaId: { not: null } },
  })
  check('o bloco 100 tem número preso a dízimo, então a rota recusaria o DELETE',
    presosNoBloco100 > 0, `${presosNoBloco100} preso(s)`)

  const blocoLimpo = await cadastrarBloco({
    churchId: vizinha.id, numeroBloco: 400, numeroInicial: 100, numeroFinal: 110,
  })
  await prisma.dizimoBloco.delete({ where: { id: blocoLimpo.bloco.id } })
  const orfaos = await prisma.dizimoNumero.count({ where: { blocoId: blocoLimpo.bloco.id } })
  check('apagar bloco intocado leva a cartela junto (cascade)', orfaos === 0, `${orfaos} órfão(s)`)

  // ── 11b. exclusão de um número ────────────────────────────────────────────
  step('11b', 'Excluir um número solto — a folha rasgada do talão')

  const livre30 = await prisma.dizimoNumero.findUnique({
    where: { churchId_numero: { churchId: igreja.id, numero: 30 } },
    select: { id: true, livroCaixaId: true },
  })
  check('o 30 está livre e sem vínculo', livre30 !== null && livre30.livroCaixaId === null)
  await prisma.dizimoNumero.delete({ where: { id: livre30.id } })
  const sumiu30 = await prisma.dizimoNumero.findUnique({
    where: { churchId_numero: { churchId: igreja.id, numero: 30 } },
  })
  check('o 30 saiu da cartela', sumiu30 === null)

  const bloco100Restante = await prisma.dizimoNumero.count({ where: { blocoId: r1.bloco.id } })
  check('o bloco continua de pé com um número a menos', bloco100Restante === 49, `${bloco100Restante} números`)

  // ── 12. lançamento excluído ───────────────────────────────────────────────
  step(12, 'Lançamento apagado devolve o número, não some com ele')

  await prisma.livroCaixa.delete({ where: { id: lanc12.id } })
  const n12 = await prisma.dizimoNumero.findUnique({
    where: { churchId_numero: { churchId: igreja.id, numero: 12 } },
    select: { status: true, livroCaixaId: true },
  })
  check('o número 12 sobreviveu ao DELETE do lançamento', Boolean(n12))
  check('e ficou sem vínculo (SET NULL), não apagado', n12.livroCaixaId === null)

  // ── resultado ─────────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(74)}`)
  console.log(`RESULTADO: ${passed} passaram, ${failed} falharam`)
  if (failed) console.log(`\nFalhas:\n${falhas.map((f) => `  • ${f}`).join('\n')}`)
  console.log('═'.repeat(74))
}

main()
  .catch((e) => { console.error('\n💥 erro no E2E:', e); failed++ })
  .finally(async () => {
    if (!KEEP) await limpar()
    else console.log('\n📌 --keep: dados preservados para inspeção.')
    await prisma.$disconnect()
    process.exit(failed ? 1 : 0)
  })
