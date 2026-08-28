/**
 * Configuração usada pelo servidor para montar `<title>`, favicon e manifesto.
 *
 * `generateMetadata`, `generateViewport` e a rota do manifesto pedem a mesma
 * coisa na mesma renderização; `cache` do React resolve isso numa consulta só.
 * Qualquer erro vira o padrão — a página não pode deixar de renderizar porque
 * o banco demorou a responder.
 */
import { cache } from "react";
import { DEFAULT_HOME_CONFIG, type HomeConfig } from "@/lib/homeConfig";
import { resolvePublicCampoId } from "@/lib/penielCampo";
import { loadHomePayload } from "@/lib/homeConfigServer";

export const loadHomeConfigForMetadata = cache(async (): Promise<HomeConfig> => {
  try {
    const campoId = await resolvePublicCampoId({});
    const { config } = await loadHomePayload(campoId);
    return config;
  } catch (error) {
    console.error("[homeMetadata] usando o padrão:", error);
    return DEFAULT_HOME_CONFIG;
  }
});
