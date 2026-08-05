/**
 * Seed de demonstração do módulo Patrimônio — cria 5 bens reais e editáveis
 * numa igreja já existente, para dar pra ver a listagem, o relatório de
 * impressão e testar o fluxo de inventário de ponta a ponta.
 *
 * Não é dado fake "solto": entra pelo mesmo caminho do cadastro manual
 * (nextAssetCode + assetDataFromBody, de assetService.ts), então o código
 * sequencial e o QR saem exatamente como sairiam cadastrando pela tela.
 *
 * As fotos são placeholders (picsum.photos) — não há upload de arquivo aqui,
 * então não sobem para o bucket Supabase; troque pela foto real editando o
 * bem na tela quando quiser.
 *
 * Uso: npx tsx scripts/seed-patrimonio-demo.mjs [--church <churchId>]
 */

import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })

import { PrismaClient } from '@prisma/client'
import { nextAssetCode, assetDataFromBody } from '../src/lib/assetService.ts'

const prisma = new PrismaClient()

const argChurchIdx = process.argv.indexOf('--church')
const CHURCH_ID = argChurchIdx > -1 ? process.argv[argChurchIdx + 1] : null

const ITENS = [
  { name: 'Cadeira plástica branca', category: 'Mobiliário', sector: 'Recepção', locationType: 'DEPOSITO', locationDetail: null, acquisitionType: 'COMPRA', acquisitionDate: '2025-02-10', value: 35, photoUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Plastic_chair.jpg' },
  { name: 'Caixa de som ativa 15"', category: 'Eletrônico', sector: 'Louvor', locationType: 'NAVE', locationDetail: null, acquisitionType: 'COMPRA', acquisitionDate: '2024-11-05', value: 1800, photoUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Active_speakers01.JPG' },
  { name: 'Microfone sem fio', category: 'Eletrônico', sector: 'Louvor', locationType: 'MIDIA', locationDetail: 'Sala de som', acquisitionType: 'DOACAO', acquisitionDate: '2025-06-20', value: 450, photoUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Microphone_closeup.jpg' },
  { name: 'Mesa de escritório', category: 'Mobiliário', sector: 'Secretaria', locationType: 'SECRETARIA', locationDetail: 'Sala 2', acquisitionType: 'COMPRA', acquisitionDate: '2023-09-01', value: 620, photoUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Office_picture.jpg' },
  { name: 'Ventilador de teto', category: 'Eletrodoméstico', sector: 'Manutenção', locationType: 'COZINHA', locationDetail: null, acquisitionType: 'DOACAO', acquisitionDate: '2025-01-15', value: 220, photoUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Modern_ceiling_fan.jpg' },
]

async function main() {
  const church = CHURCH_ID
    ? await prisma.church.findUnique({ where: { id: CHURCH_ID }, select: { id: true, name: true, code: true } })
    : await prisma.church.findFirst({
        where: { deletedAt: null, name: { contains: 'BARAO GERALDO', mode: 'insensitive' } },
        select: { id: true, name: true, code: true },
      })

  if (!church) {
    console.error('Igreja não encontrada. Passe --church <id> com o UUID da igreja desejada.')
    process.exit(1)
  }

  console.log(`\n📦 Semeando 5 bens de demonstração em: ${church.code} - ${church.name}\n`)

  const criados = []
  for (const item of ITENS) {
    const code = await nextAssetCode()
    const data = assetDataFromBody(item)
    const asset = await prisma.asset.create({
      data: { ...data, acquisitionDate: data.acquisitionDate ? new Date(data.acquisitionDate) : null, photoUrl: item.photoUrl, code, churchId: church.id },
    })
    criados.push(asset)
    console.log(`  ✓ ${asset.code} — ${asset.name} (QR: ${asset.qrToken})`)
  }

  console.log(`\n${criados.length} bens criados na igreja ${church.name}.`)
  console.log('Abra /app-ui/assets, filtre por essa igreja para ver a lista, imprimir etiquetas ou iniciar um inventário.')
}

main()
  .catch((e) => { console.error('💥 erro:', e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
