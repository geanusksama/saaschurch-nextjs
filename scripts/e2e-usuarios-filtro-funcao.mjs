/**
 * E2E do filtro de Função na lista de Usuários.
 *
 * O filtro era aplicado no navegador sobre os 25 da página aberta: em Campinas,
 * "secretario" mostrava 1 de 62. Agora vai para o servidor (roleName) e entra
 * no WHERE antes da paginação. Prova pela rota real, contra a contagem do banco.
 *
 * Cria um administrador [E2E] no campo Campinas, consulta e apaga no fim.
 * Precisa do servidor rodando. Uso: node scripts/e2e-usuarios-filtro-funcao.mjs [--base=...]
 */
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env' });
loadEnv({ path: '.env.local', override: true });

import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();
const BASE = (process.argv.find((a) => a.startsWith('--base=')) || '--base=http://localhost:3000').slice(7);
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const EMAIL = `e2e-filtro-funcao-${randomUUID().slice(0, 8)}@example.com`;

let falhas = 0;
let passos = 0;
const ok = (n, c, d = '') => { passos++; if (c) console.log(`  ok   ${n}`); else { falhas++; console.log(`  FALHA ${n}${d ? ` — ${d}` : ''}`); } };

async function token() {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: EMAIL });
  if (error) throw error;
  const anon = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data: s, error: e2 } = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'magiclink' });
  if (e2) throw e2;
  return s.session.access_token;
}

async function api(caminho, tk) {
  const r = await fetch(`${BASE}/api${caminho}`, { headers: { Authorization: `Bearer ${tk}` } });
  return { status: r.status, json: await r.json().catch(() => null) };
}

let authId = null;
let userId = null;
try {
  const campo = await prisma.campo.findFirst({ where: { name: 'Campinas' }, select: { id: true } });
  if (!campo) throw new Error('campo Campinas não encontrado');
  const a = await admin.auth.admin.createUser({ email: EMAIL, email_confirm: true, password: randomUUID() });
  if (a.error) throw a.error;
  authId = a.data.user.id;
  userId = (await prisma.user.create({ data: { email: EMAIL, fullName: '[E2E] filtro função', profileType: 'admin', campoId: campo.id }, select: { id: true } })).id;
  const tk = await token();

  // Mesmo escopo de campo que a rota usa (campo, regional do campo ou igreja do campo).
  const escopo = { OR: [{ campoId: campo.id }, { regional: { is: { campoId: campo.id } } }, { church: { is: { regional: { is: { campoId: campo.id } } } } }] };
  const noBanco = await prisma.user.count({ where: { deletedAt: null, ...escopo, role: { is: { name: 'secretario' } } } });
  const semFuncaoBanco = await prisma.user.count({ where: { deletedAt: null, ...escopo, roleId: null } });

  console.log(`E2E filtro de função — ${BASE} (banco: ${noBanco} secretários no campo)`);
  let r = await api(`/users?campoId=${campo.id}&roleName=secretario&page=1&pageSize=25`, tk);
  ok('responde 200', r.status === 200, `status ${r.status}`);
  ok(`total = contagem do banco (${noBanco})`, r.json?.total === noBanco, `total ${r.json?.total}`);
  ok('página cheia (25) quando há mais de 25', noBanco <= 25 || r.json?.data?.length === 25, `linhas ${r.json?.data?.length}`);
  ok('todas as linhas são secretário', (r.json?.data ?? []).every((u) => u.role?.name === 'secretario'));

  const ultima = Math.ceil(noBanco / 25);
  r = await api(`/users?campoId=${campo.id}&roleName=secretario&page=${ultima}&pageSize=25`, tk);
  ok(`última página (${ultima}) traz o resto`, r.json?.data?.length === noBanco - (ultima - 1) * 25, `linhas ${r.json?.data?.length}`);

  r = await api(`/users?campoId=${campo.id}&roleName=__none__&page=1&pageSize=25`, tk);
  ok(`"Sem função" = banco (${semFuncaoBanco})`, r.json?.total === semFuncaoBanco && (r.json?.data ?? []).every((u) => !u.role), `total ${r.json?.total}`);

  r = await api(`/users?campoId=${campo.id}&page=1&pageSize=25`, tk);
  const todos = await prisma.user.count({ where: { deletedAt: null, ...escopo } });
  ok(`sem filtro de função continua igual (${todos})`, r.json?.total === todos, `total ${r.json?.total}`);
} catch (e) {
  falhas++;
  console.error('ERRO', e);
} finally {
  if (userId) {
    await prisma.auditLog.deleteMany({ where: { userId } }).catch(() => undefined);
    await prisma.user.delete({ where: { id: userId } }).catch((e) => console.log('  (limpeza user)', e.message));
  }
  if (authId) await admin.auth.admin.deleteUser(authId).catch(() => undefined);
  await prisma.$disconnect();
  console.log(`\n${passos - falhas}/${passos} ok${falhas ? ` — ${falhas} FALHA(S)` : ''}`);
  process.exit(falhas ? 1 : 0);
}
