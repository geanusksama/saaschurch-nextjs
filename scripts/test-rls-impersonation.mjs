// Prova prática do isolamento: assume a identidade de usuários reais de campos
// diferentes (como o PostgREST faz) e confere o que cada um enxerga.
//
// Uso: node scripts/test-rls-impersonation.mjs
import fs from 'node:fs'; import path from 'node:path'; import pg from 'pg';

for (const f of ['.env.local', '.env']) {
  const p = path.resolve(process.cwd(), f);
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

const c = new pg.Client({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await c.connect();

// Um membro por campo, preferindo quem tem user_id vinculado
const { rows: users } = await c.query(`
  SELECT DISTINCT ON (m.campo_id)
         m.user_id, m.full_name, m.campo_id, ca.name AS campo
    FROM public.members m
    JOIN public.campos ca ON ca.id = m.campo_id
   WHERE m.user_id IS NOT NULL AND m.deleted_at IS NULL
   ORDER BY m.campo_id, m.created_at`);

if (users.length < 1) {
  console.log('Nenhum membro com user_id — impossível simular.');
  await c.end(); process.exit(0);
}

const TABELAS = ['app_events', 'feed_posts', 'ministries', 'department_sites',
                 'orders', 'peniel_events'];

console.log(`Simulando ${users.length} usuário(s), um por campo.\n`);

// Além dos membros reais, cria um membro COMUM (não-master) em cada campo que
// não tem ninguém logado, para provar o isolamento do caso que importa.
// Tudo dentro de transação revertida — nada é gravado.
const { rows: campos } = await c.query(`SELECT id, name FROM public.campos ORDER BY name`);
const jaTem = new Set(users.map(u => u.campo_id));
const sinteticos = campos.filter(k => !jaTem.has(k.id)).slice(0, 3);

for (const u of [...users, ...sinteticos.map(k => ({
  user_id: null, full_name: '(membro comum simulado)', campo_id: k.id, campo: k.name, sintetico: true,
}))]) {
  console.log(`── ${u.full_name} · campo ${u.campo} ${'─'.repeat(30)}`);
  await c.query('BEGIN');

  if (u.sintetico) {
    // Reaproveita um usuário real: dentro da transação ele é rebaixado a membro
    // comum e mudado de campo. É o cenário que interessa — alguém sem poderes
    // de master, pertencente a outro tenant. Revertido no ROLLBACK.
    u.user_id = users[0].user_id;
    await c.query(`UPDATE public.users
                      SET is_admin = false, profile_type = 'membro'
                    WHERE id = $1`, [u.user_id]);
    await c.query(`UPDATE public.members
                      SET campo_id = $2::uuid, rol = 9, regional_id = NULL
                    WHERE user_id = $1`, [u.user_id, u.campo_id]);
    // fn_get_my_campo_id também infere o campo pela hierarquia da igreja.
    // Alinha esses caminhos ao campo alvo para que o teste meça o isolamento,
    // e não uma divergência de fallback.
    await c.query(`UPDATE public.churches SET headquarters_id = NULL
                    WHERE id IN (SELECT church_id FROM public.members WHERE user_id = $1)`,
                  [u.user_id]);
    await c.query(`UPDATE public.regionais SET campo_id = $2::uuid
                    WHERE id IN (SELECT ch.regional_id FROM public.members m
                                   JOIN public.churches ch ON ch.id = m.church_id
                                  WHERE m.user_id = $1)`, [u.user_id, u.campo_id]);
  }
  // Reproduz o contexto que o PostgREST monta para um usuário logado
  await c.query(`SELECT set_config('request.jwt.claims',
                 json_build_object('sub', $1::text, 'role','authenticated')::text, true)`,
                [u.user_id]);
  await c.query(`SELECT set_config('request.jwt.claim.sub', $1::text, true)`, [u.user_id]);
  await c.query('SET LOCAL ROLE authenticated');

  const { rows: [ctx] } = await c.query(
    `SELECT public.fn_get_my_campo_id()::text AS campo_id,
            public.fn_is_campo_admin()        AS admin,
            public.fn_is_master()             AS master`);
  console.log(`   fn_get_my_campo_id = ${ctx.campo_id}  admin=${ctx.admin} master=${ctx.master}`);
  const bate = ctx.campo_id === u.campo_id ? '✔' : '✘ DIVERGE do campo do membro';
  console.log(`   ${bate}`);

  for (const t of TABELAS) {
    try {
      const { rows: [r] } = await c.query(`
        SELECT count(*)::int AS visiveis,
               count(*) FILTER (WHERE campo_id IS DISTINCT FROM $1::uuid)::int AS de_outro_campo
          FROM public.${t}`, [u.campo_id]);
      // Master enxergar outros campos é o comportamento desejado, não vazamento.
      const mark = r.de_outro_campo === 0 ? '✔' : (ctx.master ? '·' : '✘ VAZAMENTO');
      console.log(`   ${mark} ${t.padEnd(20)} vê ${String(r.visiveis).padStart(4)} linhas`
                  + (r.de_outro_campo
                      ? `, ${r.de_outro_campo} de outro campo${ctx.master ? ' (master, ok)' : ''}`
                      : ''));
    } catch (e) {
      console.log(`   – ${t}: ${e.message.split('\n')[0]}`);
    }
  }
  await c.query('ROLLBACK');
  console.log('');
}

await c.end();
