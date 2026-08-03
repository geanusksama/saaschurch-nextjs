/**
 * Garante o bucket `dept-media`, usado pelas imagens das páginas de
 * departamento e da loja.
 *
 * O código já referenciava esse bucket (em useDeptPage.uploadDeptMedia), mas
 * ele nunca havia sido criado — todo upload falhava com "Bucket not found".
 *
 * Público: as fotos aparecem em páginas abertas a visitantes sem login.
 *
 * Uso: node scripts/ensure-dept-media-bucket.mjs
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

const NOME = "dept-media";

const { data: buckets, error: erroLista } = await sb.storage.listBuckets();
if (erroLista) { console.error("Falha ao listar buckets:", erroLista.message); process.exit(1); }

if (buckets.some((b) => b.name === NOME)) {
  console.log(`✔ bucket "${NOME}" já existe`);
  process.exit(0);
}

const { error } = await sb.storage.createBucket(NOME, {
  public: true,
  fileSizeLimit: 10 * 1024 * 1024, // 10 MB por arquivo
  allowedMimeTypes: [
    "image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml",
    "video/mp4", "video/webm",
  ],
});

if (error) { console.error("Falha ao criar bucket:", error.message); process.exit(1); }
console.log(`✔ bucket "${NOME}" criado (público, 10 MB por arquivo)`);
