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
test('lê o status do número (limite em chamada separada)', async () => {
  const { f, chamadas } = fetchFalso([
    { body: { display_phone_number: '+55 11 9', verified_name: 'Igreja', quality_rating: 'GREEN', status: 'CONNECTED' } },
    { body: { whatsapp_business_manager_messaging_limit: 'TIER_250' } },
    { body: { display_phone_number: '1', verified_name: 'N', quality_rating: 'NA', status: 'PENDING' } },
    { body: {} },
  ])
  const g = criarGraph({ versao: 'v27.0', fetch: f })
  assert.deepEqual(await lerStatusNumero(g, 'TK', 'P1'), { numero: '+55 11 9', nomeExibicao: 'Igreja', qualidade: 'GREEN', status: 'CONNECTED', limiteDiario: 'TIER_250' })
  assert.match(chamadas[0].url, /\/P1\?fields=display_phone_number/)
  assert.match(chamadas[1].url, /fields=whatsapp_business_manager_messaging_limit$/)
  const s2 = await lerStatusNumero(g, 'TK', 'P1')
  assert.equal(s2.qualidade, 'UNKNOWN')
  assert.equal(s2.limiteDiario, null)
})
test('limite rejeitado (código 100) não derruba o status', async () => {
  const { f } = fetchFalso([
    { body: { display_phone_number: '1', verified_name: 'N', quality_rating: 'RED', status: 'CONNECTED' } },
    { status: 400, body: { error: { message: 'bad field', code: 100 } } },
  ])
  const s = await lerStatusNumero(criarGraph({ versao: 'v27.0', fetch: f }), 'TK', 'P1')
  assert.equal(s.qualidade, 'RED'); assert.equal(s.limiteDiario, null)
})
test('limite com token inválido (190) propaga', async () => {
  const { f } = fetchFalso([
    { body: { display_phone_number: '1', verified_name: 'N', quality_rating: 'RED', status: 'CONNECTED' } },
    { status: 401, body: { error: { message: 'expired', code: 190 } } },
  ])
  await assert.rejects(lerStatusNumero(criarGraph({ versao: 'v27.0', fetch: f }), 'TK', 'P1'), (e) => e instanceof ErroGraph && e.tokenInvalido)
})
test('trocarCodigo sem access_token lança', async () => {
  const { f } = fetchFalso([{ body: { foo: 1 } }])
  await assert.rejects(trocarCodigo(criarGraph({ versao: 'v27.0', fetch: f }), { appId: '1', appSecret: 's', code: 'C' }), /sem access_token/)
})
test('200 com corpo não-JSON vira ErroGraph', async () => {
  const f = async () => new Response('<html>ops</html>', { status: 200 })
  await assert.rejects(trocarCodigo(criarGraph({ versao: 'v27.0', fetch: f }), { appId: '1', appSecret: 's', code: 'C' }), (e) => e instanceof ErroGraph && e.status === 200)
})
test('fetch recebe signal de timeout', async () => {
  const { f, chamadas } = fetchFalso([{ body: { success: true } }])
  await registrarNumero(criarGraph({ versao: 'v27.0', fetch: f }), 'TK', 'P1', '123456')
  assert.ok(chamadas[0].init.signal instanceof AbortSignal)
})
test('token inválido vira ErroGraph.tokenInvalido', async () => {
  const { f } = fetchFalso([{ status: 401, body: { error: { message: 'expired', code: 190 } } }])
  await assert.rejects(lerStatusNumero(criarGraph({ versao: 'v27.0', fetch: f }), 'TK', 'P1'), (e) => e instanceof ErroGraph && e.tokenInvalido && e.status === 401 && e.codigo === 190 && e.message === 'expired')
})
test('pin tem 6 dígitos', () => { assert.match(gerarPin(), /^\d{6}$/) })

// ---- Serviço de conexão (Task 4) ----
import { validarBaseUrl, ErroConfigMeta } from '../src/lib/meta/configMeta.ts'
import { cancelarAssinaturaWebhook } from '../src/lib/meta/conexaoMeta.ts'
import { obterStatus, conectar, desconectar, ErroServico } from '../src/lib/meta/servicoConexao.ts'

function fakeDeps(over = {}) {
  const chamadas = []
  const reg = { salvos: [], erros: [], desconectados: [] }
  const config = { appId: 'app', appSecret: 'seg', configId: 'c', verifyToken: 'vt', chaveCifra: CHAVE, graphVersion: 'v27.0', callbackBaseUrl: 'https://fixo.exemplo' }
  const deps = {
    config,
    graph: {},
    cifra: { cifrar, decifrar },
    repo: {
      conexao: null, porPhone: null,
      async buscarConexaoDoCampo() { return this.conexao },
      async buscarPorPhoneNumberId() { return this.porPhone },
      async salvarConexao(d) { reg.salvos.push(d) },
      async marcarErro(c, m) { reg.erros.push([c, m]) },
      async desconectar(c) { reg.desconectados.push(c) },
    },
    meta: {
      async trocarCodigo() { chamadas.push('troca'); return 'TOKEN123' },
      async registrarNumero() { chamadas.push('registra') },
      async assinarWebhookDaConta(g, t, w, d) { chamadas.push(['assina', w, d]) },
      async lerStatusNumero() { chamadas.push('status'); return { numero: '+55 11', nomeExibicao: 'Igreja', qualidade: 'GREEN', status: 'CONNECTED', limiteDiario: 'TIER_250' } },
      async cancelarAssinaturaWebhook(g, t, w) { chamadas.push(['cancela', t, w]) },
      gerarPin: () => '123456',
    },
    ...over,
  }
  return { deps, chamadas, reg }
}

test('conectar: duplicado em outro campo ⇒ 409 antes de qualquer chamada à Meta', async () => {
  const { deps, chamadas } = fakeDeps()
  deps.repo.porPhone = { campoId: 'outro' }
  await assert.rejects(conectar(deps, { campoId: 'c1', userId: 'u', code: 'x', wabaId: 'w', phoneNumberId: 'p', origin: 'http://h' }),
    (e) => e instanceof ErroServico && e.status === 409)
  assert.deepEqual(chamadas, [])
})

test('conectar: sucesso grava token+PIN cifrados e assina o webhook com a origin', async () => {
  const { deps, chamadas, reg } = fakeDeps()
  const r = await conectar(deps, { campoId: 'c1', userId: 'u', code: 'x', wabaId: 'w', phoneNumberId: 'p', origin: 'https://atacante.exemplo' })
  assert.equal(reg.salvos.length, 1)
  assert.equal(decifrar(reg.salvos[0].tokenCifrado, CHAVE), 'TOKEN123')
  assert.equal(decifrar(reg.salvos[0].pinCifrado, CHAVE), '123456')
  const assina = chamadas.find((c) => Array.isArray(c))
  assert.equal(assina[2].callbackUrl, 'https://fixo.exemplo/api/meta/whatsapp/webhook')
  assert.equal(assina[2].verifyToken, 'vt')
  assert.equal(r.status, 'conectado')
  assert.ok(!JSON.stringify(r).includes('TOKEN123') && !JSON.stringify(r).includes('123456'))
})

test('conectar: campos faltando ⇒ 400', async () => {
  const { deps } = fakeDeps()
  await assert.rejects(conectar(deps, { campoId: 'c1', userId: 'u', code: '', wabaId: 'w', phoneNumberId: 'p', origin: 'h' }),
    (e) => e.status === 400)
})

test('conectar: timeout da Graph ⇒ 504', async () => {
  const { deps } = fakeDeps()
  deps.meta.trocarCodigo = async () => { const e = new Error('t'); e.name = 'TimeoutError'; throw e }
  await assert.rejects(conectar(deps, { campoId: 'c1', userId: 'u', code: 'x', wabaId: 'w', phoneNumberId: 'p', origin: 'h' }),
    (e) => e instanceof ErroServico && e.status === 504)
})

test('obterStatus: sem conexão ⇒ conectado false', async () => {
  const { deps } = fakeDeps()
  assert.deepEqual(await obterStatus(deps, 'c1'), { conectado: false })
})

test('obterStatus: tokenCifrado corrompido ⇒ status erro, não lança, sem token', async () => {
  const { deps, reg } = fakeDeps()
  deps.repo.conexao = { campoId: 'c1', wabaId: 'w', phoneNumberId: 'p', numero: '1', nomeExibicao: 'n', tokenCifrado: 'lixo', pinCifrado: 'pin-secreto', status: 'conectado', ultimoErro: null }
  const r = await obterStatus(deps, 'c1')
  assert.equal(r.status, 'erro')
  assert.match(r.ultimoErro, /Reconecte/)
  assert.equal(reg.erros.length, 1)
  assert.ok(!JSON.stringify(r).includes('lixo') && !JSON.stringify(r).includes('pin-secreto'))
})

test('obterStatus: token recusado pela Meta ⇒ marcarErro + status erro', async () => {
  const { deps, reg } = fakeDeps()
  deps.repo.conexao = { campoId: 'c1', wabaId: 'w', phoneNumberId: 'p', numero: '1', nomeExibicao: 'n', tokenCifrado: cifrar('T', CHAVE), pinCifrado: 'x', status: 'conectado', ultimoErro: null }
  deps.meta.lerStatusNumero = async () => { throw new ErroGraph('expirou', 401, 190) }
  const r = await obterStatus(deps, 'c1')
  assert.equal(r.status, 'erro')
  assert.equal(r.ultimoErro, 'Token recusado pela Meta. Reconecte o número.')
  assert.deepEqual(reg.erros, [['c1', 'Token recusado pela Meta. Reconecte o número.']])
})

test('obterStatus: timeout ⇒ 504', async () => {
  const { deps } = fakeDeps()
  deps.repo.conexao = { campoId: 'c1', wabaId: 'w', phoneNumberId: 'p', numero: '1', nomeExibicao: 'n', tokenCifrado: cifrar('T', CHAVE), pinCifrado: 'x', status: 'conectado', ultimoErro: null }
  deps.meta.lerStatusNumero = async () => { const e = new Error('a'); e.name = 'AbortError'; throw e }
  await assert.rejects(obterStatus(deps, 'c1'), (e) => e.status === 504)
})

test('obterStatus: sucesso traz qualidade e limite da Meta', async () => {
  const { deps } = fakeDeps()
  deps.repo.conexao = { campoId: 'c1', wabaId: 'w', phoneNumberId: 'p', numero: '1', nomeExibicao: 'n', tokenCifrado: cifrar('T', CHAVE), pinCifrado: 'x', status: 'conectado', ultimoErro: null }
  const r = await obterStatus(deps, 'c1')
  assert.equal(r.qualidade, 'GREEN'); assert.equal(r.limiteDiario, 'TIER_250')
})

test('desconectar (antigo)', async () => {
  const { deps, reg } = fakeDeps()
  assert.deepEqual(await desconectar(deps, 'c1'), { conectado: false })
  assert.deepEqual(reg.desconectados, ['c1'])
})

test('base do callback: https ok, localhost http ok, http público rejeitado', () => {
  assert.equal(validarBaseUrl('https://app.igreja.com/'), 'https://app.igreja.com')
  assert.equal(validarBaseUrl('http://localhost:3000'), 'http://localhost:3000')
  assert.equal(validarBaseUrl('http://127.0.0.1:3000'), 'http://127.0.0.1:3000')
  assert.throws(() => validarBaseUrl('http://app.igreja.com'), ErroConfigMeta)
  assert.throws(() => validarBaseUrl('lixo'), ErroConfigMeta)
})

test('cancelarAssinaturaWebhook chama DELETE /<waba>/subscribed_apps com o token', async () => {
  const vistos = []
  const graph = { delete: async (c, t) => { vistos.push([c, t]); return {} } }
  await cancelarAssinaturaWebhook(graph, 'TK', 'waba9')
  assert.deepEqual(vistos, [['waba9/subscribed_apps', 'TK']])
})

const conexaoSalva = (token) => ({ campoId: 'c1', wabaId: 'wX', phoneNumberId: 'p', numero: '1', nomeExibicao: 'n', tokenCifrado: token, pinCifrado: 'x', status: 'conectado', ultimoErro: null })

test('desconectar cancela a assinatura na Meta e apaga local', async () => {
  const { deps, chamadas, reg } = fakeDeps()
  deps.repo.conexao = conexaoSalva(cifrar('TOK', CHAVE))
  await desconectar(deps, 'c1')
  assert.deepEqual(chamadas, [['cancela', 'TOK', 'wX']])
  assert.deepEqual(reg.desconectados, ['c1'])
})

test('desconectar: falha da Graph ainda apaga local', async () => {
  const { deps, reg } = fakeDeps()
  deps.repo.conexao = conexaoSalva(cifrar('TOK', CHAVE))
  deps.meta.cancelarAssinaturaWebhook = async () => { throw new ErroGraph('x', 500, null) }
  assert.deepEqual(await desconectar(deps, 'c1'), { conectado: false })
  assert.deepEqual(reg.desconectados, ['c1'])
})

test('desconectar: token corrompido ainda apaga local', async () => {
  const { deps, reg } = fakeDeps()
  deps.repo.conexao = conexaoSalva('lixo')
  await desconectar(deps, 'c1')
  assert.deepEqual(reg.desconectados, ['c1'])
})
