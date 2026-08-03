/**
 * Verifica o portal público de ponta a ponta.
 *
 * Publica temporariamente uma página de departamento com alguns blocos, busca
 * a URL pública, confere o HTML renderizado e RESTAURA o estado anterior —
 * blocos criados são apagados e o site volta a RASCUNHO. Nada fica no banco.
 *
 * Uso: node scripts/test-portal-publico.mjs [http://localhost:3000]
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

for (const f of [".env.local", ".env"]) {
  const p = path.resolve(process.cwd(), f);
  if (!fs.existsSync(p)) continue;
  for (const l of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const BASE = process.argv[2] || "http://localhost:3000";
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let falhas = 0;
const ok = (cond, msg, extra = "") => {
  console.log(`  ${cond ? "✔" : "✘"} ${msg}${extra ? ` — ${extra}` : ""}`);
  if (!cond) falhas++;
};

const { data: site } = await sb
  .from("department_sites")
  .select("id, slug, titulo, campo_id, status, preset")
  .is("deleted_at", null)
  .order("slug")
  .limit(1)
  .single();

if (!site) { console.error("Nenhuma página de departamento encontrada."); process.exit(1); }

console.log(`Página de teste: "${site.titulo}" (/${site.slug}) · preset ${site.preset}`);
console.log(`Estado original: ${site.status}\n`);

const blocosCriados = [];

try {
  // ── monta uma página mínima mas representativa ─────────────────────────
  console.log("1. Publicar");
  const blocos = [
    {
      tipo: "hero", variante: "gradient", ordem: 0, visivel: true,
      props: { titulo: "TESTE AUTOMATICO HERO", subtitulo: "verificação do renderizador", altura: "md" },
    },
    {
      tipo: "texto", variante: "default", ordem: 1, visivel: true,
      props: { titulo: "TESTE AUTOMATICO TEXTO", conteudo: "Parágrafo de verificação." },
    },
    { tipo: "eventos", variante: "cards", ordem: 2, visivel: true, props: { titulo: "Agenda" } },
    { tipo: "loja",    variante: "vitrine", ordem: 3, visivel: true, props: { titulo: "Loja" } },
  ];

  for (const b of blocos) {
    const { data, error } = await sb
      .from("department_site_blocks")
      .insert({ ...b, site_id: site.id, campo_id: site.campo_id, props_publicado: b.props })
      .select("id").single();
    if (error) throw error;
    blocosCriados.push(data.id);
  }

  await sb.from("department_sites")
    .update({ status: "PUBLICADO", published_at: new Date().toISOString() })
    .eq("id", site.id);
  ok(true, `${blocosCriados.length} blocos publicados`);

  // ── API pública ────────────────────────────────────────────────────────
  console.log("\n2. API pública");
  const rApi = await fetch(`${BASE}/api/public/dept/${site.slug}?campo=${site.campo_id}`);
  const json = await rApi.json().catch(() => ({}));
  ok(rApi.status === 200, "GET /api/public/dept/[slug]", `status ${rApi.status}`);
  ok(Array.isArray(json.blocks) && json.blocks.length === blocos.length,
     "devolve todos os blocos", `${json.blocks?.length ?? 0}`);
  ok(!!json.site && json.site.slug === site.slug, "devolve o site correto");
  ok(json.eventos !== undefined, "inclui eventos (bloco de agenda presente)");
  ok(json.produtos !== undefined, "inclui produtos (bloco de loja presente)");

  // ── lista de slugs usada pela reescrita de URL ─────────────────────────
  console.log("\n3. Slugs para a URL curta");
  const rSlugs = await fetch(`${BASE}/api/public/dept-slugs`, { cache: "no-store" });
  const { slugs } = await rSlugs.json();
  ok(slugs.includes(site.slug), `/${site.slug} entra na lista de reescrita`);

  // ── página renderizada no servidor ─────────────────────────────────────
  console.log("\n4. Página renderizada");
  const rPag = await fetch(`${BASE}/dep/${site.slug}?campo=${site.campo_id}`);
  const html = await rPag.text();
  ok(rPag.status === 200, "GET /dep/[slug]", `status ${rPag.status}`);
  ok(html.includes("TESTE AUTOMATICO HERO"), "hero renderizado no HTML do servidor");
  ok(html.includes("TESTE AUTOMATICO TEXTO"), "bloco de texto renderizado");
  ok(html.includes("--ds-primary"), "tokens do preset aplicados como CSS vars");
  ok(html.includes(site.titulo), "título do departamento presente");
  ok(/<title[^>]*>/.test(html), "metadata de SEO gerada");
} catch (e) {
  console.error("\nERRO:", e.message);
  falhas++;
} finally {
  console.log("\n5. Restaurar estado original");
  if (blocosCriados.length) {
    await sb.from("department_site_blocks").delete().in("id", blocosCriados);
  }
  await sb.from("department_sites")
    .update({ status: site.status, published_at: null })
    .eq("id", site.id);
  const { data: conf } = await sb
    .from("department_sites").select("status").eq("id", site.id).single();
  const { count } = await sb
    .from("department_site_blocks")
    .select("id", { count: "exact", head: true }).eq("site_id", site.id);
  ok(conf.status === site.status, `site voltou a ${site.status}`);
  ok((count ?? 0) === 0, "blocos de teste removidos");
}

console.log(falhas === 0 ? "\n✔ portal público verificado" : `\n✘ ${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
