/**
 * E2E dos Relatórios de Secretaria e de Tesouraria (src/lib/relatoriosIgreja).
 *
 * Cria dois campos [E2E] (A e B), cada um com regional, igreja, membro,
 * ocorrência e lançamento de dízimo. Roda TODOS os grupos/relatórios no campo A
 * e confere:
 *  - nenhum relatório devolve dado do campo B (isolamento por campo);
 *  - os relatórios principais enxergam o dado do campo A;
 *  - pedir a igreja do campo B estando no campo A devolve vazio.
 * Nenhum registro real é tocado; tudo é apagado no fim (--keep preserva).
 *
 * Uso: npx tsx scripts/e2e-relatorios-igreja.mjs [--keep]
 */
import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env' })
const { prisma } = await import('../src/lib/prisma.ts')
const { executarRelatorio } = await import('../src/lib/relatoriosIgreja/servidor.ts')
const { GRUPOS } = await import('../src/lib/relatoriosIgreja/catalogo.ts')

const SUFIXO = String(Date.now()).slice(-7)
const hoje = new Date()
const iso = (d) => d.toISOString().slice(0, 10)
let falhas = 0
function ok(cond, msg) {
  console.log(`${cond ? '  ok ' : 'FALHA'} ${msg}`)
  if (!cond) falhas++
}

const criados = []
async function criarCampo(letra) {
  const campo = await prisma.campo.create({ data: { name: `[E2E] Rel ${letra} ${SUFIXO}`, code: `E2E-REL${letra}-${SUFIXO}` } })
  criados.push(campo.id)
  const regional = await prisma.regional.create({ data: { campoId: campo.id, name: `[E2E] Regional ${letra}`, code: `E2E-RR${letra}-${SUFIXO}` } })
  const igreja = await prisma.church.create({
    data: { regionalId: regional.id, name: `[E2E] Igreja ${letra} ${SUFIXO}`, code: `E2E-RI${letra}-${SUFIXO}`, addressState: 'MG', isHost: true },
  })
  const membro = await prisma.member.create({
    data: {
      churchId: igreja.id, campoId: campo.id, regionalId: regional.id, fullName: `[E2E] Membro ${letra} ${SUFIXO}`, membershipStatus: 'ATIVO',
      gender: 'Masculino', birthDate: new Date(Date.UTC(1990, hoje.getMonth(), hoje.getDate())), rol: 900000 + (letra === 'A' ? 1 : 2),
      occupation: `[E2E] Profissão ${letra}`, addressState: 'MG', addressNeighborhood: `[E2E] Bairro ${letra}`, email: `e2e-rel-${letra.toLowerCase()}-${SUFIXO}@exemplo.invalid`,
    },
  })
  await prisma.$executeRawUnsafe(
    `insert into member_occurrences (id, member_id, church_id, name, message, metadata, occurred_at, created_at)
     values (gen_random_uuid(), $1::uuid, $2::uuid, $3, 'e2e', '{"tipo":"Entrada"}'::jsonb, now(), now())`,
    membro.id, igreja.id, `[E2E] Ocorrência ${letra}`)
  await prisma.livroCaixa.create({
    data: {
      churchId: igreja.id, dataLancamento: new Date(`${iso(hoje)}T12:00:00Z`), valor: letra === 'A' ? 111 : 222, tipo: 'RECEITA',
      planoDeConta: '01.200 - DIZIMOS', formaPg: 'PIX', memberId: membro.id, tipoPessoa: 'MEMBRO', favorecido: `[E2E] ${letra} ${SUFIXO}`, numLancamento: `E2E${letra}`,
    },
  })
  return { campo, regional, igreja, membro }
}

async function limpar() {
  for (const campoId of criados) {
    const igrejas = await prisma.church.findMany({ where: { regional: { campoId } }, select: { id: true } })
    const ids = igrejas.map((i) => i.id)
    await prisma.livroCaixa.deleteMany({ where: { churchId: { in: ids } } })
    await prisma.$executeRawUnsafe(`delete from member_occurrences where church_id = any($1::uuid[])`, ids)
    await prisma.member.deleteMany({ where: { churchId: { in: ids } } })
    await prisma.church.deleteMany({ where: { id: { in: ids } } })
    await prisma.regional.deleteMany({ where: { campoId } })
    await prisma.campo.delete({ where: { id: campoId } }).catch((e) => console.log('  (limpeza campo)', e.message))
  }
}

async function main() {
  console.log(`E2E relatórios de Secretaria/Tesouraria — ${SUFIXO}`)
  const A = await criarCampo('A')
  const B = await criarCampo('B')
  const marcaB = `B ${SUFIXO}`
  const marcaA = `A ${SUFIXO}`

  let total = 0, vazamentos = 0
  const viuA = new Set()
  for (const modulo of ['secretaria', 'tesouraria']) {
    for (const g of GRUPOS[modulo]) {
      for (const r of g.relatorios) {
        const pad = Object.fromEntries(g.filtros.filter((f) => f.padrao).map((f) => [f.id, f.padrao]))
        const res = await executarRelatorio(modulo, g.id, r.id, A.campo.id, { ...pad, periodo: 'mes' })
        total++
        const txt = JSON.stringify(res?.linhas ?? [])
        if (txt.includes(marcaB) || txt.includes(B.igreja.id) || txt.includes('E2E-RIB')) { vazamentos++; console.log(`FALHA vazou campo B em ${modulo} ${g.nome} | ${r.nome}`) }
        if (txt.includes(marcaA) || txt.includes('E2E-RIA')) viuA.add(`${modulo}.${g.id}`)
      }
    }
  }
  ok(vazamentos === 0, `${total} relatórios rodados no campo A, nenhum com dado do campo B`)
  for (const k of ['secretaria.igrejas', 'secretaria.pessoas', 'secretaria.aniversariantes', 'secretaria.historico_ocorrencia', 'tesouraria.livro', 'tesouraria.dizimistas', 'tesouraria.ranking']) {
    ok(viuA.has(k), `${k} enxerga o dado do campo A`)
  }
  const cruzado = await executarRelatorio('secretaria', 'pessoas', 'com_endereco', A.campo.id, { igreja: B.igreja.id, origemMembros: '1', situacao: 'todos' })
  ok(cruzado?.linhas.length === 0, 'pedir a igreja do campo B estando no campo A devolve vazio')
  const livroA = await executarRelatorio('tesouraria', 'livro', 'lista', A.campo.id, { periodo: 'mes' })
  ok(livroA?.linhas.reduce((s, l) => s + Number(l.receita), 0) === 111, 'livro do campo A soma só o lançamento de A (111,00)')
  const inexistente = await executarRelatorio('secretaria', 'pessoas', 'nao-existe', A.campo.id, {})
  ok(inexistente === null, 'relatório inexistente é recusado')
}

try {
  await main()
} catch (e) {
  falhas++
  console.error('ERRO', e)
} finally {
  if (!process.argv.includes('--keep')) await limpar()
  await prisma.$disconnect()
  console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo.')
  process.exit(falhas ? 1 : 0)
}
