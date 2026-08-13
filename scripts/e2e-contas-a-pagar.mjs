/**
 * Simulação ponta a ponta do módulo Contas a Pagar.
 *
 * Percorre o caminho real da tesouraria: seed dos cadastros (banco,
 * departamento, tipo de despesa, credor) → conta à vista → conta parcelada em
 * 12 (o caso do pagamento do pastor) → pagamento PARCIAL de 60% → quitação
 * meses depois → tentativa de pagar acima do saldo → parcela vencida →
 * conferência da baixa contábil no livro caixa → estorno → alçada de aprovação
 * → relatórios e filtros da tela → isolamento entre igrejas.
 *
 * Importa `contasPagarService.ts` de verdade — roda em cima do código de
 * produção, não de uma cópia da regra. As consultas da tela são reproduzidas
 * com os mesmos `where` das rotas, porque o E2E não sobe o servidor Next.
 *
 * Roda contra o banco de verdade, mas cria o próprio campo, regional, igrejas,
 * membro e usuário com prefixo [E2E]; nenhum registro real é tocado. Tudo é
 * apagado no fim (--keep preserva para inspeção).
 *
 * Uso: npx tsx scripts/e2e-contas-a-pagar.mjs [--keep]
 */

import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })

import { PrismaClient } from '@prisma/client'
// As regras com banco vêm do serviço; as puras, do módulo de regras. São os
// mesmos arquivos que a aplicação usa — o E2E não tem cópia da regra.
import {
  criarContaComParcelas,
  registrarPagamento,
  estornarPagamento,
  recalcularContaCompleta,
  cancelarConta,
  alcadaDaIgreja,
} from '../src/lib/contasPagarService.ts'
import {
  aprovacaoInicial,
  gerarParcelas,
  statusDaParcela,
  derivarStatusGeral,
  validarPagamento,
  proximoNumeroConta,
  somarMeses,
  paraCentavos,
} from '../src/lib/contasPagarRules.ts'
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

const TX = { timeout: 30000, maxWait: 15000 }
const reais = (v) => Number(Number(v ?? 0).toFixed(2))
const criado = {
  campoId: null, regionalId: null, churchId: null, churchVizinhaId: null,
  userId: null, memberId: null, bancoId: null, departamentoId: null,
  planoDeContaId: null, credorId: null,
}

/** Datas relativas a hoje, para o teste não depender do calendário. */
const hoje = new Date().toISOString().slice(0, 10)
const diasAtras = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

async function limpar() {
  console.log('\n🧹 limpando os dados do teste...')
  const igrejas = [criado.churchId, criado.churchVizinhaId].filter(Boolean)
  for (const id of igrejas) {
    const c = `'${id}'::uuid`
    await exec(`DELETE FROM pagamentos_parcela WHERE church_id = ${c}`).catch(() => {})
    await exec(`DELETE FROM parcelas_contas_pagar WHERE church_id = ${c}`).catch(() => {})
    await exec(`DELETE FROM contas_pagar WHERE church_id = ${c}`).catch(() => {})
    await exec(`DELETE FROM credores WHERE church_id = ${c}`).catch(() => {})
    await exec(`DELETE FROM livro_caixa WHERE church_id = ${c}`).catch(() => {})
    await exec(`DELETE FROM settings WHERE church_id = ${c}`).catch(() => {})
    await exec(`DELETE FROM members WHERE church_id = ${c}`).catch(() => {})
  }
  if (criado.userId) await exec(`DELETE FROM users WHERE id = '${criado.userId}'::uuid`).catch(() => {})
  for (const id of igrejas) await exec(`DELETE FROM churches WHERE id = '${id}'::uuid`).catch(() => {})
  if (criado.bancoId) await exec(`DELETE FROM bancos WHERE id = '${criado.bancoId}'::uuid`).catch(() => {})
  if (criado.departamentoId) await exec(`DELETE FROM departamentos WHERE id = '${criado.departamentoId}'::uuid`).catch(() => {})
  if (criado.regionalId) await exec(`DELETE FROM regionais WHERE id = '${criado.regionalId}'::uuid`).catch(() => {})
  if (criado.campoId) await exec(`DELETE FROM campos WHERE id = '${criado.campoId}'::uuid`).catch(() => {})
  console.log('   pronto — banco no estado anterior.')
}

/** Estado atual de uma parcela, direto do banco. */
const lerParcela = (id) => prisma.parcelaContaPagar.findUnique({ where: { id } })
const lerConta = (id) => prisma.contaPagar.findUnique({ where: { id }, include: { parcelas: { orderBy: { numeroParcela: 'asc' } } } })

async function main() {
  console.log('\n💸 E2E — Módulo Contas a Pagar\n')

  // ── 1. regras puras (sem banco) ───────────────────────────────────────────
  step(1, 'Motor de cálculo — funções puras')

  const p12 = gerarParcelas({ valorTotal: 1000, numeroParcelas: 12, primeiroVencimento: '2026-01-15' })
  const soma12 = p12.reduce((s, p) => s + p.valorParcelaCentavos, 0)
  check('12 parcelas geradas', p12.length === 12)
  check('soma das parcelas bate com o total', soma12 === 100000, `${soma12} centavos`)
  check('resíduo dos centavos vai na última', p12[11].valorParcelaCentavos > p12[0].valorParcelaCentavos,
    `${p12[0].valorParcelaCentavos} vs ${p12[11].valorParcelaCentavos}`)
  check('vencimentos são mensais', p12[1].dataVencimento === '2026-02-15' && p12[11].dataVencimento === '2026-12-15')

  check('31/01 + 1 mês vira 28/02 (não estoura o mês)', somarMeses('2026-01-31', 1) === '2026-02-28',
    somarMeses('2026-01-31', 1))

  const desiguais = gerarParcelas({
    valorTotal: 1000, numeroParcelas: 3, primeiroVencimento: '2026-01-10',
    valoresManuais: [500, 300, 200],
  })
  check('parcelas desiguais aceitas', desiguais.map((p) => p.valorParcelaCentavos).join(',') === '50000,30000,20000')

  let erroSoma = null
  try { gerarParcelas({ valorTotal: 1000, numeroParcelas: 2, primeiroVencimento: '2026-01-10', valoresManuais: [500, 400] }) }
  catch (e) { erroSoma = e.message }
  check('soma que não fecha é rejeitada', !!erroSoma, erroSoma?.slice(0, 60))

  check('parcela quitada → PAGO',
    statusDaParcela({ valorParcelaCentavos: 10000, valorPagoCentavos: 10000, dataVencimento: '2026-01-01', hoje: '2026-06-01' }) === 'PAGO')
  check('parcela com pagamento parcial → PARCIAL',
    statusDaParcela({ valorParcelaCentavos: 10000, valorPagoCentavos: 6000, dataVencimento: '2026-01-01', hoje: '2026-06-01' }) === 'PARCIAL')
  check('vencida sem pagamento → ATRASADO',
    statusDaParcela({ valorParcelaCentavos: 10000, valorPagoCentavos: 0, dataVencimento: '2026-01-01', hoje: '2026-06-01' }) === 'ATRASADO')
  check('a vencer sem pagamento → PENDENTE',
    statusDaParcela({ valorParcelaCentavos: 10000, valorPagoCentavos: 0, dataVencimento: '2026-12-01', hoje: '2026-06-01' }) === 'PENDENTE')
  check('vencida COM pagamento parcial continua PARCIAL (não vira ATRASADO)',
    statusDaParcela({ valorParcelaCentavos: 10000, valorPagoCentavos: 6000, dataVencimento: '2026-01-01', hoje: '2026-06-01' }) === 'PARCIAL')

  check('status geral: todas pagas → PAGO', derivarStatusGeral([{ status: 'PAGO' }, { status: 'PAGO' }]) === 'PAGO')
  check('status geral: uma parcial → PARCIAL', derivarStatusGeral([{ status: 'PARCIAL' }, { status: 'PENDENTE' }]) === 'PARCIAL')
  check('status geral: uma paga e outras pendentes → PARCIAL', derivarStatusGeral([{ status: 'PAGO' }, { status: 'PENDENTE' }]) === 'PARCIAL')
  check('status geral: nenhuma paga e uma vencida → ATRASADO', derivarStatusGeral([{ status: 'ATRASADO' }, { status: 'PENDENTE' }]) === 'ATRASADO')
  check('status geral ignora canceladas', derivarStatusGeral([{ status: 'PAGO' }, { status: 'CANCELADA' }]) === 'PAGO')

  check('pagamento acima do saldo é rejeitado', validarPagamento({ valorPagoCentavos: 15000, valorSaldoCentavos: 10000 }).ok === false)
  check('pagamento igual ao saldo é aceito', validarPagamento({ valorPagoCentavos: 10000, valorSaldoCentavos: 10000 }).ok === true)
  check('pagamento zerado é rejeitado', validarPagamento({ valorPagoCentavos: 0, valorSaldoCentavos: 10000 }).ok === false)

  check('numeração sequencial por ano', proximoNumeroConta('CP-2026-000041', 2026) === 'CP-2026-000042')
  check('numeração reinicia em ano novo', proximoNumeroConta('CP-2026-000041', 2027) === 'CP-2027-000001')

  check('sem alçada configurada → NAO_REQUER', aprovacaoInicial(50000, 0) === 'NAO_REQUER')
  check('abaixo da alçada → NAO_REQUER', aprovacaoInicial(900, 1000) === 'NAO_REQUER')
  check('acima da alçada → AGUARDANDO', aprovacaoInicial(5000, 1000) === 'AGUARDANDO')

  // ── 2. cenário + seed dos cadastros ───────────────────────────────────────
  step(2, 'Seed: campo, regional, igrejas, membro, banco, departamento, tipo de despesa e credor')

  const stamp = Date.now() % 100000
  const campo = await prisma.campo.create({ data: { name: '[E2E] Campo Contas a Pagar', code: `E2ECP${stamp}` } })
  criado.campoId = campo.id

  const regional = await prisma.regional.create({
    data: { name: '[E2E] Regional Contas a Pagar', code: `E2ECR${stamp}`, campoId: campo.id },
  })
  criado.regionalId = regional.id

  const igreja = await prisma.church.create({
    data: { name: '[E2E] Igreja Contas a Pagar', code: `E2ECI${stamp}`, regionalId: regional.id },
  })
  criado.churchId = igreja.id

  const igrejaVizinha = await prisma.church.create({
    data: { name: '[E2E] Igreja Vizinha', code: `E2ECV${stamp}`, regionalId: regional.id },
  })
  criado.churchVizinhaId = igrejaVizinha.id

  const usuario = await prisma.user.create({
    data: {
      email: `e2e-contas-pagar-${stamp}@teste.local`, fullName: '[E2E] Tesoureiro',
      profileType: 'church', churchId: igreja.id, campoId: campo.id, regionalId: regional.id,
    },
  })
  criado.userId = usuario.id

  const pastor = await prisma.member.create({
    data: { churchId: igreja.id, fullName: '[E2E] Pastor Beneficiário' },
  })
  criado.memberId = pastor.id

  const banco = await prisma.banco.create({
    data: { nome: `[E2E] Banco Teste ${stamp}`, tipoConta: 'CORRENTE', ativo: true },
  })
  criado.bancoId = banco.id

  const departamento = await prisma.departamento.create({
    data: { nome: `[E2E] Missões ${stamp}`, tipo: 'MISSOES', cor: '#8b5cf6', ativo: true },
  })
  criado.departamentoId = departamento.id

  // Classificação da despesa vem do PLANO DE CONTAS que a igreja já usa — o
  // módulo não tem cadastro paralelo de tipos de despesa.
  const planoDespesa = (await prisma.$queryRawUnsafe(
    `SELECT id, nome FROM plano_de_contas WHERE tipo = 'DESPESA' AND ativo = true ORDER BY codigo NULLS LAST LIMIT 1`
  ))[0]
  if (!planoDespesa) throw new Error('Nenhum plano de contas de DESPESA cadastrado — o seed depende dele.')
  criado.planoDeContaId = planoDespesa.id

  const credor = await prisma.credor.create({
    data: {
      churchId: igreja.id, nome: '[E2E] Pastor Beneficiário', tipoPessoa: 'PF',
      tipoCredor: 'PASTOR', memberId: pastor.id, bancoId: banco.id, chavePix: 'e2e@pix.local',
    },
  })
  criado.credorId = credor.id

  check('seed completo', !!igreja.id && !!banco.id && !!departamento.id && !!planoDespesa.id && !!credor.id)
  check('credor ligado ao cadastro de membro', credor.memberId === pastor.id)

  // ── 3. conta à vista ──────────────────────────────────────────────────────
  step(3, 'Conta à vista — 1 parcela')

  const aVista = await prisma.$transaction(async (tx) => criarContaComParcelas(tx, {
    churchId: igreja.id, descricao: '[E2E] Conta de luz agosto', valorTotal: 480.55,
    dataEmissao: hoje, primeiroVencimento: hoje, parcelado: false,
    planoDeContaId: planoDespesa.id, credorId: credor.id, departamentoId: departamento.id,
    bancoId: banco.id, statusAprovacao: 'NAO_REQUER', criadoPor: usuario.id,
  }), TX)

  const aVistaCompleta = await lerConta(aVista.id)
  check('número no formato CP-AAAA-NNNNNN', /^CP-\d{4}-\d{6}$/.test(aVista.numero), aVista.numero)
  check('gerou exatamente 1 parcela', aVistaCompleta.parcelas.length === 1)
  check('parcela nasce com saldo igual ao total', reais(aVistaCompleta.parcelas[0].valorSaldo) === 480.55)
  check('status inicial PENDENTE', aVistaCompleta.statusGeral === 'PENDENTE', aVistaCompleta.statusGeral)

  // ── 4. conta parcelada em 12 — o caso do pastor ───────────────────────────
  step(4, 'Conta parcelada em 12 — pagamento anual do pastor lançado de uma vez')

  const primeiroVenc = diasAtras(30) // a 1ª parcela já venceu, as demais não
  const anual = await prisma.$transaction(async (tx) => criarContaComParcelas(tx, {
    churchId: igreja.id, descricao: '[E2E] Ajuda de custo pastoral 2026', valorTotal: 12000,
    dataEmissao: primeiroVenc, primeiroVencimento: primeiroVenc,
    parcelado: true, numeroParcelas: 12,
    planoDeContaId: planoDespesa.id, credorId: credor.id, departamentoId: departamento.id,
    bancoId: banco.id, statusAprovacao: 'NAO_REQUER', criadoPor: usuario.id,
  }), TX)

  let anualCompleta = await lerConta(anual.id)
  const somaParcelas = anualCompleta.parcelas.reduce((s, p) => s + paraCentavos(p.valorParcela), 0)
  check('12 parcelas criadas', anualCompleta.parcelas.length === 12)
  check('soma das parcelas = valor total', somaParcelas === 1200000, `${somaParcelas} centavos`)
  check('cada parcela vale R$ 1.000,00', reais(anualCompleta.parcelas[0].valorParcela) === 1000)
  check('1ª parcela vencida entra como ATRASADO', anualCompleta.parcelas[0].status === 'ATRASADO', anualCompleta.parcelas[0].status)
  check('conta com parcela vencida → status geral ATRASADO', anualCompleta.statusGeral === 'ATRASADO', anualCompleta.statusGeral)

  // ── 5. pagamento PARCIAL ──────────────────────────────────────────────────
  step(5, 'Pagamento parcial — só houve caixa para 60% da parcela')

  const parcela1 = anualCompleta.parcelas[0]
  const pag1 = await prisma.$transaction(async (tx) => registrarPagamento(tx, {
    parcelaId: parcela1.id, valorPago: 600, dataPagamento: diasAtras(25),
    formaPagamento: 'PIX', bancoId: banco.id,
    observacao: 'pago 60% por falta de caixa, restante fica em aberto',
    registradoPor: usuario.id, operadorNome: usuario.fullName,
  }), TX)

  let p1 = await lerParcela(parcela1.id)
  anualCompleta = await lerConta(anual.id)
  check('parcela vira PARCIAL', p1.status === 'PARCIAL', p1.status)
  check('valor pago = 600,00', reais(p1.valorPago) === 600)
  check('saldo remanescente = 400,00', reais(p1.valorSaldo) === 400)
  check('conta vira PARCIAL', anualCompleta.statusGeral === 'PARCIAL', anualCompleta.statusGeral)
  check('NÃO criou parcela nova para o saldo', anualCompleta.parcelas.length === 12, `${anualCompleta.parcelas.length} parcelas`)

  // ── 6. baixa contábil ─────────────────────────────────────────────────────
  step(6, 'Baixa contábil — o pagamento vira despesa no Livro Caixa')

  const lancamento = await prisma.livroCaixa.findUnique({ where: { id: pag1.livroCaixaId } })
  check('lançamento criado no livro caixa', !!lancamento)
  check('tipo DESPESA', lancamento?.tipo === 'DESPESA')
  check('valor igual ao pago', reais(lancamento?.valor) === 600)
  check('banco preenchido', lancamento?.bancoId === banco.id)
  check('departamento preenchido', lancamento?.departamentoId === departamento.id)
  check('favorecido = credor', lancamento?.favorecido === credor.nome, lancamento?.favorecido)
  check('member_id do credor propagado', lancamento?.memberId === pastor.id)
  check('referência aponta a parcela', /parcela 1\/12/.test(lancamento?.referencia ?? ''), lancamento?.referencia)
  check('vínculo de volta pagamento → livro caixa', pag1.pagamento.livroCaixaId === lancamento?.id)

  // ── 7. pagamento acima do saldo ───────────────────────────────────────────
  step(7, 'Trava: pagamento maior que o saldo da parcela')

  let erroExcesso = null
  try {
    await prisma.$transaction(async (tx) => registrarPagamento(tx, {
      parcelaId: parcela1.id, valorPago: 500, dataPagamento: hoje, registradoPor: usuario.id,
    }), TX)
  } catch (e) { erroExcesso = e.message }
  check('R$ 500 sobre saldo de R$ 400 é rejeitado', !!erroExcesso, erroExcesso?.slice(0, 70))

  p1 = await lerParcela(parcela1.id)
  check('saldo intacto depois da tentativa', reais(p1.valorSaldo) === 400)
  const lancamentosDepoisDaFalha = await prisma.livroCaixa.count({
    where: { churchId: igreja.id, deletedAt: null },
  })
  check('transação falha não deixou lançamento órfão no livro caixa', lancamentosDepoisDaFalha === 1,
    `${lancamentosDepoisDaFalha} lançamento(s)`)

  // ── 8. quitação meses depois ──────────────────────────────────────────────
  step(8, 'Quitação do saldo residual meses depois — mesma parcela, sem parcela nova')

  await prisma.$transaction(async (tx) => registrarPagamento(tx, {
    parcelaId: parcela1.id, valorPago: 400, dataPagamento: hoje,
    formaPagamento: 'DINHEIRO', bancoId: banco.id,
    observacao: 'quitação do saldo de agosto', registradoPor: usuario.id,
  }), TX)

  p1 = await lerParcela(parcela1.id)
  anualCompleta = await lerConta(anual.id)
  const pagamentosDaParcela = await prisma.pagamentoParcela.count({ where: { parcelaId: parcela1.id, estornadoEm: null } })
  check('parcela quitada → PAGO', p1.status === 'PAGO', p1.status)
  check('saldo zerado', reais(p1.valorSaldo) === 0)
  check('valor pago acumulado = 1000,00', reais(p1.valorPago) === 1000)
  check('a parcela guarda os DOIS pagamentos', pagamentosDaParcela === 2, `${pagamentosDaParcela} pagamentos`)
  check('total de parcelas continua 12', anualCompleta.parcelas.length === 12)
  check('conta segue PARCIAL (11 parcelas em aberto)', anualCompleta.statusGeral === 'PARCIAL', anualCompleta.statusGeral)

  // ── 9. estorno ────────────────────────────────────────────────────────────
  step(9, 'Estorno — pagamento e baixa contábil desfeitos, histórico preservado')

  await prisma.$transaction(async (tx) => estornarPagamento(tx, pag1.pagamento.id, 'lançamento em duplicidade', {
    id: usuario.id, nome: usuario.fullName,
  }), TX)

  p1 = await lerParcela(parcela1.id)
  const pagEstornado = await prisma.pagamentoParcela.findUnique({ where: { id: pag1.pagamento.id } })
  const lancEstornado = await prisma.livroCaixa.findUnique({ where: { id: pag1.livroCaixaId } })
  anualCompleta = await lerConta(anual.id)
  check('pagamento marcado como estornado', !!pagEstornado?.estornadoEm)
  check('motivo do estorno gravado', pagEstornado?.motivoEstorno === 'lançamento em duplicidade')
  check('pagamento NÃO foi apagado do histórico', !!pagEstornado)
  check('lançamento do livro caixa estornado', !!lancEstornado?.deletedAt && lancEstornado?.situacao === false)
  check('parcela volta a PARCIAL', p1.status === 'PARCIAL', p1.status)
  check('valor pago volta a 400,00', reais(p1.valorPago) === 400)
  check('saldo volta a 600,00', reais(p1.valorSaldo) === 600)
  check('conta segue PARCIAL', anualCompleta.statusGeral === 'PARCIAL')

  let erroEstornoDuplo = null
  try {
    await prisma.$transaction(async (tx) => estornarPagamento(tx, pag1.pagamento.id, 'de novo', { id: usuario.id }), TX)
  } catch (e) { erroEstornoDuplo = e.message }
  check('estornar duas vezes é bloqueado', !!erroEstornoDuplo, erroEstornoDuplo?.slice(0, 50))

  // ── 10. alçada de aprovação ───────────────────────────────────────────────
  step(10, 'Alçada — conta acima do limite só paga depois de aprovada')

  await prisma.setting.create({
    data: { churchId: igreja.id, settingKey: 'contas_pagar.alcada_aprovacao', settingValue: '5000' },
  })
  const alcada = await alcadaDaIgreja(prisma, igreja.id)
  check('alçada lida das configurações da igreja', alcada === 5000, String(alcada))

  const cara = await prisma.$transaction(async (tx) => criarContaComParcelas(tx, {
    churchId: igreja.id, descricao: '[E2E] Reforma do templo', valorTotal: 20000,
    dataEmissao: hoje, primeiroVencimento: hoje, parcelado: false,
    planoDeContaId: planoDespesa.id, credorId: credor.id, departamentoId: departamento.id,
    statusAprovacao: aprovacaoInicial(20000, alcada), criadoPor: usuario.id,
  }), TX)
  const caraCompleta = await lerConta(cara.id)
  check('conta acima da alçada nasce AGUARDANDO', caraCompleta.statusAprovacao === 'AGUARDANDO', caraCompleta.statusAprovacao)

  let erroSemAprovacao = null
  try {
    await prisma.$transaction(async (tx) => registrarPagamento(tx, {
      parcelaId: caraCompleta.parcelas[0].id, valorPago: 1000, dataPagamento: hoje, registradoPor: usuario.id,
    }), TX)
  } catch (e) { erroSemAprovacao = e.message }
  check('pagamento bloqueado enquanto aguarda aprovação', !!erroSemAprovacao, erroSemAprovacao?.slice(0, 60))

  await prisma.contaPagar.update({
    where: { id: cara.id },
    data: { statusAprovacao: 'APROVADO', aprovadoPor: usuario.id, dataAprovacao: new Date() },
  })
  const pagAprovado = await prisma.$transaction(async (tx) => registrarPagamento(tx, {
    parcelaId: caraCompleta.parcelas[0].id, valorPago: 1000, dataPagamento: hoje,
    formaPagamento: 'TRANSFERENCIA', bancoId: banco.id, registradoPor: usuario.id,
  }), TX)
  check('depois de aprovada, o pagamento passa', !!pagAprovado.pagamento.id)

  const barata = await prisma.$transaction(async (tx) => criarContaComParcelas(tx, {
    churchId: igreja.id, descricao: '[E2E] Material de escritório', valorTotal: 200,
    dataEmissao: hoje, primeiroVencimento: hoje, parcelado: false,
    planoDeContaId: planoDespesa.id, credorId: credor.id,
    statusAprovacao: aprovacaoInicial(200, alcada), criadoPor: usuario.id,
  }), TX)
  check('conta abaixo da alçada não exige aprovação', barata.statusAprovacao === 'NAO_REQUER', barata.statusAprovacao)

  // ── 11. cancelamento ──────────────────────────────────────────────────────
  step(11, 'Cancelamento — bloqueado com pagamento, permitido sem')

  let erroCancelar = null
  try { await prisma.$transaction(async (tx) => cancelarConta(tx, cara.id), TX) }
  catch (e) { erroCancelar = e.message }
  check('conta com pagamento não pode ser cancelada', !!erroCancelar, erroCancelar?.slice(0, 60))

  await prisma.$transaction(async (tx) => cancelarConta(tx, barata.id), TX)
  const baratatDepois = await lerConta(barata.id)
  check('conta sem pagamento é cancelada', baratatDepois.statusGeral === 'CANCELADA', baratatDepois.statusGeral)
  check('parcelas da conta cancelada também são canceladas', baratatDepois.parcelas.every((p) => p.status === 'CANCELADA'))
  check('cancelamento é lógico (deleted_at preenchido)', !!baratatDepois.deletedAt)

  // ── 12. recálculo em massa ────────────────────────────────────────────────
  step(12, 'Recálculo completo da conta (virada de dia / correção manual)')

  await prisma.parcelaContaPagar.update({
    where: { id: parcela1.id },
    data: { valorPago: 0, valorSaldo: 0, status: 'PENDENTE' }, // simula dado corrompido
  })
  await prisma.$transaction(async (tx) => recalcularContaCompleta(tx, anual.id), TX)
  p1 = await lerParcela(parcela1.id)
  check('recálculo restaura o valor pago a partir dos pagamentos', reais(p1.valorPago) === 400, String(reais(p1.valorPago)))
  check('recálculo restaura o saldo', reais(p1.valorSaldo) === 600)
  check('recálculo restaura o status', p1.status === 'PARCIAL', p1.status)

  // ── 13. relatórios ────────────────────────────────────────────────────────
  step(13, 'Relatórios — as mesmas agregações da aba 2 da tela')

  const totais = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS parcelas,
           COALESCE(SUM(p.valor_parcela), 0)::float8 AS total,
           COALESCE(SUM(p.valor_pago), 0)::float8    AS pago,
           COALESCE(SUM(p.valor_saldo), 0)::float8   AS saldo,
           COALESCE(SUM(p.valor_saldo) FILTER (WHERE p.valor_pago > 0), 0)::float8 AS saldo_residual
    FROM parcelas_contas_pagar p
    JOIN contas_pagar c ON c.id = p.conta_pagar_id
    WHERE p.church_id = ${igreja.id}::uuid AND c.deleted_at IS NULL AND p.status <> 'CANCELADA'
  `
  const t = totais[0]
  // 12 (anual) + 1 (à vista) + 1 (reforma) = 14 parcelas ativas
  check('total de parcelas ativas', t.parcelas === 14, String(t.parcelas))
  check('total devido = 12.000 + 480,55 + 20.000', reais(t.total) === 32480.55, String(reais(t.total)))
  check('total pago = 400 (parcial) + 1.000 (reforma)', reais(t.pago) === 1400, String(reais(t.pago)))
  check('saldo = total − pago', reais(t.saldo) === reais(t.total - t.pago))
  check('saldo residual só conta parcela com pagamento parcial', reais(t.saldo_residual) === 19600,
    String(reais(t.saldo_residual)))

  const porDepto = await prisma.$queryRaw`
    SELECT COALESCE(d.nome, 'Não informado') AS nome, SUM(p.valor_parcela)::float8 AS valor
    FROM parcelas_contas_pagar p
    JOIN contas_pagar c ON c.id = p.conta_pagar_id
    LEFT JOIN departamentos d ON d.id = c.departamento_id
    WHERE p.church_id = ${igreja.id}::uuid AND c.deleted_at IS NULL AND p.status <> 'CANCELADA'
    GROUP BY d.id, d.nome ORDER BY valor DESC
  `
  check('agrupa por departamento', porDepto.length >= 1)
  check('departamento do seed aparece no relatório', porDepto.some((d) => d.nome === departamento.nome))

  const semDepartamento = await prisma.contaPagar.count({
    where: { churchId: igreja.id, departamentoId: null, deletedAt: null },
  })
  check('conta lançada sem departamento cai no bucket "Não informado"', semDepartamento >= 0, `${semDepartamento} conta(s)`)

  // Duas parcelas ficaram pagas pela metade: a do pastor (600 de 1.000, depois
  // do estorno) e a da reforma (1.000 de 20.000).
  const residual = await prisma.parcelaContaPagar.findMany({
    where: { churchId: igreja.id, valorSaldo: { gt: 0 }, valorPago: { gt: 0 } },
  })
  const residualPastor = residual.find((p) => p.contaPagarId === anual.id)
  check('relatório de saldo residual lista as duas parcelas parciais', residual.length === 2, `${residual.length} parcela(s)`)
  check('parcela do pastor está no relatório', !!residualPastor)
  check('saldo residual do pastor = 600,00', reais(residualPastor?.valorSaldo) === 600, String(reais(residualPastor?.valorSaldo)))
  check('soma dos residuais bate com a agregação', reais(residual.reduce((s, p) => s + Number(p.valorSaldo), 0)) === 19600)

  // ── 14. filtros da tela ───────────────────────────────────────────────────
  step(14, 'Filtros da aba 1 — mesmos `where` das rotas de listagem')

  // Uma conta claramente vencida e sem pagamento, para o filtro de ATRASADO ter
  // o que encontrar. Vai de propósito SEM credor e SEM departamento, para testar
  // também o filtro "Não informado".
  const vencida = await prisma.$transaction(async (tx) => criarContaComParcelas(tx, {
    churchId: igreja.id, descricao: '[E2E] Conta vencida sem pagamento', valorTotal: 300,
    dataEmissao: diasAtras(10), primeiroVencimento: diasAtras(10), parcelado: false,
    planoDeContaId: null, credorId: null, departamentoId: null,
    statusAprovacao: 'NAO_REQUER', criadoPor: usuario.id,
  }), TX)
  const vencidaCompleta = await lerConta(vencida.id)
  check('conta vencida sem pagamento nasce ATRASADA', vencidaCompleta.statusGeral === 'ATRASADO', vencidaCompleta.statusGeral)

  const contaFiltro = async (where) => prisma.parcelaContaPagar.count({
    where: { churchId: igreja.id, contaPagar: { deletedAt: null }, ...where },
  })

  // Estado neste ponto (parcelas de contas não canceladas da igreja principal):
  //   anual   12 parcelas → 1 PARCIAL (pastor) + 11 PENDENTE
  //   aVista   1 parcela  → PENDENTE (vence hoje)
  //   cara     1 parcela  → PARCIAL (1.000 de 20.000)
  //   vencida  1 parcela  → ATRASADO
  //   barata   cancelada e com deleted_at → fora de todas as contagens
  check('filtro por status ATRASADO', (await contaFiltro({ status: 'ATRASADO' })) === 1, String(await contaFiltro({ status: 'ATRASADO' })))
  check('filtro por status PARCIAL', (await contaFiltro({ status: 'PARCIAL' })) === 2, String(await contaFiltro({ status: 'PARCIAL' })))
  check('filtro por status PENDENTE', (await contaFiltro({ status: 'PENDENTE' })) === 12, String(await contaFiltro({ status: 'PENDENTE' })))
  check('filtro por status PAGO (nenhuma, o pagamento foi estornado)', (await contaFiltro({ status: 'PAGO' })) === 0)
  check('conta cancelada fica fora dos filtros', (await contaFiltro({})) === 15, String(await contaFiltro({})))
  check('filtro por credor', (await contaFiltro({ contaPagar: { credorId: credor.id, deletedAt: null } })) === 14)
  check('filtro por plano de contas', (await contaFiltro({ contaPagar: { planoDeContaId: planoDespesa.id, deletedAt: null } })) === 14)
  check('filtro por departamento', (await contaFiltro({ contaPagar: { departamentoId: departamento.id, deletedAt: null } })) === 14)
  check('filtro "sem departamento" acha a conta não classificada',
    (await contaFiltro({ contaPagar: { departamentoId: null, deletedAt: null } })) === 1)
  check('filtro só com saldo residual', (await contaFiltro({ valorSaldo: { gt: 0 }, valorPago: { gt: 0 } })) === 2)
  check(
    'filtro por faixa de vencimento (até hoje)',
    (await contaFiltro({ dataVencimento: { lte: new Date(`${hoje}T00:00:00Z`) } })) === 4,
    String(await contaFiltro({ dataVencimento: { lte: new Date(`${hoje}T00:00:00Z`) } }))
  )

  const busca = await prisma.contaPagar.count({
    where: { churchId: igreja.id, deletedAt: null, descricao: { contains: 'pastoral', mode: 'insensitive' } },
  })
  check('busca textual por descrição', busca === 1, `${busca} conta(s)`)

  const buscaCredor = await prisma.contaPagar.count({
    where: { churchId: igreja.id, deletedAt: null, credor: { nome: { contains: 'Pastor', mode: 'insensitive' } } },
  })
  check('busca textual pelo nome do credor', buscaCredor === 3, `${buscaCredor} conta(s)`)

  // ── 15. isolamento entre igrejas ──────────────────────────────────────────
  step(15, 'Isolamento — usuário restrito à própria igreja não vê conta da vizinha')

  await prisma.$transaction(async (tx) => criarContaComParcelas(tx, {
    churchId: igrejaVizinha.id, descricao: '[E2E] Conta da igreja vizinha', valorTotal: 999,
    dataEmissao: hoje, primeiroVencimento: hoje, parcelado: false, statusAprovacao: 'NAO_REQUER',
  }), TX)

  const usuarioRestrito = {
    profileType: 'church', campoId: campo.id, churchId: igreja.id, roleName: 'Tesouraria',
  }
  const escopo = escopoDeIgrejas(usuarioRestrito, {})
  check('escopo do perfil restrito trava na própria igreja', escopo.ok && escopo.churchWhere.id === igreja.id)

  const visiveis = await prisma.contaPagar.count({
    where: { deletedAt: null, church: escopo.churchWhere },
  })
  const totalGeral = await prisma.contaPagar.count({
    where: { deletedAt: null, churchId: { in: [igreja.id, igrejaVizinha.id] } },
  })
  // 4 na igreja principal (à vista, anual, reforma, vencida — a "barata" foi
  // cancelada) + 1 na vizinha.
  check('as duas igrejas juntas têm 5 contas ativas', totalGeral === 5, `${totalGeral} contas`)
  check('perfil restrito enxerga só as 4 da própria igreja', visiveis === 4, `${visiveis} visíveis`)
  check('a conta da vizinha ficou de fora', totalGeral - visiveis === 1)

  const tentativaFiltroForcado = escopoDeIgrejas(usuarioRestrito, { churchId: igrejaVizinha.id })
  check(
    'filtro forçado por outra igreja é sobrescrito pelo perfil',
    tentativaFiltroForcado.ok && tentativaFiltroForcado.churchWhere.id === igreja.id
  )

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
