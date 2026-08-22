/**
 * Conserta os links de gráfico/relatório que ficaram quebrados no histórico do
 * chat de IA.
 *
 * A rota do chat deixava o MODELO escrever a URL do arquivo gerado, e ele
 * copiava o formato do exemplo da descrição da ferramenta em vez da URL
 * devolvida. Saíram duas deformações:
 *
 *   `[Gráfico de Batismos](/https://…supabase.co/…/grafico-8a38….svg)`
 *   `[Gráfico de Crescimento](/temp-reports/grafico-af93….svg)`
 *
 * A rota já não produz nenhuma das duas, mas as conversas gravadas continuam no
 * histórico com a imagem quebrada. Este script reescreve o alvo do link para a
 * URL real — e SÓ quando o arquivo é encontrado no Storage. Links de antes da
 * migração para o Storage apontam para arquivos que nunca chegaram a existir em
 * lugar nenhum (iam para o disco efêmero da função serverless): esses são
 * relatados e deixados como estão, porque não há o que apontar.
 *
 * Imagem vira `![…]` para o chat desenhar em vez de linkar.
 *
 * Uso:  node scripts/corrige-links-graficos-historico.mjs [--aplicar]
 * Sem --aplicar, só mostra o que faria.
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'

const APLICAR = process.argv.includes('--aplicar')
const BUCKET = 'dados'
const PASTA = 'ai-reports'
const EXT_IMAGEM = /\.(svg|png|jpe?g|gif|webp)$/i

const prisma = new PrismaClient()
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const { data: arquivos, error: erroLista } = await supabase.storage
  .from(BUCKET)
  .list(PASTA, { limit: 1000 })
if (erroLista) {
  console.error('Não consegui listar o Storage:', erroLista.message)
  process.exit(1)
}
const noStorage = new Set((arquivos ?? []).map(f => f.name))

const mensagens = await prisma.aiChatMessage.findMany({
  where: {
    role: 'assistant',
    OR: [{ content: { contains: '/temp-reports/' } }, { content: { contains: '](/http' } }],
  },
  select: { id: true, content: true },
})

let corrigidas = 0
let semArquivo = 0

for (const msg of mensagens) {
  let novo = msg.content

  novo = novo.replace(/(!?)\[([^\]]*)\]\(([^)]+)\)/g, (inteiro, bang, rotulo, alvo) => {
    const precisaConserto = alvo.startsWith('/http') || alvo.includes('/temp-reports/')
    if (!precisaConserto) return inteiro

    const nome = alvo.split('/').pop()
    if (!noStorage.has(nome)) {
      semArquivo++
      console.log(`  ${msg.id.slice(0, 8)}  SEM ARQUIVO, mantido: ${nome}`)
      return inteiro
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(`${PASTA}/${nome}`)
    const marcador = EXT_IMAGEM.test(nome) ? '!' : bang
    console.log(`  ${msg.id.slice(0, 8)}  ${alvo}\n              -> ${data.publicUrl}`)
    return `${marcador}[${rotulo}](${data.publicUrl})`
  })

  if (novo !== msg.content) {
    corrigidas++
    if (APLICAR) {
      await prisma.aiChatMessage.update({ where: { id: msg.id }, data: { content: novo } })
    }
  }
}

console.log(
  `\n${corrigidas} mensagem(ns) ${APLICAR ? 'corrigida(s)' : 'a corrigir'}; ` +
    `${semArquivo} link(s) sem arquivo no Storage, deixados intactos.`,
)
if (!APLICAR) console.log('Nada foi gravado. Rode com --aplicar para valer.')

await prisma.$disconnect()
