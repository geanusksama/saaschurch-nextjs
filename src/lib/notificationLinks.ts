/**
 * Destinos das notificações.
 *
 * O app roda todo sob /app-ui (ver src/spa/routes.tsx). Notificações antigas
 * foram gravadas com caminhos de um prefixo /admin que nunca existiu no
 * roteador — clicar nelas caía no 404. As URLs novas usam as constantes daqui e
 * as antigas são reescritas na hora de montar o link.
 */

export const ROTA_PIPELINE_SECRETARIA = "/app-ui/secretariat/pipeline";
export const ROTA_NOTIFICACOES = "/app-ui/notifications";

/** Caminhos legados → rota real. Chave sem barra final, comparação exata. */
const LEGADO: Record<string, string> = {
  "/admin/secretaria/pipeline": ROTA_PIPELINE_SECRETARIA,
  "/admin/secretariat/pipeline": ROTA_PIPELINE_SECRETARIA,
  "/secretaria/pipeline": ROTA_PIPELINE_SECRETARIA,
  "/admin/notifications": ROTA_NOTIFICACOES,
  "/admin/notificacoes": ROTA_NOTIFICACOES,
};

/**
 * Resolve o destino de uma notificação. Sem URL — ou com uma URL interna que
 * não existe mais — cai na central de notificações, nunca no 404.
 */
export function resolverActionUrl(actionUrl?: string | null): string {
  const url = (actionUrl ?? "").trim();
  if (!url) return ROTA_NOTIFICACOES;

  // Link externo ou âncora: entrega como está, quem renderiza decide o alvo.
  if (/^(https?:)?\/\//i.test(url) || url.startsWith("mailto:") || url.startsWith("#")) return url;

  const semBarra = url.replace(/\/+$/, "") || "/";
  const [caminho, resto] = [semBarra.split(/[?#]/)[0], semBarra.slice(semBarra.split(/[?#]/)[0].length)];
  const destino = LEGADO[caminho];
  if (destino) return `${destino}${resto}`;

  // /admin/... nunca foi rota deste app: manda para a central em vez do 404.
  if (caminho === "/admin" || caminho.startsWith("/admin/")) return ROTA_NOTIFICACOES;

  return url;
}
