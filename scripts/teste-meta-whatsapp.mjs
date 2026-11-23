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
  const config = { appId: 'app', appSecret: 'seg', configId: 'c', verifyToken: 'vt', chaveCifra: CHAVE, graphVersion: 'v27.0', callbackBaseUrl: 'https://fixo.exemplo', conexaoLiberada: true }
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

// ── Task 8: configuração central ──────────────────────────────────────────
import { criarConfigCentral, mesclarComEnv, visaoPublica, validarAtualizacao, TTL_CACHE_MS, LIMITE_VENCIDO_MS, PAUSA_APOS_FALHA_MS } from '../src/lib/meta/configCentral.ts'
import { MSG_NAO_LIBERADA } from '../src/lib/meta/servicoConexao.ts'

const LINHA = { appId: 'APP', esConfigId: 'CFG', graphVersion: 'v25.0', webhookVerifyToken: 'VT', appSecretCifrado: cifrar('SEGREDO', CHAVE), conexaoLiberada: true }
const mkCentral = (over = {}) => {
  let t = 1000
  const chamadas = []
  const deps = {
    env: { META_TOKEN_ENCRYPTION_KEY: CHAVE },
    fetch: async (url, init) => { chamadas.push({ url, init }); return new Response(JSON.stringify({ appId: 'A2', configId: 'C2', graphVersion: 'v26.0', verifyToken: 'V2', appSecret: 'S2', conexaoLiberada: true })) },
    agora: () => t,
    lerLinha: async () => LINHA,
    decifrar,
    ...over,
  }
  return { c: criarConfigCentral(deps), chamadas, avancar: (ms) => { t += ms } }
}

test('base lê do repositório e decifra o segredo', async () => {
  const { c, chamadas } = mkCentral({ env: { META_CONFIG_BASE: '1', META_TOKEN_ENCRYPTION_KEY: CHAVE } })
  const v = await c.lerCentral()
  assert.equal(v.appSecret, 'SEGREDO'); assert.equal(v.appId, 'APP'); assert.equal(v.conexaoLiberada, true)
  assert.equal(chamadas.length, 0)
})
test('não-base busca no base com o cabeçalho e cacheia por 5 minutos', async () => {
  const { c, chamadas, avancar } = mkCentral({ env: { META_CONFIG_URL: 'https://base.exemplo.com', META_CONFIG_SYNC_TOKEN: 'tok' } })
  assert.equal((await c.lerCentral()).appId, 'A2')
  assert.equal(chamadas[0].url, 'https://base.exemplo.com/api/meta/app-config')
  assert.equal(chamadas[0].init.headers['x-meta-config-token'], 'tok')
  avancar(TTL_CACHE_MS - 1); await c.lerCentral(); assert.equal(chamadas.length, 1)
  avancar(2); await c.lerCentral(); assert.equal(chamadas.length, 2)
})
test('não-base: falha do base cai no env; sem nada, central é null', async () => {
  const falha = async () => { throw new Error('rede') }
  const { c } = mkCentral({ fetch: falha, env: { META_CONFIG_URL: 'https://b.com', META_CONFIG_SYNC_TOKEN: 't' } })
  const central = await c.lerCentral()
  assert.equal(central, null)
  const m = mesclarComEnv(central, { META_APP_ID: 'ENVAPP', META_APP_SECRET: 'ENVSEC', META_ES_CONFIG_ID: 'c', META_WEBHOOK_VERIFY_TOKEN: 'v', META_GRAPH_VERSION: 'v25.0' })
  assert.equal(m.appId, 'ENVAPP'); assert.equal(m.appSecret, 'ENVSEC')
  const vazio = mesclarComEnv(null, {})
  assert.equal(vazio.appId, ''); assert.equal(vazio.conexaoLiberada, false)
})
test('não-base com URL http (não local) não busca', async () => {
  const { c, chamadas } = mkCentral({ env: { META_CONFIG_URL: 'http://base.exemplo.com', META_CONFIG_SYNC_TOKEN: 't' } })
  assert.equal(await c.lerCentral(), null); assert.equal(chamadas.length, 0)
})
test('o segredo nunca aparece na visão do GET do master', () => {
  const v = visaoPublica(LINHA, {})
  assert.equal(v.appSecretDefinido, true)
  assert.ok(!JSON.stringify(v).includes('SEGREDO'))
  assert.ok(!JSON.stringify(v).includes(LINHA.appSecretCifrado))
  assert.equal(visaoPublica(null, {}).appSecretDefinido, false)
})
test('PUT: segredo vazio é ignorado e campos são validados', () => {
  assert.deepEqual(validarAtualizacao({ appSecret: '  ', conexaoLiberada: true }), { ok: true, dados: { conexaoLiberada: true } })
  assert.equal(validarAtualizacao({ graphVersion: '25' }).ok, false)
  assert.equal(validarAtualizacao({ conexaoLiberada: 'sim' }).ok, false)
  assert.equal(validarAtualizacao({ appSecret: 'novo' }).dados.appSecret, 'novo')
})
test('conexaoLiberada=false: conectar recusa com 403 antes de chamar a Meta', async () => {
  let chamouMeta = false
  const deps = { config: { conexaoLiberada: false }, repo: { buscarPorPhoneNumberId: async () => { chamouMeta = true; return null } }, meta: { trocarCodigo: async () => { chamouMeta = true } } }
  await assert.rejects(() => conectar(deps, { campoId: 'c', userId: null, code: 'x', wabaId: 'w', phoneNumberId: 'p' }),
    (e) => e instanceof ErroServico && e.status === 403 && e.message === MSG_NAO_LIBERADA)
  assert.equal(chamouMeta, false)
})

test('base fora do ar após vencer: valor vencido com conexaoLiberada=false, sem novo fetch por 60 s, e nulo após 1 h', async () => {
  let cai = false
  const chamadas = []
  const { c, avancar } = mkCentral({
    env: { META_CONFIG_URL: 'https://b.com', META_CONFIG_SYNC_TOKEN: 't' },
    fetch: async (u, i) => { chamadas.push(u); if (cai) throw new Error('rede'); return new Response(JSON.stringify({ appId: 'A2', configId: 'C2', graphVersion: 'v26.0', verifyToken: 'V2', appSecret: 'S2', conexaoLiberada: true })) },
  })
  assert.equal((await c.lerCentral()).conexaoLiberada, true)
  cai = true
  avancar(TTL_CACHE_MS + 1)
  const v = await c.lerCentral()
  assert.equal(v.appId, 'A2'); assert.equal(v.conexaoLiberada, false)
  assert.equal(chamadas.length, 2)
  avancar(PAUSA_APOS_FALHA_MS - 1000); await c.lerCentral(); assert.equal(chamadas.length, 2)
  avancar(2000); await c.lerCentral(); assert.equal(chamadas.length, 3)
  avancar(LIMITE_VENCIDO_MS + PAUSA_APOS_FALHA_MS)
  assert.equal(await c.lerCentral(), null)
})
test('sem central, conexaoLiberada é false mesmo que exista variável de ambiente antiga', () => {
  assert.equal(mesclarComEnv(null, { META_CONEXAO_LIBERADA: '1' }).conexaoLiberada, false)
})
test('PUT: erro de campo informa o nome do campo', () => {
  const r = validarAtualizacao({ appId: '   ' })
  assert.equal(r.ok, false); assert.match(r.erro, /ID do app/)
})

// ── Monitor diário (Task 9) ─────────────────────────────────────────────────
import { verificarMeta, executarMonitor, atualizacaoDaProposta } from '../src/lib/meta/monitorMeta.ts'

const AGORA = new Date('2026-11-24T12:00:00Z')
const depsMon = (o = {}) => ({
  agora: () => AGORA,
  versaoEmUso: async () => 'v27.0',
  conexoes: async () => [],
  ehBase: false,
  webhookResponde: async () => true,
  alertasAbertos: async () => [],
  tabela: [{ versao: 'v27.0', desativaEm: null }],
  ...o,
})
const tipos = (l) => l.map((a) => a.tipo)

test('monitor: versão a 60 dias ou menos gera alerta com proposta', async () => {
  const r = await verificarMeta(depsMon({
    tabela: [{ versao: 'v27.0', desativaEm: '2027-01-10T00:00:00Z' }, { versao: 'v28.0', desativaEm: null }],
  }))
  assert.deepEqual(tipos(r), ['versao_graph'])
  assert.deepEqual(r[0].proposta, { tipo: 'atualizar_versao_graph', de: 'v27.0', para: 'v28.0' })
  assert.deepEqual(atualizacaoDaProposta(r[0].proposta), { graphVersion: 'v28.0' })
})
test('monitor: versão a mais de 60 dias ou sem data não alerta', async () => {
  assert.deepEqual(await verificarMeta(depsMon({ tabela: [{ versao: 'v27.0', desativaEm: '2027-06-01T00:00:00Z' }] })), [])
  assert.deepEqual(await verificarMeta(depsMon()), [])
})
test('monitor: versão fora da tabela gera alerta sem proposta', async () => {
  const r = await verificarMeta(depsMon({ versaoEmUso: async () => 'v99.0' }))
  assert.deepEqual(tipos(r), ['versao_desconhecida'])
  assert.equal(r[0].proposta, null)
})
test('monitor: conexão em erro e qualidade RED/YELLOW', async () => {
  const r = await verificarMeta(depsMon({
    conexoes: async () => [
      { campoId: 'c1', status: 'erro', qualidade: null },
      { campoId: 'c2', status: 'conectado', qualidade: 'RED' },
      { campoId: 'c3', status: 'conectado', qualidade: 'YELLOW' },
      { campoId: 'c4', status: 'conectado', qualidade: 'GREEN' },
    ],
  }))
  assert.deepEqual(r.map((a) => `${a.tipo}:${a.campoId}`), ['conexao_erro:c1', 'qualidade_baixa:c2', 'qualidade_media:c3'])
})
test('monitor: webhook só é testado no base', async () => {
  const falha = async () => false
  assert.deepEqual(tipos(await verificarMeta(depsMon({ webhookResponde: falha }))), [])
  assert.deepEqual(tipos(await verificarMeta(depsMon({ ehBase: true, webhookResponde: falha }))), ['webhook_falhou'])
  assert.deepEqual(tipos(await verificarMeta(depsMon({ ehBase: true, webhookResponde: async () => { throw new Error('x') } }))), ['webhook_falhou'])
})
test('monitor: não duplica alerta aberto com mesmo tipo e campo', async () => {
  const r = await verificarMeta(depsMon({
    conexoes: async () => [{ campoId: 'c1', status: 'erro', qualidade: null }, { campoId: 'c2', status: 'erro', qualidade: null }],
    alertasAbertos: async () => [{ tipo: 'conexao_erro', campoId: 'c1' }],
  }))
  assert.deepEqual(r.map((a) => a.campoId), ['c2'])
})
test('cron: avisa por WhatsApp só com alertas novos', async () => {
  const envios = []; let gravados = 0
  const base = {
    gravar: async (a) => { gravados += a.length },
    numeroAviso: '(19) 99999-0000',
    enviarWhatsapp: async (n, t) => { envios.push([n, t]); return true },
  }
  const sem = await executarMonitor({ ...base, verificar: async () => [] })
  assert.deepEqual(sem, { novos: 0, avisou: false }); assert.equal(envios.length, 0); assert.equal(gravados, 0)
  const com = await executarMonitor({ ...base, verificar: async () => [{ campoId: null, tipo: 'webhook_falhou', mensagem: 'm', proposta: null }] })
  assert.deepEqual(com, { novos: 1, avisou: true }); assert.equal(gravados, 1)
  assert.equal(envios[0][0], '19999990000')
  assert.ok(!/token|secret/i.test(envios[0][1]))
})
test('cron: sem META_ALERTA_WHATSAPP só grava; sem instância não quebra', async () => {
  let envios = 0, gravados = 0
  const novo = [{ campoId: null, tipo: 'webhook_falhou', mensagem: 'm', proposta: null }]
  const dep = (numeroAviso, enviar) => ({ verificar: async () => novo, gravar: async (a) => { gravados += a.length }, numeroAviso, enviarWhatsapp: enviar })
  assert.deepEqual(await executarMonitor(dep('', async () => { envios++; return true })), { novos: 1, avisou: false })
  assert.equal(envios, 0); assert.equal(gravados, 1)
  assert.deepEqual(await executarMonitor(dep('5519999990000', async () => false)), { novos: 1, avisou: false })
  assert.deepEqual(await executarMonitor(dep('5519999990000', async () => { throw new Error('z') })), { novos: 1, avisou: false })
})
