// Gera um .sql que recria TODAS as policies atuais — rede de segurança antes
// de qualquer migration que mexa em RLS.
// Uso: node scripts/dump-rls-policies.mjs > backups/policies-YYYYMMDD.sql
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

const { rows: pol } = await client.query(`
  SELECT schemaname, tablename, policyname, permissive, roles::text AS roles,
         cmd, qual, with_check
    FROM pg_policies WHERE schemaname='public'
   ORDER BY tablename, policyname`);

const { rows: rls } = await client.query(`
  SELECT c.relname, c.relrowsecurity
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity
   ORDER BY c.relname`);

const out = [];
out.push(`-- Snapshot de RLS/policies — ${new Date().toISOString()}`);
out.push(`-- ${pol.length} policies, ${rls.length} tabelas com RLS ligada`);
out.push('');
for (const t of rls) out.push(`ALTER TABLE public.${t.relname} ENABLE ROW LEVEL SECURITY;`);
out.push('');
for (const p of pol) {
  const roles = p.roles.replace(/[{}]/g, '');
  out.push(`DROP POLICY IF EXISTS "${p.policyname}" ON public.${p.tablename};`);
  out.push(
    `CREATE POLICY "${p.policyname}" ON public.${p.tablename}` +
    ` AS ${p.permissive === 'PERMISSIVE' ? 'PERMISSIVE' : 'RESTRICTIVE'}` +
    ` FOR ${p.cmd} TO ${roles}` +
    (p.qual ? `\n  USING (${p.qual})` : '') +
    (p.with_check ? `\n  WITH CHECK (${p.with_check})` : '') + ';');
  out.push('');
}
console.log(out.join('\n'));
await client.end();
