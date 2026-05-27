import type { AuthUser } from "./auth";

/**
 * Builds the WHERE conditions, params array, and JOIN clause for livro_caixa dashboard queries.
 * Priority: church user scope > explicit churchId > explicit regionalId > campo scope.
 */
export function buildDashboardScope(
  user: AuthUser,
  reqChurchId?: string | null,
  reqRegionalId?: string | null,
) {
  const conditions: string[] = ["lc.deleted_at IS NULL"];
  const params: unknown[] = [];
  let p = 1;
  let joinClause = "";

  if (user?.churchId && user?.profileType === "church") {
    conditions.push(`lc.church_id = $${p}::uuid`);
    params.push(user.churchId);
    p++;
  } else if (reqChurchId) {
    conditions.push(`lc.church_id = $${p}::uuid`);
    params.push(reqChurchId);
    p++;
  } else if (reqRegionalId) {
    // Only needs churches join (regional_id is in churches table)
    conditions.push(`c.regional_id = $${p}::uuid`);
    params.push(reqRegionalId);
    p++;
    joinClause = "JOIN churches c ON c.id = lc.church_id";
  } else if (user?.campoId) {
    conditions.push(`r.campo_id = $${p}::uuid`);
    params.push(user.campoId);
    p++;
    joinClause = "JOIN churches c ON c.id = lc.church_id JOIN regionais r ON r.id = c.regional_id";
  }

  return { conditions, params, p, joinClause };
}
