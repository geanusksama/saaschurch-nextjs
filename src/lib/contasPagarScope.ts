/**
 * Escopo multi-igreja das rotas de Contas a Pagar.
 *
 * O repositório não usa RLS (as tabelas estão com `relrowsecurity = false`); o
 * isolamento é feito na aplicação, no mesmo formato de /api/assets. Centralizar
 * aqui evita que uma rota nova esqueça o filtro e vaze conta de outra igreja.
 */
import type { AuthUser } from "@/lib/auth";
import { isRestrictedToOwnChurch } from "@/lib/helpers";

export type EscopoIgreja =
  | { ok: true; churchWhere: Record<string, unknown> }
  | { ok: false; erro: string };

/**
 * Monta o `where` da igreja a partir dos filtros da tela e do perfil do usuário.
 * A restrição do perfil sempre vence o filtro pedido no querystring.
 */
export function escopoDeIgrejas(
  user: AuthUser,
  filtros: { churchId?: string; regionalId?: string; campoId?: string }
): EscopoIgreja {
  const churchWhere: Record<string, unknown> = { deletedAt: null };

  if (filtros.churchId) {
    churchWhere.id = filtros.churchId;
  } else if (filtros.regionalId) {
    churchWhere.regionalId = filtros.regionalId;
  } else if (filtros.campoId) {
    churchWhere.regional = { campoId: filtros.campoId };
  } else if (user.campoId) {
    churchWhere.regional = { campoId: user.campoId };
  }

  if (user.profileType !== "master") {
    if (!user.campoId) return { ok: false, erro: "Sem acesso. Campo não definido." };
    churchWhere.regional = {
      ...((churchWhere.regional as Record<string, unknown>) || {}),
      campoId: user.campoId,
    };
  }

  if (isRestrictedToOwnChurch(user)) {
    if (!user.churchId) return { ok: false, erro: "Sem acesso." };
    churchWhere.id = user.churchId;
  }

  return { ok: true, churchWhere };
}

/** Igreja em que uma criação deve cair, respeitando a restrição do perfil. */
export function igrejaDeGravacao(user: AuthUser, churchIdPedido?: string | null) {
  const churchId = churchIdPedido || user.churchId || null;
  if (!churchId) return { ok: false as const, erro: "Igreja é obrigatória." };
  if (isRestrictedToOwnChurch(user) && churchId !== user.churchId) {
    return { ok: false as const, erro: "Sem acesso a esta igreja." };
  }
  return { ok: true as const, churchId };
}

/** Só master/admin/campo mexem em aprovação e pagamento (tesouraria). */
export function podeAprovar(user: AuthUser) {
  return ["master", "admin", "campo"].includes(user.profileType) || !!user.isAdmin;
}
