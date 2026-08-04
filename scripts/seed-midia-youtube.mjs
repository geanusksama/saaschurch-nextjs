/**
 * Substitui o acervo mocado de `app_media_items` pelos vídeos reais do canal
 * do YouTube da AD Campinas.
 *
 * Fonte: feed RSS do canal (o HTML da página devolve tela de consentimento
 * para robô, então raspar não funciona). O RSS não traz duração nem se o vídeo
 * é Short — o tipo é descoberto pedindo /shorts/<id>: o YouTube só mantém essa
 * URL para Short de verdade, vídeo longo é redirecionado para /watch.
 *
 * Faz backup do que existe antes de apagar. Uso:
 *   node scripts/seed-midia-youtube.mjs           (simula)
 *   node scripts/seed-midia-youtube.mjs --apply   (grava)
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const APPLY = process.argv.includes('--apply');
const CANAL = 'UCVwbdCm9oZhTPe14bw7LgmQ';

for (const f of ['.env.local', '.env']) {
  const p = path.resolve(f);
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

// ── 1. feed do canal ────────────────────────────────────────────────────────
const xml = await (await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${CANAL}`)).text();
const entradas = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(e => {
  const b = e[1];
  const g = (re) => (b.match(re) ?? [])[1] ?? null;
  return {
    videoId: g(/<yt:videoId>([^<]+)/),
    titulo: (g(/<title>([^<]+)/) ?? '').trim(),
    publicado: g(/<published>([^<]+)/),
    views: Number(g(/views="(\d+)"/) ?? 0),
  };
}).filter(v => v.videoId && v.titulo);

if (!entradas.length) { console.error('feed vazio — abortando'); process.exit(1); }

// ── 2. Short ou vídeo longo? ────────────────────────────────────────────────
async function ehShort(id) {
  try {
    const r = await fetch(`https://www.youtube.com/shorts/${id}`, { method: 'HEAD', redirect: 'manual' });
    return r.status === 200; // 3xx => redirecionou para /watch, é vídeo longo
  } catch { return false; }
}
for (const v of entradas) v.short = await ehShort(v.videoId);

const shorts = entradas.filter(v => v.short).length;
console.log(`feed: ${entradas.length} vídeos — ${shorts} shorts, ${entradas.length - shorts} longos`);
for (const v of entradas) console.log(`  [${v.short ? 'short ' : 'sermon'}] ${v.titulo.slice(0, 64)}`);

if (!APPLY) { console.log('\nSIMULAÇÃO. Nada gravado. Use --apply.'); process.exit(0); }

// ── 3. grava ────────────────────────────────────────────────────────────────
const c = new pg.Client({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await c.connect();

const { rows: atuais } = await c.query('SELECT * FROM app_media_items');
fs.mkdirSync('backups', { recursive: true });
const bkp = path.join('backups', `app_media_items-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
fs.writeFileSync(bkp, JSON.stringify(atuais, null, 2));
console.log(`\nbackup de ${atuais.length} linha(s) -> ${bkp}`);

// herda campo/canal/escopo das linhas que já existiam, para não inventar vínculo
const base = atuais[0];
if (!base) { console.error('sem linha existente para herdar campo_id/channel_id — abortando'); process.exit(1); }

await c.query('BEGIN');
try {
  await c.query('DELETE FROM app_media_items');
  let i = 0;
  for (const v of entradas) {
    await c.query(
      `INSERT INTO app_media_items
         (channel_id, campo_id, headquarters_id, church_id, audience_scope, kind, slug,
          publish_status, title, subtitle, badge_label, watch_url, thumbnail_url,
          view_count, published_at, accent_hex, is_live_now, sort_order, active)
       VALUES ($1,$2,$3,$4,$5,$6,$16,'published',$7,$8,$9,$10,$11,$12,$13,$14,false,$15,true)`,
      [
        base.channel_id, base.campo_id, base.headquarters_id, base.church_id, base.audience_scope,
        v.short ? 'short' : 'sermon',
        v.titulo,
        'TV AD Campinas',
        v.short ? 'SHORT' : 'PREGACAO',
        v.short ? `https://www.youtube.com/shorts/${v.videoId}` : `https://www.youtube.com/watch?v=${v.videoId}`,
        `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
        v.views,
        v.publicado,
        v.short ? '#7c3aed' : '#2563eb',
        i++,
        // slug único e estável: o próprio id do vídeo no YouTube
        v.videoId.toLowerCase(),
      ]
    );
  }
  await c.query('COMMIT');
  console.log(`OK — ${entradas.length} vídeos reais gravados.`);
} catch (err) {
  await c.query('ROLLBACK');
  console.error('ROLLBACK — nada alterado:', err.message);
  process.exitCode = 1;
}
await c.end();
