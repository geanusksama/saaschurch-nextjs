/**
 * Auto-migracao do banco desta instancia, no build.
 *
 * O saaschurch e um codigo so, mas cada igreja roda contra o SEU proprio banco
 * Supabase. Quando o repositorio ganha uma tabela ou coluna nova, o deploy
 * atualiza o front de todas as igrejas — e os bancos ficariam para tras.
 *
 * Este script roda no build de cada projeto da Vercel, contra o DIRECT_URL que
 * aquele projeto ja tem no ambiente. Nenhuma credencial precisa ser
 * centralizada em lugar nenhum.
 *
 * Como funciona:
 *   1. le a versao do baseline em baseline/manifest.json (vem no repositorio)
 *   2. le a versao aplicada em public._painelchurch_baseline no banco
 *   3. iguais -> nao faz nada e o build segue
 *   4. diferentes -> aplica o baseline (todo idempotente) e carimba a versao
 *
 * ATENCAO A QUEM CRIA MIGRATION: este script aplica o BASELINE, nao as
 * migrations do Prisma. Criar prisma/migrations/... resolve so o banco de
 * referencia. Sem regerar o baseline (painelchurch: npm run baseline:dump) e
 * copiar para saaschurch-nextjs/baseline/, o deploy leva o front novo para
 * todas as igrejas e deixa os bancos delas para tras.
 * Passo a passo: docs/RELEASE-CHECKLIST.md secao 1.
 *
 * ATIVACAO: so roda quando MIGRATE_ON_BUILD=1. E opt-in de proposito — o
 * projeto principal do saaschurch nao deve se automigrar.
 *
 * Falha do script derruba o build. E deliberado: e melhor um deploy que nao sai
 * do que um site no ar com o front novo e o banco velho.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = join(ROOT, 'baseline');

const log = (m) => console.log(`[migrate-self] ${m}`);

// ── Ativacao ────────────────────────────────────────────────────────────────
if (process.env.MIGRATE_ON_BUILD !== '1') {
  log('MIGRATE_ON_BUILD != 1 — auto-migracao desligada, seguindo o build.');
  process.exit(0);
}

const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('[migrate-self] DIRECT_URL/DATABASE_URL ausente. Abortando o build.');
  process.exit(1);
}

/**
 * Bancos que NUNCA podem ser automigrados. O banco de origem do baseline esta
 * aqui: e dele que o baseline e extraido, e aplicar o baseline de volta nele
 * rodaria 8 mil statements na producao do saaschurch.
 *
 * Se MIGRATE_ON_BUILD=1 for ligado por engano no projeto principal, para aqui.
 */
const PROTECTED_REFS = ['ysibqnwgitakofehdxvd'];
const refMatch =
  /postgres\.([a-z0-9]{20})[:@]/i.exec(dbUrl) ||
  /@db\.([a-z0-9]{20})\.supabase\.co/i.exec(dbUrl);
const ref = refMatch?.[1] ?? null;

if (ref && PROTECTED_REFS.includes(ref)) {
  console.error(
    `[migrate-self] Projeto ${ref} e o banco de ORIGEM do baseline e nao pode ` +
    'ser automigrado. Remova MIGRATE_ON_BUILD deste projeto. Abortando.'
  );
  process.exit(1);
}
log(`alvo: ${ref ?? '(ref nao identificado)'}`);
if (!existsSync(join(BASELINE, 'manifest.json'))) {
  console.error('[migrate-self] baseline/manifest.json ausente no repositorio. Abortando.');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(join(BASELINE, 'manifest.json'), 'utf8'));

// Mesma ordem do painel — ver painelchurch/src/lib/baseline.ts
const STEPS = [
  { file: '01_extensions.sql', autocommit: true },
  { file: '02_types.sql' },
  { file: '03_sequences.sql' },
  { file: '05_tables.sql' },
  { file: '05b_columns.sql', autocommit: true, tolerant: true },
  { file: '05c_notnull.sql', autocommit: true, tolerant: true },
  { file: '06_constraints.sql' },
  { file: '07_foreign_keys.sql' },
  { file: '08_indexes.sql' },
  { file: '04_functions.sql' },
  { file: '09_views.sql' },
  { file: '10_triggers.sql' },
  { file: '11_rls_policies.sql' },
  { file: '12_grants.sql' },
  { file: '13_storage.sql' },
  { file: '14_realtime.sql', autocommit: true },
  { file: '99_version.sql' },
];

/** Divide SQL respeitando strings, identificadores e dollar-quoting. */
function splitStatements(sql) {
  const out = []; let buf = ''; let i = 0;
  while (i < sql.length) {
    const c = sql[i], n = sql[i + 1];
    if (c === '-' && n === '-') {
      const e = sql.indexOf('\n', i); const s = e === -1 ? sql.length : e;
      buf += sql.slice(i, s); i = s; continue;
    }
    if (c === '/' && n === '*') {
      const e = sql.indexOf('*/', i + 2); const s = e === -1 ? sql.length : e + 2;
      buf += sql.slice(i, s); i = s; continue;
    }
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === c && sql[j + 1] === c) { j += 2; continue; }
        if (sql[j] === c) { j += 1; break; }
        j += 1;
      }
      buf += sql.slice(i, j); i = j; continue;
    }
    if (c === '$') {
      const m = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/.exec(sql.slice(i));
      if (m) {
        const t = m[0];
        const e = sql.indexOf(t, i + t.length);
        const s = e === -1 ? sql.length : e + t.length;
        buf += sql.slice(i, s); i = s; continue;
      }
    }
    if (c === ';') {
      const s = buf.trim();
      if (s && s.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').trim()) out.push(s);
      buf = ''; i += 1; continue;
    }
    buf += c; i += 1;
  }
  const t = buf.trim();
  if (t && t.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').trim()) out.push(t);
  return out;
}

const client = new pg.Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
  statement_timeout: 180_000,
  connectionTimeoutMillis: 30_000,
});

let exitCode = 0;
try {
  await client.connect();

  // ── Ja esta na versao? ────────────────────────────────────────────────────
  const cur = await client
    .query('select version from public._painelchurch_baseline limit 1')
    .catch(() => null);
  const applied = cur?.rows?.[0]?.version ?? null;

  if (applied === manifest.version) {
    log(`banco ja esta na versao ${applied} — nada a fazer.`);
    await client.end();
    process.exit(0);
  }

  log(`banco em ${applied ?? '(sem carimbo)'} -> aplicando ${manifest.version}`);

  const failures = [];
  for (const step of STEPS) {
    const path = join(BASELINE, step.file);
    if (!existsSync(path)) { log(`${step.file}: ausente, pulando.`); continue; }

    // O carimbo de versao so vale se TUDO passou. Carimbar um banco meio
    // aplicado o marcaria como atualizado, e o deploy seguinte pularia a
    // migracao — o banco ficaria quebrado em silencio.
    if (step.file === '99_version.sql' && failures.length > 0) {
      log(`99_version.sql: NAO carimbado — ${failures.length} falhas antes.`);
      continue;
    }

    const statements = splitStatements(readFileSync(path, 'utf8'));
    const tx = !step.autocommit;
    if (tx) await client.query('begin');

    let done = 0, tolerated = 0, aborted = false;
    for (const stmt of statements) {
      try {
        await client.query(stmt);
        done++;
      } catch (e) {
        const head = stmt.slice(0, 120).replace(/\s+/g, ' ');
        if (step.tolerant) {
          tolerated++;
        } else {
          failures.push(`${step.file}: ${e.message} | ${head}`);
          console.error(`[migrate-self] ERRO ${step.file}: ${e.message}\n   -> ${head}`);
          if (tx) { aborted = true; break; }
        }
      }
    }

    if (tx) await client.query(aborted ? 'rollback' : 'commit');
    log(`${step.file}: ${done} aplicados` +
      (tolerated ? `, ${tolerated} ignorados` : '') +
      (aborted ? ' — REVERTIDO' : ''));
  }

  if (failures.length > 0) {
    console.error(`[migrate-self] ${failures.length} statements falharam. Build abortado.`);
    exitCode = 1;
  } else {
    log(`banco atualizado para ${manifest.version}.`);
  }
} catch (e) {
  console.error(`[migrate-self] falha: ${e.message}`);
  exitCode = 1;
} finally {
  await client.end().catch(() => {});
}

process.exit(exitCode);
