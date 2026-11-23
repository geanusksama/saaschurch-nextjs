import { test } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { cifrar, decifrar } from '../src/lib/meta/cifra.ts'
import { assinaturaValida, respostaDesafio } from '../src/lib/meta/webhookSeguranca.ts'
import { criarGraph, ErroGraph } from '../src/lib/meta/graph.ts'
import { trocarCodigo, registrarNumero, assinarWebhookDaConta, lerStatusNumero, gerarPin } from '../src/lib/meta/conexaoMeta.ts'
import { normalizarTelefoneBR, ehPedidoDeSair, primeiroNome, deduplicarPorTelefone, montarParametros, montarMensagemTemplate, tamanhoDoLote, CODIGOS_PARAR_DISPARO, mascararTelefone, statusDoEnvio, lerAcaoControle, lerPaginacao } from '../src/lib/meta/envio.ts'

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
import { obterStatus, obterStatusDoCampo, conectar, desconectar, ErroServico } from '../src/lib/meta/servicoConexao.ts'

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
test('liberação desligada + não master: 403 MSG_NAO_LIBERADA', async () => {
  const deps = { config: { conexaoLiberada: false }, repo: { buscarPorPhoneNumberId: async () => null }, meta: {} }
  await assert.rejects(() => conectar(deps, { campoId: 'c', userId: null, code: 'x', wabaId: 'w', phoneNumberId: 'p', ehMaster: false }),
    (e) => e instanceof ErroServico && e.status === 403 && e.message === MSG_NAO_LIBERADA)
})
test('liberação desligada + master: segue o fluxo (não lança 403)', async () => {
  let consultou = false
  const deps = { config: { conexaoLiberada: false }, repo: { buscarPorPhoneNumberId: async () => { consultou = true; return { campoId: 'outro' } } }, meta: {} }
  await assert.rejects(() => conectar(deps, { campoId: 'c', userId: null, code: 'x', wabaId: 'w', phoneNumberId: 'p', ehMaster: true }),
    (e) => e instanceof ErroServico && e.status === 409)
  assert.equal(consultou, true)
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
import { verificarMeta, executarMonitor, atualizacaoDaProposta, lerComOrcamento } from '../src/lib/meta/monitorMeta.ts'

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
test('monitor: leitura com prazo devolve resultado parcial (Graph lenta) e respeita concorrência', async () => {
  let ativos = 0, maximo = 0
  const lenta = async (n) => {
    ativos++; maximo = Math.max(maximo, ativos)
    await new Promise((r) => setTimeout(r, n === 99 ? 5000 : 30))
    ativos--
    return n
  }
  const itens = Array.from({ length: 40 }, (_, i) => i)
  const t0 = Date.now()
  const r = await lerComOrcamento(itens, lenta, { concorrencia: 5, prazoMs: 100 })
  assert.ok(Date.now() - t0 < 1000)
  assert.ok(r.length > 0 && r.length < 40, `parcial: ${r.length}`)
  assert.ok(maximo <= 5)
  const travada = await lerComOrcamento([99, 99], lenta, { concorrencia: 2, prazoMs: 80 })
  assert.deepEqual(travada, [])
})
test('monitor: falha de leitura vira monitor_falhou por campo, com dedupe', async () => {
  const dep = (abertos) => depsMon({ conexoes: async () => [{ campoId: 'c1', status: 'conectado', qualidade: null, falhou: true }], alertasAbertos: async () => abertos })
  assert.deepEqual((await verificarMeta(dep([]))).map((a) => `${a.tipo}:${a.campoId}`), ['monitor_falhou:c1'])
  assert.deepEqual(await verificarMeta(dep([{ tipo: 'monitor_falhou', campoId: 'c1' }])), [])
})

// ── Correções da revisão final ────────────────────────────────────────────
test('webhook: verify token com tamanho diferente é recusado e challenge longo também', () => {
  const mk = (t, c) => new URLSearchParams({ 'hub.mode': 'subscribe', 'hub.verify_token': t, 'hub.challenge': c })
  assert.equal(respostaDesafio(mk('vt', '1'), 'vt'), '1')
  assert.equal(respostaDesafio(mk('vt-maior', '1'), 'vt'), null)
  assert.equal(respostaDesafio(mk('', '1'), 'vt'), null)
  assert.equal(respostaDesafio(mk('vt', 'x'.repeat(200)), 'vt'), 'x'.repeat(200))
  assert.equal(respostaDesafio(mk('vt', 'x'.repeat(201)), 'vt'), null)
})

test('GET sem linha: conectado false sem montar dependências (sem exigir config)', async () => {
  let montou = false
  const repo = { async buscarConexaoDoCampo() { return null } }
  const r = await obterStatusDoCampo(repo, async () => { montou = true; throw new ErroConfigMeta('incompleta') }, 'c1')
  assert.deepEqual(r, { conectado: false })
  assert.equal(montou, false)
})

test('GET com linha desconectada: conectado false sem montar dependências', async () => {
  let montou = false
  const repo = { async buscarConexaoDoCampo() { return { ...conexaoSalva(''), status: 'desconectado' } } }
  assert.deepEqual(await obterStatusDoCampo(repo, async () => { montou = true }, 'c1'), { conectado: false })
  assert.equal(montou, false)
  const { deps } = fakeDeps()
  deps.repo.conexao = { ...conexaoSalva(''), status: 'desconectado' }
  assert.deepEqual(await obterStatus(deps, 'c1'), { conectado: false })
})

test('GET com linha ativa monta as dependências e consulta a Meta', async () => {
  const { deps } = fakeDeps()
  deps.repo.conexao = conexaoSalva(cifrar('TOK', CHAVE))
  const r = await obterStatusDoCampo(deps.repo, async () => deps, 'c1')
  assert.equal(r.conectado, true); assert.equal(r.qualidade, 'GREEN')
})

test('config incompleta: a rota /config responde 200 conexaoLiberada false, sem nomes de variáveis', async () => {
  // lerConfigMeta carrega o Prisma por import tardio e não roda sob node:test; confere a rota pelo código.
  const { readFileSync } = await import('node:fs')
  const src = readFileSync(new URL('../src/app/api/meta/whatsapp/config/route.ts', import.meta.url), 'utf8')
  assert.match(src, /e instanceof ErroConfigMeta/)
  assert.match(src, /json\(\{ conexaoLiberada: false, podeConectar: false \}\)/)
  assert.doesNotMatch(src.slice(src.indexOf('ErroConfigMeta)')), /e\.message/)
  assert.throws(() => validarBaseUrl('lixo'), (e) => e instanceof ErroConfigMeta)
})

test('conectar reaproveita o PIN do mesmo número já registrado', async () => {
  const { deps, reg } = fakeDeps()
  deps.meta.gerarPin = () => { throw new Error('não devia gerar PIN novo') }
  deps.repo.conexao = { ...conexaoSalva(''), phoneNumberId: 'p1', pinCifrado: cifrar('654321', CHAVE), status: 'desconectado' }
  await conectar(deps, { campoId: 'c1', userId: 'u', code: 'C', wabaId: 'w', phoneNumberId: 'p1' })
  assert.equal(decifrar(reg.salvos[0].pinCifrado, CHAVE), '654321')
})

test('conectar gera PIN novo para número diferente ou PIN ilegível', async () => {
  const a = fakeDeps()
  a.deps.repo.conexao = { ...conexaoSalva(''), phoneNumberId: 'outro', pinCifrado: cifrar('654321', CHAVE) }
  await conectar(a.deps, { campoId: 'c1', userId: 'u', code: 'C', wabaId: 'w', phoneNumberId: 'p1' })
  assert.equal(decifrar(a.reg.salvos[0].pinCifrado, CHAVE), '123456')
  const b = fakeDeps()
  b.deps.repo.conexao = { ...conexaoSalva(''), phoneNumberId: 'p1', pinCifrado: 'lixo' }
  await conectar(b.deps, { campoId: 'c1', userId: 'u', code: 'C', wabaId: 'w', phoneNumberId: 'p1' })
  assert.equal(decifrar(b.reg.salvos[0].pinCifrado, CHAVE), '123456')
})

test('desconectar já desconectado não chama a Meta', async () => {
  const { deps, chamadas, reg } = fakeDeps()
  deps.repo.conexao = { ...conexaoSalva(''), status: 'desconectado' }
  await desconectar(deps, 'c1')
  assert.deepEqual(chamadas, [])
  assert.deepEqual(reg.desconectados, ['c1'])
})

test('conexaoRepo.desconectar mantém pin e número (atualiza, não apaga)', async () => {
  const { readFileSync } = await import('node:fs')
  const src = readFileSync(new URL('../src/lib/meta/conexaoRepo.ts', import.meta.url), 'utf8')
  const corpo = src.slice(src.indexOf('export async function desconectar'))
  assert.match(corpo, /updateMany/); assert.match(corpo, /status: 'desconectado'/)
  assert.doesNotMatch(corpo, /deleteMany|pinCifrado|phoneNumberId/)
})

// ---- modelos (regras puras) ----
import { nomeDoTitulo, normalizarRascunho, validarRascunho, montarCorpoGraph, normalizarDaMeta, ROTULO_STATUS } from '../src/lib/meta/modelos.ts'

const rascunhoOk = () => ({
  nome: 'culto_de_ceia', categoria: 'UTILITY', corpo: 'Olá {{1}}, hoje tem culto.',
  variaveis: [{ posicao: 1, tipo: 'nome', exemplo: 'Maria' }],
})

test('modelos: nomeDoTitulo', () => {
  assert.equal(nomeDoTitulo('Culto de Ceia!'), 'culto_de_ceia')
  assert.equal(nomeDoTitulo('Ação Jovem'), 'acao_jovem')
  assert.equal(nomeDoTitulo('a'.repeat(600)).length, 512)
})
test('modelos: rascunho válido', () => {
  assert.deepEqual(validarRascunho(rascunhoOk()), [])
})
test('modelos: corpo começando ou terminando com variável', () => {
  const r = { ...rascunhoOk(), corpo: '{{1}} olá' }
  assert.ok(validarRascunho(r).some((e) => /começar/.test(e)))
  const f = { ...rascunhoOk(), corpo: 'olá {{1}}' }
  assert.ok(validarRascunho(f).some((e) => /terminar/.test(e)))
})
test('modelos: sequência das variáveis', () => {
  const r = { ...rascunhoOk(), corpo: 'olá {{2}} tudo', variaveis: [{ posicao: 2, tipo: 'livre', exemplo: 'x' }] }
  assert.ok(validarRascunho(r).some((e) => /sequenciais/.test(e)))
})
test('modelos: rodapé com variável', () => {
  assert.ok(validarRascunho({ ...rascunhoOk(), rodape: 'ola {{1}}' }).some((e) => /rodapé/i.test(e)))
})
test('modelos: botões', () => {
  const b = (t) => ({ texto: t })
  assert.ok(validarRascunho({ ...rascunhoOk(), botoes: [b('a'), b('b'), b('c'), b('d')] }).length > 0)
  assert.ok(validarRascunho({ ...rascunhoOk(), botoes: [b('x'.repeat(26))] }).length > 0)
  assert.deepEqual(validarRascunho({ ...rascunhoOk(), botoes: [b('x'.repeat(25))] }), [])
})
test('modelos: exemplo vazio, nome e categoria inválidos', () => {
  const r = { ...rascunhoOk(), variaveis: [{ posicao: 1, tipo: 'nome', exemplo: '  ' }] }
  assert.ok(validarRascunho(r).some((e) => /exemplo/i.test(e)))
  assert.ok(validarRascunho({ ...rascunhoOk(), nome: 'Nome Ruim' }).length > 0)
  assert.ok(validarRascunho({ ...rascunhoOk(), categoria: 'AUTHENTICATION' }).length > 0)
  assert.ok(validarRascunho({ ...rascunhoOk(), corpo: '' }).length > 0)
})
test('modelos: cabeçalho', () => {
  assert.ok(validarRascunho({ ...rascunhoOk(), cabecalho: 'x'.repeat(61) }).length > 0)
  assert.ok(validarRascunho({ ...rascunhoOk(), cabecalho: '{{1}} e {{2}}' }).length > 0)
})
test('modelos: montarCorpoGraph', () => {
  const g = montarCorpoGraph(rascunhoOk())
  assert.equal(g.name, 'culto_de_ceia')
  assert.equal(g.language, 'pt_BR')
  assert.equal(g.category, 'UTILITY')
  assert.equal(g.components.length, 1)
  assert.deepEqual(g.components[0], { type: 'BODY', text: 'Olá {{1}}, hoje tem culto.', example: { body_text: [['Maria']] } })
})
test('modelos: montarCorpoGraph completo', () => {
  const g = montarCorpoGraph({ ...rascunhoOk(), cabecalho: 'Aviso', rodape: 'Igreja', botoes: [{ texto: 'Ok' }] })
  assert.deepEqual(g.components.map((c) => c.type), ['HEADER', 'BODY', 'FOOTER', 'BUTTONS'])
  assert.deepEqual(g.components[0], { type: 'HEADER', format: 'TEXT', text: 'Aviso' })
  assert.deepEqual(g.components[3].buttons, [{ type: 'QUICK_REPLY', text: 'Ok' }])
})
test('modelos: normalizarDaMeta', () => {
  const n = normalizarDaMeta({ id: '123', name: 'x', language: 'pt_BR', category: 'UTILITY', status: 'APPROVED', rejected_reason: 'NONE', components: [{ type: 'BODY' }] })
  assert.equal(n.metaTemplateId, '123')
  assert.equal(n.motivoRecusa, null)
  assert.equal(n.nome, 'x')
  const r = normalizarDaMeta({ id: 1, name: 'y', status: 'REJECTED', rejected_reason: 'INVALID_FORMAT' })
  assert.equal(r.motivoRecusa, 'INVALID_FORMAT')
  assert.equal(r.metaTemplateId, '1')
  assert.deepEqual(r.componentes, [])
})
test('modelos: ROTULO_STATUS', () => {
  assert.equal(ROTULO_STATUS.APPROVED, 'Aprovado')
  assert.equal(ROTULO_STATUS.PENDING, 'Em análise')
  assert.equal(ROTULO_STATUS.REJECTED, 'Recusado')
  assert.equal(ROTULO_STATUS.PAUSED, 'Pausado')
  assert.equal(ROTULO_STATUS.DISABLED, 'Desativado')
  assert.equal(ROTULO_STATUS.OUTRO ?? 'OUTRO', 'OUTRO')
})

test('modelos: variável do cabeçalho exige {{1}} e exemplo próprio', () => {
  assert.ok(validarRascunho({ ...rascunhoOk(), cabecalho: 'Aviso {{1}}' }).some((e) => /cabeçalho precisa de um exemplo/.test(e)))
  assert.ok(validarRascunho({ ...rascunhoOk(), cabecalho: 'Aviso {{2}}', exemploCabecalho: 'x' }).some((e) => /deve ser \{\{1\}\}/.test(e)))
  assert.deepEqual(validarRascunho({ ...rascunhoOk(), cabecalho: 'Aviso {{1}}', exemploCabecalho: 'Maria' }), [])
  const g = montarCorpoGraph({ ...rascunhoOk(), cabecalho: 'Aviso {{1}}', exemploCabecalho: 'Maria' })
  assert.deepEqual(g.components[0].example, { header_text: ['Maria'] })
})

// ---- Etapa 2, Task 2: serviço de modelos ----
import { variaveisParaGravar, listarModelos, sincronizarModelos, criarModelo, excluirModelo, MSG_SEM_CONEXAO } from '../src/lib/meta/servicoModelos.ts'
import { MSG_TOKEN_RECUSADO as MSG_TOK, MSG_TIMEOUT as MSG_TMO } from '../src/lib/meta/servicoConexao.ts'

function depsModelos({ conexao = 'conectado', noBanco = [], daMeta = [], graphErro = null } = {}) {
  const chamadas = { graph: [], inserir: [], substituir: null, remover: [], marcarErro: [] }
  const quebra = async () => { if (graphErro) throw graphErro }
  const deps = {
    repo: {
      listar: async () => noBanco,
      substituirDoCampo: async (_c, linhas) => { chamadas.substituir = linhas },
      inserir: async (l) => { chamadas.inserir.push(l); return { id: 'novo', ...l } },
      buscar: async (campoId, id) => noBanco.find((m) => m.id === id && m.campoId === campoId) ?? null,
      remover: async (id) => { chamadas.remover.push(id) },
    },
    conexoes: {
      buscarConexaoDoCampo: async () => (conexao ? { campoId: 'c1', wabaId: 'W1', tokenCifrado: 'cif', status: conexao } : null),
      marcarErro: async (c, m) => { chamadas.marcarErro.push([c, m]) },
    },
    graph: {
      get: async (...a) => { chamadas.graph.push(['get', ...a]); await quebra(); return { data: daMeta } },
      post: async (...a) => { chamadas.graph.push(['post', ...a]); await quebra(); return { id: 'T9', status: '', category: 'UTILITY' } },
      delete: async (...a) => { chamadas.graph.push(['delete', ...a]); await quebra() },
    },
    chave: 'k', cifra: { decifrar: () => 'TOKEN' },
  }
  return { deps, chamadas }
}
const erroGraph = (codigo, msg = 'x') => new ErroGraph(msg, 400, codigo)
const rej = async (p, status, msg) => assert.rejects(p, (e) => e instanceof ErroServico && e.status === status && (!msg || e.message === msg || msg.test?.(e.message)))

test('modelos serviço: sem conexão ou desconectado -> 409 sem chamar a Meta', async () => {
  for (const conexao of [null, 'desconectado']) {
    const { deps, chamadas } = depsModelos({ conexao })
    await rej(sincronizarModelos(deps, 'c1'), 409, MSG_SEM_CONEXAO)
    await rej(criarModelo(deps, 'c1', 'u1', rascunhoOk()), 409, MSG_SEM_CONEXAO)
    await rej(excluirModelo(deps, 'c1', 'm1'), 409, MSG_SEM_CONEXAO)
    assert.equal(chamadas.graph.length, 0)
  }
})

test('modelos serviço: sincronizar preserva variaveis e criado_por, remove os que sumiram', async () => {
  const noBanco = [
    { id: 'b', campoId: 'c1', metaTemplateId: 'B', variaveis: [{ posicao: 1, tipo: 'nome', exemplo: 'M' }], criadoPor: 'u7' },
    { id: 'c', campoId: 'c1', metaTemplateId: 'C', variaveis: [], criadoPor: null },
  ]
  const daMeta = [
    { id: 'A', name: 'a', language: 'pt_BR', category: 'UTILITY', status: 'APPROVED', components: [] },
    { id: 'B', name: 'b', language: 'pt_BR', category: 'MARKETING', status: 'PENDING', components: [] },
  ]
  const { deps, chamadas } = depsModelos({ noBanco, daMeta })
  const r = await sincronizarModelos(deps, 'c1')
  assert.deepEqual(r, { total: 2 })
  assert.deepEqual(chamadas.substituir.map((l) => l.metaTemplateId), ['A', 'B'])
  const b = chamadas.substituir.find((l) => l.metaTemplateId === 'B')
  assert.deepEqual(b.variaveis, noBanco[0].variaveis)
  assert.equal(b.criadoPor, 'u7')
  assert.equal(b.wabaId, 'W1')
  assert.deepEqual(chamadas.substituir.find((l) => l.metaTemplateId === 'A').variaveis, [])
  assert.equal(chamadas.graph[0][1], 'W1/message_templates')
})

test('modelos serviço: criar inválido -> 400 sem chamar a Meta', async () => {
  const { deps, chamadas } = depsModelos()
  await rej(criarModelo(deps, 'c1', 'u1', { ...rascunhoOk(), nome: 'Nome Inválido' }), 400)
  assert.equal(chamadas.graph.length, 0)
})

test('modelos serviço: criar válido faz POST e grava PENDING', async () => {
  const { deps, chamadas } = depsModelos()
  await criarModelo(deps, 'c1', 'u1', rascunhoOk())
  assert.equal(chamadas.graph[0][0], 'post')
  assert.equal(chamadas.graph[0][1], 'W1/message_templates')
  assert.equal(chamadas.graph[0][3], 'TOKEN')
  const l = chamadas.inserir[0]
  assert.equal(l.status, 'PENDING')
  assert.equal(l.metaTemplateId, 'T9')
  assert.equal(l.campoId, 'c1')
  assert.equal(l.criadoPor, 'u1')
  assert.deepEqual(l.variaveis, rascunhoOk().variaveis)
})

test('modelos serviço: erros da Graph viram 401, 504 e 502', async () => {
  let t = depsModelos({ graphErro: erroGraph(190) })
  await rej(sincronizarModelos(t.deps, 'c1'), 401, MSG_TOK)
  assert.equal(t.chamadas.marcarErro.length, 1)
  t = depsModelos({ graphErro: Object.assign(new Error('t'), { name: 'TimeoutError' }) })
  await rej(criarModelo(t.deps, 'c1', 'u1', rascunhoOk()), 504, MSG_TMO)
  t = depsModelos({ graphErro: erroGraph(100, 'nome repetido') })
  await rej(criarModelo(t.deps, 'c1', 'u1', rascunhoOk()), 502, /^A Meta recusou: nome repetido/)
})

test('modelos serviço: excluir de outro campo -> 404 sem chamar a Meta', async () => {
  const { deps, chamadas } = depsModelos({ noBanco: [{ id: 'm1', campoId: 'outro', metaTemplateId: 'T', nome: 'n' }] })
  await rej(excluirModelo(deps, 'c1', 'm1'), 404)
  assert.equal(chamadas.graph.length, 0)
})

test('modelos serviço: excluir chama DELETE com hsm_id e name e remove; inexistente na Meta remove igual', async () => {
  const m = { id: 'm1', campoId: 'c1', metaTemplateId: 'T1', nome: 'meu_modelo' }
  let t = depsModelos({ noBanco: [m] })
  await excluirModelo(t.deps, 'c1', 'm1')
  assert.equal(t.chamadas.graph[0][1], 'W1/message_templates?hsm_id=T1&name=meu_modelo')
  assert.deepEqual(t.chamadas.remover, ['m1'])
  t = depsModelos({ noBanco: [m], graphErro: erroGraph(100, 'Template does not exist') })
  await excluirModelo(t.deps, 'c1', 'm1')
  assert.deepEqual(t.chamadas.remover, ['m1'])
  t = depsModelos({ noBanco: [m], graphErro: erroGraph(100, 'permissão negada') })
  await rej(excluirModelo(t.deps, 'c1', 'm1'), 502)
  assert.deepEqual(t.chamadas.remover, [])
})

test('modelos serviço: listar devolve o espelho do campo', async () => {
  const { deps } = depsModelos({ noBanco: [{ id: 'a' }] })
  assert.deepEqual(await listarModelos(deps, 'c1'), [{ id: 'a' }])
})

test('modelos: normalizarRascunho descarta chaves extras e mantém o válido', () => {
  const r = normalizarRascunho({ nome: 'a', categoria: 'UTILITY', corpo: 'oi', extra: 1, botoes: [{ texto: 'Ok', x: 1 }],
    variaveis: [{ posicao: 1, tipo: 'nome', exemplo: 'Ana', lixo: true }] })
  assert.ok('rascunho' in r)
  assert.deepEqual(r.rascunho.botoes, [{ texto: 'Ok' }])
  assert.deepEqual(r.rascunho.variaveis, [{ posicao: 1, tipo: 'nome', exemplo: 'Ana' }])
  assert.equal('extra' in r.rascunho, false)
})

test('modelos: normalizarRascunho rejeita tipo, limites e formas erradas', () => {
  const base = { nome: 'a', categoria: 'UTILITY', corpo: 'oi' }
  const falha = (extra) => 'erros' in normalizarRascunho({ ...base, ...extra })
  assert.ok(falha({ variaveis: [{ posicao: 1, tipo: 'cpf', exemplo: 'x' }] }))
  assert.ok(falha({ variaveis: [{ posicao: 1.5, tipo: 'nome', exemplo: 'x' }] }))
  assert.ok(falha({ variaveis: [{ posicao: -1, tipo: 'nome', exemplo: 'x' }] }))
  assert.ok(falha({ variaveis: [{ posicao: 1, tipo: 'nome', exemplo: 'x'.repeat(201) }] }))
  assert.ok(falha({ variaveis: Array.from({ length: 21 }, (_, i) => ({ posicao: i + 1, tipo: 'nome', exemplo: 'x' })) }))
  assert.ok(falha({ botoes: [{ texto: 'a' }, { texto: 'b' }, { texto: 'c' }, { texto: 'd' }] }))
  assert.ok(falha({ botoes: [{ texto: 5 }] }))
  assert.ok(falha({ variaveis: 'x' }))
  assert.ok('erros' in normalizarRascunho(null))
  assert.ok('erros' in normalizarRascunho([]))
  assert.ok('rascunho' in normalizarRascunho(base))
})

test('master fora do base com liberação desligada -> 403 (rotas só concedem o desvio no base)', async () => {
  const { readFileSync } = await import('node:fs')
  const rota = (p) => readFileSync(new URL(`../src/app/api/meta/whatsapp/${p}/route.ts`, import.meta.url), 'utf8')
  assert.match(rota('conexao'), /ehMaster: user\.profileType === 'master' && ehBase\(process\.env\)/)
  assert.match(rota('config'), /user\.profileType === 'master' && ehBase\(process\.env\)/)
  const { ehBase } = await import('../src/lib/meta/configCentral.ts')
  assert.equal(ehBase({}), false)
  const ehMaster = (env) => true && ehBase(env)
  const { deps } = fakeDeps()
  deps.config = { ...deps.config, conexaoLiberada: false }
  await assert.rejects(
    () => conectar(deps, { campoId: 'c', userId: null, code: 'x', wabaId: 'w', phoneNumberId: 'p', ehMaster: ehMaster({}) }),
    (e) => e instanceof ErroServico && e.status === 403)
})

test('modelos: variaveisParaGravar só grava as do corpo e monta a do cabeçalho no servidor', () => {
  const r = {
    ...rascunhoOk(), corpo: 'Olá {{1}}, vem {{2}} aqui',
    cabecalho: 'Oi {{1}}', exemploCabecalho: 'Ana', tipoCabecalho: 'nome',
    variaveis: [
      { posicao: 0, tipo: 'livre', exemplo: 'forjada' },
      { posicao: 1, tipo: 'nome', exemplo: 'M' },
      { posicao: 1, tipo: 'livre', exemplo: 'repetida' },
      { posicao: 2, tipo: 'livre', exemplo: 'X' },
      { posicao: 5, tipo: 'livre', exemplo: 'fora' },
    ],
  }
  assert.deepEqual(variaveisParaGravar(r), [
    { posicao: 1, tipo: 'nome', exemplo: 'M' },
    { posicao: 2, tipo: 'livre', exemplo: 'X' },
    { posicao: 0, tipo: 'nome', exemplo: 'Ana' },
  ])
  assert.deepEqual(variaveisParaGravar({ ...r, cabecalho: 'Sem variável' }).map((v) => v.posicao), [1, 2])
})

test('envio: normaliza telefone BR para E.164 só com dígitos', () => {
  assert.equal(normalizarTelefoneBR('(19) 99212-6683'), '5519992126683')
  assert.equal(normalizarTelefoneBR('+55 19 99212-6683'), '5519992126683')
  assert.equal(normalizarTelefoneBR('5519992126683'), '5519992126683')
  assert.equal(normalizarTelefoneBR('19 3333-4444'), null)
  assert.equal(normalizarTelefoneBR('551933334444'), null)
  assert.equal(normalizarTelefoneBR('123'), null)
  assert.equal(normalizarTelefoneBR(''), null)
  assert.equal(normalizarTelefoneBR(null), null)
})
test('envio: pedido de sair ignora caixa, acento e espaços, só mensagem inteira', () => {
  for (const t of ['SAIR', ' sair ', 'Parar', 'stop', 'CANCELAR', 'Descadastrar']) assert.equal(ehPedidoDeSair(t), true, t)
  for (const t of ['quero sair', 'oi', '', 'paraná']) assert.equal(ehPedidoDeSair(t), false, t)
  assert.equal(ehPedidoDeSair('Sáir'), true)
})
test('envio: primeiro nome, nome preferido vence', () => {
  assert.equal(primeiroNome('Maria da Silva'), 'Maria')
  assert.equal(primeiroNome('  joão  pedro '), 'joão')
  assert.equal(primeiroNome('Maria da Silva', 'Mari'), 'Mari')
  assert.equal(primeiroNome('Maria da Silva', '  '), 'Maria')
  assert.equal(primeiroNome('Maria da Silva', null), 'Maria')
})
const ct = (o, t, n = 'Ana Souza', i = 'Sede') => ({ origem: o, refId: n, nome: n, telefone: t, igrejaNome: i })
test('envio: deduplica por telefone, membro antes de interessado', () => {
  const r = deduplicarPorTelefone([ct('interessado', '55a', 'L1'), ct('membro', '55a', 'M1'), ct('interessado', '55b', 'L2'), ct('membro', '55a', 'M2')])
  assert.deepEqual(r.map((c) => c.refId), ['M1', 'L2'])
})
test('envio: monta parâmetros do corpo e do cabeçalho', () => {
  const vars = [
    { posicao: 2, tipo: 'igreja', exemplo: 'x' },
    { posicao: 1, tipo: 'nome', exemplo: 'x' },
    { posicao: 3, tipo: 'data', exemplo: 'x' },
    { posicao: 4, tipo: 'livre', exemplo: 'x' },
    { posicao: 0, tipo: 'nome', exemplo: 'x' },
  ]
  const p = montarParametros(vars, ct('membro', '55a'), { data: '25/12', livre: 'Culto' })
  assert.deepEqual(p, { header: ['Ana'], body: ['Ana', 'Sede', '25/12', 'Culto'] })
  assert.deepEqual(montarParametros([], ct('membro', '55a'), {}), { body: [] })
})
test('envio: corpo do POST /messages só inclui componentes com parâmetros', () => {
  assert.deepEqual(montarMensagemTemplate('5519992126683', 'aviso', 'pt_BR', { header: ['Ana'], body: ['Ana', 'Sede'] }), {
    messaging_product: 'whatsapp', to: '5519992126683', type: 'template',
    template: { name: 'aviso', language: { code: 'pt_BR' }, components: [
      { type: 'header', parameters: [{ type: 'text', text: 'Ana' }] },
      { type: 'body', parameters: [{ type: 'text', text: 'Ana' }, { type: 'text', text: 'Sede' }] },
    ] },
  })
  assert.deepEqual(montarMensagemTemplate('55', 'a', 'pt_BR', { body: [] }).template.components, [])
})
test('envio: tamanho do lote e códigos de parada', () => {
  assert.equal(tamanhoDoLote(0, 100), 0)
  assert.equal(tamanhoDoLote(250, 10), 10)
  assert.equal(tamanhoDoLote(250, 100), 60)
  assert.equal(tamanhoDoLote(-5, 100), 0)
  assert.equal(tamanhoDoLote(250, 100, 20), 20)
  assert.deepEqual(CODIGOS_PARAR_DISPARO, [131031, 131042, 368, 190])
})

// ---------- Etapa 3: serviço do envio em massa (deps falsas, sem banco nem rede) ----------
import {
  processarFila, criarDisparo, contarPublico, pausar, retomar, cancelar, aplicarStatusWebhook, registrarSair,
  processarWebhook, extrairEventosWebhook, limiteRestante, limiteDoNivel, podeAvancarStatus, validarEntradaDisparo,
  validarFiltros, sanearParametro, telefoneDoWaId, montarPublico,
} from '../src/lib/meta/servicoEnvio.ts'

const AGORA_ENV = new Date('2026-11-23T15:00:00Z')

/** Repositório em memória com a mesma semântica do SQL (reserva, troca condicionada, recálculo). */
function depsEnvio({ disparos = [], envios = [], enviados24h = 0, limite = 'TIER_250', qualidade = 'GREEN', conexao = 'conectado', postErro = null, modelos = [], contatos = { membros: [], interessados: [] }, excluidos = [], aoEnviar = null } = {}) {
  const st = { disparos: disparos.map((d) => ({ motivo: null, agendadoPara: null, criadoEm: AGORA_ENV, modeloNome: 'aviso', idioma: 'pt_BR', campoId: 'c1', ...d })), envios: envios.map((e) => ({ wamid: null, erroCodigo: null, erro: null, enviadoEm: null, reservado: false, parametros: { body: ['Ana'] }, campoId: 'c1', ...e })), exclusoes: [], alertas: [], posts: [], marcarErro: [], criados: null, enviados24h, liberados: [], quebrarGravacao: false }
  let wam = 0
  const ativo = (d) => d.status === 'enviando' || d.status === 'aguardando_limite' || (d.status === 'agendado' && d.agendadoPara && d.agendadoPara <= AGORA_ENV)
  const repo = {
    contarPublico: async () => ({ membros: 7, interessados: 3 }),
    listarContatos: async () => contatos,
    telefonesExcluidos: async (_c, tels) => new Set(tels.filter((t) => excluidos.includes(t))),
    // Mesma semântica da PK: id repetido ⇒ erro P2002 e nada é gravado.
    criarDisparoComEnvios: async (d, e) => {
      if (st.disparos.some((x) => x.id === d.id)) { const err = new Error('Unique constraint failed on the fields: (`id`)'); err.code = 'P2002'; throw err }
      st.criados = { d, e }; st.disparos.push(d)
    },
    disparosAtivos: async (campoId) => st.disparos.filter((d) => d.campoId === campoId && ativo(d)).map((d) => ({ ...d })),
    resumoDisparo: async (id) => { const d = st.disparos.find((x) => x.id === id); return d ? { id: d.id, campoId: d.campoId, status: d.status, total: d.total, enviados: d.enviados ?? 0, entregues: d.entregues ?? 0, lidos: d.lidos ?? 0, falhos: d.falhos ?? 0 } : null },
    buscarDisparo: async (campoId, id) => { const d = st.disparos.find((x) => x.id === id && x.campoId === campoId); return d ? { ...d } : null },
    mudarStatus: async (id, de, para, motivo) => { const d = st.disparos.find((x) => x.id === id); if (!d || !de.includes(d.status)) return false; d.status = para; d.motivo = motivo; return true },
    cancelar: async (id, de) => { const d = st.disparos.find((x) => x.id === id); if (!d || !de.includes(d.status)) return false; d.status = 'cancelado'; for (const e of st.envios) if (e.disparoId === id && e.status === 'pendente' && !e.reservado) e.status = 'ignorado'; return true },
    enviadosDesde: async () => st.enviados24h,
    reservarPendentes: async (disparoId, n) => { const l = st.envios.filter((e) => e.disparoId === disparoId && e.status === 'pendente' && !e.reservado).slice(0, n); for (const e of l) e.reservado = true; return l.map((e) => ({ id: e.id, telefone: e.telefone, parametros: e.parametros })) },
    liberarReserva: async (ids) => {
      st.liberados.push(...ids)
      for (const e of st.envios) {
        if (!ids.includes(e.id) || e.status !== 'pendente' || !e.reservado) continue
        const d = st.disparos.find((x) => x.id === e.disparoId)
        e.reservado = false
        if (d.status === 'cancelado' || st.exclusoes.some((x) => x.campoId === e.campoId && x.telefone === e.telefone)) e.status = 'ignorado'
      }
    },
    varrerReservasVencidas: async (campoId) => {
      const ids = new Set()
      for (const e of st.envios) if (e.campoId === campoId && e.status === 'pendente' && e.reservado && e.vencida) { Object.assign(e, { status: 'falhou', erro: 'não confirmado', reservado: false }); ids.add(e.disparoId) }
      return [...ids]
    },
    marcarEnviado: async (id, wamid, quando) => { if (st.quebrarGravacao) throw new Error('pooler'); const e = st.envios.find((x) => x.id === id); if (e.status === 'pendente') { Object.assign(e, { status: 'enviado', wamid, enviadoEm: quando, reservado: false }); st.enviados24h++ } },
    marcarFalha: async (id, codigo, erro, talvez) => { const e = st.envios.find((x) => x.id === id); if (e.status === 'pendente') { Object.assign(e, { status: 'falhou', erroCodigo: codigo, erro, reservado: false }); if (talvez) st.enviados24h++ } },
    recalcular: async (disparoId) => {
      const d = st.disparos.find((x) => x.id === disparoId); const es = st.envios.filter((e) => e.disparoId === disparoId)
      d.enviados = es.filter((e) => ['enviado', 'entregue', 'lido'].includes(e.status)).length
      d.entregues = es.filter((e) => ['entregue', 'lido'].includes(e.status)).length
      d.lidos = es.filter((e) => e.status === 'lido').length
      d.falhos = es.filter((e) => e.status === 'falhou').length
      if (d.status === 'enviando' && !es.some((e) => e.status === 'pendente')) d.status = 'concluido'
    },
    buscarEnvioPorWamid: async (campoId, wamid) => { const e = st.envios.find((x) => x.wamid === wamid && x.campoId === campoId); return e ? { id: e.id, status: e.status, disparoId: e.disparoId } : null },
    trocarStatusEnvio: async (id, de, para, erro) => { const e = st.envios.find((x) => x.id === id); if (e.status !== de) return false; e.status = para; if (erro) { e.erroCodigo = erro.codigo; e.erro = erro.mensagem } return true },
    inserirExclusao: async (campoId, telefone, motivo) => { if (!st.exclusoes.some((x) => x.campoId === campoId && x.telefone === telefone)) st.exclusoes.push({ campoId, telefone, motivo }) },
    ignorarPendentesDoTelefone: async (campoId, telefone) => { for (const e of st.envios) if (e.campoId === campoId && e.telefone === telefone && e.status === 'pendente' && !e.reservado) e.status = 'ignorado' },
  }
  const deps = {
    repo,
    modelos: { buscar: async (campoId, id) => modelos.find((m) => m.id === id && m.campoId === campoId) ?? null },
    conexoes: {
      buscarConexaoDoCampo: async () => (conexao ? { campoId: 'c1', phoneNumberId: 'PN1', tokenCifrado: 'cif', status: conexao } : null),
      buscarPorPhoneNumberId: async (pn) => (pn === 'PN1' ? { campoId: 'c1' } : null),
      marcarErro: async (c, m) => { st.marcarErro.push([c, m]) },
    },
    graph: {
      get: async () => { throw new Error('não deveria chamar get') },
      delete: async () => { throw new Error('não deveria chamar delete') },
      post: async (caminho, corpo, token) => {
        st.posts.push({ caminho, corpo, token })
        if (aoEnviar) await aoEnviar(st, corpo)
        const erro = typeof postErro === 'function' ? postErro(corpo) : postErro
        if (erro) throw erro
        return { messages: [{ id: 'wamid.' + (++wam) }] }
      },
    },
    lerStatus: async () => ({ qualidade, limiteDiario: limite }),
    alertas: { gravar: async (campoId, mensagem) => { st.alertas.push({ campoId, mensagem }) } },
    chave: 'k', cifra: { decifrar: () => 'TOKEN' },
    novoId: (() => { let i = 0; return () => 'id-' + (++i) })(),
  }
  return { deps, st }
}
const pend = (n, disparoId = 'd1', base = 0) => Array.from({ length: n }, (_, i) => ({ id: `${disparoId}-e${base + i}`, disparoId, telefone: '55199' + String(10000000 + base + i), status: 'pendente' }))

test('envio fila: limite de 250 já usado por outro disparo ⇒ novo fica aguardando limite sem enviar', async () => {
  const { deps, st } = depsEnvio({ disparos: [{ id: 'd1', status: 'enviando' }], envios: pend(5), enviados24h: 250 })
  const r = await processarFila(deps, 'c1', AGORA_ENV)
  assert.equal(st.posts.length, 0)
  assert.equal(st.disparos[0].status, 'aguardando_limite')
  assert.equal(r.enviados, 0)
  assert.equal(st.envios.every((e) => e.status === 'pendente'), true)
})
test('envio fila: envia até o limite restante e o lote de 60, grava wamid e conclui', async () => {
  const a = depsEnvio({ disparos: [{ id: 'd1', status: 'enviando' }], envios: pend(3), enviados24h: 0 })
  await processarFila(a.deps, 'c1', AGORA_ENV)
  assert.equal(a.st.posts.length, 3)
  assert.equal(a.st.posts[0].caminho, 'PN1/messages')
  assert.equal(a.st.posts[0].token, 'TOKEN')
  assert.equal(a.st.posts[0].corpo.template.name, 'aviso')
  assert.equal(a.st.envios[0].wamid, 'wamid.1')
  assert.equal(a.st.disparos[0].status, 'concluido')
  assert.equal(a.st.disparos[0].enviados, 3)

  const b = depsEnvio({ disparos: [{ id: 'd1', status: 'enviando' }], envios: pend(100), enviados24h: 0, limite: 'TIER_2K' })
  await processarFila(b.deps, 'c1', AGORA_ENV)
  assert.equal(b.st.posts.length, 60)
  assert.equal(b.st.disparos[0].status, 'enviando')

  const c = depsEnvio({ disparos: [{ id: 'd1', status: 'enviando' }], envios: pend(10), enviados24h: 246 })
  await processarFila(c.deps, 'c1', AGORA_ENV)
  assert.equal(c.st.posts.length, 4)
  assert.equal(c.st.disparos[0].status, 'aguardando_limite')
  assert.equal(c.st.envios.filter((e) => e.status === 'pendente' && !e.reservado).length, 6)
})
test('envio fila: aguardando limite volta a enviar sozinho quando o limite libera', async () => {
  const { deps, st } = depsEnvio({ disparos: [{ id: 'd1', status: 'aguardando_limite' }], envios: pend(2), enviados24h: 10 })
  await processarFila(deps, 'c1', AGORA_ENV)
  assert.equal(st.posts.length, 2)
  assert.equal(st.disparos[0].status, 'concluido')
})
test('envio fila: erro 131042 (pagamento) para o disparo, grava alerta e devolve a pessoa à fila (nada saiu)', async () => {
  const { deps, st } = depsEnvio({ disparos: [{ id: 'd1', status: 'enviando' }, { id: 'd2', status: 'aguardando_limite' }], envios: [...pend(8), ...pend(2, 'd2')], postErro: erroGraph(131042, 'Business eligibility payment issue') })
  const r = await processarFila(deps, 'c1', AGORA_ENV)
  assert.ok(st.posts.length >= 1 && st.posts.length <= 5, `posts ${st.posts.length}`)
  assert.equal(st.disparos[0].status, 'pausado')
  assert.equal(st.disparos[1].status, 'pausado')
  assert.match(st.disparos[0].motivo, /131042/)
  assert.equal(st.alertas.length, 1)
  assert.equal(st.alertas[0].campoId, 'c1')
  assert.equal(st.envios.filter((e) => e.status === 'falhou').length, 0)
  assert.equal(st.envios.filter((e) => e.reservado).length, 0)
  assert.equal(st.envios.filter((e) => e.disparoId === 'd1' && e.status === 'pendente').length, 8)
  assert.ok(r.pausado)
})
test('envio fila: erro 190 também marca a conexão com erro', async () => {
  const { deps, st } = depsEnvio({ disparos: [{ id: 'd1', status: 'enviando' }], envios: pend(2), postErro: erroGraph(190) })
  await processarFila(deps, 'c1', AGORA_ENV)
  assert.equal(st.disparos[0].status, 'pausado')
  assert.equal(st.marcarErro.length, 1)
})
test('envio fila: erro 131026 só falha a pessoa e o disparo segue', async () => {
  const { deps, st } = depsEnvio({
    disparos: [{ id: 'd1', status: 'enviando' }], envios: pend(3),
    postErro: (corpo) => (corpo.to === '5519910000001' ? erroGraph(131026, 'Message undeliverable') : null),
  })
  await processarFila(deps, 'c1', AGORA_ENV)
  assert.equal(st.posts.length, 3)
  const f = st.envios.find((e) => e.telefone === '5519910000001')
  assert.equal(f.status, 'falhou')
  assert.equal(f.erroCodigo, 131026)
  assert.equal(st.envios.filter((e) => e.status === 'enviado').length, 2)
  assert.equal(st.disparos[0].status, 'concluido')
  assert.equal(st.disparos[0].falhos, 1)
  assert.equal(st.alertas.length, 0)
})
test('envio fila: qualidade vermelha pausa sem enviar e grava alerta', async () => {
  const { deps, st } = depsEnvio({ disparos: [{ id: 'd1', status: 'enviando' }], envios: pend(2), qualidade: 'RED' })
  await processarFila(deps, 'c1', AGORA_ENV)
  assert.equal(st.posts.length, 0)
  assert.equal(st.disparos[0].status, 'pausado')
  assert.equal(st.alertas.length, 1)
})
test('envio fila: tempo esgotado da Meta falha só quem estava em voo (sem reenviar) e encerra a rodada', async () => {
  const t = new Error('timeout'); t.name = 'TimeoutError'
  const { deps, st } = depsEnvio({ disparos: [{ id: 'd1', status: 'enviando' }], envios: pend(12), postErro: t })
  await processarFila(deps, 'c1', AGORA_ENV)
  assert.equal(st.posts.length, 5)
  assert.equal(st.envios.filter((e) => e.status === 'falhou').length, 5)
  assert.equal(st.enviados24h, 5)
  assert.equal(st.envios.filter((e) => e.status === 'pendente' && !e.reservado).length, 7)
  assert.equal(st.disparos[0].status, 'enviando')
  const semCodigo = depsEnvio({ disparos: [{ id: 'd1', status: 'enviando' }], envios: pend(1), postErro: new ErroGraph('Graph API respondeu 502', 502, null) })
  await processarFila(semCodigo.deps, 'c1', AGORA_ENV)
  assert.equal(semCodigo.st.envios[0].status, 'falhou')
})
test('envio fila: sem conexão pausa os disparos ativos sem chamar a Meta', async () => {
  const { deps, st } = depsEnvio({ disparos: [{ id: 'd1', status: 'enviando' }], envios: pend(2), conexao: null })
  await processarFila(deps, 'c1', AGORA_ENV)
  assert.equal(st.posts.length, 0)
  assert.equal(st.disparos[0].status, 'pausado')
})
test('envio fila: agendado só entra quando chega a hora', async () => {
  const futuro = depsEnvio({ disparos: [{ id: 'd1', status: 'agendado', agendadoPara: new Date(AGORA_ENV.getTime() + 60_000) }], envios: pend(2) })
  await processarFila(futuro.deps, 'c1', AGORA_ENV)
  assert.equal(futuro.st.posts.length, 0)
  assert.equal(futuro.st.disparos[0].status, 'agendado')
  const vencido = depsEnvio({ disparos: [{ id: 'd1', status: 'agendado', agendadoPara: new Date(AGORA_ENV.getTime() - 60_000) }], envios: pend(2) })
  await processarFila(vencido.deps, 'c1', AGORA_ENV)
  assert.equal(vencido.st.posts.length, 2)
  assert.equal(vencido.st.disparos[0].status, 'concluido')
})
test('envio: cancelar no meio ⇒ nada novo sai no próximo minuto; enviados seguem recebendo status', async () => {
  const { deps, st } = depsEnvio({ disparos: [{ id: 'd1', status: 'enviando' }], envios: pend(100), limite: 'TIER_2K' })
  await processarFila(deps, 'c1', AGORA_ENV)
  assert.equal(st.posts.length, 60)
  await cancelar(deps, 'c1', 'd1')
  assert.equal(st.disparos[0].status, 'cancelado')
  assert.equal(st.envios.filter((e) => e.status === 'pendente').length, 0)
  await processarFila(deps, 'c1', AGORA_ENV)
  assert.equal(st.posts.length, 60)
  await aplicarStatusWebhook(deps, { phoneNumberId: 'PN1', wamid: 'wamid.1', status: 'delivered' })
  assert.equal(st.envios[0].status, 'entregue')
  assert.equal(st.disparos[0].entregues, 1)
  assert.equal(st.disparos[0].status, 'cancelado')
})
test('envio fila: cancelado durante a rodada para em até 10 envios', async () => {
  const { deps, st } = depsEnvio({
    disparos: [{ id: 'd1', status: 'enviando' }], envios: pend(60), limite: 'TIER_2K',
    aoEnviar: (s) => { if (s.posts.length === 3) s.disparos[0].status = 'cancelado' },
  })
  await processarFila(deps, 'c1', AGORA_ENV)
  assert.ok(st.posts.length <= 10, `enviou ${st.posts.length}`)
  assert.equal(st.envios.filter((e) => e.reservado).length, 0)
})
test('envio webhook: delivered depois de read mantém read; failed não sobrescreve entregue', async () => {
  const { deps, st } = depsEnvio({ disparos: [{ id: 'd1', status: 'concluido' }], envios: [{ id: 'e1', disparoId: 'd1', telefone: '5519992126683', status: 'enviado', wamid: 'w1' }, { id: 'e2', disparoId: 'd1', telefone: '5519992126684', status: 'entregue', wamid: 'w2' }] })
  await aplicarStatusWebhook(deps, { phoneNumberId: 'PN1', wamid: 'w1', status: 'read' })
  await aplicarStatusWebhook(deps, { phoneNumberId: 'PN1', wamid: 'w1', status: 'delivered' })
  assert.equal(st.envios[0].status, 'lido')
  await aplicarStatusWebhook(deps, { phoneNumberId: 'PN1', wamid: 'w2', status: 'failed', erroCodigo: 131047, erro: 'x' })
  assert.equal(st.envios[1].status, 'entregue')
  assert.equal(st.disparos[0].lidos, 1)
  assert.equal(st.disparos[0].entregues, 2)
})
test('envio webhook: failed sobre enviado grava o erro', async () => {
  const { deps, st } = depsEnvio({ disparos: [{ id: 'd1', status: 'concluido' }], envios: [{ id: 'e1', disparoId: 'd1', telefone: '5519992126683', status: 'enviado', wamid: 'w1' }] })
  await aplicarStatusWebhook(deps, { phoneNumberId: 'PN1', wamid: 'w1', status: 'failed', erroCodigo: 131049, erro: 'ecosystem' })
  assert.equal(st.envios[0].status, 'falhou')
  assert.equal(st.envios[0].erroCodigo, 131049)
  assert.equal(st.disparos[0].falhos, 1)
})
test('envio webhook: evento de outro phone_number_id é ignorado', async () => {
  const { deps, st } = depsEnvio({ disparos: [{ id: 'd1', status: 'concluido' }], envios: [{ id: 'e1', disparoId: 'd1', telefone: '5519992126683', status: 'enviado', wamid: 'w1' }] })
  await aplicarStatusWebhook(deps, { phoneNumberId: 'OUTRO', wamid: 'w1', status: 'read' })
  assert.equal(st.envios[0].status, 'enviado')
  await registrarSair(deps, 'OUTRO', '5519992126683')
  assert.equal(st.exclusoes.length, 0)
})
test('envio webhook: SAIR entra na exclusão do campo e ignora pendentes do telefone; frase não entra', async () => {
  const { deps, st } = depsEnvio({ disparos: [{ id: 'd1', status: 'enviando' }], envios: [{ id: 'e1', disparoId: 'd1', telefone: '5519992126683', status: 'pendente' }] })
  const payload = (pn, from, body) => ({ entry: [{ changes: [{ value: { metadata: { phone_number_id: pn }, messages: [{ from, type: 'text', text: { body } }] } }] }] })
  await processarWebhook(deps, payload('PN1', '5519992126683', 'quero sair do grupo'))
  assert.equal(st.exclusoes.length, 0)
  await processarWebhook(deps, payload('PN1', '5519992126683', ' SAÍR '))
  assert.deepEqual(st.exclusoes.map((x) => [x.campoId, x.telefone]), [['c1', '5519992126683']])
  assert.equal(st.envios[0].status, 'ignorado')
  await processarWebhook(deps, payload('OUTRO', '5519992126684', 'Sair'))
  assert.equal(st.exclusoes.length, 1)
})
test('envio webhook: wa_id do Brasil sem o 9 vira o celular com 9', () => {
  assert.equal(telefoneDoWaId('551992126683'), '5519992126683')
  assert.equal(telefoneDoWaId('5519992126683'), '5519992126683')
  assert.equal(telefoneDoWaId('551933334444'), null)
  assert.equal(telefoneDoWaId('14155550100'), null)
})
test('envio webhook: extrai statuses e mensagens do payload; payload torto não lança', () => {
  const ev = extrairEventosWebhook({ entry: [{ changes: [{ value: {
    metadata: { phone_number_id: 'PN1' },
    statuses: [{ id: 'w1', status: 'read' }, { id: 'w2', status: 'failed', errors: [{ code: 131026, title: 'Message undeliverable' }] }, { id: 'w3', status: 'deleted' }],
    messages: [{ from: '5519992126683', type: 'text', text: { body: 'Sair' } }, { from: '5519992126683', type: 'image' }],
  } }] }] })
  assert.deepEqual(ev.statuses, [
    { phoneNumberId: 'PN1', wamid: 'w1', status: 'read', erroCodigo: null, erro: null },
    { phoneNumberId: 'PN1', wamid: 'w2', status: 'failed', erroCodigo: 131026, erro: 'Message undeliverable' },
  ])
  assert.deepEqual(ev.mensagens, [{ phoneNumberId: 'PN1', from: '5519992126683', texto: 'Sair' }])
  for (const torto of [null, 1, 'x', {}, { entry: 'x' }, { entry: [{ changes: [null] }] }]) {
    assert.deepEqual(extrairEventosWebhook(torto), { statuses: [], mensagens: [] })
  }
})
test('envio: ordem dos status nunca regride', () => {
  assert.equal(podeAvancarStatus('enviado', 'lido'), true)
  assert.equal(podeAvancarStatus('lido', 'entregue'), false)
  assert.equal(podeAvancarStatus('entregue', 'entregue'), false)
  assert.equal(podeAvancarStatus('pendente', 'falhou'), true)
  assert.equal(podeAvancarStatus('enviado', 'falhou'), true)
  assert.equal(podeAvancarStatus('entregue', 'falhou'), false)
  assert.equal(podeAvancarStatus('falhou', 'lido'), false)
  assert.equal(podeAvancarStatus('ignorado', 'enviado'), false)
})
test('envio: limite do nível e limite restante', async () => {
  assert.equal(limiteDoNivel('TIER_250'), 250)
  assert.equal(limiteDoNivel('TIER_2K'), 2000)
  assert.equal(limiteDoNivel('TIER_100K'), 100000)
  assert.equal(limiteDoNivel('TIER_UNLIMITED'), Infinity)
  assert.equal(limiteDoNivel(null), 250)
  assert.equal(limiteDoNivel('ESQUISITO'), 250)
  const { deps } = depsEnvio({ enviados24h: 100 })
  assert.deepEqual(await limiteRestante(deps, 'c1', AGORA_ENV), { limite: 250, usados: 100, restante: 150, qualidade: 'GREEN' })
})
test('envio: pausar, retomar e cancelar respeitam o status atual; outro campo ⇒ 404', async () => {
  const { deps, st } = depsEnvio({ disparos: [{ id: 'd1', status: 'enviando' }, { id: 'd9', status: 'enviando', campoId: 'c2' }], envios: pend(2) })
  await rej(pausar(deps, 'c1', 'd9'), 404)
  await pausar(deps, 'c1', 'd1')
  assert.equal(st.disparos[0].status, 'pausado')
  await rej(pausar(deps, 'c1', 'd1'), 409)
  await retomar(deps, 'c1', 'd1')
  assert.equal(st.disparos[0].status, 'enviando')
  assert.equal(st.disparos[0].motivo, null)
  await cancelar(deps, 'c1', 'd1')
  await rej(retomar(deps, 'c1', 'd1'), 409)
  await rej(cancelar(deps, 'c1', 'd1'), 409)
})
test('envio: sanear parâmetro e validar entrada do disparo', () => {
  assert.equal(sanearParametro('  Culto\nde\tdomingo      às 19h '), 'Culto de domingo às 19h')
  const filtros = { membros: { igrejaIds: [], situacoes: ['ATIVO'], titulos: [], mesAniversario: null }, interessados: null }
  const base = { nome: 'Boas-vindas', modeloId: '11111111-1111-4111-8111-111111111111', filtros, valores: {}, agendadoPara: null }
  assert.equal(validarEntradaDisparo(base, { agora: AGORA_ENV }).ok, true)
  const vars = [{ posicao: 1, tipo: 'nome', exemplo: 'x' }, { posicao: 2, tipo: 'data', exemplo: 'x' }, { posicao: 3, tipo: 'livre', exemplo: 'x' }]
  const r = validarEntradaDisparo(base, { variaveis: vars, agora: AGORA_ENV })
  assert.equal(r.ok, false)
  assert.equal(r.erros.length, 2)
  const ok = validarEntradaDisparo({ ...base, valores: { data: '25/12', livre: 'a\nb' } }, { variaveis: vars, agora: AGORA_ENV })
  assert.equal(ok.ok, true)
  assert.deepEqual(ok.valor.valores, { data: '25/12', livre: 'a b' })
  assert.equal(validarEntradaDisparo({ ...base, valores: { data: '1', livre: 'x'.repeat(201) } }, { variaveis: vars, agora: AGORA_ENV }).ok, false)
  assert.equal(validarEntradaDisparo({ ...base, nome: '' }, { agora: AGORA_ENV }).ok, false)
  assert.equal(validarEntradaDisparo({ ...base, modeloId: 'x' }, { agora: AGORA_ENV }).ok, false)
  assert.equal(validarEntradaDisparo({ ...base, agendadoPara: 'ontem' }, { agora: AGORA_ENV }).ok, false)
  assert.equal(validarEntradaDisparo({ ...base, agendadoPara: '2026-11-22T10:00:00Z' }, { agora: AGORA_ENV }).ok, false)
  assert.equal(validarEntradaDisparo({ ...base, agendadoPara: '2026-11-24T10:00:00Z' }, { agora: AGORA_ENV }).ok, true)
  assert.equal(validarEntradaDisparo(null, { agora: AGORA_ENV }).ok, false)
  assert.equal(validarFiltros({ membros: null, interessados: null }).length, 1)
  assert.equal(validarFiltros({ membros: { mesAniversario: 13 }, interessados: null }).length, 1)
  assert.equal(validarFiltros({ membros: null, interessados: { cadastroDe: '2026-13-01' } }).length, 1)
  assert.equal(validarFiltros({ membros: { igrejaIds: ['nao-uuid'] }, interessados: null }).length, 1)
  assert.equal(validarFiltros({ membros: {}, interessados: { origens: ['site'], cadastroDe: '2026-01-01', cadastroAte: '2026-02-01' } }).length, 0)
})
test('envio: montar público tira sem celular, excluídos e duplicados (membro vence)', () => {
  const p = montarPublico({
    membros: [
      { id: 'm1', fullName: 'Ana Souza', preferredName: 'Aninha', mobile: '(19) 99212-6683', phone: null, igrejaNome: 'Sede' },
      { id: 'm2', fullName: 'Bia Lima', preferredName: null, mobile: '19 3333-4444', phone: '19 99111-2222', igrejaNome: 'Sede' },
      { id: 'm3', fullName: 'Caio', preferredName: null, mobile: null, phone: '19 3333-4444', igrejaNome: 'Sede' },
      { id: 'm4', fullName: 'Duda', preferredName: null, mobile: '19 99000-0001', phone: null, igrejaNome: 'Sede' },
    ],
    interessados: [{ id: 'l1', fullName: 'Ana S', phone: '5519992126683', igrejaNome: 'Vila' }],
  }, new Set(['5519990000001']))
  assert.deepEqual(p.contatos.map((c) => [c.origem, c.refId, c.nome, c.telefone]), [
    ['membro', 'm1', 'Aninha', '5519992126683'],
    ['membro', 'm2', 'Bia Lima', '5519991112222'],
  ])
  assert.deepEqual([p.semCelular, p.excluidos, p.duplicados], [1, 1, 1])
})
test('envio: criar disparo só com modelo APROVADO do campo, grava envios com parâmetros', async () => {
  const modelos = [
    { id: '11111111-1111-4111-8111-111111111111', campoId: 'c1', status: 'APPROVED', nome: 'boas_vindas', idioma: 'pt_BR', categoria: 'MARKETING', variaveis: [{ posicao: 1, tipo: 'nome', exemplo: 'x' }, { posicao: 2, tipo: 'igreja', exemplo: 'x' }] },
    { id: '22222222-2222-4222-8222-222222222222', campoId: 'c1', status: 'PENDING', nome: 'b', idioma: 'pt_BR', categoria: 'MARKETING', variaveis: [] },
    { id: '33333333-3333-4333-8333-333333333333', campoId: 'c2', status: 'APPROVED', nome: 'c', idioma: 'pt_BR', categoria: 'MARKETING', variaveis: [] },
  ]
  const contatos = { membros: [{ id: 'm1', fullName: 'Ana Souza', preferredName: null, mobile: '19992126683', phone: null, igrejaNome: 'Sede' }], interessados: [] }
  const entrada = (modeloId, extra = {}) => ({ nome: 'Teste', modeloId, filtros: { membros: {}, interessados: null }, valores: {}, agendadoPara: null, ...extra })
  const a = depsEnvio({ modelos, contatos })
  await rej(criarDisparo(a.deps, 'c1', 'u1', entrada(modelos[1].id), AGORA_ENV), 400)
  await rej(criarDisparo(a.deps, 'c1', 'u1', entrada(modelos[2].id), AGORA_ENV), 404)
  await rej(criarDisparo(a.deps, 'c1', 'u1', { nome: '' }, AGORA_ENV), 400)
  const r = await criarDisparo(a.deps, 'c1', 'u1', entrada(modelos[0].id), AGORA_ENV)
  assert.equal(r.total, 1)
  assert.equal(a.st.criados.d.status, 'enviando')
  assert.equal(a.st.criados.d.modeloNome, 'boas_vindas')
  assert.equal(a.st.criados.d.criadoPor, 'u1')
  assert.deepEqual(a.st.criados.e[0].parametros, { body: ['Ana', 'Sede'] })
  assert.equal(a.st.criados.e[0].disparoId, a.st.criados.d.id)
  const ag = await criarDisparo(a.deps, 'c1', 'u1', entrada(modelos[0].id, { agendadoPara: '2026-11-24T10:00:00Z' }), AGORA_ENV)
  assert.equal(a.st.criados.d.status, 'agendado')
  assert.equal(ag.total, 1)
  const vazio = depsEnvio({ modelos, contatos: { membros: [], interessados: [] } })
  await rej(criarDisparo(vazio.deps, 'c1', 'u1', entrada(modelos[0].id), AGORA_ENV), 400)
  const semCon = depsEnvio({ modelos, contatos, conexao: null })
  await rej(criarDisparo(semCon.deps, 'c1', 'u1', entrada(modelos[0].id), AGORA_ENV), 409)
})
test('envio: mesma chave de idempotência cria um só disparo (resposta perdida não duplica)', async () => {
  const modelo = { id: '11111111-1111-4111-8111-111111111111', campoId: 'c1', status: 'APPROVED', nome: 'boas_vindas', idioma: 'pt_BR', categoria: 'MARKETING', variaveis: [{ posicao: 1, tipo: 'nome', exemplo: 'x' }] }
  const contatos = { membros: [{ id: 'm1', fullName: 'Ana Souza', preferredName: null, mobile: '19992126683', phone: null, igrejaNome: 'Sede' }], interessados: [] }
  const chave = '9f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f'
  const corpo = { nome: 'Teste', modeloId: modelo.id, filtros: { membros: {}, interessados: null }, valores: {}, agendadoPara: null, chave }
  const a = depsEnvio({ modelos: [modelo], contatos })
  const r1 = await criarDisparo(a.deps, 'c1', 'u1', corpo, AGORA_ENV)
  const r2 = await criarDisparo(a.deps, 'c1', 'u1', corpo, AGORA_ENV)
  assert.equal(a.st.disparos.length, 1)
  assert.equal(a.st.criados.d.valores.chave, chave)
  assert.equal(a.st.criados.d.id, chave) // a chave do cliente é o id do disparo
  assert.equal(r1.id, chave)
  assert.equal(r2.id, r1.id)
  assert.equal(r2.repetido, true)
  // outro campo com a mesma chave: 409, sem ver nem criar nada
  const b = depsEnvio({ modelos: [{ ...modelo, campoId: 'c2' }], contatos, disparos: a.st.disparos })
  await rej(criarDisparo(b.deps, 'c2', 'u1', corpo, AGORA_ENV), 409)
  assert.equal(b.st.disparos.length, 1)
})
test('envio: retry enquanto a criação ainda grava ⇒ P2002 na PK devolve o mesmo disparo com contadores reais', async () => {
  const modelo = { id: '11111111-1111-4111-8111-111111111111', campoId: 'c1', status: 'APPROVED', nome: 'boas_vindas', idioma: 'pt_BR', categoria: 'MARKETING', variaveis: [{ posicao: 1, tipo: 'nome', exemplo: 'x' }] }
  const contatos = { membros: [{ id: 'm1', fullName: 'Ana Souza', preferredName: null, mobile: '19992126683', phone: null, igrejaNome: 'Sede' }], interessados: [] }
  const chave = '9f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f'
  const corpo = { nome: 'Teste', modeloId: modelo.id, filtros: { membros: {}, interessados: null }, valores: {}, agendadoPara: null, chave }
  // O primeiro pedido ainda não comitou quando o segundo olha (a leitura prévia não acha nada);
  // quando o segundo chega ao INSERT, o primeiro já comitou ⇒ P2002.
  const primeiro = { id: chave, campoId: 'c1', status: 'enviando', total: 40, enviados: 12, entregues: 7, lidos: 3, falhos: 1 }
  const a = depsEnvio({ modelos: [modelo], contatos, disparos: [primeiro] })
  const resumo = a.deps.repo.resumoDisparo
  let leituras = 0
  a.deps.repo.resumoDisparo = async (id) => (++leituras === 1 ? null : resumo(id))
  const r = await criarDisparo(a.deps, 'c1', 'u1', corpo, AGORA_ENV)
  assert.equal(leituras, 2)
  assert.equal(a.st.disparos.length, 1)
  assert.equal(a.st.criados, null)
  assert.deepEqual(r, { id: chave, total: 40, status: 'enviando', repetido: true, enviados: 12, entregues: 7, lidos: 3, falhos: 1 })
  // Mesma corrida com o id já usado em outro campo ⇒ 409
  const b = depsEnvio({ modelos: [modelo], contatos, disparos: [{ ...primeiro, campoId: 'c9' }] })
  const resumoB = b.deps.repo.resumoDisparo
  let lb = 0
  b.deps.repo.resumoDisparo = async (id) => (++lb === 1 ? null : resumoB(id))
  await rej(criarDisparo(b.deps, 'c1', 'u1', corpo, AGORA_ENV), 409)
  // P2002 sem disparo achado (outro unique) ⇒ o erro original sobe
  const c = depsEnvio({ modelos: [modelo], contatos })
  c.deps.repo.criarDisparoComEnvios = async () => { const e = new Error('outro unique'); e.code = 'P2002'; throw e }
  await assert.rejects(criarDisparo(c.deps, 'c1', 'u1', corpo, AGORA_ENV), /outro unique/)
})
test('envio fila: erro do modelo (132015/132016/132001/132000/132012) pausa só o disparo, devolve a pessoa e alerta', async () => {
  for (const codigo of [132015, 132016, 132001, 132000, 132012]) {
    const { deps, st } = depsEnvio({ disparos: [{ id: 'd1', status: 'enviando' }, { id: 'd2', status: 'enviando' }], envios: [...pend(8), ...pend(2, 'd2')], postErro: (corpo) => (corpo.to.startsWith('55199') ? erroGraph(codigo, 'template') : null) })
    const r = await processarFila(deps, 'c1', AGORA_ENV)
    assert.equal(st.disparos[0].status, 'pausado', `${codigo}`)
    assert.match(st.disparos[0].motivo, new RegExp(String(codigo)))
    assert.equal(st.disparos[1].status, 'enviando', `${codigo}: outro disparo não pausa`)
    assert.equal(st.alertas.length, 1)
    assert.equal(st.envios.filter((e) => e.status === 'falhou').length, 0, `${codigo}: ninguém falha`)
    assert.equal(st.envios.filter((e) => e.reservado).length, 0)
    assert.equal(st.envios.filter((e) => e.disparoId === 'd1' && e.status === 'pendente').length, 8)
    assert.ok(r.pausado)
  }
})
test('envio fila: 131048 (limite de spam) pausa todos os disparos do campo sem falhar ninguém', async () => {
  const { deps, st } = depsEnvio({ disparos: [{ id: 'd1', status: 'enviando' }, { id: 'd2', status: 'aguardando_limite' }], envios: [...pend(8), ...pend(2, 'd2')], postErro: erroGraph(131048, 'Spam rate limit hit') })
  await processarFila(deps, 'c1', AGORA_ENV)
  assert.equal(st.disparos[0].status, 'pausado')
  assert.equal(st.disparos[1].status, 'pausado')
  assert.match(st.disparos[0].motivo, /131048/)
  assert.equal(st.alertas.length, 1)
  assert.equal(st.envios.filter((e) => e.status === 'falhou').length, 0)
  assert.equal(st.envios.filter((e) => e.reservado).length, 0)
})
test('envio fila: 4 e 80007 (limite de chamadas) devolvem à fila e encerram a rodada sem pausar', async () => {
  for (const codigo of [4, 80007]) {
    const { deps, st } = depsEnvio({ disparos: [{ id: 'd1', status: 'enviando' }], envios: pend(20), postErro: erroGraph(codigo, 'rate') })
    const r = await processarFila(deps, 'c1', AGORA_ENV)
    assert.ok(st.posts.length >= 1 && st.posts.length <= 5, `${codigo}: posts ${st.posts.length}`)
    assert.equal(st.disparos[0].status, 'enviando')
    assert.equal(st.alertas.length, 0)
    assert.equal(st.envios.filter((e) => e.status === 'falhou').length, 0)
    assert.equal(st.envios.filter((e) => e.reservado).length, 0)
    assert.equal(st.envios.filter((e) => e.status === 'pendente').length, 20)
    assert.equal(r.pausado, undefined)
  }
})
test('envio: contar público usa contagem do repositório', async () => {
  const { deps } = depsEnvio()
  assert.deepEqual(await contarPublico(deps, 'c1', { membros: {}, interessados: {} }), { membros: 7, interessados: 3, total: 10 })
  await rej(contarPublico(deps, 'c1', { membros: null, interessados: null }), 400)
})
test('envio webhook: erro num evento não impede os outros', async () => {
  const { deps, st } = depsEnvio({ disparos: [{ id: 'd1', status: 'concluido' }], envios: [{ id: 'e1', disparoId: 'd1', telefone: '5519992126683', status: 'enviado', wamid: 'w1' }] })
  const original = deps.repo.buscarEnvioPorWamid
  deps.repo.buscarEnvioPorWamid = async (c, w) => { if (w === 'quebra') throw new Error('banco'); return original(c, w) }
  const r = await processarWebhook(deps, { entry: [{ changes: [{ value: { metadata: { phone_number_id: 'PN1' }, statuses: [{ id: 'quebra', status: 'read' }, { id: 'w1', status: 'read' }] } }] }] })
  assert.equal(r.erros, 1)
  assert.equal(r.status, 1)
  assert.equal(st.envios[0].status, 'lido')
})

test('envio fila: cancelar durante a rodada não apaga quem já saiu; webhook atualiza; sobra vira ignorado', async () => {
  let cancelou = false
  const { deps, st } = depsEnvio({
    disparos: [{ id: 'd1', status: 'enviando' }], envios: pend(30), limite: 'TIER_2K',
    aoEnviar: async (s) => { if (s.posts.length === 3 && !cancelou) { cancelou = true; await deps.repo.cancelar('d1', ['enviando']) } },
  })
  await processarFila(deps, 'c1', AGORA_ENV)
  const n = st.posts.length
  assert.ok(n >= 3 && n <= 10, `enviou ${n}`)
  const saiu = st.envios.filter((e) => e.wamid)
  assert.equal(saiu.length, n)
  assert.ok(saiu.every((e) => e.status === 'enviado' && e.enviadoEm))
  assert.equal(st.enviados24h, n)
  assert.equal(st.envios.filter((e) => e.status === 'pendente').length, 0)
  assert.equal(st.envios.filter((e) => e.status === 'ignorado').length, 30 - n)
  await aplicarStatusWebhook(deps, { phoneNumberId: 'PN1', wamid: saiu[n - 1].wamid, status: 'read' })
  assert.equal(saiu[n - 1].status, 'lido')
  assert.equal(st.disparos[0].status, 'cancelado')
})
test('envio fila: SAIR durante a rodada ⇒ o não enviado desse telefone não volta à fila', async () => {
  const lista = pend(12)
  const { deps, st } = depsEnvio({
    disparos: [{ id: 'd1', status: 'enviando' }], envios: lista, limite: 'TIER_2K',
    aoEnviar: async (s) => { if (s.posts.length === 1) { await registrarSair(deps, 'PN1', lista[11].telefone); s.disparos[0].status = 'pausado' } },
  })
  await processarFila(deps, 'c1', AGORA_ENV)
  assert.equal(st.envios[11].status, 'ignorado')
  assert.equal(st.envios.filter((e) => e.status === 'pendente' && !e.reservado).length, 12 - st.posts.length - 1)
})
test('envio fila: gravação falha depois do POST ⇒ item fica reservado (nunca reenviado) e a varredura o torna falhou', async () => {
  const { deps, st } = depsEnvio({ disparos: [{ id: 'd1', status: 'enviando' }], envios: pend(8) })
  st.quebrarGravacao = true
  await assert.rejects(processarFila(deps, 'c1', AGORA_ENV), /pooler/)
  assert.equal(st.posts.length, 5)
  const emVoo = st.envios.slice(0, 5)
  assert.ok(emVoo.every((e) => e.reservado && e.status === 'pendente'))
  assert.equal(st.envios.filter((e) => e.status === 'pendente' && !e.reservado).length, 3)
  assert.deepEqual(st.liberados, st.envios.slice(5).map((e) => e.id))
  st.quebrarGravacao = false
  await processarFila(deps, 'c1', AGORA_ENV)
  assert.equal(st.posts.length, 8)
  assert.ok(emVoo.every((e) => st.posts.filter((p) => p.corpo.to === e.telefone).length === 1))
  for (const e of emVoo) e.vencida = true
  await processarFila(deps, 'c1', AGORA_ENV)
  assert.ok(emVoo.every((e) => e.status === 'falhou'))
  assert.equal(st.posts.length, 8)
  assert.equal(st.disparos[0].status, 'concluido')
})
test('envio fila: 130429 (vazão) devolve a pessoa à fila e encerra a rodada', async () => {
  const { deps, st } = depsEnvio({ disparos: [{ id: 'd1', status: 'enviando' }], envios: pend(12), postErro: erroGraph(130429) })
  await processarFila(deps, 'c1', AGORA_ENV)
  assert.equal(st.posts.length, 5)
  assert.equal(st.envios.filter((e) => e.status === 'falhou').length, 0)
  assert.equal(st.envios.filter((e) => e.status === 'pendente' && !e.reservado).length, 12)
  assert.equal(st.disparos[0].status, 'enviando')
})
test('envio fila: no máximo 5 POSTs ao mesmo tempo; cada um grava logo após o próprio POST; prazo não começa POST novo', async () => {
  let emVoo = 0
  let pico = 0
  const { deps, st } = depsEnvio({ disparos: [{ id: 'd1', status: 'enviando' }], envios: pend(20), limite: 'TIER_2K' })
  const marcar = deps.repo.marcarEnviado
  deps.graph.post = async (caminho, corpo) => {
    st.posts.push({ caminho, corpo })
    emVoo++; pico = Math.max(pico, emVoo)
    await new Promise((r) => setTimeout(r, 5))
    emVoo--
    return { messages: [{ id: 'w-' + corpo.to }] }
  }
  const gravouAntesDoFim = []
  deps.repo.marcarEnviado = async (id, w, q) => { gravouAntesDoFim.push(st.posts.length < 20); return marcar(id, w, q) }
  await processarFila(deps, 'c1', AGORA_ENV)
  assert.equal(pico, 5)
  assert.equal(st.posts.length, 20)
  assert.ok(gravouAntesDoFim.some(Boolean), 'gravou durante a rodada, não só no fim')
  assert.equal(st.disparos[0].status, 'concluido')

  let relogio = 0
  const p = depsEnvio({ disparos: [{ id: 'd1', status: 'enviando' }], envios: pend(20), limite: 'TIER_2K' })
  p.deps.agoraMs = () => relogio
  p.deps.graph.post = async (caminho, corpo) => { p.st.posts.push({ caminho, corpo }); relogio += 400; return { messages: [{ id: 'w-' + corpo.to }] } }
  await processarFila(p.deps, 'c1', AGORA_ENV, { prazoMs: 1000 })
  assert.ok(p.st.posts.length < 20)
  assert.equal(p.st.envios.filter((e) => e.reservado).length, 0)
  assert.equal(p.st.envios.filter((e) => e.status === 'pendente').length, 20 - p.st.posts.length)
})

test('telefone mascarado nunca sai completo', () => {
  assert.equal(mascararTelefone('5519991236683'), '+55 19 9****-6683')
  assert.equal(mascararTelefone('123'), '****')
  assert.equal(mascararTelefone(null), '****')
  assert.ok(!mascararTelefone('5511987654321').includes('987654'))
})
test('pendente reservado (-1) aparece como enviando; outros ficam', () => {
  assert.equal(statusDoEnvio('pendente', -1), 'enviando')
  assert.equal(statusDoEnvio('pendente', null), 'pendente')
  assert.equal(statusDoEnvio('falhou', -1), 'falhou')
  assert.equal(statusDoEnvio('falhou', 131026), 'falhou')
})
test('ação de controle e paginação do detalhe', () => {
  assert.deepEqual(lerAcaoControle({ acao: 'pausar' }), { ok: true, acao: 'pausar' })
  for (const ruim of [null, {}, { acao: 'apagar' }, { acao: 1 }, 'pausar']) assert.equal(lerAcaoControle(ruim).ok, false)
  assert.deepEqual(lerPaginacao(null, null), { pagina: 1, porPagina: 50 })
  assert.deepEqual(lerPaginacao('3', '500'), { pagina: 3, porPagina: 100 })
  assert.deepEqual(lerPaginacao('-1', '0'), { pagina: 1, porPagina: 50 })
  assert.deepEqual(lerPaginacao('abc', '1.5'), { pagina: 1, porPagina: 50 })
})
