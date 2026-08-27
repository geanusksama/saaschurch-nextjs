/**
 * Simulação ponta a ponta da Gestão de Culto.
 *
 * Prova as duas coisas que o módulo promete e que não dá para verificar
 * olhando a tela:
 *
 *   1. ISOLAMENTO — o tesoureiro não vê o bloco do secretário, e vice-versa.
 *      "O tesoureiro que está do lado não vê, nem o secretário vê."
 *   2. MÁQUINA DE ESTADOS — o culto só sobe quando todos os blocos exigidos
 *      chegam, o dirigente aprova, e a hospedeira fecha. Igreja sem hospedeira
 *      fecha na aprovação local.
 *
 * Importa src/lib/cultoScope.ts e src/lib/cultoService.ts de verdade: o teste
 * roda em cima do código de produção, não de uma cópia da regra.
 *
 * Roda contra o banco real, mas cria as próprias igrejas e usuários com prefixo
 * [E2E] e apaga tudo no fim (--keep preserva). Nenhum registro real é tocado.
 *
 * Uso: npx tsx scripts/e2e-gestao-culto.mjs
 */
import { PrismaClient } from '@prisma/client';
import {
  getCultoScope,
  podarLancamentos,
  podeEnviarBloco,
  podeAprovarNivel,
  filtroDeIgrejas,
} from '../src/lib/cultoScope.ts';
import { recalcularStatus, blocosExigidos, montarPainel } from '../src/lib/cultoService.ts';
import { montarResumo } from '../src/lib/cultoResumo.ts';

const prisma = new PrismaClient();
const KEEP = process.argv.includes('--keep');
const PREFIXO = '[E2E-CULTO]';

let falhas = 0;
let passes = 0;

function ok(condicao, descricao, detalhe) {
  if (condicao) {
    passes += 1;
    console.log(`  ✓ ${descricao}`);
  } else {
    falhas += 1;
    console.log(`  ✗ ${descricao}${detalhe !== undefined ? ` → obtido: ${JSON.stringify(detalhe)}` : ''}`);
  }
}

/** AuthUser mínimo: o cultoScope só usa id, profileType, churchId e campoId. */
function comoUsuario(u, campoId, profileType = 'church') {
  return {
    id: u.id,
    sub: u.id,
    email: u.email,
    fullName: u.fullName,
    profileType,
    churchId: u.churchId,
    churchName: null,
    regionalId: null,
    regionalName: null,
    campoId,
    campoName: null,
    roleId: null,
    roleName: null,
    permissions: null,
    isAdmin: false,
    parentChurchId: null,
    parentChurch: null,
    headquartersId: null,
    headquartersName: null,
    headquarters: null,
    profile: null,
  };
}

const criados = { churches: [], users: [], registros: [] };

async function limpar() {
  if (KEEP) {
    console.log('\n--keep: dados de teste preservados.');
    return;
  }
  // Cascade cuida de lançamentos, aprovações e posições.
  await prisma.cultoRegistro.deleteMany({ where: { id: { in: criados.registros } } });
  await prisma.cultoPosicao.deleteMany({ where: { userId: { in: criados.users } } });
  await prisma.church.updateMany({
    where: { id: { in: criados.churches } },
    data: { hostChurchId: null },
  });
  await prisma.user.deleteMany({ where: { id: { in: criados.users } } });
  await prisma.church.deleteMany({ where: { id: { in: criados.churches } } });
  console.log('\nDados de teste removidos.');
}

async function main() {
  const regional = await prisma.regional.findFirst({
    where: { deletedAt: null },
    select: { id: true, campoId: true, name: true },
  });
  if (!regional) throw new Error('Nenhuma regional no banco.');
  const campoId = regional.campoId;
  console.log(`Regional de apoio: ${regional.name}\n`);

  // ── Cenário ───────────────────────────────────────────────────────────────
  const hospedeira = await prisma.church.create({
    data: {
      regionalId: regional.id,
      name: `${PREFIXO} Hospedeira`,
      code: `E2EC-H-${Date.now()}`,
      isHost: true,
    },
  });
  const filha = await prisma.church.create({
    data: {
      regionalId: regional.id,
      name: `${PREFIXO} Filha`,
      code: `E2EC-F-${Date.now()}`,
      hostChurchId: hospedeira.id,
    },
  });
  // Igreja solta: nem hospedeira nem anexa. É o caso de 122 das 126 igrejas
  // reais, e o que exercita o fallback da decisão D3.
  const solta = await prisma.church.create({
    data: {
      regionalId: regional.id,
      name: `${PREFIXO} Sem hospedeira`,
      code: `E2EC-S-${Date.now()}`,
    },
  });
  criados.churches.push(hospedeira.id, filha.id, solta.id);

  async function novoUsuario(nome, churchId) {
    const u = await prisma.user.create({
      data: {
        fullName: `${PREFIXO} ${nome}`,
        email: `e2e-culto-${nome}-${Date.now()}@teste.local`,
        profileType: 'church',
        churchId,
        campoId,
      },
    });
    criados.users.push(u.id);
    return u;
  }

  const tesoureiro = await novoUsuario('tesoureiro', filha.id);
  const secretario = await novoUsuario('secretario', filha.id);
  const dirigente = await novoUsuario('dirigente', filha.id);
  const dirHospedeira = await novoUsuario('dirhospedeira', hospedeira.id);
  const soltoTesoureiro = await novoUsuario('soltotes', solta.id);
  const soltoDirigente = await novoUsuario('soltodir', solta.id);

  async function anexar(churchId, userId, papel) {
    await prisma.cultoPosicao.create({ data: { campoId, churchId, userId, papel } });
  }
  await anexar(filha.id, tesoureiro.id, 'FINANCEIRO');
  await anexar(filha.id, secretario.id, 'PRESENCA');
  await anexar(filha.id, dirigente.id, 'APROVADOR_LOCAL');
  await anexar(hospedeira.id, dirHospedeira.id, 'APROVADOR_HOSPEDEIRA');
  await anexar(solta.id, soltoTesoureiro.id, 'FINANCEIRO');
  await anexar(solta.id, soltoDirigente.id, 'APROVADOR_LOCAL');

  // ── 1. Escopo e isolamento ────────────────────────────────────────────────
  console.log('1. Isolamento entre os lançadores');

  const escTesoureiro = await getCultoScope(comoUsuario(tesoureiro, campoId));
  const escSecretario = await getCultoScope(comoUsuario(secretario, campoId));
  const escDirigente = await getCultoScope(comoUsuario(dirigente, campoId));
  const escHospedeira = await getCultoScope(comoUsuario(dirHospedeira, campoId));

  ok(
    JSON.stringify(escTesoureiro.blocosVisiveis) === JSON.stringify(['FINANCEIRO']),
    'tesoureiro só enxerga o bloco FINANCEIRO',
    escTesoureiro.blocosVisiveis,
  );
  ok(
    JSON.stringify(escSecretario.blocosVisiveis) === JSON.stringify(['PRESENCA']),
    'secretário só enxerga o bloco PRESENCA',
    escSecretario.blocosVisiveis,
  );
  ok(
    escDirigente.blocosVisiveis.length === 3,
    'dirigente enxerga os três blocos',
    escDirigente.blocosVisiveis,
  );
  ok(
    escTesoureiro.churchIds?.length === 1 && escTesoureiro.churchIds[0] === filha.id,
    'tesoureiro fica preso à própria igreja',
    escTesoureiro.churchIds,
  );
  ok(
    escHospedeira.churchIds?.includes(filha.id) && escHospedeira.churchIds?.includes(hospedeira.id),
    'dirigente da hospedeira alcança a própria igreja e a filha',
    escHospedeira.churchIds,
  );
  ok(
    !podeEnviarBloco(escTesoureiro, 'PRESENCA', filha.id),
    'tesoureiro NÃO pode enviar o bloco de presença',
  );
  ok(
    podeEnviarBloco(escTesoureiro, 'FINANCEIRO', filha.id),
    'tesoureiro pode enviar o próprio bloco',
  );
  ok(
    !podeAprovarNivel(escTesoureiro, 'LOCAL', filha.id),
    'tesoureiro NÃO aprova',
  );
  ok(podeAprovarNivel(escDirigente, 'LOCAL', filha.id), 'dirigente aprova no nível LOCAL');
  ok(
    !podeAprovarNivel(escDirigente, 'HOSPEDEIRA', filha.id),
    'dirigente local NÃO aprova no nível da hospedeira',
  );
  ok(
    podeAprovarNivel(escHospedeira, 'HOSPEDEIRA', filha.id),
    'dirigente da hospedeira aprova a filha',
  );

  const filtro = filtroDeIgrejas(escTesoureiro);
  ok(
    JSON.stringify(filtro) === JSON.stringify({ churchId: { in: [filha.id] } }),
    'filtro Prisma do tesoureiro restringe à própria igreja',
    filtro,
  );

  // ── 2. Máquina de estados, igreja COM hospedeira ──────────────────────────
  console.log('\n2. Fluxo completo (igreja com hospedeira)');

  const exigidos = await blocosExigidos(filha.id);
  ok(
    exigidos.length === 2 && exigidos.includes('FINANCEIRO') && exigidos.includes('PRESENCA'),
    'blocos exigidos derivam das posições ativas (2, sem EXTRA)',
    exigidos,
  );

  const reg = await prisma.cultoRegistro.create({
    data: {
      campoId,
      regionalId: regional.id,
      churchId: filha.id,
      hostChurchId: hospedeira.id,
      dataCulto: new Date('2026-08-23T00:00:00.000Z'),
      tipoCulto: 'E2E',
    },
  });
  criados.registros.push(reg.id);

  let r = await recalcularStatus(reg.id);
  ok(r.status === 'ABERTO', 'nasce em ABERTO', r.status);

  await prisma.cultoLancamento.create({
    data: {
      registroId: reg.id,
      bloco: 'FINANCEIRO',
      enviadoPor: tesoureiro.id,
      enviadoEm: new Date(),
      totalDizimos: '1500.00',
      totalOfertas: '320.00',
    },
  });
  r = await recalcularStatus(reg.id);
  ok(r.status === 'ABERTO', 'com só um bloco continua ABERTO', r.status);
  ok(
    r.faltando.length === 1 && r.faltando[0] === 'PRESENCA',
    'aponta exatamente qual bloco falta',
    r.faltando,
  );

  await prisma.cultoLancamento.create({
    data: {
      registroId: reg.id,
      bloco: 'PRESENCA',
      enviadoPor: secretario.id,
      enviadoEm: new Date(),
      qtdHomens: 40,
      qtdMulheres: 55,
      cadeirasVazias: 12,
    },
  });
  r = await recalcularStatus(reg.id);
  ok(r.status === 'AGUARDANDO_LOCAL', 'com os dois blocos vai para AGUARDANDO_LOCAL', r.status);

  // A poda é o coração do isolamento: com os dois blocos gravados, o tesoureiro
  // ainda só recebe um.
  const todosLancamentos = await prisma.cultoLancamento.findMany({
    where: { registroId: reg.id },
    select: { bloco: true },
  });
  ok(todosLancamentos.length === 2, 'o banco tem os dois blocos');
  ok(
    podarLancamentos(escTesoureiro, todosLancamentos).length === 1,
    'o tesoureiro recebe só 1 dos 2 blocos',
    podarLancamentos(escTesoureiro, todosLancamentos).map((l) => l.bloco),
  );
  ok(
    podarLancamentos(escSecretario, todosLancamentos)[0]?.bloco === 'PRESENCA',
    'e o secretário recebe só o dele',
    podarLancamentos(escSecretario, todosLancamentos).map((l) => l.bloco),
  );
  ok(
    podarLancamentos(escDirigente, todosLancamentos).length === 2,
    'o dirigente recebe os dois',
    podarLancamentos(escDirigente, todosLancamentos).length,
  );

  await prisma.cultoAprovacao.create({
    data: { registroId: reg.id, nivel: 'LOCAL', decisao: 'APROVADO', aprovadorId: dirigente.id },
  });
  r = await recalcularStatus(reg.id);
  ok(
    r.status === 'APROVADO_LOCAL',
    'aprovação local NÃO fecha o culto quando existe hospedeira',
    r.status,
  );

  await prisma.cultoAprovacao.create({
    data: {
      registroId: reg.id,
      nivel: 'HOSPEDEIRA',
      decisao: 'APROVADO',
      aprovadorId: dirHospedeira.id,
    },
  });
  r = await recalcularStatus(reg.id);
  ok(r.status === 'CONCLUIDO', 'aprovação da hospedeira fecha o culto', r.status);

  const fechado = await prisma.cultoRegistro.findUnique({
    where: { id: reg.id },
    select: { concluidoEm: true },
  });
  ok(fechado?.concluidoEm !== null, 'grava concluido_em ao fechar');

  // Devolução da hospedeira apaga a aprovação local.
  await prisma.cultoAprovacao.update({
    where: { registroId_nivel: { registroId: reg.id, nivel: 'HOSPEDEIRA' } },
    data: { decisao: 'REJEITADO', motivo: 'conferir ofertas' },
  });
  r = await recalcularStatus(reg.id);
  ok(r.status === 'REJEITADO', 'devolução da hospedeira volta para REJEITADO', r.status);

  // ── 3. Igreja SEM hospedeira (fallback D3) ────────────────────────────────
  console.log('\n3. Igreja sem hospedeira (o caso de 122 das 126 igrejas)');

  const regSolta = await prisma.cultoRegistro.create({
    data: {
      campoId,
      regionalId: regional.id,
      churchId: solta.id,
      hostChurchId: null,
      dataCulto: new Date('2026-08-23T00:00:00.000Z'),
      tipoCulto: 'E2E',
    },
  });
  criados.registros.push(regSolta.id);

  // Regra vigente desde 27/08/2026: FINANCEIRO e PRESENCA são SEMPRE exigidos,
  // mesmo que a igreja não tenha ninguém anexado ao papel. Antes a exigência
  // vinha das posições, e o efeito colateral era um culto "Concluído" com só o
  // ícone de tesouraria — sem ninguém ter contado a presença.
  const exigidosSolta = await blocosExigidos(solta.id);
  ok(
    exigidosSolta.length === 2 &&
      exigidosSolta.includes('FINANCEIRO') &&
      exigidosSolta.includes('PRESENCA'),
    'os dois blocos são exigidos mesmo sem secretário anexado',
    exigidosSolta,
  );

  await prisma.cultoLancamento.create({
    data: {
      registroId: regSolta.id,
      bloco: 'FINANCEIRO',
      enviadoPor: soltoTesoureiro.id,
      enviadoEm: new Date(),
      totalDizimos: '900.00',
    },
  });
  r = await recalcularStatus(regSolta.id);
  // Este é o PREÇO da regra nova, e está aqui de propósito: igreja sem
  // secretário anexado trava em "Aguardando envio" até alguém assumir o papel.
  ok(
    r.status === 'ABERTO' && r.faltando.includes('PRESENCA'),
    'só o financeiro NÃO fecha: fica aguardando a presença',
    { status: r.status, faltando: r.faltando },
  );

  // Anexa o secretário e completa: é assim que a igreja destrava.
  const soltoSecretario = await novoUsuario('soltosec', solta.id);
  await anexar(solta.id, soltoSecretario.id, 'PRESENCA');
  await prisma.cultoLancamento.create({
    data: {
      registroId: regSolta.id,
      bloco: 'PRESENCA',
      enviadoPor: soltoSecretario.id,
      enviadoEm: new Date(),
      qtdHomens: 10,
      qtdMulheres: 12,
    },
  });
  r = await recalcularStatus(regSolta.id);
  ok(r.status === 'AGUARDANDO_LOCAL', 'com os dois blocos vai a aprovação', r.status);

  await prisma.cultoAprovacao.create({
    data: {
      registroId: regSolta.id,
      nivel: 'LOCAL',
      decisao: 'APROVADO',
      aprovadorId: soltoDirigente.id,
    },
  });
  r = await recalcularStatus(regSolta.id);
  ok(
    r.status === 'CONCLUIDO',
    'sem hospedeira, a aprovação do dirigente já fecha o culto',
    r.status,
  );

  // ── 4. Painel agregado ────────────────────────────────────────────────────
  console.log('\n4. Painel do Pastor Presidente');

  const grupos = await montarPainel({
    campoId,
    de: new Date('2026-08-01T00:00:00.000Z'),
    ate: new Date('2026-08-31T23:59:59.999Z'),
    tipoCulto: 'E2E',
    churchIds: [hospedeira.id, filha.id, solta.id],
  });

  const grupoHosp = grupos.find((g) => g.tipo === 'HOSPEDEIRA' && g.id === hospedeira.id);
  ok(Boolean(grupoHosp), 'a hospedeira vira um grupo', grupos.map((g) => `${g.tipo}:${g.nome}`));
  ok(
    grupoHosp?.totalIgrejas === 2,
    'o grupo da hospedeira conta ela mesma + a filha',
    grupoHosp?.totalIgrejas,
  );
  ok(
    grupoHosp?.dirigente === `${PREFIXO} dirhospedeira`,
    'mostra o nome do dirigente da hospedeira',
    grupoHosp?.dirigente,
  );
  ok(grupoHosp?.cor === 'VERMELHO', 'grupo com pendência fica vermelho', grupoHosp?.cor);

  const grupoRegional = grupos.find((g) => g.tipo === 'REGIONAL');
  ok(
    Boolean(grupoRegional),
    'igreja sem hospedeira cai num grupo REGIONAL (fallback D3)',
    grupos.map((g) => g.tipo),
  );
  ok(
    grupoRegional?.concluidas.some((c) => c.churchId === solta.id),
    'a igreja solta aparece como concluída no grupo da regional',
    grupoRegional?.concluidas.map((c) => c.nome),
  );

  // ── 5. Resumo hierárquico (o modal) ───────────────────────────────────────
  console.log('\n5. Resumo consolidado do modal');

  const periodo = {
    de: new Date('2026-08-01T00:00:00.000Z'),
    ate: new Date('2026-08-31T23:59:59.999Z'),
  };
  const comum = {
    campoId,
    ...periodo,
    tipoCulto: 'E2E',
    churchIdsPermitidos: [hospedeira.id, filha.id, solta.id],
    campoNome: 'Campo E2E',
  };
  const todosBlocos = ['FINANCEIRO', 'PRESENCA', 'EXTRA'];

  // Nível GRUPO: a hospedeira soma ela mesma + a filha.
  const rGrupo = await montarResumo({
    ...comum,
    nivel: 'GRUPO',
    id: hospedeira.id,
    tipoGrupo: 'HOSPEDEIRA',
    blocosVisiveis: todosBlocos,
  });
  ok(rGrupo.totais.igrejas === 2, 'resumo do grupo cobre 2 igrejas', rGrupo.totais.igrejas);
  ok(rGrupo.totais.cultos === 1, 'e 1 culto no período', rGrupo.totais.cultos);
  ok(
    rGrupo.totais.financeiro?.totalDizimos === 1500,
    'soma os dízimos do grupo',
    rGrupo.totais.financeiro,
  );
  ok(
    rGrupo.totais.presenca?.publicoTotal === 95,
    'soma o público (40 homens + 55 mulheres)',
    rGrupo.totais.presenca?.publicoTotal,
  );
  ok(
    rGrupo.totais.presenca?.cadeirasVazias === 12,
    'soma as cadeiras vazias',
    rGrupo.totais.presenca?.cadeirasVazias,
  );
  ok(
    rGrupo.filhos.length === 2 && rGrupo.filhos.every((f) => f.tipo === 'IGREJA'),
    'os filhos do grupo são igrejas',
    rGrupo.filhos.map((f) => `${f.tipo}:${f.nome}`),
  );

  // Nível IGREJA: os filhos são os cultos.
  const rIgreja = await montarResumo({
    ...comum,
    nivel: 'IGREJA',
    id: filha.id,
    blocosVisiveis: todosBlocos,
  });
  ok(
    rIgreja.filhos.length === 1 && rIgreja.filhos[0].tipo === 'CULTO',
    'os filhos da igreja são cultos',
    rIgreja.filhos.map((f) => f.tipo),
  );
  ok(
    rIgreja.filhos[0].registroId === reg.id,
    'o culto traz o registroId para abrir o detalhe',
    rIgreja.filhos[0].registroId,
  );
  ok(rIgreja.filhos[0].navegavel === false, 'culto é folha: não desce mais');

  // Nível CAMPO: soma tudo e agrupa por hospedeira/regional.
  const rCampo = await montarResumo({ ...comum, nivel: 'CAMPO', blocosVisiveis: todosBlocos });
  ok(rCampo.totais.igrejas === 3, 'resumo do campo cobre as 3 igrejas', rCampo.totais.igrejas);
  ok(rCampo.totais.cultos === 2, 'e os 2 cultos', rCampo.totais.cultos);
  ok(
    rCampo.totais.financeiro?.totalDizimos === 2400,
    'soma o campo inteiro (1500 + 900)',
    rCampo.totais.financeiro?.totalDizimos,
  );
  ok(
    rCampo.filhos.length === 2 && rCampo.filhos.every((f) => f.tipo === 'GRUPO'),
    'os filhos do campo são grupos',
    rCampo.filhos.map((f) => `${f.tipo}:${f.nome}`),
  );
  ok(
    rCampo.filhos.some((f) => f.tipoGrupo === 'REGIONAL'),
    'e um deles é do tipo REGIONAL (fallback D3)',
    rCampo.filhos.map((f) => f.tipoGrupo),
  );
  // A igreja com hospedeira NÃO pode aparecer também no grupo da regional,
  // senão o total do campo sairia inflado.
  const somaDosGrupos = rCampo.filhos.reduce((s, f) => s + f.cultos, 0);
  ok(
    somaDosGrupos === rCampo.totais.cultos,
    'os grupos não se sobrepõem: a soma dos filhos bate com o total',
    { somaDosGrupos, total: rCampo.totais.cultos },
  );

  // ISOLAMENTO NA AGREGAÇÃO: o tesoureiro soma o financeiro e nada de presença.
  const rTesoureiro = await montarResumo({
    ...comum,
    nivel: 'GRUPO',
    id: hospedeira.id,
    tipoGrupo: 'HOSPEDEIRA',
    churchIdsPermitidos: escTesoureiro.churchIds,
    blocosVisiveis: escTesoureiro.blocosVisiveis,
  });
  ok(
    rTesoureiro.totais.financeiro?.totalDizimos === 1500,
    'o tesoureiro vê o financeiro consolidado',
    rTesoureiro.totais.financeiro,
  );
  ok(
    rTesoureiro.totais.presenca === null,
    'e a presença nem é somada para ele',
    rTesoureiro.totais.presenca,
  );

  const rSecretario = await montarResumo({
    ...comum,
    nivel: 'GRUPO',
    id: hospedeira.id,
    tipoGrupo: 'HOSPEDEIRA',
    churchIdsPermitidos: escSecretario.churchIds,
    blocosVisiveis: escSecretario.blocosVisiveis,
  });
  ok(
    rSecretario.totais.financeiro === null,
    'o secretário não recebe o financeiro',
    rSecretario.totais.financeiro,
  );
  ok(
    rSecretario.totais.presenca?.publicoTotal === 95,
    'mas recebe a presença consolidada',
    rSecretario.totais.presenca?.publicoTotal,
  );
  ok(
    rSecretario.totais.igrejas === 1,
    'e o escopo dele fica na própria igreja, não no grupo todo',
    rSecretario.totais.igrejas,
  );

  // ── Resultado ─────────────────────────────────────────────────────────────
  console.log(`\n${passes} passaram, ${falhas} falharam.`);
  if (falhas > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error('\n[e2e-gestao-culto] erro:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await limpar().catch((e) => console.error('falha ao limpar:', e.message));
    await prisma.$disconnect();
  });
