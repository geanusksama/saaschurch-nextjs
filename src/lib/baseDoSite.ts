import { headers } from "next/headers";
import { publicBaseUrl } from "@/lib/publicUrl";

/**
 * Endereço do site de QUEM está acessando (cada igreja tem o seu domínio).
 * Usado pelo robots.txt e pelo sitemap.xml: com o fallback fixo de
 * publicBaseUrl, o site de outra igreja apontaria para o de Campinas.
 * localhost cai no publicBaseUrl (desenvolvimento).
 */
export async function baseDoSite(): Promise<string> {
  try {
    const h = await headers();
    const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim();
    if (host && !/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(host)) {
      // sites das igrejas são sempre https (o proxy de dev informa http)
      return `https://${host}`.replace(/\/$/, "");
    }
  } catch { /* fora de request */ }
  return publicBaseUrl();
}
