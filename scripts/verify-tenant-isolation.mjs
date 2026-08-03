// Verifica o estado do isolamento multi-tenant após as migrations 48/49.
// Uso: node scripts/verify-tenant-isolation.mjs
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

for (const envFile of ['.env.local', '.env']) {
  const p = path.resolve(process.cwd(), envFile);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

const client = new pg.Client({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const section = (t) => console.log(`\n${'═'.repeat(64)}\n${t}\n${'═'.repeat(64)}`);

section('1. RLS ligada com ZERO policies (tabela retorna vazio — BUG)');
const { rows: silent } = await client.query(`
  SELECT c.relname
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity
     AND (SELECT count(*) FROM pg_policies p
           WHERE p.schemaname='public' AND p.tablename=c.relname)=0
   ORDER BY 1`);
console.log(silent.length ? silent.map(r => '  ✘ ' + r.relname).join('\n') : '  ✔ nenhuma');

section('2. Policies permissivas USING(true) em tabelas de tenant');
const { rows: leaky } = await client.query(`
  SELECT tablename, policyname, cmd, roles::text AS roles
    FROM pg_policies
   WHERE schemaname='public' AND qual='true'
     AND tablename IN (SELECT table_name FROM information_schema.columns
                        WHERE table_schema='public' AND column_name='campo_id')
   ORDER BY 1,2`);
console.log(leaky.length
  ? leaky.map(r => `  ✘ ${r.tablename}.${r.policyname} [${r.cmd}] ${r.roles}`).join('\n')
  : '  ✔ nenhuma');

section('3. Linhas órfãs (campo_id NULL) nas tabelas do app');
const tables = ['app_events','event_departments','app_orders','app_tickets',
  'event_orders','event_order_items','event_qrcodes','orders','order_items',
  'feed_posts','feed_post_comments','ministries','ministry_members',
  'department_sites','peniel_registrations'];
for (const t of tables) {
  try {
    const { rows } = await client.query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE campo_id IS NULL)::int AS orfaos
         FROM public.${t}`);
    const { total, orfaos } = rows[0];
    const mark = orfaos === 0 ? '✔' : '⚠';
    console.log(`  ${mark} ${t.padEnd(30)} ${String(total).padStart(6)} linhas, ${orfaos} sem campo_id`);
  } catch (e) { console.log(`  – ${t}: ${e.message.split('\n')[0]}`); }
}

section('4. Tabelas department_* criadas');
const { rows: dept } = await client.query(`
  SELECT table_name FROM information_schema.tables
   WHERE table_schema='public' AND table_name LIKE 'department%' ORDER BY 1`);
console.log(dept.map(r => '  ✔ ' + r.table_name).join('\n') || '  ✘ nenhuma');

section('5. Sites de departamento semeados');
const { rows: sites } = await client.query(`
  SELECT COALESCE(c.name,'(sem campo)') AS campo, ds.slug, ds.titulo, ds.status
    FROM public.department_sites ds
    LEFT JOIN public.campos c ON c.id = ds.campo_id
   ORDER BY 1,2 LIMIT 40`);
console.table(sites);

await client.end();
