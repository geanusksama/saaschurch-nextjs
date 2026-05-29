import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ysibqnwgitakofehdxvd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzaWJxbndnaXRha29mZWhkeHZkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQyNzA1NSwiZXhwIjoyMDkxMDAzMDU1fQ.x_Llp2oKclR52AnJ9N5RRDY0TYceOUpZ2B0SZ02kr90'
);

const EMAIL = 'engcom-soft@hotmail.com';
const LEGADO  = '0d4f2e77-6f4c-4e3a-9a7f-2d0ce9d68f01';
const CORRETO = '7e1cfbf6-f7b5-48d0-8926-7ed272e07e1d';

async function run() {
  // 1. Busca o user_id via members (email) ou app_cadastros
  const { data: memberCheck } = await supabase.from('members').select('id,email,campo_id').eq('email', EMAIL);
  console.log('members check:', memberCheck);
  const userId = memberCheck?.[0]?.id ?? null;

  // 2. Diagnóstico antes
  const { data: membersRow } = await supabase.from('members').select('email,campo_id').eq('email', EMAIL);
  console.log('members antes:', membersRow);

  const { data: cadastrosRow } = await supabase.from('app_cadastros').select('nome,campo_id').eq('user_id', userId);
  console.log('app_cadastros antes:', cadastrosRow);

  // 3. Corrige members
  const { data: mUpd, error: mErr } = await supabase.from('members')
    .update({ campo_id: CORRETO })
    .eq('email', EMAIL)
    .eq('campo_id', LEGADO)
    .select();
  console.log('members update:', mErr?.message ?? `${mUpd?.length ?? 0} rows`);

  // 4. Corrige app_cadastros
  const { data: cUpd, error: cErr } = await supabase.from('app_cadastros')
    .update({ campo_id: CORRETO })
    .eq('user_id', userId)
    .select();
  console.log('app_cadastros update:', cErr?.message ?? `${cUpd?.length ?? 0} rows`);

  // 5. Confirma feed_posts
  const { data: fp } = await supabase.from('feed_posts').select('id,campo_id,author_name,is_published');
  console.log('feed_posts:', fp);
}

run().catch(console.error);
