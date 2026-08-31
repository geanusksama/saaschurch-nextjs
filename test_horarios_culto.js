/**
 * Teste de integração dos horários de culto.
 *
 * Roda o mesmo SQL que /api/lookups/[key] monta (mesmas colunas, mesmos casts,
 * mesmo filtro) dentro de transações que sempre terminam em rollback: nada do
 * que este teste escreve sobrevive.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ok = [];
const falhas = [];
const checar = (nome, condicao, detalhe) =>
  (condicao ? ok : falhas).push(detalhe ? `${nome} — ${detalhe}` : nome);

const ROLLBACK = Symbol('rollback');

/** Roda o corpo numa transação e desfaz tudo no fim. */
async function emTransacao(nome, corpo) {
  try {
    await prisma.$transaction(async (tx) => {
      await corpo(tx);
      throw ROLLBACK;
    });
  } catch (e) {
    if (e !== ROLLBACK) checar(nome, false, e.message.split('\n').slice(-2).join(' ').trim());
  }
}

(async () => {
  const [a, b] = await prisma.$queryRawUnsafe(
    `SELECT id, name FROM churches WHERE deleted_at IS NULL ORDER BY name LIMIT 2`
  );
  console.log(`Igrejas do teste: "${a.name}" e "${b.name}"\n`);

  const listarSQL = `SELECT id, codigo, nome, hora_inicio, ordem, ativo, is_default
                       FROM horario_culto
                      WHERE deleted_at IS NULL AND church_id = $1::uuid
                      ORDER BY ordem, hora_inicio, nome`;

  // 1..3 — seed, criação e isolamento entre igrejas
  await emTransacao('criação e isolamento', async (tx) => {
    const seedA = await tx.$queryRawUnsafe(listarSQL, a.id);
    checar('seed da igreja tem os 3 horários', seedA.length === 3, `${seedA.length} linha(s)`);
    checar(
      'seed traz nome e hora de início',
      seedA.every((h) => h.nome && /^\d{2}:\d{2}$/.test(h.hora_inicio || '')),
      seedA.map((h) => `${h.nome} ${h.hora_inicio}`).join(', ')
    );
    checar('exatamente um horário é o padrão', seedA.filter((h) => h.is_default).length === 1);

    // Cria como o modal cria: código gerado do nome, ordem no fim da lista.
    await tx.$executeRawUnsafe(
      `INSERT INTO horario_culto (codigo, nome, hora_inicio, ordem, church_id, campo_id)
       VALUES ($1, $2, $3, $4::int, $5::uuid,
               (SELECT r.campo_id FROM churches c JOIN regionais r ON r.id = c.regional_id WHERE c.id = $5::uuid))`,
      'CULTO_DE_TESTE',
      'Culto de teste',
      '06:15',
      99,
      a.id
    );
    const depois = await tx.$queryRawUnsafe(listarSQL, a.id);
    checar('horário criado aparece na lista da igreja', depois.length === seedA.length + 1);
    checar('a hora gravada volta como "HH:MM"', depois.some((h) => h.hora_inicio === '06:15'));

    const daOutra = await tx.$queryRawUnsafe(listarSQL, b.id);
    checar(
      'a outra igreja NÃO vê o horário criado',
      !daOutra.some((h) => h.codigo === 'CULTO_DE_TESTE'),
      `${daOutra.length} linha(s) próprias`
    );
  });

  // 4 — código repetido na MESMA igreja é recusado. Transação própria: o erro
  //     do Postgres aborta a transação inteira, não dá para dividir com o resto.
  await emTransacao('código repetido', async (tx) => {
    const [{ codigo }] = await tx.$queryRawUnsafe(
      `SELECT codigo FROM horario_culto WHERE church_id = $1::uuid AND deleted_at IS NULL LIMIT 1`,
      a.id
    );
    let recusou = false;
    try {
      await tx.$executeRawUnsafe(
        `INSERT INTO horario_culto (codigo, nome, church_id) VALUES ($1, 'Repetido', $2::uuid)`,
        codigo,
        a.id
      );
    } catch (e) {
      recusou = /23505|duplicate|unique/i.test(e.message);
    }
    checar('código repetido na mesma igreja é bloqueado', recusou);
  });

  // 5 — o mesmo código vale em OUTRA igreja (unicidade é por igreja)
  await emTransacao('mesmo código em outra igreja', async (tx) => {
    await tx.$executeRawUnsafe(
      `DELETE FROM horario_culto WHERE church_id = $1::uuid AND codigo = 'NOITE'`,
      b.id
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO horario_culto (codigo, nome, church_id) VALUES ('NOITE', 'Outra igreja', $1::uuid)`,
      b.id
    );
    checar('o mesmo código vale em outra igreja', true);
  });

  // 6 — exclusão lógica some da lista
  await emTransacao('exclusão lógica', async (tx) => {
    const [{ id }] = await tx.$queryRawUnsafe(
      `SELECT id FROM horario_culto WHERE church_id = $1::uuid AND deleted_at IS NULL LIMIT 1`,
      a.id
    );
    await tx.$executeRawUnsafe(`UPDATE horario_culto SET deleted_at = now() WHERE id = $1::uuid`, id);
    const restou = await tx.$queryRawUnsafe(listarSQL, a.id);
    checar('excluir some da lista (exclusão lógica)', !restou.some((h) => h.id === id));
  });

  // 7 — nada sobreviveu aos rollbacks
  const [{ n }] = await prisma.$queryRawUnsafe(
    `SELECT count(*)::int AS n FROM horario_culto WHERE codigo = 'CULTO_DE_TESTE'`
  );
  const [{ total }] = await prisma.$queryRawUnsafe(
    `SELECT count(*)::int AS total FROM horario_culto WHERE deleted_at IS NOT NULL`
  );
  checar('rollback: nada do teste ficou gravado', n === 0 && total === 0, `${n} sobra(s)`);

  console.log(ok.map((t) => `  PASSOU  ${t}`).join('\n'));
  if (falhas.length) console.log('\n' + falhas.map((t) => `  FALHOU  ${t}`).join('\n'));
  console.log(`\n${ok.length} passaram, ${falhas.length} falharam`);
  await prisma.$disconnect();
  process.exit(falhas.length ? 1 : 0);
})();
