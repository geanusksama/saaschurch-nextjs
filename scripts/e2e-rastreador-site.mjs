/**
 * E2E do Rastreador do site (12/11/2026).
 *
 * 1. POST /api/public/site-eventos como se viesse de adcampinas.com.br
 *    (Host) — visitas do Google, do Instagram e direto; cliques.
 *    Robô e página do painel (/app-ui) NÃO podem ser gravados.
 * 2. GET /api/site-rastreio (painel e detalhe) com um usuário master
 *    temporário no campo Campinas: totais, origem, páginas, cliques.
 * 3. Usuário sem permissão (perfil church) recebe 403.
 *
 * Tudo marcado: visitante "e2e-…" e usuário [E2E]; apagado no fim.
 * Precisa do servidor rodando. Uso: npx tsx scripts/e2e-rastreador-site.mjs [--base=http://localhost:3005]
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })

import http from 'node:http'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'

const prisma = new PrismaClient()
const BASE = (process.argv.find((a) => a.startsWith('--base=')) || '--base=http://localhost:3000').slice(7)
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const CAMPINAS = '7e1cfbf6-f7b5-48d0-8926-7ed272e07e1d'
const SUFIXO = randomUUID().slice(0, 8)
const EMAIL = `e2e-rastreio-${SUFIXO}@example.com`
const UA_CEL = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const UA_PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'

let falhas = 0; let passos = 0
const ok = (nome, cond, det = '') => { passos++; if (cond) console.log(`  ok   ${nome}`); else { falhas++; console.log(`  FALHA ${nome}${det ? ` — ${det}` : ''}`) } }

/** POST com Host de produção (fetch do Node não deixa trocar o Host). */
function enviar(corpo, ua, caminho = '/api/public/site-eventos') {
  const url = new URL(caminho, BASE)
  const dados = JSON.stringify(corpo)
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: url.hostname, port: url.port, path: url.pathname + url.search, method: 'POST',
      headers: { Host: 'www.adcampinas.com.br', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(dados), 'User-Agent': ua } },
      (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)) })
    req.on('error', reject)
    req.end(dados)
  })
}

async function token() {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: EMAIL })
  if (error) throw new Error(error.message)
  const anon = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const { data: s, error: e } = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'magiclink' })
  if (e) throw new Error(e.message)
  return s.session.access_token
}
async function api(caminho, tk) {
  const r = await fetch(`${BASE}${caminho}`, { headers: { Authorization: `Bearer ${tk}` } })
  return { status: r.status, json: await r.json().catch(() => null) }
}

const criados = { userId: null, authId: null }
const visitantes = [`e2e-${SUFIXO}-a`, `e2e-${SUFIXO}-b`, `e2e-${SUFIXO}-c`]

async function limpar() {
  await prisma.siteEvento.deleteMany({ where: { visitanteId: { startsWith: `e2e-${SUFIXO}` } } })
  if (criados.userId) await prisma.user.delete({ where: { id: criados.userId } }).catch(() => {})
  if (criados.authId) await admin.auth.admin.deleteUser(criados.authId).catch(() => {})
}

const hoje = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10)

async function main() {
  console.log(`E2E rastreador do site — ${BASE}`)
  console.log('\n1. Gravação pública')
  let st = await enviar({ visitante: visitantes[0], sessao: `e2e-${SUFIXO}-s1`, referrer: 'https://www.google.com/', eventos: [
    { tipo: 'pagina', caminho: '/', titulo: 'Início' },
    { tipo: 'pagina', caminho: '/gf', titulo: 'GF' },
    { tipo: 'clique', caminho: '/gf', alvo: `[E2E] Quero participar ${SUFIXO}`, alvoUrl: 'https://wa.me/5500000000000' },
  ] }, UA_CEL)
  ok('envio responde 204', st === 204, `status ${st}`)
  await enviar({ visitante: visitantes[1], sessao: `e2e-${SUFIXO}-s2`, referrer: 'https://l.instagram.com/', eventos: [
    { tipo: 'pagina', caminho: '/' }, { tipo: 'clique', caminho: '/', alvo: `[E2E] Quero participar ${SUFIXO}` },
  ] }, UA_PC)
  await enviar({ visitante: visitantes[2], sessao: `e2e-${SUFIXO}-s3`, utmSource: 'qr', utmCampaign: 'recepcao', eventos: [
    { tipo: 'pagina', caminho: '/eventos' },
    { tipo: 'pagina', caminho: '/app-ui/members' },          // painel: não grava
    { tipo: 'pagina', caminho: '/membro/formulario/abc' },   // link pessoal: não grava
  ] }, UA_CEL)
  await enviar({ visitante: `e2e-${SUFIXO}-robo`, sessao: `e2e-${SUFIXO}-s4`, eventos: [{ tipo: 'pagina', caminho: '/' }] }, 'Googlebot/2.1 (+http://www.google.com/bot.html)')
  st = await enviar({ visitante: 'x', sessao: 'y', eventos: [{ tipo: 'pagina', caminho: '/' }] }, UA_PC)
  ok('identificador inválido é ignorado sem erro (204)', st === 204)

  // ?campo= na chamada tenta desviar para Aguaí; link e referrer vêm com token na query
  await enviar({ visitante: `e2e-${SUFIXO}-d`, sessao: `e2e-${SUFIXO}-s5`, referrer: 'https://www.google.com/search?q=igreja&email=a@b.com', eventos: [
    { tipo: 'clique', caminho: '/', alvo: `[E2E] Formulário ${SUFIXO}`, alvoUrl: 'https://www.adcampinas.com.br/membro/formulario/TOKEN123?x=1' },
    { tipo: 'clique', caminho: '/', alvo: `[E2E] Mapa ${SUFIXO}`, alvoUrl: 'https://maps.google.com/place?token=SEGREDO' },
  ] }, UA_PC, '/api/public/site-eventos?campo=be2f95ec-cf98-4e81-b4c6-428018b5cbc3')
  const extras = await prisma.siteEvento.findMany({ where: { visitanteId: `e2e-${SUFIXO}-d` } })
  ok('?campo= na chamada não desvia: continua Campinas', extras.length === 2 && extras.every((g) => g.campoId === CAMPINAS), extras.map((g) => g.campoId).join(','))
  ok('referrer gravado sem parâmetros (sem e-mail)', extras.every((g) => g.referrer === 'https://www.google.com/search'), extras[0]?.referrer)
  ok('link pessoal com código: guarda só o texto, sem a URL', extras.find((g) => g.alvo?.includes('Formulário'))?.alvoUrl === null)
  ok('link externo sem o token da query', extras.find((g) => g.alvo?.includes('Mapa'))?.alvoUrl === 'https://maps.google.com/place')
  await prisma.siteEvento.deleteMany({ where: { visitanteId: `e2e-${SUFIXO}-d` } })

  const gravados = await prisma.siteEvento.findMany({ where: { visitanteId: { startsWith: `e2e-${SUFIXO}` } } })
  ok('6 eventos gravados: 3 (Google) + 2 (Instagram) + 1 (QR); painel, link pessoal e robô descartados', gravados.length === 6, `${gravados.length}`)
  ok('campo Campinas resolvido pelo domínio', gravados.every((g) => g.campoId === CAMPINAS))
  ok('origem Google / Instagram / QR', ['Google', 'Instagram', 'QR code'].every((o) => gravados.some((g) => g.origem === o)), [...new Set(gravados.map((g) => g.origem))].join(','))
  ok('aparelho classificado (Celular e Computador)', gravados.some((g) => g.dispositivo === 'Celular') && gravados.some((g) => g.dispositivo === 'Computador'))
  ok('nenhuma página do painel gravada', !gravados.some((g) => g.caminho.startsWith('/app-ui') || g.caminho.startsWith('/membro')))

  console.log('\n2. Painel')
  const auth = await admin.auth.admin.createUser({ email: EMAIL, email_confirm: true, password: randomUUID() })
  if (auth.error) throw new Error(auth.error.message)
  criados.authId = auth.data.user.id
  const u = await prisma.user.create({ data: { email: EMAIL, fullName: `[E2E] Rastreio ${SUFIXO}`, profileType: 'church', campoId: CAMPINAS } })
  criados.userId = u.id
  const tk = await token()
  let r = await api(`/api/site-rastreio?de=${hoje}&ate=${hoje}`, tk)
  ok('perfil igreja sem permissão → 403', r.status === 403, `status ${r.status}`)
  await prisma.user.update({ where: { id: u.id }, data: { profileType: 'master' } })
  await new Promise((s) => setTimeout(s, 11_000)) // cache do withAuth (10 s)
  r = await api(`/api/site-rastreio?de=${hoje}&ate=${hoje}`, tk)
  ok('painel → 200', r.status === 200, `status ${r.status} ${r.json?.error ?? ''}`)
  const p = r.json ?? {}
  ok('visitantes de teste contados', (p.totais?.visitantes ?? 0) >= 3)
  ok('origem Google aparece', p.porOrigem?.some((o) => o.rotulo === 'Google'))
  ok('página /gf entre as mais vistas', p.paginas?.some((x) => x.rotulo === '/gf'))
  const clique = p.cliques?.find((c) => c.rotulo === `[E2E] Quero participar ${SUFIXO}`)
  ok('clique contado 2 vezes por 2 visitantes', clique?.total === 2 && clique?.visitantes === 2, JSON.stringify(clique))
  r = await api(`/api/site-rastreio?de=${hoje}&ate=${hoje}&detalhe=clique&valor=${encodeURIComponent(`[E2E] Quero participar ${SUFIXO}`)}`, tk)
  ok('detalhe do clique mostra as páginas (/ e /gf)', r.status === 200 && r.json?.linhas?.length === 2, JSON.stringify(r.json?.linhas))
  r = await api(`/api/site-rastreio?de=${hoje}&ate=${hoje}&detalhe=origem&valor=Google`, tk)
  ok('detalhe da origem Google lista páginas', r.status === 200 && r.json?.linhas?.some((l) => l[0] === '/gf'))
  r = await api(`/api/site-rastreio?de=${hoje}&ate=2020-01-01`, tk)
  ok('período invertido → 400', r.status === 400)
  await prisma.user.update({ where: { id: u.id }, data: { campoId: 'be2f95ec-cf98-4e81-b4c6-428018b5cbc3' } })
  await new Promise((s) => setTimeout(s, 11_000))
  r = await api(`/api/site-rastreio?de=${hoje}&ate=${hoje}`, tk)
  ok('em outro campo (Aguaí) não vê as visitas de Campinas', r.status === 200 && !r.json?.cliques?.some((c) => c.rotulo.includes(SUFIXO)))
}

main()
  .catch((e) => { falhas++; console.error('\nERRO', e) })
  .finally(async () => {
    await limpar(); console.log(`\nlimpeza feita (e2e-${SUFIXO})`)
    await prisma.$disconnect()
    console.log(`\n${passos - falhas}/${passos} ok${falhas ? ` — ${falhas} FALHA(S)` : ''}`)
    process.exit(falhas ? 1 : 0)
  })
