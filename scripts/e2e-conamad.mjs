/**
 * Simulação ponta a ponta do módulo Conamad: inadimplência, lista geral e
 * atualização por planilha (prévia não grava; aplicar grava só o que é exato),
 * com isolamento entre campos.
 *
 * Importa `src/lib/conamad/service.ts` de verdade. Roda contra o banco, mas cria
 * os próprios campos com prefixo [E2E]; nenhum registro real é tocado. Tudo é
 * apagado no fim (--keep preserva para inspeção).
 *
 * Uso: npx tsx scripts/e2e-conamad.mjs [--keep]
 */
import { config as loadEnv } from 'dotenv'
import { randomUUID } from 'node:crypto'

loadEnv({ path: '.env' })
const { prisma } = await import('../src/lib/prisma.ts')
const svc = await import('../src/lib/conamad/service.ts')

const stamp = Date.now()
const base = 900000000 + (stamp % 1000000)
let falhas = 0
function ok(cond, msg) {
  console.log(`${cond ? '  ok ' : 'FALHA'} ${msg}`)
  if (!cond) falhas++
}

// As telas leem o Excel no navegador e mandam as linhas: o serviço recebe o mesmo formato.
const planilha = (linhas) => linhas

const ids = []
async function campo(nome) {
  const c = await prisma.campo.create({ data: { name: `[E2E] ${nome}`, code: `E2ECON${nome}${stamp}`.slice(0, 30) } })
  ids.push(c.id)
  return c
}
async function ministro(campoId, matricula, nome, situacao = 'ATIVO') {
  return prisma.conamadMinistro.create({ data: { campoId, conamadId: randomUUID(), matricula, nome, situacao, titulo: 'EVANGELISTA', igreja: '[E2E] Igreja' } })
}
async function anuidade(m, anoReferencia, situacao, valor = 405) {
  return prisma.conamadAnuidade.create({ data: { campoId: m.campoId, conamadId: randomUUID(), ministroId: m.id, matricula: m.matricula, nome: m.nome, titulo: 'EVANGELISTA', situacaoMinistro: m.situacao, igreja: '[E2E] Igreja', anoReferencia, valor, situacao } })
}

try {
  const a = await campo('A')
  const b = await campo('B')
  const m1 = await ministro(a.id, base + 1, 'JOAO DA SILVA')
  const mB = await ministro(b.id, base + 2, 'MARIA OUTRO CAMPO')
  await anuidade(m1, 2024, 'Cancelado')
  await anuidade(m1, 2024, 'Pago', 280)
  await anuidade(m1, 2025, 'Não Pago')
  await anuidade(m1, 2026, 'Não Pago')
  await anuidade(mB, 2026, 'Não Pago', 999)

  console.log('\n# Inadimplentes')
  const ina = await svc.listarInadimplentes(a.id, {})
  ok(ina.length === 1 && ina[0].matricula === m1.matricula, 'só o ministro do campo aparece')
  ok(Number(ina[0].total) === 810 && ina[0].anos.join() === '2025,2026', 'soma e anos em aberto corretos')
  const so2026 = await svc.listarInadimplentes(a.id, { anoDe: 2026, anoAte: 2026 })
  ok(Number(so2026[0].total) === 405, 'filtro de ano respeitado')
  ok((await svc.listarInadimplentes(a.id, { situacoesMinistro: ['DESLIGADO'] })).length === 0, 'filtro de situação respeitado')
  ok(ina[0].titulo === 'EVANGELISTA' && ina[0].situacao === 'ATIVO', 'título e situação na escrita do sistema')
  ok((await svc.listarInadimplentes(a.id, { anos: [2025], titulos: ['EVANGELISTA'], situacoesMinistro: ['ATIVO', 'DESLIGADO'] })).length === 1, 'filtros de múltipla escolha')
  ok((await svc.listarInadimplentes(a.id, { titulos: ['PASTOR'] })).length === 0, 'múltipla escolha exclui o resto')
  ok((await svc.listarInadimplentes(a.id, { busca: 'joao da' })).length === 1, 'busca por nome')
  ok((await svc.listarInadimplentes(a.id, { busca: String(m1.matricula) })).length === 1, 'busca por matrícula')

  console.log('\n# Lista geral e por igreja')
  const grade = await svc.listaGeral(a.id, {})
  ok(grade[0].anos['2024'] === 'Pago', 'ano com cancelada e paga mostra a paga')
  ok(Number(grade[0].naoPago) === 810, 'valor não pago da grade')
  const igreja = await svc.inadimplentesPorIgreja(a.id, {})
  ok(igreja.length === 1 && Number(igreja[0].total) === 810, 'total por igreja sem misturar campos')
  ok(igreja[0].totalMinistros === 1 && igreja[0].anos['2025'] === 1 && igreja[0].anos['2026'] === 1, 'por igreja traz total e quantos devem por ano')
  const porAno = await svc.resumoPorAno(a.id, {})
  ok(porAno.some((x) => x.ano === 2026 && x.naoPagas === 1 && Number(x.aberto) === 405), 'resumo por ano')
  ok((await svc.resumoPorAno(a.id, { anos: [2025] })).length === 1, 'resumo respeita o ano')
  ok((await svc.anosDisponiveis(a.id)).join() === '2026,2025,2024', 'anos vêm dos dados, do mais novo ao mais antigo')

  console.log('\n# Planilha de anuidades')
  const xlsx = planilha([
    { Matricula: m1.matricula, NomeCompleto: 'João da Silva', NomeIgreja: 'X', TituloEclesiastico: 'Ev', ValorNaoPago: 405, 2024: 'PAGO', 2025: 'PAGO', 2026: 'NPAG' },
    { Matricula: mB.matricula, NomeCompleto: 'MARIA OUTRO CAMPO', NomeIgreja: 'X', TituloEclesiastico: 'Ev', ValorNaoPago: 0, 2024: '', 2025: '', 2026: 'PAGO' },
    { Matricula: base + 9, NomeCompleto: 'NINGUEM', NomeIgreja: 'X', TituloEclesiastico: 'Ev', ValorNaoPago: 0, 2024: '', 2025: '', 2026: 'PAGO' },
  ])
  const previa = await svc.previaPlanilha(a.id, xlsx)
  ok(previa.mudancasAnuidades.length === 1 && previa.mudancasAnuidades[0].ano === 2025, 'prévia aponta só a anuidade diferente')
  ok(previa.iguais === 2, 'anos iguais contados')
  ok(previa.duvidas.length === 2, 'matrícula de outro campo e inexistente ficam em dúvida')
  ok(Number((await svc.listarInadimplentes(a.id, {}))[0].total) === 810, 'prévia não grava nada')
  let recusou = false
  try { await svc.aplicarPlanilha(a.id, null, xlsx, 'teste.xlsx', 'assinatura-antiga') } catch { recusou = true }
  ok(recusou, 'confirmação de prévia antiga é recusada')
  const r = await svc.aplicarPlanilha(a.id, null, xlsx, 'teste.xlsx', previa.assinatura)
  ok(r.anuidades === 1, 'aplicar grava a mudança')
  ok(Number((await svc.listarInadimplentes(a.id, {}))[0].total) === 405, 'inadimplência recalculada')
  ok((await svc.listarInadimplentes(b.id, {}))[0].total === '999.00', 'outro campo intacto')
  ok((await svc.previaPlanilha(a.id, xlsx)).mudancasAnuidades.length === 0, 'reenviar não muda mais nada')

  console.log('\n# Nome divergente e planilha de ministros')
  const nomeErrado = planilha([{ Matricula: m1.matricula, NomeCompleto: 'JOAO SOUZA', NomeIgreja: 'X', TituloEclesiastico: 'Ev', ValorNaoPago: 0, 2026: 'PAGO' }])
  const pErrado = await svc.previaPlanilha(a.id, nomeErrado)
  ok(pErrado.mudancasAnuidades.length === 0 && pErrado.duvidas.length === 1, 'nome diferente não atualiza')
  const repetida = planilha([
    { Matricula: m1.matricula, NomeCompleto: 'JOAO DA SILVA', NomeIgreja: 'X', TituloEclesiastico: 'Ev', ValorNaoPago: 0, 2026: 'PAGO' },
    { Matricula: m1.matricula, NomeCompleto: 'JOAO DA SILVA', NomeIgreja: 'Y', TituloEclesiastico: 'Ev', ValorNaoPago: 0, 2026: 'NPAG' },
  ])
  const pRep = await svc.previaPlanilha(a.id, repetida)
  ok(pRep.mudancasAnuidades.length === 0 && pRep.duvidas.length === 2, 'matrícula repetida na planilha não atualiza')
  const xMin = planilha([{ Igreja: 'X', Matricula: m1.matricula, NomeCompleto: 'JOAO DA SILVA', Situacao: 'INAT' }])
  const pMin = await svc.previaPlanilha(a.id, xMin)
  const rMin = await svc.aplicarPlanilha(a.id, null, xMin, 'min.xlsx', pMin.assinatura)
  const pVazia = await svc.previaPlanilha(a.id, planilha([{ Igreja: 'X', Matricula: m1.matricula, NomeCompleto: 'JOAO DA SILVA', Situacao: '' }]))
  ok(pVazia.mudancasMinistros.length === 0 && pVazia.duvidas.length === 1, 'situação em branco não grava')
  ok(rMin.ministros === 1, 'situação do espelho atualizada')
  ok((await prisma.conamadMinistro.findUnique({ where: { id: m1.id } })).situacao === 'DESLIGADO', 'espelho gravado')
  await prisma.conamadMinistro.update({ where: { id: m1.id }, data: { jubilado: true, jubiladoEstado: 'SP', jubiladoAnuidade: 'Isento' } })
  const jub = await svc.listarJubilados(a.id, {})
  ok(jub.length === 1 && jub[0].estado === 'SP' && jub[0].anuidade === 'Isento', 'jubilados do campo')
  ok((await svc.listarJubilados(b.id, {})).length === 0, 'jubilados não vazam para outro campo')
  ok((await svc.previaPlanilha(a.id, []).catch((e) => e)) instanceof svc.ErroPlanilha, 'planilha vazia é recusada')
  ok((await svc.listarJubilados(a.id, { busca: String(m1.matricula) })).length === 1, 'jubilados busca por matrícula')
  await prisma.conamadMinistro.update({ where: { id: m1.id }, data: { sexo: 'Masculino', estadoCivil: 'Casado(a)', credencialStatus: 'VIGENTE' } })
  ok((await svc.listarMinistros(a.id, { sexos: ['Masculino'], estadosCivis: ['Casado(a)'], credenciais: ['VIGENTE'] })).length === 1, 'filtros de Secretaria')
  ok((await svc.listarMinistros(a.id, { sexos: ['Feminino'] })).length === 0, 'filtro de sexo exclui')
  ok((await svc.listarMinistros(b.id, {})).every((x) => x.matricula !== m1.matricula), 'Secretaria não mistura campos')
  await prisma.conamadMinistro.update({ where: { id: m1.id }, data: { credencialValidade: new Date('2020-01-31') } })
  ok((await svc.listarMinistros(a.id, { credenciais: ['VENCIDA'] })).some((x) => x.matricula === m1.matricula && x.credencialStatus === 'VENCIDA'), 'credencial com validade passada é VENCIDA')
  ok((await svc.listarMinistros(a.id, { credenciais: ['VIGENTE'] })).every((x) => x.matricula !== m1.matricula), 'credencial vencida não conta como VIGENTE')
  const perm = await import('../src/lib/conamad/permissoes.ts')
  const linha = { nome: 'X', documento: '1', celular: '2', endereco: 'R', nascimento: '01/01/2000' }
  const soCargo = perm.semDadosRestritos(linha, perm.relatorioSecretaria('sec-cargo'))
  ok(soCargo.nome === 'X' && !('documento' in soCargo) && !('celular' in soCargo) && !('endereco' in soCargo), 'relatório sem CPF não recebe dados pessoais')
  const comCpf = perm.semDadosRestritos(linha, perm.relatorioSecretaria('sec-cpf'))
  ok(comCpf.documento === '1' && !('celular' in comCpf), 'relatório de CPF recebe só o CPF')
  ok(perm.relatorioSecretaria('constructor') === null && perm.relatorioSecretaria(null) === null, 'relatório inválido é recusado')
  let erro = false
  try { await svc.previaPlanilha(a.id, planilha([{ Coluna: 1 }])) } catch { erro = true }
  ok(erro, 'planilha desconhecida é recusada')
} catch (e) {
  falhas++
  console.error('ERRO', e)
} finally {
  if (!process.argv.includes('--keep')) {
    await prisma.campo.deleteMany({ where: { id: { in: ids } } })
    const resto = await prisma.conamadMinistro.count({ where: { campoId: { in: ids } } })
    console.log(`\nLimpeza: ${resto === 0 ? 'ok' : 'SOBROU ' + resto}`)
  }
  await prisma.$disconnect()
  console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK')
  process.exit(falhas ? 1 : 0)
}
