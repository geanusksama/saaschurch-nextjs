// Executa um arquivo .sql inteiro contra o banco (DIRECT_URL).
// Uso: node scripts/run-sql-file.mjs <caminho.sql> [--dry]
//
// Usa o simple query protocol do `pg`, que aceita múltiplos statements e
// dollar-quoting ($$ ... $$) sem precisar fatiar o arquivo.
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const file = process.argv[2];
const dry = process.argv.includes('--dry');
if (!file) {
  console.error('uso: node scripts/run-sql-file.mjs <arquivo.sql> [--dry]');
  process.exit(1);
}

// carrega .env.local sem depender de dotenv
for (const envFile of ['.env.local', '.env']) {
  const p = path.resolve(process.cwd(), envFile);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

const conn = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!conn) { console.error('DIRECT_URL/DATABASE_URL ausente'); process.exit(1); }

const sql = fs.readFileSync(path.resolve(file), 'utf8');
console.log(`→ ${file} (${sql.length} bytes)`);
if (dry) { console.log('--dry: nada executado'); process.exit(0); }

const client = new pg.Client({
  connectionString: conn,
  ssl: { rejectUnauthorized: false },
  statement_timeout: 300000,
});

try {
  await client.connect();
  const res = await client.query(sql);
  const results = Array.isArray(res) ? res : [res];
  console.log(`✔ OK — ${results.length} comandos`);
  for (const r of results) {
    if (r.rows?.length) console.table(r.rows.slice(0, 25));
  }
} catch (err) {
  console.error('✘ FALHOU');
  console.error(`  ${err.message}`);
  for (const k of ['detail','hint','where','position','routine','code']) {
    if (err[k]) console.error(`  ${k}: ${err[k]}`);
  }
  if (err.position) {
    const pos = Number(err.position);
    console.error('  ...' + sql.slice(Math.max(0, pos - 220), pos + 220) + '...');
  }
  process.exitCode = 1;
} finally {
  await client.end();
}
