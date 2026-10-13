import type { AuthUser } from "./auth";
import { NENHUM_ID, campoAtivoId } from "./campoAtivo";
import { isRestrictedToOwnChurch } from "./helpers";

/**
 * Escopo das consultas de livro_caixa do dashboard financeiro.
 *
 * O campo ativo entra SEMPRE, para todo perfil (master inclusive). A igreja
 * pedida no corpo da requisição só estreita dentro dele — e perfil igreja,
 * secretaria e tesouraria ficam na própria igreja, peçam o que pedirem.
 *
 * A consulta precisa de `JOIN churches c ... JOIN regionais r ...` (alias c e r).
 */
export function escopoDoDashboard(user: AuthUser, reqChurchId: unknown, primeiroParam: number) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let p = primeiroParam;

  conditions.push(`r.campo_id = $${p}::uuid`);
  params.push(campoAtivoId(user));
  p++;

  const churchId = isRestrictedToOwnChurch(user)
    ? user.churchId || NENHUM_ID
    : typeof reqChurchId === "string" && reqChurchId
      ? reqChurchId
      : null;
  if (churchId) {
    conditions.push(`lc.church_id = $${p}::uuid`);
    params.push(churchId);
    p++;
  }

  return { conditions, params, p };
}
