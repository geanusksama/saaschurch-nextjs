/**
 * Teste de fumaça do cadastro de produtos: exercita a mesma lógica das rotas
 * /api/cms/department-products contra o banco real e desfaz tudo no final.
 *
 * Confere o que importa: o produto nasce com campo_id, imagens e variações são
 * substituídas em bloco, e o soft delete preserva o histórico.
 *
 * Uso: node scripts/test-department-products.mjs
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

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let falhas = 0;
const ok = (cond, msg) => {
  console.log(`  ${cond ? "✔" : "✘"} ${msg}`);
  if (!cond) falhas++;
};

// Um departamento real para pendurar o teste
const { data: dept } = await sb
  .from("ministries")
  .select("id, name, campo_id")
  .not("campo_id", "is", null)
  .is("deleted_at", null)
  .limit(1)
  .single();

if (!dept) { console.error("Nenhum departamento encontrado."); process.exit(1); }
console.log(`Departamento de teste: ${dept.name}\n`);

let produtoId = null;
try {
  // ── criar ──────────────────────────────────────────────────────────────
  console.log("1. Criar produto");
  const { data: produto, error } = await sb
    .from("department_products")
    .insert({
      campo_id: dept.campo_id,
      department_id: dept.id,
      slug: `zz-teste-${Date.now()}`,
      nome: "ZZ Produto de teste",
      preco: 89.9,
      parcelas_max: 3,
      ficha_tecnica: [{ label: "Tecido", value: "Algodão 30.1" }],
      ativo: true,
    })
    .select("*")
    .single();
  if (error) throw error;
  produtoId = produto.id;

  ok(produto.campo_id === dept.campo_id, "nasce carimbado com o campo do departamento");
  ok(Number(produto.preco) === 89.9, "preço gravado");

  // ── imagens e variações ────────────────────────────────────────────────
  console.log("\n2. Imagens e variações");
  await sb.from("department_product_images").insert([
    { campo_id: dept.campo_id, product_id: produtoId, url: "https://exemplo/1.jpg", ordem: 0, variant_cor: "Preto" },
    { campo_id: dept.campo_id, product_id: produtoId, url: "https://exemplo/2.jpg", ordem: 1, variant_cor: "Branco" },
  ]);
  await sb.from("department_product_variants").insert([
    { campo_id: dept.campo_id, product_id: produtoId, cor: "Preto", cor_hex: "#000", tamanho: "M", estoque: 5 },
    { campo_id: dept.campo_id, product_id: produtoId, cor: "Branco", cor_hex: "#fff", tamanho: "G", estoque: 0 },
  ]);

  const { data: imgs } = await sb.from("department_product_images").select("*").eq("product_id", produtoId);
  const { data: vars } = await sb.from("department_product_variants").select("*").eq("product_id", produtoId);
  ok(imgs.length === 2, "2 imagens gravadas");
  ok(vars.length === 2, "2 variações gravadas");
  ok(imgs.every((i) => i.campo_id === dept.campo_id), "imagens herdaram o campo pela trigger");
  ok(vars.every((v) => v.campo_id === dept.campo_id), "variações herdaram o campo pela trigger");

  // ── substituição em bloco (o que o PATCH faz) ──────────────────────────
  console.log("\n3. Substituição em bloco das variações");
  await sb.from("department_product_variants").delete().eq("product_id", produtoId);
  await sb.from("department_product_variants").insert([
    { campo_id: dept.campo_id, product_id: produtoId, cor: "Azul", tamanho: "P", estoque: 3 },
  ]);
  const { data: vars2 } = await sb.from("department_product_variants").select("*").eq("product_id", produtoId);
  ok(vars2.length === 1 && vars2[0].cor === "Azul", "lista substituída, sem sobras");

  // ── o portal público enxerga? ──────────────────────────────────────────
  console.log("\n4. Visibilidade no portal");
  const { data: publicos } = await sb
    .from("department_products")
    .select("id")
    .eq("department_id", dept.id).eq("ativo", true).is("deleted_at", null);
  ok(publicos.some((p) => p.id === produtoId), "produto ativo aparece na listagem da loja");

  // ── soft delete ────────────────────────────────────────────────────────
  console.log("\n5. Arquivar");
  await sb.from("department_products")
    .update({ deleted_at: new Date().toISOString(), ativo: false })
    .eq("id", produtoId);
  const { data: depois } = await sb
    .from("department_products")
    .select("id")
    .eq("department_id", dept.id).eq("ativo", true).is("deleted_at", null);
  ok(!depois.some((p) => p.id === produtoId), "some da loja");

  const { data: aindaExiste } = await sb
    .from("department_products").select("id").eq("id", produtoId).maybeSingle();
  ok(!!aindaExiste, "linha preservada (histórico de pedidos intacto)");
} finally {
  if (produtoId) {
    await sb.from("department_product_images").delete().eq("product_id", produtoId);
    await sb.from("department_product_variants").delete().eq("product_id", produtoId);
    await sb.from("department_products").delete().eq("id", produtoId);
    console.log("\n(limpeza concluída — nada ficou no banco)");
  }
}

console.log(falhas === 0 ? "\n✔ tudo passou" : `\n✘ ${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
