/**
 * Simulação ponta a ponta da leitura de mensagens recebidas da Z-API.
 *
 * Passa pelo parser de produção (src/lib/zapiInbound.ts) os payloads exatos da
 * documentação oficial — https://developer.z-api.io/webhooks/on-message-received-examples
 * — um de cada tipo, e confere o que sobra para gravar em whatsapp_messages e
 * para a conversa exibir.
 *
 * O motivo de existir: o webhook antigo procurava `image.url`, `document.url`,
 * `video.url` e `sticker.url`, mas a Z-API envia `image.imageUrl`,
 * `document.documentUrl`, `video.videoUrl` e `sticker.stickerUrl`. Toda foto,
 * PDF, vídeo e figurinha que chegava era descartada em silêncio — a conversa no
 * sistema ficava com buracos. Este teste tranca essa porta: se alguém trocar o
 * nome do campo de volta, ele falha.
 *
 * Lógica pura, sem banco e sem rede.
 *
 * Uso: npx tsx scripts/e2e-zapi-inbound.mjs
 */

import { parseInbound } from '../src/lib/zapiInbound.ts'

let passed = 0, failed = 0
const falhas = []
function check(label, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { failed++; falhas.push(label); console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}
const step = (n, t) => console.log(`\n${'─'.repeat(70)}\n${n}. ${t}\n${'─'.repeat(70)}`)

/** Envelope comum a todo webhook de mensagem recebida. */
const envelope = (extra) => ({
  instanceId: '3C1F...',
  messageId: 'D7A1B2C3',
  phone: '5519991923889',
  fromMe: false,
  momment: 1769000000000,
  senderName: 'Gislane',
  chatName: 'Gislane',
  isGroup: false,
  type: 'ReceivedCallback',
  ...extra,
})

console.log('\n📥 E2E — leitura das mensagens recebidas da Z-API\n')

// ── 1. Texto ──
step(1, 'Texto simples')
const texto = parseInbound(envelope({ text: { message: 'Amém 🙏' } }))
check('tipo text', texto.type === 'text')
check('conteúdo preservado', texto.content === 'Amém 🙏')
check('prévia é o próprio texto', texto.preview === 'Amém 🙏')

// ── 2. Imagem (o caso que estava quebrado) ──
step(2, 'Imagem — a doc usa imageUrl, não url')
const imagem = parseInbound(envelope({
  image: {
    mimeType: 'image/jpeg',
    imageUrl: 'https://cdn.z-api.io/foto.jpg',
    thumbnailUrl: 'https://cdn.z-api.io/thumb.jpg',
    downloadError: null,
    caption: 'Foto do culto',
    width: 600,
    height: 315,
    viewOnce: false,
  },
}))
check('tipo image', imagem.type === 'image', imagem.type)
check('pega imageUrl', imagem.mediaUrl === 'https://cdn.z-api.io/foto.jpg', imagem.mediaUrl ?? 'null')
check('legenda vira conteúdo', imagem.content === 'Foto do culto')
check('mime preservado', imagem.mediaMime === 'image/jpeg')
check('prévia com ícone', imagem.preview === '📷 Foto do culto', imagem.preview)
check('thumbnail guardado', imagem.extra.thumbnailUrl === 'https://cdn.z-api.io/thumb.jpg')

const imagemAntiga = parseInbound(envelope({ image: { url: 'https://antigo/f.jpg' } }))
check('payload antigo com url ainda funciona', imagemAntiga.mediaUrl === 'https://antigo/f.jpg')
check('imagem sem legenda tem prévia padrão', imagemAntiga.preview === '📷 Foto', imagemAntiga.preview)

// ── 3. Documento ──
step(3, 'Documento — documentUrl e fileName')
const doc = parseInbound(envelope({
  document: {
    documentUrl: 'https://cdn.z-api.io/ficha.pdf',
    mimeType: 'application/pdf',
    title: 'ficha',
    pageCount: 3,
    fileName: 'ficha-de-membro.pdf',
  },
}))
check('tipo document', doc.type === 'document', doc.type)
check('pega documentUrl', doc.mediaUrl === 'https://cdn.z-api.io/ficha.pdf')
check('nome do arquivo guardado', doc.extra.fileName === 'ficha-de-membro.pdf')
check('prévia mostra o arquivo', doc.preview === '📄 ficha-de-membro.pdf', doc.preview)
check('páginas guardadas', doc.extra.pageCount === 3)

// ── 4. Áudio ──
step(4, 'Áudio — mensagem de voz (ptt) e áudio comum')
const voz = parseInbound(envelope({
  audio: { ptt: true, seconds: 10, audioUrl: 'https://cdn.z-api.io/voz.ogg', mimeType: 'audio/ogg; codecs=opus' },
}))
check('tipo audio', voz.type === 'audio')
check('pega audioUrl', voz.mediaUrl === 'https://cdn.z-api.io/voz.ogg')
check('marca como mensagem de voz', voz.extra.ptt === true)
check('duração guardada', voz.extra.seconds === 10)
check('prévia de voz', voz.preview === '🎤 Mensagem de voz', voz.preview)

const audioAntigo = parseInbound(envelope({ ptt: { url: 'https://antigo/v.ogg' } }))
check('ptt fora do objeto audio ainda funciona', audioAntigo.mediaUrl === 'https://antigo/v.ogg')

// ── 5. Vídeo e figurinha ──
step(5, 'Vídeo e figurinha')
const video = parseInbound(envelope({
  video: { videoUrl: 'https://cdn.z-api.io/v.mp4', caption: 'Testemunho', mimeType: 'video/mp4', seconds: 42 },
}))
check('tipo video', video.type === 'video')
check('pega videoUrl', video.mediaUrl === 'https://cdn.z-api.io/v.mp4')
check('legenda preservada', video.content === 'Testemunho')

const figurinha = parseInbound(envelope({ sticker: { stickerUrl: 'https://cdn.z-api.io/s.webp', mimeType: 'image/webp' } }))
check('tipo sticker', figurinha.type === 'sticker')
check('pega stickerUrl', figurinha.mediaUrl === 'https://cdn.z-api.io/s.webp')

// ── 6. Localização ──
step(6, 'Localização')
const local = parseInbound(envelope({
  location: { longitude: -47.0616, latitude: -22.9056, address: 'Av. Brasil, 100 — Campinas', url: '' },
}))
check('tipo location', local.type === 'location', local.type)
check('endereço no conteúdo', local.content === 'Av. Brasil, 100 — Campinas')
check('coordenadas guardadas', local.extra.latitude === -22.9056 && local.extra.longitude === -47.0616)
check('monta link do mapa quando a Z-API não manda',
  String(local.extra.mapUrl).includes('google.com/maps?q=-22.9056,-47.0616'), String(local.extra.mapUrl))

// ── 7. Contato compartilhado ──
step(7, 'Contato compartilhado')
const contato = parseInbound(envelope({
  contact: { displayName: 'Pastor João', vCard: 'BEGIN:VCARD...', phones: ['5519999990000'] },
}))
check('tipo contact', contato.type === 'contact')
check('nome e telefone no conteúdo', contato.content === 'Pastor João · 5519999990000', contato.content ?? '')
check('vCard guardado', typeof contato.extra.vCard === 'string')

// ── 8. Resposta de botão e de lista ──
step(8, 'Resposta de botão e de lista — o que o fluxo automatizado precisa ler')
const botao = parseInbound(envelope({ buttonsResponseMessage: { buttonId: '1', message: 'Quero participar' } }))
check('tipo button_reply', botao.type === 'button_reply', botao.type)
check('escolha vira conteúdo', botao.content === 'Quero participar')
check('id do botão guardado', botao.extra.buttonId === '1')
check('prévia com ícone de botão', botao.preview === '🔘 Quero participar', botao.preview)

const lista = parseInbound(envelope({
  listResponseMessage: { title: 'Culto de quarta', message: 'Vou nesse', selectedRowId: 'row_2' },
}))
check('tipo list_reply', lista.type === 'list_reply', lista.type)
check('linha escolhida guardada', lista.extra.selectedRowId === 'row_2')
check('prévia com o título', lista.preview === '📋 Culto de quarta', lista.preview)

// ── 9. Reação, enquete e voto ──
step(9, 'Reação, enquete e voto')
const reacao = parseInbound(envelope({
  reaction: { value: '❤️', reactionBy: '5519991923889', referencedMessage: { messageId: 'ABC123' } },
}))
check('tipo reaction', reacao.type === 'reaction')
check('emoji no conteúdo', reacao.content === '❤️')
check('mensagem reagida guardada', reacao.extra.referencedMessageId === 'ABC123')

const enquete = parseInbound(envelope({
  poll: { question: 'Vai ao culto de quarta?', options: [{ name: 'Sim' }, { name: 'Não' }] },
}))
check('tipo poll', enquete.type === 'poll')
check('opções extraídas', JSON.stringify(enquete.extra.options) === '["Sim","Não"]', String(enquete.extra.options))

const voto = parseInbound(envelope({ pollVote: { pollMessageId: 'P1', options: [{ name: 'Sim' }] } }))
check('tipo poll_vote', voto.type === 'poll_vote')
check('voto no conteúdo', voto.content === 'Sim')

// ── 10. Resposta a uma mensagem (citação) ──
step(10, 'Citação: responder uma mensagem anterior')
const citacao = parseInbound(envelope({
  text: { message: 'Isso mesmo!' },
  referenceMessageId: 'MSG_ANTERIOR_1',
}))
check('id da mensagem citada guardado', citacao.extra.referenceMessageId === 'MSG_ANTERIOR_1')

// ── 11. Tipo desconhecido não some ──
step(11, 'Tipo que ainda não sabemos exibir')
const desconhecido = parseInbound(envelope({ type: 'ReceivedCallback', novidadeDaZApi: { x: 1 } }))
check('vira unsupported em vez de sumir', desconhecido.type === 'unsupported', desconhecido.type)
check('prévia explica o que houve', desconhecido.preview.includes('não suportada'), desconhecido.preview)

// ── 12. Nenhum tipo perde a prévia ──
step(12, 'Toda mensagem tem prévia para a lista de conversas')
const todos = [texto, imagem, doc, voz, video, figurinha, local, contato, botao, lista, reacao, enquete, voto, desconhecido]
check('nenhuma prévia vazia', todos.every(m => m.preview && m.preview.trim().length > 0),
  `${todos.length} tipos verificados`)
check('nenhuma prévia crua tipo "[object Object]"',
  todos.every(m => !m.preview.includes('[object')))

console.log(`\n${'═'.repeat(70)}`)
console.log(`RESULTADO: ${passed} passaram · ${failed} falharam`)
if (failed) console.log(`Falhas: ${falhas.join(' | ')}`)
console.log('═'.repeat(70))
process.exit(failed ? 1 : 0)
