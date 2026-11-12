import type { MetadataRoute } from "next";
import { baseDoSite } from "@/lib/baseDoSite";

/**
 * robots.txt — o Google pode ler o site público; painel, login, API e links
 * pessoais com código ficam fora da busca. Aponta o mapa do site.
 */
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = await baseDoSite();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app-ui", "/auth", "/api", "/membro", "/campanha", "/gf-resumo", "/pastoral", "/pending-activation", "/design-system"],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
