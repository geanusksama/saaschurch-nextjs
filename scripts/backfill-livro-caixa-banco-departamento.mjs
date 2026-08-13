/**
 * Carimba banco e departamento PADRÃO nos lançamentos históricos do Livro Caixa.
 *
 * Por que isso é um script manual e não parte da migration: os 331 mil
 * lançamentos anteriores ao cadastro de bancos/departamentos foram feitos sem
 * essa classificação. Preenchê-los automaticamente com um valor padrão seria
 * afirmar que a igreja escolheu aquele banco e aquele departamento na época —
 * o que não aconteceu. Em prestação de contas, um "Não informado" honesto vale
 * mais que um número inventado.
 *
 * Se a tesouraria decidir que "tudo o que é antigo é Caixa/Geral", este script
 * aplica essa decisão. É escolha dela, não do sistema.
 *
 * Uso:
 *   node scripts/backfill-livro-caixa-banco-departamento.mjs              # dry-run (padrão)
 *   node scripts/backfill-livro-caixa-banco-departamento.mjs --aplicar    # grava
 *   node scripts/backfill-livro-caixa-banco-departamento.mjs --aplicar --ate 2026-01-01
 *   node scripts/backfill-livro-caixa-banco-departamento.mjs --aplicar --church <uuid>
 *
 * Só toca em linhas com banco_id/departamento_id NULOS — rodar duas vezes não
 * sobrescreve nada que já foi classificado à mão.
 */

import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const argv = process.argv.slice(2)
const APLICAR = argv.includes('--aplicar')
const arg = (nome) => {
  const i = argv.indexOf(nome)
  return i >= 0 ? argv[i + 1] : null
}
const ATE = arg('--ate')
const CHURCH = arg('--church')
const LOTE = 5000

async function main() {
  const banco = await prisma.banco.findFirst({ where: { isDefault: true, ativo: true } })
  const departamento = await prisma.departamento.findFirst({ where: { isDefault: true, ativo: true } })

  if (!banco && !departamento) {
    console.error('✗ Nenhum banco nem departamento marcado como padrão. Marque um em Configurações antes de rodar.')
    process.exit(1)
  }

  console.log(`\nBanco padrão .......: ${banco ? banco.nome : '(nenhum — banco_id não será tocado)'}`)
  console.log(`Departamento padrão : ${departamento ? departamento.nome : '(nenhum — departamento_id não será tocado)'}`)
  if (ATE) console.log(`Somente lançamentos até: ${ATE}`)
  if (CHURCH) console.log(`Somente a igreja: ${CHURCH}`)

  const where = {
    OR: [
      ...(banco ? [{ bancoId: null }] : []),
      ...(departamento ? [{ departamentoId: null }] : []),
    ],
    ...(ATE ? { dataLancamento: { lte: new Date(`${ATE}T00:00:00Z`) } } : {}),
    ...(CHURCH ? { churchId: CHURCH } : {}),
  }

  const total = await prisma.livroCaixa.count({ where })
  console.log(`\nLançamentos sem classificação no recorte: ${total.toLocaleString('pt-BR')}`)

  if (!APLICAR) {
    console.log('\n🔍 DRY-RUN — nada foi gravado. Rode com --aplicar para efetivar.')
    return
  }

  console.log('\nAplicando em lotes...')
  let feitos = 0
  // Em lotes para não segurar uma transação gigante em cima de uma tabela viva.
  for (;;) {
    const lote = await prisma.livroCaixa.findMany({ where, select: { id: true }, take: LOTE })
    if (!lote.length) break

    const r = await prisma.livroCaixa.updateMany({
      where: { id: { in: lote.map((l) => l.id) } },
      data: {
        ...(banco ? { bancoId: banco.id } : {}),
        ...(departamento ? { departamentoId: departamento.id } : {}),
      },
    })
    feitos += r.count
    process.stdout.write(`\r  ${feitos.toLocaleString('pt-BR')} / ${total.toLocaleString('pt-BR')}`)
    if (r.count === 0) break // trava de segurança contra laço infinito
  }
  console.log(`\n\n✔ ${feitos.toLocaleString('pt-BR')} lançamentos classificados.`)
}

main()
  .catch((e) => { console.error('\n💥', e.message); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
