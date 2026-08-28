/**
 * Manifesto do PWA gerado a partir da configuração da igreja.
 *
 * Substitui o antigo `public/manifest.webmanifest` estático (removido: arquivo
 * em `public/` tem precedência sobre esta rota e venceria sempre). Assim o app
 * instalado leva o nome e o ícone da igreja, não os da AD Campinas.
 */
import type { MetadataRoute } from "next";
import { loadHomeConfigForMetadata } from "@/lib/homeMetadata";

// Mesmo motivo do layout: o manifesto vem do banco, não do build.
export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const cfg = await loadHomeConfigForMetadata();

  return {
    name: cfg.pwaName,
    short_name: cfg.pwaShortName,
    description: cfg.siteDescription,
    id: "/",
    start_url: "/?fonte=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: cfg.bgDark,
    theme_color: cfg.bgDark,
    lang: "pt-BR",
    dir: "ltr",
    categories: ["lifestyle", "education"],
    icons: [
      { src: cfg.pwaIcon192, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: cfg.pwaIcon512, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: cfg.pwaIconMaskable, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Portal do Membro",
        short_name: "Sou Membro",
        url: "/?atalho=membro",
        icons: [{ src: cfg.pwaIcon192, sizes: "192x192" }],
      },
    ],
  };
}
