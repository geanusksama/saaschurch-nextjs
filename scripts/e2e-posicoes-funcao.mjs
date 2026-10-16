/**
 * E2E das Posições do Culto setadas pela função da igreja.
 *
 * Prova, pelas rotas de verdade:
 *   1. GET /api/culto/posicoes/funcoes devolve quem tem função vigente na
 *      igreja, traduzida para o papel do culto — dirigente → dirigente da
 *      igreja (e da hospedeira, se a igreja hospeda), secretário → presença.
 *   2. Função do departamento (TESOUREIRA CIBE) e função encerrada não entram.
 *   3. O usuário do titular sai de fato: e-mail igual, depois o vínculo
 *      members.user_id. Sem nenhum dos dois, `usuario` vem null.
 *   4. POST /api/culto/posicoes com memberId grava o vínculo só quando ele
 *      está vazio — nunca troca o usuário de quem já tem um.
 *   5. Igreja de outro campo → 403; perfil de igreja → 403.
 *
 * Usa funções reais do catálogo (só leitura) e cria campo, igreja, membros e
 * usuários com prefixo [E2E]. Tudo é apagado no fim (--keep preserva).
 *
 * Precisa do servidor rodando (npm run dev).
 * Uso: node scripts/e2e-posicoes-funcao.mjs [--keep] [--base=http://localhost:3000]
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

async function pegarToken(email) {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
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

const criados = { campoId: null, userIds: [], authIds: [] };

async function criarUsuario(rotulo, dados, comLogin) {
  const email = `e2e-posfuncao-${rotulo}-${SUFIXO}@example.com`;
  if (comLogin) {
    const auth = await admin.auth.admin.createUser({ email, email_confirm: true, password: randomUUID() });
    if (auth.error) throw new Error(`createUser: ${auth.error.message}`);
    criados.authIds.push(auth.data.user.id);
  }
  const u = await prisma.user.create({
    data: { email, fullName: `[E2E] ${rotulo} ${SUFIXO}`, ...dados },
  });
  criados.userIds.push(u.id);
  return u;
}

async function limpar() {
  if (criados.campoId) {
    const igrejas = await prisma.church.findMany({ where: { regional: { campoId: criados.campoId } }, select: { id: true } });
    const ids = igrejas.map((i) => i.id);
    await prisma.cultoPosicao.deleteMany({ where: { churchId: { in: ids } } });
    await prisma.churchFunctionHistory.deleteMany({ where: { churchId: { in: ids } } });
    await prisma.member.deleteMany({ where: { churchId: { in: ids } } });
  }
  for (const id of criados.userIds) {
    await prisma.auditLog.deleteMany({ where: { userId: id } }).catch(() => undefined);
    await prisma.user.delete({ where: { id } }).catch((e) => console.log('  (limpeza user)', e.message));
  }
  for (const id of criados.authIds) await admin.auth.admin.deleteUser(id).catch(() => undefined);
  if (criados.campoId) {
    await prisma.church.deleteMany({ where: { regional: { campoId: criados.campoId } } });
    await prisma.regional.deleteMany({ where: { campoId: criados.campoId } });
    await prisma.campo.delete({ where: { id: criados.campoId } }).catch((e) => console.log('  (limpeza campo)', e.message));
  }
}

async function funcaoDoCatalogo(nome) {
  const f = await prisma.churchFunctionCatalog.findFirst({ where: { name: nome }, select: { id: true } });
  if (!f) throw new Error(`Função "${nome}" não está no catálogo — o teste depende dela.`);
  return f.id;
}

async function main() {
  console.log(`E2E posições pela função — ${BASE}`);

  const fDirigente = await funcaoDoCatalogo('DIRIGENTE DE CONGREGACAO');
  const fSecretario = await funcaoDoCatalogo('SECRETARIO(a)');
  const fCibe = await funcaoDoCatalogo('TESOUREIRA CIBE');

  const campo = await prisma.campo.create({ data: { name: `[E2E] Campo PF ${SUFIXO}`, code: `E2E-PF-${SUFIXO}` } });
  criados.campoId = campo.id;
  const regional = await prisma.regional.create({
    data: { campoId: campo.id, name: '[E2E] Regional PF', code: `E2E-RPF-${SUFIXO}` },
  });
  const igreja = await prisma.church.create({
    data: { regionalId: regional.id, name: `[E2E] Hospedeira PF ${SUFIXO}`, code: `E2E-HPF-${SUFIXO}`, isHost: true },
  });
  const filha = await prisma.church.create({
    data: { regionalId: regional.id, name: `[E2E] Filha PF ${SUFIXO}`, code: `E2E-FPF-${SUFIXO}`, hostChurchId: igreja.id },
  });

  const gestor = await criarUsuario('gestor', { profileType: 'campo', campoId: campo.id, regionalId: regional.id }, true);
  const deIgreja = await criarUsuario('igreja', { profileType: 'church', campoId: campo.id, regionalId: regional.id, churchId: igreja.id }, true);
  const usuarioDirigente = await criarUsuario('dirigente', { profileType: 'church', campoId: campo.id, regionalId: regional.id, churchId: igreja.id }, false);
  const outroUsuario = await criarUsuario('outro', { profileType: 'church', campoId: campo.id, regionalId: regional.id, churchId: igreja.id }, false);

  const membro = (nome, extra = {}) =>
    prisma.member.create({
      data: { churchId: igreja.id, campoId: campo.id, fullName: `[E2E] ${nome} ${SUFIXO}`, membershipStatus: 'ATIVO', ...extra },
    });
  // E-mail em caixa diferente: o casamento não pode depender de maiúsculas.
  const mDirigente = await membro('Dirigente', { email: usuarioDirigente.email.toUpperCase() });
  const mSecretario = await membro('Secretario');
  const mCibe = await membro('Tesoureira CIBE');
  const mAntigo = await membro('Dirigente antigo');

  const hoje = new Date('2026-10-01');
  await prisma.churchFunctionHistory.createMany({
    data: [
      { churchId: igreja.id, memberId: mDirigente.id, functionId: fDirigente, startDate: hoje },
      { churchId: igreja.id, memberId: mSecretario.id, functionId: fSecretario, startDate: hoje },
      { churchId: igreja.id, memberId: mCibe.id, functionId: fCibe, startDate: hoje },
      { churchId: igreja.id, memberId: mAntigo.id, functionId: fDirigente, startDate: new Date('2020-01-01'), endDate: new Date('2025-01-01'), isActive: false },
      // Na filha (não hospedeira) o dirigente não pode virar dirigente da hospedeira.
      { churchId: filha.id, memberId: mSecretario.id, functionId: fDirigente, startDate: hoje },
    ],
  });

  const tGestor = await pegarToken(gestor.email);
  const tIgreja = await pegarToken(deIgreja.email);

  console.log('\n1. Titulares da hospedeira');
  let r = await api(`/api/culto/posicoes/funcoes?church_id=${igreja.id}`, tGestor);
  ok('responde 200', r.status === 200, `status ${r.status} ${JSON.stringify(r.json)}`);
  const lista = Array.isArray(r.json) ? r.json : [];
  const chaves = lista.map((x) => `${x.papel}:${x.membro.id}`).sort();
  const esperado = [
    `APROVADOR_LOCAL:${mDirigente.id}`,
    `APROVADOR_HOSPEDEIRA:${mDirigente.id}`,
    `PRESENCA:${mSecretario.id}`,
  ].sort();
  ok('dirigente → local + hospedeira; secretário → presença', JSON.stringify(chaves) === JSON.stringify(esperado), JSON.stringify(chaves));
  ok('TESOUREIRA CIBE não entra', !lista.some((x) => x.membro.id === mCibe.id));
  ok('função encerrada não entra', !lista.some((x) => x.membro.id === mAntigo.id));
  const dirig = lista.find((x) => x.papel === 'APROVADOR_LOCAL');
  ok('dirigente casa por e-mail (sem diferença de caixa)', dirig?.usuario?.id === usuarioDirigente.id && dirig?.usuario?.origem === 'EMAIL', JSON.stringify(dirig?.usuario));
  const secr = lista.find((x) => x.papel === 'PRESENCA');
  ok('secretário sem e-mail e sem vínculo → usuario null', secr && secr.usuario === null, JSON.stringify(secr?.usuario));

  console.log('\n2. Igreja que não hospeda');
  r = await api(`/api/culto/posicoes/funcoes?church_id=${filha.id}`, tGestor);
  const papeisFilha = (r.json || []).map((x) => x.papel).sort();
  ok('dirigente da filha → só dirigente da igreja', JSON.stringify(papeisFilha) === JSON.stringify(['APROVADOR_LOCAL']), JSON.stringify(papeisFilha));

  console.log('\n3. Confirmar grava a posição e o vínculo');
  r = await api('/api/culto/posicoes', tGestor, {
    metodo: 'POST',
    corpo: { userId: usuarioDirigente.id, papel: 'APROVADOR_LOCAL', churchId: igreja.id, memberId: mDirigente.id },
  });
  ok('POST 201', r.status === 201, `status ${r.status} ${JSON.stringify(r.json)}`);
  let m = await prisma.member.findUnique({ where: { id: mDirigente.id }, select: { userId: true } });
  ok('members.user_id gravado', m?.userId === usuarioDirigente.id, JSON.stringify(m));
  r = await api(`/api/culto/posicoes/funcoes?church_id=${igreja.id}`, tGestor);
  const dirig2 = (r.json || []).find((x) => x.papel === 'APROVADOR_LOCAL');
  ok('agora casa pelo vínculo', dirig2?.usuario?.origem === 'VINCULO', JSON.stringify(dirig2?.usuario));

  console.log('\n4. Vínculo existente não é trocado');
  r = await api('/api/culto/posicoes', tGestor, {
    metodo: 'POST',
    corpo: { userId: outroUsuario.id, papel: 'FINANCEIRO', churchId: igreja.id, memberId: mDirigente.id },
  });
  ok('POST 201', r.status === 201, `status ${r.status}`);
  m = await prisma.member.findUnique({ where: { id: mDirigente.id }, select: { userId: true } });
  ok('members.user_id continua o do dirigente', m?.userId === usuarioDirigente.id, JSON.stringify(m));

  console.log('\n5. Escopo');
  const deFora = await prisma.church.findFirst({
    where: { deletedAt: null, regional: { campoId: { not: campo.id } } },
    select: { id: true },
  });
  if (deFora) {
    r = await api(`/api/culto/posicoes/funcoes?church_id=${deFora.id}`, tGestor);
    ok('igreja de outro campo → 403', r.status === 403, `status ${r.status}`);
  }
  r = await api(`/api/culto/posicoes/funcoes?church_id=${igreja.id}`, tIgreja);
  ok('perfil de igreja → 403', r.status === 403, `status ${r.status}`);
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
