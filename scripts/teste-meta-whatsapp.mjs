import { test } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { cifrar, decifrar } from '../src/lib/meta/cifra.ts'
import { assinaturaValida, respostaDesafio } from '../src/lib/meta/webhookSeguranca.ts'
import { criarGraph, ErroGraph } from '../src/lib/meta/graph.ts'
import { trocarCodigo, registrarNumero, assinarWebhookDaConta, lerStatusNumero, gerarPin } from '../src/lib/meta/conexaoMeta.ts'

const CHAVE = 'a'.repeat(64)

test('cifra e decifra o token', () => {
  const c = cifrar('EAAG-token', CHAVE)
  assert.notEqual(c, 'EAAG-token')
  assert.equal(decifrar(c, CHAVE), 'EAAG-token')
})
test('chave inválida lança erro claro', () => {
  assert.throws(() => cifrar('x', 'curta'), /META_TOKEN_ENCRYPTION_KEY inválida/)
})
test('cifrado adulterado lança', () => {
  const c = cifrar('x', CHAVE); const p = c.split(':'); p[2] = (parseInt(p[2].slice(0, 2), 16) ^ 0xff).toString(16).padStart(2, '0') + p[2].slice(2)
  assert.throws(() => decifrar(p.join(':'), CHAVE))
})
test('assinatura do webhook', () => {
  const corpo = '{"a":1}'
  const sig = 'sha256=' + crypto.createHmac('sha256', 'segredo').update(corpo).digest('hex')
  assert.equal(assinaturaValida(corpo, sig, 'segredo'), true)
  assert.equal(assinaturaValida(corpo, sig, 'outro'), false)
  assert.equal(assinaturaValida(corpo, null, 'segredo'), false)
  assert.equal(assinaturaValida(corpo, 'sha256=abc', 'segredo'), false)
})
test('desafio de verificação', () => {
  const ok = new URLSearchParams({ 'hub.mode': 'subscribe', 'hub.verify_token': 'vt', 'hub.challenge': '123' })
  assert.equal(respostaDesafio(ok, 'vt'), '123')
  assert.equal(respostaDesafio(ok, 'errado'), null)
})
test('desafio: null sem subscribe ou sem challenge', () => {
  const modoErrado = new URLSearchParams({ 'hub.mode': 'unsubscribe', 'hub.verify_token': 'vt', 'hub.challenge': '1' })
  assert.equal(respostaDesafio(modoErrado, 'vt'), null)
  const semChallenge = new URLSearchParams({ 'hub.mode': 'subscribe', 'hub.verify_token': 'vt' })
  assert.equal(respostaDesafio(semChallenge, 'vt'), null)
})
test('decifrar rejeita formato com menos de 3 partes e chave diferente', () => {
  assert.throws(() => decifrar('aa:bb', CHAVE), /Formato de cifrado inválido/)
  assert.throws(() => decifrar(cifrar('x', CHAVE), 'b'.repeat(64)))
})

function fetchFalso(respostas) {
  const chamadas = []
  const f = async (url, init) => { chamadas.push({ url, init }); const r = respostas.shift(); return new Response(JSON.stringify(r.body), { status: r.status ?? 200 }) }
  return { f, chamadas }
}

test('troca o código pelo token', async () => {
  const { f, chamadas } = fetchFalso([{ body: { access_token: 'TK' } }])
  const g = criarGraph({ versao: 'v27.0', fetch: f })
  assert.equal(await trocarCodigo(g, { appId: '1', appSecret: 's', code: 'C' }), 'TK')
  assert.match(chamadas[0].url, /^https:\/\/graph\.facebook\.com\/v27\.0\/oauth\/access_token\?/)
  assert.match(chamadas[0].url, /code=C/)
})
test('assina o webhook com override por conta', async () => {
  const { f, chamadas } = fetchFalso([{ body: { success: true } }])
  await assinarWebhookDaConta(criarGraph({ versao: 'v27.0', fetch: f }), 'TK', 'W1', { callbackUrl: 'https://igreja/api/meta/whatsapp/webhook', verifyToken: 'vt' })
  assert.match(chamadas[0].url, /\/W1\/subscribed_apps$/)
  assert.deepEqual(JSON.parse(chamadas[0].init.body), { override_callback_uri: 'https://igreja/api/meta/whatsapp/webhook', verify_token: 'vt' })
  assert.equal(chamadas[0].init.headers.Authorization, 'Bearer TK')
  assert.equal(chamadas[0].init.headers['Content-Type'], 'application/json')
  assert.doesNotMatch(chamadas[0].url, /TK/)
})
test('registra o número com pin', async () => {
  const { f, chamadas } = fetchFalso([{ body: { success: true } }])
  await registrarNumero(criarGraph({ versao: 'v27.0', fetch: f }), 'TK', 'P1', '123456')
  assert.match(chamadas[0].url, /\/P1\/register$/)
  assert.deepEqual(JSON.parse(chamadas[0].init.body), { messaging_product: 'whatsapp', pin: '123456' })
})
test('lê o status do número', async () => {
  const { f, chamadas } = fetchFalso([{ body: { display_phone_number: '+55 11 9', verified_name: 'Igreja', quality_rating: 'GREEN', status: 'CONNECTED', whatsapp_business_manager_messaging_limit: 'TIER_1K' } }, { body: { display_phone_number: '1', verified_name: 'N', quality_rating: 'XYZ', status: 'PENDING' } }])
  const g = criarGraph({ versao: 'v27.0', fetch: f })
  assert.deepEqual(await lerStatusNumero(g, 'TK', 'P1'), { numero: '+55 11 9', nomeExibicao: 'Igreja', qualidade: 'GREEN', status: 'CONNECTED', limiteDiario: 'TIER_1K' })
  assert.match(chamadas[0].url, /\/P1\?fields=/)
  const s2 = await lerStatusNumero(g, 'TK', 'P1')
  assert.equal(s2.qualidade, 'UNKNOWN')
  assert.equal(s2.limiteDiario, null)
})
test('token inválido vira ErroGraph.tokenInvalido', async () => {
  const { f } = fetchFalso([{ status: 401, body: { error: { message: 'expired', code: 190 } } }])
  await assert.rejects(lerStatusNumero(criarGraph({ versao: 'v27.0', fetch: f }), 'TK', 'P1'), (e) => e instanceof ErroGraph && e.tokenInvalido && e.status === 401 && e.codigo === 190 && e.message === 'expired')
})
test('pin tem 6 dígitos', () => { assert.match(gerarPin(), /^\d{6}$/) })
