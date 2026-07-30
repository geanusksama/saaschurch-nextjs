/**
 * Resolução de permissão — a regra de decisão que estava dentro de
 * usePermissions, extraída como função pura para poder ser testada de fora do
 * React (ver scripts/e2e-permissao-chat.mjs) e reaproveitada em qualquer lugar
 * que precise decidir acesso sem montar o hook.
 *
 * Ordem de precedência:
 *   1. sobrescrita explícita do usuário (`users.permissions`, ex "internal_chat.view")
 *   2. FUNÇÃO (role) como whitelist: com role + sobrescritas salvas, o que não
 *      foi concedido é negado — exceto chaves opt-out (OPT_OUT_PERMISSION_KEYS)
 *   3. padrão do catálogo para o profileType
 *   4. chave desconhecida (fora do catálogo) → liberada
 */
import {
  OPT_OUT_PERMISSION_KEYS,
  type PermissionModule,
  type ProfileKey,
} from '../app-ui/system/permissionCatalog';

export interface ResolveInput {
  key: string;
  action: string;
  profileType: ProfileKey;
  modules: PermissionModule[];
  /** { "dashboard.view": false, "members.create": true, ... } */
  userOverrides: Record<string, boolean>;
  /** id da função atribuída ao usuário, ou null */
  userRoleId?: string | null;
}

export function resolvePermission({
  key,
  action,
  profileType,
  modules,
  userOverrides,
  userRoleId = null,
}: ResolveInput): boolean {
  const overrideKey = `${key}.${action}`;
  if (overrideKey in userOverrides) return userOverrides[overrideKey];

  // Role whitelist: qualquer chave ausente do mapa é negada.
  // Guard: só ativa quando há sobrescritas, para não bloquear a sidebar
  // enquanto as permissões ainda estão carregando.
  // Chaves opt-out escapam da whitelist e caem no padrão do perfil — roles
  // antigas não conhecem chaves novas e o recurso já era visível para todos.
  if (userRoleId && Object.keys(userOverrides).length > 0 && !OPT_OUT_PERMISSION_KEYS.has(key)) {
    return false;
  }

  const mod = modules.find((m) => m.key === key);
  if (!mod) return true;
  const actionPerms = mod.permissions[action as keyof typeof mod.permissions];
  if (!actionPerms) return false;
  return (actionPerms as Record<string, boolean>)[profileType] ?? false;
}
