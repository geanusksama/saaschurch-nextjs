require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL });
c.connect().then(async () => {
  // headquarters columns
  const hq = await c.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'headquarters'
    ORDER BY ordinal_position LIMIT 8
  `);
  console.log('=== headquarters columns ===');
  hq.rows.forEach(x => console.log(' ', x.column_name, '|', x.data_type));

  // sample headquarters rows
  const rows = await c.query(`SELECT id, nome, campo_id FROM headquarters LIMIT 5`);
  console.log('\n=== headquarters sample ===');
  rows.rows.forEach(x => console.log(JSON.stringify(x)));

  // FK check: does app_cadastros.headquarters_id reference headquarters.id?
  const fk = await c.query(`
    SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS ref_table, ccu.column_name AS ref_col
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'app_cadastros' AND tc.constraint_type = 'FOREIGN KEY'
  `);
  console.log('\n=== app_cadastros FKs ===');
  fk.rows.forEach(x => console.log(JSON.stringify(x)));

  await c.end();
}).catch(console.error);
