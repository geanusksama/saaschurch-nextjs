import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * GET /api/public/dept-slugs
 *
 * Lista os slugs de páginas de departamento publicadas. Consumida pelo
 * middleware para saber quais caminhos de um segmento (`/jovens`) devem ser
 * reescritos para o portal em vez de cair no SPA.
 *
 * Devolve só os slugs — nenhum conteúdo — então é seguro ser público.
 */
export const revalidate = 60;

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("department_sites")
    .select("slug")
    .eq("status", "PUBLICADO")
    .is("deleted_at", null)
    .returns<{ slug: string }[]>();

  if (error) {
    // Lista vazia é mais seguro que erro: o middleware simplesmente não
    // reescreve nada e o SPA continua atendendo.
    return NextResponse.json({ slugs: [] });
  }

  return NextResponse.json(
    { slugs: [...new Set((data ?? []).map((r) => r.slug.toLowerCase()))] },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600" } },
  );
}
