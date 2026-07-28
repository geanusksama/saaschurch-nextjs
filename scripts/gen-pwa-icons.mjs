/**
 * Gera os ícones do PWA a partir de public/adcampinas.png.
 *
 * O logo original é pequeno (225x225), então ele é ampliado sobre um fundo
 * sólido escuro — o mesmo tom da home. O ícone "maskable" recebe margem extra
 * porque o Android recorta o ícone em círculo/squircle e comeria a borda.
 *
 * Uso: node scripts/gen-pwa-icons.mjs
 */
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'

const ORIGEM = 'public/adcampinas.png'
const DESTINO = 'public/icons'
// preto puro de propósito: o PNG do logo já vem com fundo preto opaco, então
// qualquer outro tom deixaria um quadrado visível no meio do ícone
const FUNDO = { r: 0, g: 0, b: 0, alpha: 1 }

/** Desenha o logo centralizado num quadrado de `lado`, ocupando `escala` dele. */
async function icone(lado, escala, saida) {
  const logo = await sharp(ORIGEM)
    .resize(Math.round(lado * escala), Math.round(lado * escala), { kernel: 'lanczos3', fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer()

  await sharp({ create: { width: lado, height: lado, channels: 4, background: FUNDO } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(`${DESTINO}/${saida}`)

  console.log(`  ✓ ${saida} (${lado}x${lado})`)
}

await mkdir(DESTINO, { recursive: true })
console.log('gerando ícones do PWA...')
await icone(192, 0.82, 'icon-192.png')
await icone(512, 0.82, 'icon-512.png')
// safe zone do maskable: o conteúdo tem de caber nos 80% centrais
await icone(512, 0.62, 'icon-maskable-512.png')
await icone(180, 0.82, 'apple-touch-icon.png')
console.log('pronto.')
