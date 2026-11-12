import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { baseDoSite } from "@/lib/baseDoSite";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * sitemap.xml — páginas públicas que o Google deve listar: a home, os Grupos
 * Familiares, eventos e as páginas de departamento PUBLICADAS do campo do
 * domínio. Nunca falha: sem banco, devolve só as páginas fixas.
 */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = await baseDoSite();
  const agora = new Date();
  const fixas: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: agora, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/gf`, lastModified: agora, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/eventos`, lastModified: agora, changeFrequency: "weekly", priority: 0.7 },
  ];
  try {
    const host = (await headers()).get("host") ?? "";
    const { resolveCampoFromRequest } = await import("@/lib/publicTenant");
    const campoId = await resolveCampoFromRequest({
      nextUrl: { searchParams: new URLSearchParams() },
      headers: { get: (k: string) => (k === "host" ? host : null) },
    } as never);
    // domínio sem campo reconhecido: só as páginas fixas — nunca as de outro campo
    if (!campoId) return fixas;
    const { data } = await supabaseAdmin.from("department_sites").select("slug, updated_at")
      .eq("status", "PUBLICADO").is("deleted_at", null).eq("campo_id", campoId).limit(200);
    const deps: MetadataRoute.Sitemap = (data ?? []).filter((d) => d.slug).map((d) => ({
      url: `${base}/dep/${String(d.slug).toLowerCase()}`,
      lastModified: d.updated_at ? new Date(d.updated_at) : agora,
      changeFrequency: "monthly",
      priority: 0.6,
    }));
    return [...fixas, ...deps];
  } catch (err) {
    console.error("[sitemap]", err);
    return fixas;
  }
}
