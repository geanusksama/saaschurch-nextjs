/**
 * Resolução das permissões granulares e dos Grupos de usuários.
 *
 * Função pura, usada igual no navegador (usePermissions) e no servidor
 * (exigirPermissao, auth.ts). Ver docs/modules/permissoes-granulares/SPEC.md,
 * seção 3.
 *
 *   master                    → libera
 *   em ≥1 grupo ativo         → OU entre os grupos; chave ausente herda do pai
 *                               NO MESMO GRUPO; sem pai → negado. Categoria e
 *                               sobrescrita pessoal não contam (D2)
 *   fora de grupo             → regra de sempre (resolvePermission) para chave
 *                               de módulo; chave granular herda do pai
 */
import {
  DEFAULT_PERMISSION_MODULES,
  type PermissionModule,
  type ProfileKey,
} from '../../app-ui/system/permissionCatalog';
import { resolvePermission } from '../resolvePermission';
import { COMPONENTES_PERMISSAO } from './arvore.generated';
import { ACOES_MODULO, type DefPermissao } from './definir';

export type MapaPermissoes = Record<string, boolean>;

const POR_CHAVE: Map<string, DefPermissao> = new Map(
  COMPONENTES_PERMISSAO.map((d) => [d.chave, d]),
);

/** Pai da chave granular, ou null para chave de módulo/desconhecida. */
export function herdaDe(chave: string): string | null {
  return POR_CHAVE.get(chave)?.herda ?? null;
}

/** "members.view" → { key: "members", action: "view" }; granular → null. */
export function separarChaveDeModulo(chave: string): { key: string; action: string } | null {
  const i = chave.lastIndexOf('.');
  if (i <= 0) return null;
  const key = chave.slice(0, i);
  const action = chave.slice(i + 1);
  if (key.includes('.') || !(ACOES_MODULO as readonly string[]).includes(action)) return null;
  return { key, action };
}

/** Todas as chaves que o sistema conhece: módulo × ação + granulares. */
export function todasAsChaves(modules: PermissionModule[] = DEFAULT_PERMISSION_MODULES): string[] {
  return [
    ...modules.flatMap((m) => ACOES_MODULO.map((a) => `${m.key}.${a}`)),
    ...COMPONENTES_PERMISSAO.map((d) => d.chave),
  ];
}

/** Valor da chave dentro de UM grupo: explícito, senão o do pai, senão negado. */
function valorNoGrupo(regras: MapaPermissoes, chave: string): boolean {
  let atual: string | null = chave;
  for (let passos = 0; atual && passos < 50; passos++) {
    if (Object.prototype.hasOwnProperty.call(regras, atual)) return regras[atual] === true;
    atual = herdaDe(atual);
  }
  return false;
}

/**
 * Mapa efetivo de quem está em grupo: para cada chave conhecida, OU entre os
 * grupos — e pai negado nega o filho (D7), avaliado também na união.
 */
export function permissoesEfetivasDosGrupos(
  grupos: MapaPermissoes[],
  modules: PermissionModule[] = DEFAULT_PERMISSION_MODULES,
): MapaPermissoes {
  const mapa: MapaPermissoes = {};
  const chaves = todasAsChaves(modules);
  // Chaves de módulo primeiro: os filhos consultam o pai já resolvido.
  for (const chave of chaves) {
    if (separarChaveDeModulo(chave)) mapa[chave] = grupos.some((g) => valorNoGrupo(g, chave));
  }
  // Na árvore, Criar/Editar/Excluir ficam abaixo da tela: tela bloqueada
  // bloqueia as ações dela também (D7), igual ao que a tela de grupos mostra.
  for (const chave of chaves) {
    const m = separarChaveDeModulo(chave);
    if (m && m.action !== 'view') mapa[chave] = mapa[chave] && mapa[`${m.key}.view`] === true;
  }
  const resolver = (chave: string, pilha = 0): boolean => {
    if (chave in mapa) return mapa[chave];
    const pai = herdaDe(chave);
    const proprio = grupos.some((g) => valorNoGrupo(g, chave));
    mapa[chave] = proprio && (pai && pilha < 50 ? resolver(pai, pilha + 1) : true);
    return mapa[chave];
  };
  for (const chave of chaves) resolver(chave);
  return mapa;
}

export interface ContextoPermissao {
  profileType: ProfileKey | string;
  modules: PermissionModule[];
  /** Fora de grupo: sobrescritas pessoais (+ categoria). Em grupo: o mapa efetivo. */
  userOverrides: MapaPermissoes;
  userRoleId?: string | null;
  /** true quando o usuário está em ao menos um grupo ativo do campo. */
  emGrupo?: boolean;
}

/** A pergunta única: esta pessoa pode `chave`? */
export function podeChave(chave: string, ctx: ContextoPermissao): boolean {
  if (ctx.profileType === 'master') return true;
  if (ctx.emGrupo) return ctx.userOverrides[chave] === true;

  const modulo = separarChaveDeModulo(chave);
  if (modulo) {
    return resolvePermission({
      key: modulo.key,
      action: modulo.action,
      profileType: ctx.profileType as ProfileKey,
      modules: ctx.modules,
      userOverrides: ctx.userOverrides,
      userRoleId: ctx.userRoleId ?? null,
    });
  }

  // Granular fora de grupo: sobrescrita pessoal da própria chave, senão o pai.
  // O pai negado nega o filho mesmo com sobrescrita (D7).
  const pai = herdaDe(chave);
  if (!pai) return true; // chave fora da árvore: mesma regra do catálogo (liberada)
  const doPai = podeChave(pai, ctx);
  if (Object.prototype.hasOwnProperty.call(ctx.userOverrides, chave)) {
    return doPai && ctx.userOverrides[chave] === true;
  }
  return doPai;
}
