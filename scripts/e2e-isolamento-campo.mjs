/**
 * E2E do isolamento por campo e da troca de campo por usuário liberado.
 *
 * O caso real: a Ilca (tesouraria, presa à própria igreja) trabalha em
 * Campinas e em Aguaí. O master libera Aguaí para ela; ela troca de campo pelo
 * seletor, sem senha, e em cada campo vê SÓ os dados daquele campo — pelas
 * rotas /api (servidor) e pelo Supabase direto do navegador (RLS).
 *
 * Cria tudo com prefixo [E2E]: 3 campos (A, B e C), regional, igreja, membro e
 * lançamento de livro caixa em cada; uma função "Tesouraria E2E"; uma usuária
 * com login. Nenhum registro real é tocado. Tudo é apagado no fim (--keep
 * preserva para inspeção).
 *
 * Precisa do servidor rodando (npm run dev) — as rotas são chamadas de verdade.
 * Uso: node scripts/e2e-isolamento-campo.mjs [--keep] [--base=http://localhost:3000]
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env' });
loadEnv({ path: '.env.local', override: true });

import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();
const BASE = (process.argv.find((a) => a.startsWith('--base=')) || '--base=http://localhost:3000').slice(7);
const KEEP = process.argv.includes('--keep');
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const SUFIXO = randomUUID().slice(0, 8);
const EMAIL = `e2e-isolamento-${SUFIXO}@example.com`;

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

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function pegarToken() {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: EMAIL });
  if (error) throw new Error(`generateLink: ${error.message}`);
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data: sessao, error: erroOtp } = await anon.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: 'magiclink',
  });
  if (erroOtp) throw new Error(`verifyOtp: ${erroOtp.message}`);
  return sessao.session.access_token;
}

async function api(caminho, token, { metodo = 'GET', corpo } = {}) {
  const res = await fetch(`${BASE}${caminho}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(corpo ? { 'Content-Type': 'application/json' } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await res.text();
  let json = null;
  try { json = JSON.parse(texto); } catch { /* corpo não-JSON */ }
  return { status: res.status, json };
}

/** O que o navegador enxerga: supabase-js com o token da usuária (RLS). */
function navegador(token) {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

const criados = { campos: [], roleId: null, userId: null, authId: null };

async function criarCampo(letra) {
  const campo = await prisma.campo.create({
    data: { name: `[E2E] Campo ${letra} ${SUFIXO}`, code: `E2E-${letra}-${SUFIXO}` },
  });
  criados.campos.push(campo.id);
  const regional = await prisma.regional.create({
    data: { campoId: campo.id, name: `[E2E] Regional ${letra}`, code: `E2E-R${letra}-${SUFIXO}` },
  });
  const igreja = await prisma.church.create({
    data: { regionalId: regional.id, name: `[E2E] Igreja ${letra} ${SUFIXO}`, code: `E2E-I${letra}-${SUFIXO}` },
  });
  const membro = await prisma.member.create({
    data: { churchId: igreja.id, campoId: campo.id, fullName: `[E2E] Membro ${letra} ${SUFIXO}`, membershipStatus: 'ATIVO' },
  });
  const lancamento = await prisma.livroCaixa.create({
    data: { churchId: igreja.id, dataLancamento: new Date('2026-10-01'), valor: 10, tipo: 'RECEITA', favorecido: `[E2E] ${letra} ${SUFIXO}` },
  });
  return { campo, regional, igreja, membro, lancamento };
}

async function limpar() {
  if (criados.userId) {
    await prisma.userCampo.deleteMany({ where: { userId: criados.userId } });
    await prisma.auditLog.deleteMany({ where: { userId: criados.userId } }).catch(() => undefined);
    await prisma.user.delete({ where: { id: criados.userId } }).catch((e) => console.log('  (limpeza user)', e.message));
  }
  if (criados.authId) await admin.auth.admin.deleteUser(criados.authId).catch(() => undefined);
  if (criados.roleId) await prisma.role.delete({ where: { id: criados.roleId } }).catch(() => undefined);
  for (const campoId of criados.campos) {
    const igrejas = await prisma.church.findMany({ where: { regional: { campoId } }, select: { id: true } });
    const ids = igrejas.map((i) => i.id);
    await prisma.livroCaixa.deleteMany({ where: { churchId: { in: ids } } });
    await prisma.member.deleteMany({ where: { churchId: { in: ids } } });
    await prisma.church.deleteMany({ where: { id: { in: ids } } });
    await prisma.regional.deleteMany({ where: { campoId } });
    await prisma.campo.delete({ where: { id: campoId } }).catch((e) => console.log('  (limpeza campo)', e.message));
  }
}

async function main() {
  console.log(`E2E isolamento por campo — ${BASE}`);
  const A = await criarCampo('A');
  const B = await criarCampo('B');
  const C = await criarCampo('C');

  const role = await prisma.role.create({ data: { name: `Tesouraria E2E ${SUFIXO}` } });
  criados.roleId = role.id;
  const auth = await admin.auth.admin.createUser({ email: EMAIL, email_confirm: true, password: randomUUID() });
  if (auth.error) throw new Error(`createUser: ${auth.error.message}`);
  criados.authId = auth.data.user.id;
  const usuaria = await prisma.user.create({
    data: {
      email: EMAIL, fullName: `[E2E] Tesoureira ${SUFIXO}`, profileType: 'church', roleId: role.id,
      campoId: A.campo.id, regionalId: A.regional.id, churchId: A.igreja.id,
    },
  });
  criados.userId = usuaria.id;
  const token = await pegarToken();
  const nav = navegador(token);

  console.log('\n1. Sem liberação: presa ao campo A');
  let r = await api('/api/context-switcher/options', token);
  ok('options responde', r.status === 200, `status ${r.status}`);
  ok('seletor oculto (canSwitchField=false)', r.json?.canSwitchField === false);
  ok('só o campo A na lista', r.json?.fields?.length === 1 && r.json.fields[0].id === A.campo.id);
  r = await api('/api/context-switcher/verify-field', token, { metodo: 'POST', corpo: { fieldId: B.campo.id } });
  ok('trocar para B sem liberação → 403', r.status === 403, `status ${r.status}`);

  console.log('\n2. Master libera o campo B (com a igreja B) — mesma função da tela do usuário');
  // salvarCamposNavegaveis é TS; o E2E grava o mesmo resultado que ela grava.
  await prisma.userCampo.createMany({
    data: [
      { userId: usuaria.id, campoId: A.campo.id, churchId: A.igreja.id, regionalId: A.regional.id },
      { userId: usuaria.id, campoId: B.campo.id, churchId: B.igreja.id, regionalId: B.regional.id },
    ],
  });
  r = await api('/api/context-switcher/options', token);
  ok('seletor visível (canSwitchField=true)', r.json?.canSwitchField === true);
  const ids = (r.json?.fields || []).map((f) => f.id).sort();
  ok('lista = A e B (não C)', JSON.stringify(ids) === JSON.stringify([A.campo.id, B.campo.id].sort()), JSON.stringify(ids));
  ok('sem senha para campo liberado', (r.json?.fields || []).every((f) => f.requiresPassword === false));
  ok('campo ativo informado = A', r.json?.activeFieldId === A.campo.id);

  console.log('\n3. No campo A: só dados de A');
  r = await api('/api/members?status=&memberType=ALL&pageSize=50', token);
  let nomes = (r.json?.data || r.json?.members || []).map((m) => m.fullName);
  ok('API membros responde', r.status === 200, `status ${r.status}`);
  ok('API membros: vê o membro A', nomes.includes(A.membro.fullName), JSON.stringify(nomes));
  ok('API membros: não vê B', !nomes.includes(B.membro.fullName));
  let lc = await nav.from('livro_caixa').select('id, church_id').like('favorecido', `[E2E]%${SUFIXO}`);
  ok('RLS livro_caixa: só o lançamento de A', lc.data?.length === 1 && lc.data[0].church_id === A.igreja.id, JSON.stringify(lc.data || lc.error));
  let mb = await nav.from('members').select('id').like('full_name', `[E2E]%${SUFIXO}`);
  ok('RLS members: só 1 (A)', mb.data?.length === 1 && mb.data[0].id === A.membro.id, JSON.stringify(mb.data || mb.error));
  r = await api(`/api/members?churchId=${B.igreja.id}`, token);
  ok('filtro com igreja de B na URL → 403 FORA_DO_CAMPO', r.status === 403 && r.json?.code === 'FORA_DO_CAMPO', `status ${r.status}`);

  console.log('\n4. Troca para B (sem senha): lotação vai para a igreja B');
  r = await api('/api/context-switcher/verify-field', token, { metodo: 'POST', corpo: { fieldId: B.campo.id } });
  ok('troca aceita', r.status === 200, `status ${r.status} ${JSON.stringify(r.json)}`);
  ok('igreja assumida = igreja B', r.json?.churchId === B.igreja.id);
  const depois = await prisma.user.findUnique({ where: { id: usuaria.id }, select: { campoId: true, churchId: true } });
  ok('users.campo_id = B no banco', depois.campoId === B.campo.id && depois.churchId === B.igreja.id);

  console.log('\n5. No campo B: só dados de B (A sumiu)');
  r = await api('/api/members?status=&memberType=ALL&pageSize=50', token);
  nomes = (r.json?.data || r.json?.members || []).map((m) => m.fullName);
  ok('API membros: vê B', nomes.includes(B.membro.fullName), JSON.stringify(nomes));
  ok('API membros: não vê A', !nomes.includes(A.membro.fullName));
  lc = await nav.from('livro_caixa').select('id, church_id').like('favorecido', `[E2E]%${SUFIXO}`);
  ok('RLS livro_caixa: só o de B', lc.data?.length === 1 && lc.data[0].church_id === B.igreja.id, JSON.stringify(lc.data || lc.error));
  r = await api(`/api/members?churchId=${A.igreja.id}`, token);
  ok('igreja de A na URL agora → 403', r.status === 403);
  r = await api(`/api/members?campoId=${A.campo.id}`, token);
  ok('campoId de A na URL → 403', r.status === 403);
  const insere = await nav.from('livro_caixa').insert({ church_id: A.igreja.id, data_lancamento: '2026-10-02', valor: 1, tipo: 'RECEITA', favorecido: `[E2E] invasao ${SUFIXO}` });
  ok('RLS: gravar lançamento no campo A estando em B → recusado', Boolean(insere.error), JSON.stringify(insere.error));

  console.log('\n6. Volta para A: igreja A restaurada');
  r = await api('/api/context-switcher/verify-field', token, { metodo: 'POST', corpo: { fieldId: A.campo.id } });
  ok('volta aceita', r.status === 200 && r.json?.churchId === A.igreja.id, JSON.stringify(r.json));

  console.log('\n7. Campo não liberado e escalada');
  r = await api('/api/context-switcher/verify-field', token, { metodo: 'POST', corpo: { fieldId: C.campo.id } });
  ok('trocar para C (não liberado) → 403', r.status === 403);
  const escala = await nav.from('users').update({ profile_type: 'master' }).eq('email', EMAIL).select('id');
  const perfil = await prisma.user.findUnique({ where: { id: usuaria.id }, select: { profileType: true } });
  ok('navegador não grava profile_type (continua church)', perfil.profileType === 'church', JSON.stringify(escala));
  const ucNav = await nav.from('user_campos').select('id');
  ok('navegador não lê user_campos', (ucNav.data || []).length === 0);
  const ucIns = await nav.from('user_campos').insert({ user_id: usuaria.id, campo_id: C.campo.id });
  ok('navegador não se libera campo (insert user_campos recusado)', Boolean(ucIns.error));
  r = await api(`/api/users/${usuaria.id}`, token, { metodo: 'PATCH', corpo: { profileType: 'master' } });
  ok('API não deixa perfil igreja virar master', r.status === 403);
}

main()
  .catch((e) => {
    falhas++;
    console.error('\nERRO', e);
  })
  .finally(async () => {
    if (KEEP) console.log(`\n--keep: dados [E2E] ${SUFIXO} mantidos`);
    else {
      await limpar();
      console.log(`\nlimpeza feita ([E2E] ${SUFIXO})`);
    }
    await prisma.$disconnect();
    console.log(`\n${passos - falhas}/${passos} ok${falhas ? ` — ${falhas} FALHA(S)` : ''}`);
    process.exit(falhas ? 1 : 0);
  });
