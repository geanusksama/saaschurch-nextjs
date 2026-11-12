/**
 * Situação do membro (`members.membership_status`) — decisão do dono, 31/10/2026:
 * - "INATIVO" não existe: vira DESLIGADO, qualquer que seja o cargo ou título.
 * - Grafias erradas de desligado (Desigado, Desligamento de Membros, Suspenso)
 *   também viram DESLIGADO.
 * - Grafias de aguardando (AGUARDANDO_ATIVACAO, Aguadando Ativação...) viram
 *   AGUARDANDO ATIVACAO; "Ativo" vira ATIVO.
 * - EXCLUIDO e "Carta de Mudança" continuam existindo (têm rotina própria).
 *   Outros valores ficam como estão (mudança futura).
 *
 * Toda gravação do status passa por `normalizarSituacaoMembro`, inclusive o texto
 * das regras da matriz de serviços, para a grafia errada não voltar ao banco.
 */
const DESLIGADO_ALIASES = new Set([
  "INATIVO", "INACTIVE", "DESLIGADO", "DESIGADO", "DESLIGAMENTO DE MEMBROS",
  "SUSPENSO",
]);

function semAcento(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Vazio → null (quem chama decide o padrão). */
export function normalizarSituacaoMembro(valor: unknown): string | null {
  const s = semAcento(valor);
  if (!s) return null;
  if (s.startsWith("AGUA")) return "AGUARDANDO ATIVACAO";
  if (s === "ATIVO" || s === "ACTIVE") return "ATIVO";
  if (s === "EXCLUIDO") return "EXCLUIDO";
  if (DESLIGADO_ALIASES.has(s)) return "DESLIGADO";
  return String(valor).trim();
}
