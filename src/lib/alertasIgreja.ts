/**
 * Sininho (notificações): alerta ligado a uma IGREJA (data.churchId — ex.:
 * card da Secretaria movido, kan_action) só aparece para quem é daquela
 * igreja ou para quem enxerga o campo inteiro (master, perfil campo,
 * administrador do campo — sem trava de "só a própria igreja"). Aviso manual
 * do campo (sem churchId) segue para todos do campo. Pedido do dono, 12/11/2026.
 */
import type { AuthUser } from "@/lib/auth";
import { isFieldAdmin, isRestrictedToOwnChurch } from "@/lib/helpers";

/** Quem enxerga o campo inteiro: master, perfil campo e administrador do campo — sem trava de igreja. */
function veOCampoInteiro(user: AuthUser): boolean {
  if (isRestrictedToOwnChurch(user)) return false;
  return user.profileType === "master" || user.profileType === "campo" || isFieldAdmin(user);
}

export function podeVerAlertaDaIgreja(user: AuthUser, n: Record<string, unknown>, userId: string): boolean {
  const data = (n.data as Record<string, unknown> | null) ?? {};
  const churchId = typeof data.churchId === "string" && data.churchId ? data.churchId : null;
  // alerta de sistema da Secretaria (card movido) sem igreja: só quem vê o campo
  // inteiro — nunca vai para todas as igrejas
  if (!churchId) return n.notificationType === "kan_action" ? n.userId === userId || veOCampoInteiro(user) : true
  if (n.userId === userId) return true; // endereçado a esta pessoa
  if (user.churchId && user.churchId === churchId) return true; // da própria igreja
  return veOCampoInteiro(user);
}

