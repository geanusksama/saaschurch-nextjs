/**
 * E2E: o servidor decide igual ao navegador para quem tem CATEGORIA (role).
 *
 * O navegador resolve permissão com as sobrescritas PESSOAIS do usuário
 * (mrm_user.permissions, vindas do /auth/me). O exigirPermissao usava o mapa
 * categoria ∪ pessoal do auth.ts: um tesoureiro (categoria sem reports.view)
 * via o card do Relatório de requerimentos e o servidor recusava os dados (403).
 *
 * Cria um usuário [E2E] perfil igreja com a categoria "tesoureiro" e sem
 * sobrescritas; consulta a rota do relatório; apaga no fim.
 * Precisa do servidor rodando. Uso: node scripts/e2e-permissao-categoria.mjs [--base=...]
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
const EMAIL = `e2e-categoria-${randomUUID().slice(0, 8)}@example.com`;

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

let authId = null;
let userId = null;
try {
  const campo = await prisma.campo.findFirst({ where: { name: 'Campinas' }, select: { id: true } });
  const igreja = await prisma.church.findFirst({ where: { deletedAt: null, regional: { campoId: campo.id } }, select: { id: true, regionalId: true } });
  const categoria = await prisma.role.findFirst({ where: { name: 'tesoureiro', deletedAt: null }, select: { id: true, permissions: true } });
  ok('fato: categoria tesoureiro NÃO tem reports.view', !(categoria.permissions ?? {})['reports.view']);

  const a = await admin.auth.admin.createUser({ email: EMAIL, email_confirm: true, password: randomUUID() });
  if (a.error) throw a.error;
  authId = a.data.user.id;
  userId = (await prisma.user.create({
    data: { email: EMAIL, fullName: '[E2E] tesoureiro', profileType: 'church', campoId: campo.id, regionalId: igreja.regionalId, churchId: igreja.id, roleId: categoria.id },
    select: { id: true },
  })).id;
  const tk = await token();

  console.log(`E2E permissão de quem tem categoria — ${BASE}`);
  // O navegador mostra o card: perfil igreja, sem sobrescrita → reports.view do catálogo (liberado).
  const r = await fetch(`${BASE}/api/kan/cards/report`, { headers: { Authorization: `Bearer ${tk}` } });
  ok('tesoureiro sem sobrescrita: rota do relatório de requerimentos 200 (igual à tela)', r.status === 200, `status ${r.status}`);

  // Com sobrescrita pessoal bloqueando a tela de Relatórios, o servidor também bloqueia.
  await prisma.user.update({ where: { id: userId }, data: { permissions: { 'reports.view': false } } });
  const tk2 = await token();
  const r2 = await fetch(`${BASE}/api/kan/cards/report`, { headers: { Authorization: `Bearer ${tk2}` } });
  ok('com reports.view bloqueado na tela do usuário: rota 403', r2.status === 403, `status ${r2.status}`);
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
