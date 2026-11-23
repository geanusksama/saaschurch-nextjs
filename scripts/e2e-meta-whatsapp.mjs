/**
 * E2E das rotas do WhatsApp Oficial (Meta Cloud API).
 *
 * Sempre roda: desafio do webhook, assinatura do webhook, 401 sem token.
 * Com MRM_TOKEN (token do localStorage `mrm_token`, usuário COM campo ativo): status vazio,
 * 409 de número duplicado, token cifrado corrompido. Opcional MRM_TOKEN_SEM_CAMPO:
 * usuário sem campo ativo (400).
 *
 * Pré-requisitos: META_TOKEN_ENCRYPTION_KEY no .env.local (cifra o token de teste do DELETE de modelos)
 * e a tabela meta_whatsapp_modelos aplicada. O script apaga e recria a conexão do campo de teste
 * (e a do "outro campo"), restaurando as originais no final.
 *
 * Exige META_* no .env.local e o `next dev` reiniciado depois de editá-lo.
 * Uso: node scripts/e2e-meta-whatsapp.mjs [http://localhost:3000]
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })
import crypto from 'node:crypto'
import { cifrar } from '../src/lib/meta/cifra.ts'
import { PrismaClient } from '@prisma/client'

const BASE = process.argv[2] || process.env.MRM_BASE || 'http://localhost:3000'
const API = `${BASE}/api/meta/whatsapp`
const TOKEN = process.env.MRM_TOKEN
const TOKEN_SEM_CAMPO = process.env.MRM_TOKEN_SEM_CAMPO
const prisma = new PrismaClient()

let ok = 0, falhou = 0
function check(rotulo, cond, detalhe = '') {
  if (cond) { ok++; console.log(`  ✓ ${rotulo}`) } else { falhou++; console.log(`  ✗ ${rotulo} ${detalhe}`) }
}
const auth = (t) => ({ Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' })

async function semAutenticacao() {
  const vt = process.env.META_WEBHOOK_VERIFY_TOKEN
  const segredo = process.env.META_APP_SECRET
  if (!vt || !segredo) { check('META_* definidas no .env.local', false); return }
  console.log('\nWebhook')
  let r = await fetch(`${API}/webhook?hub.mode=subscribe&hub.verify_token=${vt}&hub.challenge=42`)
  check('desafio com token certo ⇒ 200 e corpo 42', r.status === 200 && (await r.text()) === '42', `status ${r.status}`)
  r = await fetch(`${API}/webhook?hub.mode=subscribe&hub.verify_token=errado&hub.challenge=42`)
  check('desafio com token errado ⇒ 403', r.status === 403, `status ${r.status}`)
  const corpo = JSON.stringify({ object: 'whatsapp_business_account', entry: [] })
  r = await fetch(`${API}/webhook`, { method: 'POST', body: corpo, headers: { 'Content-Type': 'application/json' } })
  check('POST sem assinatura ⇒ 401', r.status === 401, `status ${r.status}`)
  r = await fetch(`${API}/webhook`, { method: 'POST', body: corpo, headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': 'sha256=' + '0'.repeat(64) } })
  check('POST com assinatura errada ⇒ 401', r.status === 401, `status ${r.status}`)
  const sig = 'sha256=' + crypto.createHmac('sha256', segredo).update(corpo).digest('hex')
  r = await fetch(`${API}/webhook`, { method: 'POST', body: corpo, headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': sig } })
  check('POST com assinatura correta ⇒ 200', r.status === 200, `status ${r.status}`)
  console.log('\nSem token')
  r = await fetch(`${API}/conexao`)
  check('GET /conexao sem Authorization ⇒ 401', r.status === 401, `status ${r.status}`)
  r = await fetch(`${BASE}/api/meta/app-config`)
  check('GET /app-config sem token ⇒ 401', r.status === 401, `status ${r.status}`)
  r = await fetch(`${BASE}/api/meta/app-config`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{"conexaoLiberada":true}' })
  check('PUT /app-config sem autenticação ⇒ 401', r.status === 401, `status ${r.status}`)
  r = await fetch(`${BASE}/api/meta/app-config`, { headers: { 'x-meta-config-token': 'errado' } })
  check('GET /app-config com token errado ⇒ 401', r.status === 401, `status ${r.status}`)
  console.log('\nModelos sem token')
  const UUID0 = '00000000-0000-4000-8000-000000000000'
  r = await fetch(`${API}/modelos`)
  check('GET /modelos sem Authorization ⇒ 401', r.status === 401, `status ${r.status}`)
  r = await fetch(`${API}/modelos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
  check('POST /modelos sem Authorization ⇒ 401', r.status === 401, `status ${r.status}`)
  r = await fetch(`${API}/modelos/${UUID0}`, { method: 'DELETE' })
  check('DELETE /modelos/:id sem Authorization ⇒ 401', r.status === 401, `status ${r.status}`)
  r = await fetch(`${API}/modelos/sincronizar`, { method: 'POST' })
  check('POST /modelos/sincronizar sem Authorization ⇒ 401', r.status === 401, `status ${r.status}`)
  r = await fetch(`${BASE}/api/cron/meta-modelos`)
  check('cron meta-modelos sem segredo ⇒ 401', r.status === 401, `status ${r.status}`)
  console.log('\nMonitor')
  r = await fetch(`${BASE}/api/cron/meta-monitor`)
  check('cron meta-monitor sem segredo ⇒ 401', r.status === 401, `status ${r.status}`)
  r = await fetch(`${BASE}/api/meta/app-config/alertas`)
  check('GET /app-config/alertas sem autenticação ⇒ 401', r.status === 401, `status ${r.status}`)
}

async function autenticado() {
  console.log('\nCom usuário do campo')
  const me = await (await fetch(`${BASE}/api/auth/me`, { headers: auth(TOKEN) })).json()
  const campoId = me.campoId ?? me.user?.campoId
  if (!campoId) { check('usuário MRM_TOKEN tem campo ativo', false); return }
  const criados = []
  const salvas = [] // conexões reais apagadas pelo teste; recriadas iguais no finally
  const guardar = async (cid) => {
    const antes = await prisma.metaWhatsappConexao.findUnique({ where: { campoId: cid } })
    if (antes) salvas.push(antes)
  }
  const modelosCriados = []
  try {
    await guardar(campoId)
    await prisma.metaWhatsappConexao.deleteMany({ where: { campoId } })
    let r = await fetch(`${API}/conexao`, { headers: auth(TOKEN) })
    let j = await r.json()
    check('GET sem conexão ⇒ { conectado:false }', r.status === 200 && j.conectado === false, JSON.stringify(j))

    // Modelos (exige a tabela meta_whatsapp_modelos aplicada)
    r = await fetch(`${API}/modelos`, { headers: auth(TOKEN) })
    j = await r.json()
    check('GET /modelos sem conexão ⇒ 200 conectado:false', r.status === 200 && j.conectado === false && Array.isArray(j.modelos) && j.modelos.length === 0, JSON.stringify(j))
    r = await fetch(`${API}/modelos`, { method: 'POST', headers: auth(TOKEN),
      body: JSON.stringify({ nome: 'Nome Inválido', categoria: 'MARKETING', corpo: '{{1}} oi', variaveis: [] }) })
    j = await r.json()
    check('POST /modelos inválido ⇒ 400 com lista de erros', r.status === 400 && Array.isArray(j.erros) && j.erros.length > 0, JSON.stringify(j))
    r = await fetch(`${API}/modelos`, { method: 'POST', headers: auth(TOKEN), body: JSON.stringify({ nome: 5 }) })
    j = await r.json()
    check('POST /modelos com forma errada ⇒ 400', r.status === 400 && Array.isArray(j.erros), JSON.stringify(j))
    // DELETE: conexão com token cifrado VÁLIDO (senão o 401 vem antes do 404)
    const chave = (process.env.META_TOKEN_ENCRYPTION_KEY ?? '').trim()
    if (!chave) check('META_TOKEN_ENCRYPTION_KEY definida para cifrar o token do teste', false)
    else {
      const cx = await prisma.metaWhatsappConexao.create({ data: {
        campoId, wabaId: 'e2e-waba', phoneNumberId: 'e2e-modelos',
        tokenCifrado: cifrar('e2e-token', chave), pinCifrado: cifrar('000000', chave), status: 'conectado' } })
      criados.push(cx.id)
      r = await fetch(`${API}/modelos/00000000-0000-4000-8000-000000000000`, { method: 'DELETE', headers: auth(TOKEN) })
      check('DELETE de uuid inexistente ⇒ 404', r.status === 404, `status ${r.status}`)
      r = await fetch(`${API}/modelos/nao-e-uuid`, { method: 'DELETE', headers: auth(TOKEN) })
      check('DELETE de id fora do formato ⇒ 404', r.status === 404, `status ${r.status}`)
      const outroCampo = await prisma.campo.findFirst({ where: { id: { not: campoId } }, select: { id: true } })
      if (!outroCampo) check('existe outro campo para o teste de isolamento', false)
      else {
        const alheio = await prisma.metaWhatsappModelo.create({ data: {
          campoId: outroCampo.id, wabaId: 'e2e-waba-outro', metaTemplateId: 'e2e-alheio', nome: 'e2e_alheio',
          categoria: 'UTILITY', status: 'APPROVED' } })
        modelosCriados.push(alheio.id)
        r = await fetch(`${API}/modelos/${alheio.id}`, { method: 'DELETE', headers: auth(TOKEN) })
        check('DELETE de modelo de outro campo ⇒ 404', r.status === 404, `status ${r.status}`)
        check('modelo de outro campo continua existindo', (await prisma.metaWhatsappModelo.count({ where: { id: alheio.id } })) === 1)
      }
    }

    // Duplicado em outro campo (mantém a unicidade do campo_id)
    const outro = await prisma.campo.findFirst({ where: { id: { not: campoId } }, select: { id: true } })
    if (!outro) check('existe outro campo para o teste de duplicado', false)
    else {
      await guardar(outro.id)
      await prisma.metaWhatsappConexao.deleteMany({ where: { campoId: outro.id } })
      const dup = await prisma.metaWhatsappConexao.create({ data: {
        campoId: outro.id, wabaId: 'e2e-waba', phoneNumberId: 'e2e-dup', tokenCifrado: 'x', pinCifrado: 'x', status: 'conectado' } })
      criados.push(dup.id)
      r = await fetch(`${API}/conexao`, { method: 'POST', headers: auth(TOKEN),
        body: JSON.stringify({ code: 'c', wabaId: 'w', phoneNumberId: 'e2e-dup' }) })
      j = await r.json()
      check('POST com phoneNumberId de outro campo ⇒ 409 (antes de chamar a Meta)', r.status === 409, `status ${r.status} ${JSON.stringify(j)}`)
    }

    // Token corrompido (campoId é único: libera a conexão do bloco do DELETE antes)
    await prisma.metaWhatsappConexao.deleteMany({ where: { campoId } })
    const lixo = await prisma.metaWhatsappConexao.create({ data: {
      campoId, wabaId: 'e2e-waba', phoneNumberId: 'e2e-lixo', tokenCifrado: 'lixo', pinCifrado: 'lixo', status: 'conectado' } })
    criados.push(lixo.id)
    r = await fetch(`${API}/conexao`, { headers: auth(TOKEN) })
    const texto = await r.text(); j = JSON.parse(texto)
    check('token corrompido ⇒ 200 com status erro', r.status === 200 && j.status === 'erro', `status ${r.status}`)
    check('ultimoErro pede para reconectar', /reconecte/i.test(j.ultimoErro ?? ''), texto)
    check('resposta não contém o token', !texto.includes('lixo'))
  } finally {
    if (criados.length) await prisma.metaWhatsappConexao.deleteMany({ where: { id: { in: criados } } })
    for (const c of salvas) {
      await prisma.metaWhatsappConexao.deleteMany({ where: { OR: [{ campoId: c.campoId }, { phoneNumberId: c.phoneNumberId }] } })
      await prisma.metaWhatsappConexao.create({ data: c })
    }
    if (modelosCriados.length) await prisma.metaWhatsappModelo.deleteMany({ where: { id: { in: modelosCriados } } })
  }
  if (TOKEN_SEM_CAMPO) {
    console.log('\nUsuário sem campo ativo')
    const antes = await prisma.metaWhatsappConexao.count()
    let r = await fetch(`${API}/conexao`, { headers: auth(TOKEN_SEM_CAMPO) })
    let j = await r.json()
    check('GET ⇒ 400 "Selecione um campo"', r.status === 400 && /Selecione um campo/.test(j.error ?? ''), `status ${r.status}`)
    r = await fetch(`${API}/conexao`, { method: 'POST', headers: auth(TOKEN_SEM_CAMPO),
      body: JSON.stringify({ code: 'c', wabaId: 'w', phoneNumberId: 'p' }) })
    j = await r.json()
    check('POST ⇒ 400 "Selecione um campo"', r.status === 400 && /Selecione um campo/.test(j.error ?? ''), `status ${r.status}`)
    check('nada gravado', (await prisma.metaWhatsappConexao.count()) === antes)
  } else console.log('\npulado (sem campo): defina MRM_TOKEN_SEM_CAMPO')
}

try {
  await semAutenticacao()
  if (TOKEN) await autenticado(); else console.log('\npulado: defina MRM_TOKEN')
} finally {
  await prisma.$disconnect()
}
console.log(`\n${ok} ok, ${falhou} falhas`)
process.exit(falhou ? 1 : 0)
