/**
 * Permissão granular no SERVIDOR (SPEC, D4): esconder o botão não basta, a
 * rota da ação recusa a mesma chave.
 *
 *   const negado = await exigirPermissao(user, 'members.lista.exportar');
 *   if (negado) return negado;
 *
 * Mesma resolução do navegador (`podeChave`). Para quem está em grupo,
 * `user.permissions` já é o mapa efetivo (auth.ts); fora de grupo, a matriz
 * salva em `settings` é mesclada ao catálogo, como em /api/help/ask.
 */
import { NextResponse } from 'next/server';
import { prisma } from '../prisma';
import type { AuthUser } from '../auth';
import { mergeModules, type PermissionModule } from '../../app-ui/system/permissionCatalog';
import { podeChave } from './resolver';

async function matrizSalva(): Promise<PermissionModule[]> {
  try {
    const row = await prisma.setting.findFirst({
      where: { settingKey: 'permissions_matrix', churchId: null },
    });
    return mergeModules(row?.settingValue ? JSON.parse(row.settingValue as string) : null);
  } catch {
    // matriz ilegível: cai no catálogo do código, que é o padrão seguro
    return mergeModules(null);
  }
}

/**
 * A MESMA fonte de módulos que o navegador usa para o perfil: o usePermissions
 * só consegue ler a matriz salva como master/admin (/permissions/matrix dá 403
 * para os outros), então campo e igreja decidem pelo catálogo do código. Se o
 * servidor lesse a matriz salva para eles, poderia bloquear um botão que a tela
 * mostra — e o bloqueio tem de ser exatamente o que a tela mostra.
 */
async function modulosDoPerfil(user: AuthUser): Promise<PermissionModule[]> {
  if (user.emGrupo) return mergeModules(null); // em grupo a matriz não conta
  return ['master', 'admin'].includes(user.profileType) ? matrizSalva() : mergeModules(null);
}

export async function pode(user: AuthUser, chave: string): Promise<boolean> {
  if (user.profileType === 'master') return true;
  return podeChave(chave, {
    profileType: user.profileType,
    modules: await modulosDoPerfil(user),
    userOverrides: (user.permissions ?? {}) as Record<string, boolean>,
    userRoleId: user.roleId,
    emGrupo: user.emGrupo,
  });
}

/** null = pode seguir; senão, a resposta 403 pronta para devolver. */
export async function exigirPermissao(user: AuthUser, chave: string): Promise<NextResponse | null> {
  if (await pode(user, chave)) return null;
  return NextResponse.json(
    { error: 'Você não tem permissão para esta ação.', chave },
    { status: 403 },
  );
}
