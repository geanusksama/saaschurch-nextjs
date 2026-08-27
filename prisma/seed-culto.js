/**
 * Seed da Gestão de Culto — cria o cenário de teste que o banco ainda não tem.
 *
 * Contexto medido em 27/08/2026: das 126 igrejas ativas, só 1 era hospedeira
 * (AD Campinas - SEDE) e só 3 estavam anexadas a ela. As demais estão
 * *preparadas* para a organização por hospedeiras, que ainda não foi feita.
 * Sem hospedeiras não dá para exercitar o segundo nível de aprovação nem o
 * card agregado do Pastor Presidente.
 *
 * O que este script faz:
 *   1. elege uma hospedeira por Regional que tenha igrejas suficientes e anexa
 *      as demais daquela Regional a ela;
 *   2. anexa posições a partir das roles que JÁ existem (tesoureiro → bloco
 *      FINANCEIRO, secretario → bloco PRESENCA) e escolhe um APROVADOR_LOCAL;
 *   3. cria registros dos domingos do mês corrente em estados variados, para a
 *      tela nascer com verde e vermelho de verdade.
 *
 * É idempotente e NÃO desfaz o que já existe: a AD Campinas - SEDE e as três
 * anexas atuais continuam como estão.
 *
 * Uso:
 *   node prisma/seed-culto.js              # aplica
 *   node prisma/seed-culto.js --dry-run    # só mostra o que faria
 *   node prisma/seed-culto.js --regionais=8
 */
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('node:crypto');

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const MAX_REGIONAIS = Number(
  (args.find((a) => a.startsWith('--regionais=')) || '').split('=')[1] || 6,
);
/** Uma Regional só vira grupo se tiver ao menos isto de igrejas. */
const MIN_IGREJAS_POR_REGIONAL = 3;

function log(...a) {
  console.log(DRY_RUN ? '[dry-run]' : '[seed]', ...a);
}

/** Domingos do mês corrente, como Date UTC. */
function domingosDoMes() {
  const hoje = new Date();
  const ano = hoje.getUTCFullYear();
  const mes = hoje.getUTCMonth();
  const dias = [];
  const d = new Date(Date.UTC(ano, mes, 1));
  while (d.getUTCMonth() === mes) {
    if (d.getUTCDay() === 0 && d <= hoje) dias.push(new Date(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dias;
}

async function main() {
  // Existe mais de um campo no banco, e a maioria está vazia. Sem --campo, o
  // seed escolhe o que tem mais igrejas — que é onde o teste faz sentido.
  const codigoCampo = (args.find((a) => a.startsWith('--campo=')) || '').split('=')[1] || null;
  const campos = await prisma.campo.findMany({
    where: { deletedAt: null, ...(codigoCampo ? { code: codigoCampo } : {}) },
    select: {
      id: true,
      name: true,
      code: true,
      _count: { select: { regionais: true } },
      regionais: { select: { _count: { select: { churches: true } } } },
    },
  });
  if (campos.length === 0) throw new Error('Nenhum campo encontrado.');
  const comTotal = campos.map((c) => ({
    ...c,
    totalIgrejas: c.regionais.reduce((s, r) => s + r._count.churches, 0),
  }));
  comTotal.sort((a, b) => b.totalIgrejas - a.totalIgrejas);
  const campo = comTotal[0];
  log(`campo: ${campo.name} (${campo.code}) — ${campo.totalIgrejas} igrejas`);
  if (!codigoCampo && comTotal.length > 1) {
    log(`  outros campos ignorados: ${comTotal.slice(1).map((c) => `${c.code}(${c.totalIgrejas})`).join(', ')}`);
  }

  // ── 1. Hospedeiras ────────────────────────────────────────────────────────
  const regionais = await prisma.regional.findMany({
    where: { campoId: campo.id, deletedAt: null },
    select: {
      id: true,
      name: true,
      churches: {
        where: { deletedAt: null },
        select: { id: true, name: true, isHost: true, hostChurchId: true },
        orderBy: { name: 'asc' },
      },
    },
  });

  const candidatas = regionais
    .filter((r) => r.churches.length >= MIN_IGREJAS_POR_REGIONAL)
    // Uma Regional que já tem hospedeira não é mexida.
    .filter((r) => !r.churches.some((c) => c.isHost))
    .sort((a, b) => b.churches.length - a.churches.length)
    .slice(0, MAX_REGIONAIS);

  log(
    `${regionais.length} regionais no campo; ${candidatas.length} vão receber hospedeira nova`,
  );

  const gruposCriados = [];

  for (const regional of candidatas) {
    // Hospedeira = a primeira igreja da Regional que ainda não está anexada a
    // ninguém. Determinístico de propósito: rodar de novo dá o mesmo resultado.
    const host = regional.churches.find((c) => !c.hostChurchId);
    if (!host) {
      log(`  ${regional.name}: todas as igrejas já estão anexadas, pulando`);
      continue;
    }
    const filhas = regional.churches.filter((c) => c.id !== host.id && !c.hostChurchId);
    if (filhas.length === 0) {
      log(`  ${regional.name}: sem filhas disponíveis, pulando`);
      continue;
    }

    log(`  ${regional.name}: hospedeira "${host.name}" + ${filhas.length} anexas`);

    if (!DRY_RUN) {
      await prisma.church.update({ where: { id: host.id }, data: { isHost: true } });
      await prisma.church.updateMany({
        where: { id: { in: filhas.map((f) => f.id) } },
        data: { hostChurchId: host.id },
      });
    }

    gruposCriados.push({ regional, host, filhas });
  }

  // Grupos que já existiam entram no passo das posições do mesmo jeito.
  const hospedeirasExistentes = await prisma.church.findMany({
    where: { isHost: true, deletedAt: null, regional: { campoId: campo.id } },
    select: {
      id: true,
      name: true,
      hostedChurches: { where: { deletedAt: null }, select: { id: true, name: true } },
    },
  });

  // ── 2. Posições ───────────────────────────────────────────────────────────
  const igrejasAlvo = new Map();
  for (const h of hospedeirasExistentes) {
    igrejasAlvo.set(h.id, { id: h.id, name: h.name, isHost: true });
    for (const f of h.hostedChurches) {
      igrejasAlvo.set(f.id, { id: f.id, name: f.name, isHost: false });
    }
  }
  // Em dry-run as hospedeiras novas ainda não estão no banco.
  for (const g of gruposCriados) {
    igrejasAlvo.set(g.host.id, { id: g.host.id, name: g.host.name, isHost: true });
    for (const f of g.filhas) igrejasAlvo.set(f.id, { id: f.id, name: f.name, isHost: false });
  }

  const usuarios = await prisma.user.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      churchId: { in: Array.from(igrejasAlvo.keys()) },
    },
    select: {
      id: true,
      fullName: true,
      churchId: true,
      createdAt: true,
      role: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const porIgreja = new Map();
  for (const u of usuarios) {
    const lista = porIgreja.get(u.churchId) || [];
    lista.push(u);
    porIgreja.set(u.churchId, lista);
  }

  function normaliza(v) {
    return String(v || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase();
  }

  async function anexar(churchId, userId, papel) {
    const jaTem = await prisma.cultoPosicao.findFirst({
      where: { churchId, userId, papel, deletedAt: null },
      select: { id: true },
    });
    if (jaTem) return false;
    if (!DRY_RUN) {
      await prisma.cultoPosicao.create({
        data: { campoId: campo.id, churchId, userId, papel },
      });
    }
    return true;
  }

  let anexadas = 0;
  let semUsuario = 0;

  for (const igreja of igrejasAlvo.values()) {
    const lista = porIgreja.get(igreja.id) || [];
    if (lista.length === 0) {
      semUsuario += 1;
      continue;
    }

    const tesoureiro = lista.find((u) => normaliza(u.role?.name).includes('tesour'));
    const secretario = lista.find((u) => normaliza(u.role?.name).includes('secret'));

    if (tesoureiro && (await anexar(igreja.id, tesoureiro.id, 'FINANCEIRO'))) anexadas++;
    if (secretario && (await anexar(igreja.id, secretario.id, 'PRESENCA'))) anexadas++;

    // Dirigente: alguém que não seja um dos lançadores, para o teste exercitar
    // gente diferente. Se a igreja só tem uma pessoa, ela acumula os papéis —
    // que é exatamente o caso real de 35 igrejas do campo.
    const dirigente =
      lista.find((u) => u.id !== tesoureiro?.id && u.id !== secretario?.id) || lista[0];
    if (dirigente && (await anexar(igreja.id, dirigente.id, 'APROVADOR_LOCAL'))) anexadas++;

    if (igreja.isHost && dirigente) {
      if (await anexar(igreja.id, dirigente.id, 'APROVADOR_HOSPEDEIRA')) anexadas++;
    }
  }

  log(`posições anexadas: ${anexadas} (${semUsuario} igrejas ficaram sem ninguém — não têm usuário)`);

  // Pastor Presidente: o master do campo, sem igreja (vale para o campo todo).
  const master = await prisma.user.findFirst({
    where: { profileType: 'master', deletedAt: null, isActive: true },
    select: { id: true, fullName: true },
  });
  if (master) {
    const jaTem = await prisma.cultoPosicao.findFirst({
      where: { userId: master.id, papel: 'PRESIDENTE', deletedAt: null },
    });
    if (!jaTem && !DRY_RUN) {
      await prisma.cultoPosicao.create({
        data: { campoId: campo.id, churchId: null, userId: master.id, papel: 'PRESIDENTE' },
      });
    }
    log(`presidente: ${master.fullName}${jaTem ? ' (já existia)' : ''}`);
  }

  // ── 3. Registros de culto ─────────────────────────────────────────────────
  // --reset apaga os registros de culto do campo antes de semear de novo.
  // Só faz sentido em ambiente de teste; posições e hospedeiras não são tocadas.
  if (args.includes('--reset') && !DRY_RUN) {
    const apagados = await prisma.cultoRegistro.deleteMany({ where: { campoId: campo.id } });
    log(`--reset: ${apagados.count} registros de culto apagados`);
  }

  const domingos = domingosDoMes();
  if (domingos.length === 0) {
    log('nenhum domingo já passado neste mês — sem registros de culto para criar');
  }

  const igrejasComPosicao = await prisma.cultoPosicao.findMany({
    where: {
      campoId: campo.id,
      isActive: true,
      deletedAt: null,
      papel: { in: ['FINANCEIRO', 'PRESENCA'] },
    },
    select: { churchId: true, papel: true, userId: true },
  });

  const lancadoresPorIgreja = new Map();
  for (const p of igrejasComPosicao) {
    const m = lancadoresPorIgreja.get(p.churchId) || {};
    m[p.papel] = p.userId;
    lancadoresPorIgreja.set(p.churchId, m);
  }

  const dadosIgrejas = await prisma.church.findMany({
    where: { id: { in: Array.from(lancadoresPorIgreja.keys()) }, deletedAt: null },
    select: { id: true, name: true, regionalId: true, hostChurchId: true, isHost: true },
  });

  // Uma consulta só para saber o que já existe, em vez de um SELECT por
  // (igreja, domingo). A versão sequencial gravava ~8 registros por minuto
  // contra o pooler; em lote isso vira alguns segundos.
  const existentes = await prisma.cultoRegistro.findMany({
    where: {
      churchId: { in: dadosIgrejas.map((c) => c.id) },
      dataCulto: { in: domingos },
      tipoCulto: 'CULTO',
      deletedAt: null,
    },
    select: { churchId: true, dataCulto: true },
  });
  const jaExistem = new Set(
    existentes.map((e) => `${e.churchId}|${e.dataCulto.toISOString().slice(0, 10)}`),
  );

  const aprovadoresLocais = await prisma.cultoPosicao.findMany({
    where: {
      churchId: { in: dadosIgrejas.map((c) => c.id) },
      papel: 'APROVADOR_LOCAL',
      isActive: true,
      deletedAt: null,
    },
    select: { churchId: true, userId: true },
  });
  const aprovadorPorIgreja = new Map(aprovadoresLocais.map((a) => [a.churchId, a.userId]));

  const novosRegistros = [];
  const planos = [];
  let i = 0;

  for (let idxIgreja = 0; idxIgreja < dadosIgrejas.length; idxIgreja++) {
    const igreja = dadosIgrejas[idxIgreja];
    for (let idxDia = 0; idxDia < domingos.length; idxDia++) {
      const dia = domingos[idxDia];
      i += 1;
      const chave = `${igreja.id}|${dia.toISOString().slice(0, 10)}`;
      if (jaExistem.has(chave)) continue;

      // Distribui os estados para a tela nascer com as colunas povoadas.
      //   0 → nada enviado (ABERTO / vermelho)
      //   1 → só o financeiro (ABERTO, faltando presença)
      //   2 → tudo enviado, sem aprovação (AGUARDANDO_LOCAL)
      //   3 → tudo enviado e aprovado pelo dirigente
      //
      // O cenário varia pela IGREJA e pelo domingo. Um contador único não
      // servia: com 4 domingos e módulo 4, o índice andava junto com a data e
      // todas as igrejas ficavam com o mesmo status no mesmo dia — a consulta
      // de um domingo específico saía 100% de uma cor só.
      const cenario = (idxIgreja + idxDia) % 4;
      const id = randomUUID();
      novosRegistros.push({
        id,
        campoId: campo.id,
        regionalId: igreja.regionalId,
        churchId: igreja.id,
        hostChurchId: igreja.hostChurchId ?? (igreja.isHost ? igreja.id : null),
        dataCulto: dia,
        tipoCulto: 'CULTO',
      });
      planos.push({ id, churchId: igreja.id, cenario, i });
    }
  }

  const criados = novosRegistros.length;

  if (!DRY_RUN && criados > 0) {
    await prisma.cultoRegistro.createMany({ data: novosRegistros, skipDuplicates: true });

    const agora = new Date();
    const lancamentos = [];
    const aprovacoes = [];

    for (const plano of planos) {
      const lancadores = lancadoresPorIgreja.get(plano.churchId) || {};
      const n = plano.i;

      if (plano.cenario >= 1 && lancadores.FINANCEIRO) {
        lancamentos.push({
          registroId: plano.id,
          bloco: 'FINANCEIRO',
          enviadoPor: lancadores.FINANCEIRO,
          enviadoEm: agora,
          totalDizimos: (500 + ((n * 137) % 4000)).toFixed(2),
          totalOfertas: (100 + ((n * 71) % 900)).toFixed(2),
          qtdDizimos: 5 + (n % 30),
          qtdOfertas: 10 + (n % 60),
        });
      }

      // A partir do cenário 1 os DOIS blocos vão juntos: com a regra nova, um
      // culto com só o financeiro fica em "Aguardando envio" e o seed não
      // conseguiria povoar as colunas seguintes.
      if (plano.cenario >= 1 && lancadores.PRESENCA) {
        lancamentos.push({
          registroId: plano.id,
          bloco: 'PRESENCA',
          enviadoPor: lancadores.PRESENCA,
          enviadoEm: agora,
          qtdHomens: 20 + (n % 50),
          qtdMulheres: 30 + (n % 70),
          qtdJovens: 5 + (n % 25),
          qtdAdolescentes: 3 + (n % 15),
          qtdCriancas: 4 + (n % 20),
          qtdVisitantes: n % 12,
          qtdConversoes: n % 4,
          qtdReconciliacoes: n % 3,
          qtdFamilias: 8 + (n % 18),
          cadeirasVazias: n % 30,
        });
      }

      if (plano.cenario === 3) {
        const aprovador = aprovadorPorIgreja.get(plano.churchId);
        if (aprovador) {
          aprovacoes.push({
            registroId: plano.id,
            nivel: 'LOCAL',
            decisao: 'APROVADO',
            aprovadorId: aprovador,
          });
        }
      }
    }

    if (lancamentos.length) {
      await prisma.cultoLancamento.createMany({ data: lancamentos, skipDuplicates: true });
    }
    if (aprovacoes.length) {
      await prisma.cultoAprovacao.createMany({ data: aprovacoes, skipDuplicates: true });
    }

    // O status vem da mesma regra da aplicação, calculada em SQL de uma vez —
    // carimbar status na mão faria o seed divergir do cultoService.
    await recalcularEmLote(campo.id);
  }

  log(`registros de culto criados: ${criados}`);

  // ── 4. Aprovação da hospedeira ────────────────────────────────────────────
  // Sem este passo nenhum registro chegaria a CONCLUIDO: as igrejas do seed
  // ficaram todas com hospedeira, e aí APROVADO_LOCAL não é terminal (D3).
  // O painel do presidente nasceria 100% vermelho e não daria para ver o verde
  // funcionando. Aprova metade das que estão em APROVADO_LOCAL.
  const paraHospedeira = await prisma.cultoRegistro.findMany({
    where: { campoId: campo.id, status: 'APROVADO_LOCAL', deletedAt: null },
    select: { id: true, hostChurchId: true },
    orderBy: { createdAt: 'asc' },
  });

  let concluidos = 0;
  for (let k = 0; k < paraHospedeira.length; k++) {
    if (k % 2 === 1) continue; // metade fica pendente de propósito
    const reg = paraHospedeira[k];
    if (!reg.hostChurchId) continue;

    const jaTem = await prisma.cultoAprovacao.findFirst({
      where: { registroId: reg.id, nivel: 'HOSPEDEIRA' },
      select: { id: true },
    });
    if (jaTem) continue;

    const aprovador = await prisma.cultoPosicao.findFirst({
      where: {
        churchId: reg.hostChurchId,
        papel: 'APROVADOR_HOSPEDEIRA',
        isActive: true,
        deletedAt: null,
      },
      select: { userId: true },
    });
    if (!aprovador) continue;

    if (!DRY_RUN) {
      await prisma.cultoAprovacao.create({
        data: {
          registroId: reg.id,
          nivel: 'HOSPEDEIRA',
          decisao: 'APROVADO',
          aprovadorId: aprovador.userId,
        },
      });
      await recalcular(reg.id);
    }
    concluidos += 1;
  }
  log(`aprovados pela hospedeira (viram CONCLUIDO): ${concluidos}`);

  // ── 5. Algumas devoluções ─────────────────────────────────────────────────
  // Sem isto a coluna "Devolvido" do Kanban nasce vazia e não dá para ver o
  // caminho de volta funcionando.
  const paraDevolver = await prisma.cultoRegistro.findMany({
    where: { campoId: campo.id, status: 'AGUARDANDO_LOCAL', deletedAt: null },
    select: { id: true, churchId: true },
    orderBy: { createdAt: 'asc' },
    take: 30,
  });

  let devolvidos = 0;
  for (let k = 0; k < paraDevolver.length; k += 5) {
    const reg = paraDevolver[k];
    const jaTem = await prisma.cultoAprovacao.findFirst({
      where: { registroId: reg.id, nivel: 'LOCAL' },
      select: { id: true },
    });
    if (jaTem) continue;
    const aprovador = await prisma.cultoPosicao.findFirst({
      where: { churchId: reg.churchId, papel: 'APROVADOR_LOCAL', isActive: true, deletedAt: null },
      select: { userId: true },
    });
    if (!aprovador) continue;
    if (!DRY_RUN) {
      await prisma.cultoAprovacao.create({
        data: {
          registroId: reg.id,
          nivel: 'LOCAL',
          decisao: 'REJEITADO',
          aprovadorId: aprovador.userId,
          motivo: 'Conferir o total de ofertas — não bate com o envelope.',
        },
      });
    }
    devolvidos += 1;
  }
  if (!DRY_RUN && devolvidos > 0) await recalcularEmLote(campo.id);
  log(`devolvidos pelo dirigente: ${devolvidos}`);

  const resumo = DRY_RUN
    ? null
    : await prisma.cultoRegistro.groupBy({ by: ['status'], _count: { _all: true } });
  if (resumo) log('status:', resumo.map((r) => `${r.status}=${r._count._all}`).join(' '));
}

/**
 * Mesma regra do recalcular(), porém para o campo inteiro num único UPDATE.
 * A versão linha a linha levava minutos contra o pooler.
 *
 * Espelho de src/lib/cultoService.ts:recalcularStatus — se a regra mudar lá,
 * mude aqui também.
 */
async function recalcularEmLote(campoId) {
  await prisma.$executeRawUnsafe(
    `
    WITH enviados AS (
      -- FINANCEIRO e PRESENCA são sempre exigidos (ver blocosExigidos em
      -- src/lib/cultoService.ts). O EXTRA não entra na conta de fechamento.
      SELECT r.id AS registro_id,
             count(*) FILTER (WHERE l.bloco = 'FINANCEIRO' AND l.enviado_em IS NOT NULL)::int AS fin,
             count(*) FILTER (WHERE l.bloco = 'PRESENCA'   AND l.enviado_em IS NOT NULL)::int AS pre
      FROM culto_registros r
      LEFT JOIN culto_lancamentos l ON l.registro_id = r.id
      GROUP BY r.id
    ),
    calc AS (
      SELECT r.id,
             CASE
               WHEN EXISTS (SELECT 1 FROM culto_aprovacoes a
                            WHERE a.registro_id = r.id AND a.decisao = 'REJEITADO')
                 THEN 'REJEITADO'
               WHEN EXISTS (SELECT 1 FROM culto_aprovacoes a
                            WHERE a.registro_id = r.id AND a.nivel = 'HOSPEDEIRA' AND a.decisao = 'APROVADO')
                 THEN 'CONCLUIDO'
               WHEN EXISTS (SELECT 1 FROM culto_aprovacoes a
                            WHERE a.registro_id = r.id AND a.nivel = 'LOCAL' AND a.decisao = 'APROVADO')
                 THEN CASE WHEN r.host_church_id IS NULL THEN 'CONCLUIDO' ELSE 'APROVADO_LOCAL' END
               WHEN coalesce(s.fin, 0) > 0 AND coalesce(s.pre, 0) > 0
                 THEN 'AGUARDANDO_LOCAL'
               ELSE 'ABERTO'
             END AS novo_status
      FROM culto_registros r
      LEFT JOIN enviados s ON s.registro_id = r.id
      WHERE r.campo_id = $1::uuid AND r.deleted_at IS NULL
    )
    UPDATE culto_registros r
    SET status = c.novo_status,
        concluido_em = CASE WHEN c.novo_status = 'CONCLUIDO' THEN now() ELSE NULL END
    FROM calc c
    WHERE c.id = r.id AND c.novo_status IS DISTINCT FROM r.status
    `,
    campoId,
  );
}

/**
 * Espelho de src/lib/cultoService.ts:recalcularStatus, em JS puro (o seed não
 * consegue importar o TS). Se a regra mudar lá, mude aqui também.
 */
async function recalcular(registroId) {
  const r = await prisma.cultoRegistro.findUnique({
    where: { id: registroId },
    include: { lancamentos: true, aprovacoes: true },
  });
  if (!r) return;

  // FINANCEIRO e PRESENCA são sempre exigidos.
  const exigidos = ['FINANCEIRO', 'PRESENCA'];
  const enviados = r.lancamentos.filter((l) => l.enviadoEm).map((l) => l.bloco);
  const faltando = exigidos.filter((b) => !enviados.includes(b));

  const local = r.aprovacoes.find((a) => a.nivel === 'LOCAL');
  const hosp = r.aprovacoes.find((a) => a.nivel === 'HOSPEDEIRA');

  let status;
  if (local?.decisao === 'REJEITADO' || hosp?.decisao === 'REJEITADO') status = 'REJEITADO';
  else if (hosp?.decisao === 'APROVADO') status = 'CONCLUIDO';
  else if (local?.decisao === 'APROVADO') status = r.hostChurchId ? 'APROVADO_LOCAL' : 'CONCLUIDO';
  else if (faltando.length === 0) status = 'AGUARDANDO_LOCAL';
  else status = 'ABERTO';

  if (status !== r.status) {
    await prisma.cultoRegistro.update({
      where: { id: registroId },
      data: { status, concluidoEm: status === 'CONCLUIDO' ? new Date() : null },
    });
  }
}

main()
  .catch((e) => {
    console.error('[seed-culto] falhou:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
