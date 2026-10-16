/**
 * Regras compartilhadas das rotas /api/grupos-usuarios.
 *
 * Grupo pertence ao campo ativo (isolamento por campo): de outro campo ele
 * simplesmente não existe para quem está aqui, master inclusive.
 */
import { NextResponse } from 'next/server';
import { prisma } from '../prisma';
import type { AuthUser } from '../auth';
import { campoAtivoId } from '../campoAtivo';
import { exigirPermissao } from './servidor';
import { todasAsChaves } from './resolver';

/** Ler grupos exige ver a tela; mexer exige editar. */
export function exigirGestaoDeGrupos(user: AuthUser, escrita: boolean) {
  return exigirPermissao(user, escrita ? 'system_grupos_usuarios.edit' : 'system_grupos_usuarios.view');
}

export async function grupoDoCampo(id: string, user: AuthUser) {
  return prisma.grupoUsuarios.findFirst({
    where: { id, campoId: campoAtivoId(user), deletedAt: null },
  });
}

export const grupoNaoEncontrado = () =>
  NextResponse.json({ error: 'Grupo não encontrado neste campo.' }, { status: 404 });

/**
 * Mantém só chaves que o sistema conhece, com valor booleano. Chave inventada
 * não entra no banco: se entrasse, ninguém a veria na tela para desmarcar.
 */
export function limparRegras(entrada: unknown): Record<string, boolean> {
  if (!entrada || typeof entrada !== 'object' || Array.isArray(entrada)) return {};
  const conhecidas = new Set(todasAsChaves());
  const saida: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(entrada as Record<string, unknown>)) {
    if (conhecidas.has(k) && typeof v === 'boolean') saida[k] = v;
  }
  return saida;
}

/** Usuários que pertencem ao campo: lotados nele ou liberados para navegá-lo. */
export async function usuariosDoCampo(ids: string[], campoId: string): Promise<string[]> {
  if (!ids.length) return [];
  const achados = await prisma.user.findMany({
    where: {
      id: { in: ids },
      deletedAt: null,
      OR: [{ campoId }, { camposNavegaveis: { some: { campoId } } }],
    },
    select: { id: true },
  });
  return achados.map((u) => u.id);
}
