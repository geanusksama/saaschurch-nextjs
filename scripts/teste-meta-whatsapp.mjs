import { test } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { cifrar, decifrar } from '../src/lib/meta/cifra.ts'
import { assinaturaValida, respostaDesafio } from '../src/lib/meta/webhookSeguranca.ts'

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
  const c = cifrar('x', CHAVE); const p = c.split(':'); p[2] = '00' + p[2].slice(2)
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
