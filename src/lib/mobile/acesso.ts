/**
 * Painel Mobile — quem pode o quê, e em qual campo.
 *
 * Permissão: a mesma matriz da tela "Funções e Permissões" (settings
 * `permissions_matrix` + sobrescritas do usuário/função), decidida pela mesma
 * `resolvePermission` que o menu usa. A API confere de novo — esconder o item
 * do menu não é o que protege o dado.
 *
 * Campo: o app mostra conteúdo por campo (appv3/docs/01-PRD.md §6.1). O
 * painel trabalha no campo do usuário; só o master escolhe outro (o seletor
 * de campo do sistema grava `mrm_active_field_id`, que a tela manda como
 * `?campoId=`). Mesma regra de `escopoDeIgrejas` (contasPagarScope.ts).
 */
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { AuthUser } from '@/lib/auth';
import { isRestrictedToOwnChurch } from '@/lib/helpers';
import { resolvePermission } from '@/lib/resolvePermission';
import { mergeModules, type PermissionModule, type ProfileKey } from '@/app-ui/system/permissionCatalog';

export type Acao = 'view' | 'create' | 'edit' | 'delete';

const PERFIS = ['master', 'admin', 'campo', 'church'];

// A matriz muda raramente; 30 s evita uma ida ao banco por requisição.
let matrizCache: { quando: number; modulos: PermissionModule[] } | null = null;
async function matriz(): Promise<PermissionModule[]> {
  if (matrizCache && Date.now() - matrizCache.quando < 30_000) return matrizCache.modulos;
  let salvo: PermissionModule[] | null = null;
  try {
    const row = await prisma.setting.findFirst({ where: { settingKey: 'permissions_matrix', churchId: null } });
    if (row?.settingValue) salvo = JSON.parse(row.settingValue as string);
  } catch {
    salvo = null;
  }
  const modulos = mergeModules(salvo);
  matrizCache = { quando: Date.now(), modulos };
  return modulos;
}

export async function pode(user: AuthUser, key: string, acao: Acao): Promise<boolean> {
  if (!PERFIS.includes(user.profileType)) return false;
  return resolvePermission({
    key,
    action: acao,
    profileType: user.profileType as ProfileKey,
    modules: await matriz(),
    userOverrides: user.permissions ?? {},
    userRoleId: user.roleId,
  });
}

export function negado(msg = 'Sem permissão para esta ação.') {
  return NextResponse.json({ error: msg }, { status: 403 });
}

/** Campo em que o painel trabalha, ou null quando o usuário não tem campo. */
export async function campoDoPainel(user: AuthUser, pedido?: string | null): Promise<string | null> {
  if (user.profileType === 'master') {
    if (pedido) {
      const c = await prisma.campo.findFirst({ where: { id: pedido, deletedAt: null }, select: { id: true } });
      if (c) return c.id;
    }
    if (user.campoId) return user.campoId;
    // Master sem campo: o campo com mais regionais (o "principal" do banco).
    const campos = await prisma.campo.findMany({
      where: { deletedAt: null },
      select: { id: true, _count: { select: { regionais: true } } },
    });
    campos.sort((a, b) => b._count.regionais - a._count.regionais);
    return campos[0]?.id ?? null;
  }
  return user.campoId ?? null;
}

/**
 * Secretário/tesoureiro de uma igreja (perfil church ou função com
 * "secret"/"tesour") vê só o que é da própria igreja. Devolve o churchId a
 * aplicar, ou null quando o usuário vê o campo todo.
 */
export function igrejaRestrita(user: AuthUser): string | null {
  return isRestrictedToOwnChurch(user) ? user.churchId ?? '__nenhuma__' : null;
}
