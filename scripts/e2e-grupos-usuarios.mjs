/**
 * E2E dos Grupos de usuários (fase 1 da SPEC permissoes-granulares).
 *
 * Prova, pelas rotas de verdade:
 *   1. Fora de grupo nada muda: /permissoes/efetivas diz emGrupo=false.
 *   2. Em grupo, vale SÓ a regra do grupo (whitelist): a sobrescrita pessoal
 *      fica sem efeito (D2).
 *   3. Dois grupos somam: basta um liberar (D3).
 *   4. Grupo inativo ou excluído deixa de valer; saindo de todos, a pessoa
 *      volta exatamente ao que tinha.
 *   5. Regra inventada não é gravada; nome repetido no campo → 409.
 *   6. Isolamento por campo: grupo, usuário e igreja de outro campo → 404/403.
 *   7. O bloqueio é no servidor: quem está em grupo sem a chave de gestão
 *      recebe 403 nas rotas de grupos.
 *   8. Sessão inválida em requisições paralelas → todas 401, nenhuma 500.
 *
 * Cria campos, igreja e usuários com prefixo [E2E] e apaga tudo no fim
 * (--keep preserva). Nenhum registro real é tocado.
 *
 * Precisa do servidor rodando. Uso:
 *   node scripts/e2e-grupos-usuarios.mjs [--keep] [--base=http://localhost:3001]
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env' });
loadEnv({ path: '.env.local', override: true });

import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();
const BASE = (process.argv.find((a) => a.startsWith('--base=')) || '--base=http://localhost:3001').slice(7);
const KEEP = process.argv.includes('--keep');
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUFIXO = randomUUID().slice(0, 8);

let falhas = 0;
let passos = 0;
function ok(nome, condicao, detalhe = '') {
  passos++;
  if (condicao) console.log(`  ok   ${nome}`);
  else {
    falhas++;
    console.log(`  FALHA ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
  }
}

/** Igualdade de objetos sem depender da ordem das chaves (o JSONB reordena). */
function mesmoMapa(a, b) {
  const ord = (o) => JSON.stringify(Object.keys(o ?? {}).sort().map((k) => [k, o[k]]));
  return ord(a) === ord(b);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

/** Token novo a cada chamada: o cache de sessão do servidor é por token (10 s). */
async function token(email) {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error) throw new Error(`generateLink: ${error.message}`);
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data: s, error: e2 } = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'magiclink' });
  if (e2) throw new Error(`verifyOtp: ${e2.message}`);
  return s.session.access_token;
}

async function api(caminho, tk, { metodo = 'GET', corpo } = {}) {
  const res = await fetch(`${BASE}/api${caminho}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${tk}`, ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const txt = await res.text();
  let json = null;
  try { json = JSON.parse(txt); } catch { /* corpo não-JSON */ }
  return { status: res.status, json };
}

const criados = { campos: [], users: [], auths: [] };

async function criarCampo(letra) {
  const campo = await prisma.campo.create({ data: { name: `[E2E] Campo GU ${letra} ${SUFIXO}`, code: `E2E-GU${letra}-${SUFIXO}` } });
  criados.campos.push(campo.id);
  const regional = await prisma.regional.create({ data: { campoId: campo.id, name: `[E2E] Regional GU ${letra}`, code: `E2E-RGU${letra}-${SUFIXO}` } });
  const igreja = await prisma.church.create({ data: { regionalId: regional.id, name: `[E2E] Igreja GU ${letra} ${SUFIXO}`, code: `E2E-IGU${letra}-${SUFIXO}` } });
  return { campo, regional, igreja };
}

async function criarUsuario(rotulo, dados) {
  const email = `e2e-grupos-${rotulo}-${SUFIXO}@example.com`;
  const auth = await admin.auth.admin.createUser({ email, email_confirm: true, password: randomUUID() });
  if (auth.error) throw new Error(`createUser: ${auth.error.message}`);
  criados.auths.push(auth.data.user.id);
  const u = await prisma.user.create({ data: { email, fullName: `[E2E] ${rotulo} ${SUFIXO}`, ...dados } });
  criados.users.push(u.id);
  return u;
}

async function limpar() {
  for (const campoId of criados.campos) {
    await prisma.grupoUsuarios.deleteMany({ where: { campoId } });
  }
  for (const id of criados.users) {
    await prisma.auditLog.deleteMany({ where: { userId: id } }).catch(() => undefined);
    await prisma.user.delete({ where: { id } }).catch((e) => console.log('  (limpeza user)', e.message));
  }
  for (const id of criados.auths) await admin.auth.admin.deleteUser(id).catch(() => undefined);
  for (const campoId of criados.campos) {
    await prisma.church.deleteMany({ where: { regional: { campoId } } });
    await prisma.regional.deleteMany({ where: { campoId } });
    await prisma.campo.delete({ where: { id: campoId } }).catch((e) => console.log('  (limpeza campo)', e.message));
  }
}

async function main() {
  console.log(`E2E grupos de usuários — ${BASE}`);
  const A = await criarCampo('A');
  const B = await criarCampo('B');

  // Gestor: admin com a gestão de grupos liberada pela sobrescrita pessoal
  // (não precisa ser master para o teste).
  const gestor = await criarUsuario('gestor', {
    profileType: 'admin', campoId: A.campo.id, regionalId: A.regional.id,
    permissions: { 'system_grupos_usuarios.view': true, 'system_grupos_usuarios.edit': true },
  });
  // Alvo: perfil igreja com sobrescritas pessoais que o grupo deve anular.
  const alvo = await criarUsuario('alvo', {
    profileType: 'church', campoId: A.campo.id, regionalId: A.regional.id, churchId: A.igreja.id,
    permissions: { 'finance.view': true, 'members.view': true },
  });
  const deFora = await criarUsuario('fora', {
    profileType: 'church', campoId: B.campo.id, regionalId: B.regional.id, churchId: B.igreja.id,
  });

  let tg = await token(gestor.email);

  console.log('\n1. Fora de grupo, nada muda');
  let r = await api('/permissoes/efetivas', await token(alvo.email));
  ok('efetivas responde 200', r.status === 200, `status ${r.status}`);
  ok('emGrupo = false e sem mapa', r.json?.emGrupo === false && r.json?.permissoes === null, JSON.stringify(r.json));

  console.log('\n2. Criar grupo');
  r = await api('/grupos-usuarios', tg, { metodo: 'POST', corpo: { name: 'Tesoureiro geral E2E' } });
  ok('POST 201', r.status === 201, `status ${r.status} ${JSON.stringify(r.json)}`);
  const g1 = r.json?.id;
  ok('nasce sem nada liberado', r.json && Object.keys(r.json.permissions ?? {}).length === 0, JSON.stringify(r.json?.permissions));
  r = await api('/grupos-usuarios', tg, { metodo: 'POST', corpo: { name: 'tesoureiro GERAL e2e' } });
  ok('mesmo nome (sem caixa) no campo → 409', r.status === 409, `status ${r.status}`);

  r = await api(`/grupos-usuarios/${g1}`, tg, {
    metodo: 'PATCH',
    corpo: { permissions: { 'members.view': true, 'members.edit': false, 'inventada.nao.existe': true, 'dashboard.view': 'sim' } },
  });
  ok('PATCH regras 200', r.status === 200, `status ${r.status}`);
  const salvo = await prisma.grupoUsuarios.findUnique({ where: { id: g1 }, select: { permissions: true } });
  ok('grava só chave conhecida com valor booleano', mesmoMapa(salvo.permissions, { 'members.view': true, 'members.edit': false }), JSON.stringify(salvo.permissions));

  console.log('\n3. Usuários do grupo');
  r = await api(`/grupos-usuarios/${g1}/usuarios`, tg, { metodo: 'POST', corpo: { userIds: [deFora.id] } });
  ok('usuário de outro campo → 403', r.status === 403, `status ${r.status}`);
  r = await api(`/grupos-usuarios/${g1}/usuarios`, tg, { metodo: 'POST', corpo: { userIds: [alvo.id] } });
  ok('adicionar do campo → 201', r.status === 201, `status ${r.status} ${JSON.stringify(r.json)}`);
  r = await api(`/grupos-usuarios/${g1}/usuarios`, tg, { metodo: 'POST', corpo: { userIds: [alvo.id] } });
  ok('adicionar de novo não duplica', r.status === 201 && r.json?.adicionados === 0, JSON.stringify(r.json));

  console.log('\n4. Em grupo vale só o grupo');
  let ta = await token(alvo.email);
  r = await api('/permissoes/efetivas', ta);
  const ef = r.json?.permissoes ?? {};
  ok('emGrupo = true, grupo listado', r.json?.emGrupo === true && r.json?.grupos?.[0]?.id === g1, JSON.stringify(r.json?.grupos));
  ok('members.view liberado pelo grupo', ef['members.view'] === true);
  ok('finance.view negado: sobrescrita pessoal sem efeito', ef['finance.view'] === false, String(ef['finance.view']));
  ok('dashboard.view negado: o que não foi marcado é negado', ef['dashboard.view'] === false, String(ef['dashboard.view']));
  ok('sobrescrita pessoal continua guardada no banco', mesmoMapa((await prisma.user.findUnique({ where: { id: alvo.id }, select: { permissions: true } })).permissions, { 'finance.view': true, 'members.view': true }));

  console.log('\n5. Bloqueio no servidor');
  r = await api('/grupos-usuarios', ta);
  ok('em grupo sem a chave de gestão → 403 na rota de grupos', r.status === 403, `status ${r.status}`);

  console.log('\n6. Dois grupos somam');
  r = await api('/grupos-usuarios', tg, { metodo: 'POST', corpo: { name: 'Financeiro E2E', permissions: { 'finance.view': true } } });
  const g2 = r.json?.id;
  ok('segundo grupo criado já com regra', r.status === 201 && r.json?.permissions?.['finance.view'] === true, JSON.stringify(r.json?.permissions));
  await api(`/grupos-usuarios/${g2}/usuarios`, tg, { metodo: 'POST', corpo: { userIds: [alvo.id] } });
  r = await api('/permissoes/efetivas', await token(alvo.email));
  ok('finance.view liberado pelo 2º grupo', r.json?.permissoes?.['finance.view'] === true);
  ok('members.view continua pelo 1º', r.json?.permissoes?.['members.view'] === true);
  ok('members.edit negado nos dois', r.json?.permissoes?.['members.edit'] === false);

  console.log('\n7. Grupo inativo deixa de valer');
  r = await api(`/grupos-usuarios/${g2}`, tg, { metodo: 'PATCH', corpo: { isActive: false } });
  ok('desativar 200', r.status === 200, `status ${r.status}`);
  r = await api('/permissoes/efetivas', await token(alvo.email));
  ok('finance.view volta a negado', r.json?.permissoes?.['finance.view'] === false, JSON.stringify(r.json?.grupos));

  console.log('\n8. Igrejas do grupo');
  r = await api(`/grupos-usuarios/${g1}/igrejas`, tg, { metodo: 'PUT', corpo: { churchIds: [B.igreja.id] } });
  ok('igreja de outro campo → 403', r.status === 403, `status ${r.status}`);
  r = await api(`/grupos-usuarios/${g1}/igrejas`, tg, { metodo: 'PUT', corpo: { churchIds: [A.igreja.id] } });
  ok('igreja do campo → 200', r.status === 200 && r.json?.igrejas === 1, `status ${r.status} ${JSON.stringify(r.json)}`);
  r = await api(`/grupos-usuarios/${g1}`, tg);
  ok('detalhe traz igreja e usuário', r.json?.igrejas?.[0] === A.igreja.id && r.json?.users?.some((u) => u.id === alvo.id), JSON.stringify({ igrejas: r.json?.igrejas, users: r.json?.users?.length }));

  console.log('\n9. Isolamento por campo');
  const gB = await prisma.grupoUsuarios.create({ data: { campoId: B.campo.id, name: 'Grupo do campo B' } });
  r = await api(`/grupos-usuarios/${gB.id}`, tg);
  ok('grupo de outro campo → 404', r.status === 404, `status ${r.status}`);
  r = await api('/grupos-usuarios', tg);
  ok('lista só os do campo ativo', Array.isArray(r.json) && r.json.every((g) => g.id !== gB.id) && r.json.length === 2, JSON.stringify(r.json?.map((g) => g.name)));

  console.log('\n10. Sair do grupo / excluir: volta ao que tinha');
  r = await api(`/grupos-usuarios/${g1}`, tg, { metodo: 'DELETE' });
  ok('excluir 200', r.status === 200, `status ${r.status}`);
  r = await api('/permissoes/efetivas', await token(alvo.email));
  ok('sem grupo ativo → emGrupo = false (volta às regras pessoais)', r.json?.emGrupo === false, JSON.stringify(r.json));
  r = await api('/grupos-usuarios', tg);
  ok('excluído some da lista', Array.isArray(r.json) && !r.json.some((g) => g.id === g1));

  console.log('\n11. Sessão inválida em paralelo');
  const lixo = 'token-invalido-' + SUFIXO;
  const varias = await Promise.all(['/campos', '/permissoes/efetivas', '/grupos-usuarios', '/churches?slim=1', '/auth/me'].map((c) => api(c, lixo)));
  ok('todas 401, nenhuma 500', varias.every((x) => x.status === 401), JSON.stringify(varias.map((x) => x.status)));
}

try {
  await main();
} catch (e) {
  falhas++;
  console.error('ERRO', e);
} finally {
  if (KEEP) console.log('\n--keep: dados [E2E] preservados.');
  else await limpar();
  await prisma.$disconnect();
  console.log(`\n${passos - falhas}/${passos} ok${falhas ? ` — ${falhas} FALHA(S)` : ''}`);
  process.exit(falhas ? 1 : 0);
}
