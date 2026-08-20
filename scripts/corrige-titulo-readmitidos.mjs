/**
 * Corrige o título eclesiástico de quem foi readmitido ANTES da restauração
 * automática existir e por isso ficou com o título errado.
 *
 * Contexto: até 13/08/2026 a matriz de decisão só aplicava título fixo, então a
 * readmissão devolvia o membro como CONGREGADO/MEMBRO mesmo que ele já tivesse
 * sido pastor. A correção do fluxo está em src/lib/tituloEclesiasticoHistorico.ts;
 * este script conserta os registros que passaram pelo caminho antigo.
 *
 * Usa o MESMO resolvedor da aplicação — não tem regra própria. E grava um
 * registro em member_title_history com `source = CORRECAO_READMISSAO`, para a
 * mudança não aparecer do nada numa conferência da secretaria.
 *
 * Uso:
 *   node scripts/corrige-titulo-readmitidos.mjs --rol 9091 --rol 9092            # mostra
 *   node scripts/corrige-titulo-readmitidos.mjs --rol 9091 --rol 9092 --aplicar  # grava
 */

import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })

import { PrismaClient } from '@prisma/client'
import { ultimoTituloDoHistorico } from '../src/lib/tituloEclesiasticoHistorico.ts'

const prisma = new PrismaClient()
const argv = process.argv.slice(2)
const APLICAR = argv.includes('--aplicar')

const rols = argv.reduce((acc, a, i) => {
  if (a === '--rol' && argv[i + 1]) acc.push(Number(argv[i + 1]))
  return acc
}, [])

async function main() {
  if (!rols.length) {
    console.error('Informe ao menos um --rol. Ex: --rol 9091 --rol 9092')
    process.exitCode = 1
    return
  }

  console.log(`\n${APLICAR ? '✏️  APLICANDO' : '🔍 SIMULAÇÃO (use --aplicar para gravar)'}\n`)

  for (const rol of rols) {
    const membro = await prisma.member.findFirst({
      where: { rol, deletedAt: null },
      select: {
        id: true, fullName: true, churchId: true, gender: true,
        ecclesiasticalTitle: true, ecclesiasticalTitleId: true,
        addressCity: true, addressState: true, nationality: true,
      },
    })
    if (!membro) {
      console.log(`ROL ${rol}: membro não encontrado.\n`)
      continue
    }

    const alvo = await ultimoTituloDoHistorico(prisma, membro.id)
    console.log(`${membro.fullName} (ROL ${rol}, ${membro.gender ?? 'sexo não informado'})`)
    console.log(`  atual .....: ${membro.ecclesiasticalTitle ?? '(vazio)'}`)

    if (!alvo) {
      console.log('  → sem título reconhecível no histórico; nada a fazer.\n')
      continue
    }
    console.log(`  último ....: ${alvo.nome} (registrado em ${alvo.quando ? new Date(alvo.quando).toLocaleDateString('pt-BR') : 'data não informada'})`)

    if (membro.ecclesiasticalTitle === alvo.nome) {
      console.log('  → já está correto; nada a fazer.\n')
      continue
    }

    if (!APLICAR) {
      console.log(`  → mudaria de ${membro.ecclesiasticalTitle ?? '(vazio)'} para ${alvo.nome}\n`)
      continue
    }

    // Cadastro e histórico na mesma transação: um sem o outro deixaria a
    // mudança sem rastro ou um rastro sem a mudança.
    await prisma.$transaction(async (tx) => {
      await tx.member.update({
        where: { id: membro.id },
        data: { ecclesiasticalTitle: alvo.nome, ecclesiasticalTitleId: alvo.id },
      })
      await tx.memberTitleHistory.create({
        data: {
          memberId: membro.id,
          churchId: membro.churchId,
          previousTitle: membro.ecclesiasticalTitle ?? null,
          newTitle: alvo.nome,
          source: 'CORRECAO_READMISSAO',
          serviceGroup: 'REQUERIMENTO',
          serviceName: 'Readmissão — correção de título',
          memberCity: membro.addressCity ?? null,
          memberState: membro.addressState ?? null,
          memberCountry: membro.nationality ?? null,
          notes: `Título restaurado do histórico (${alvo.nome}). A readmissão anterior aplicou "${membro.ecclesiasticalTitle ?? 'vazio'}" porque a matriz só usava título fixo.`,
        },
      })
    })
    console.log(`  ✔ corrigido: ${membro.ecclesiasticalTitle ?? '(vazio)'} → ${alvo.nome}\n`)
  }
}

main()
  .catch((e) => { console.error('\n💥', e.message || e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
