/**
 * Mostra o conteúdo só se a pessoa pode a chave. É também a MARCAÇÃO que o
 * script da árvore varre — por isso `chave`, `rotulo` e `herda` têm de ser
 * texto literal. Ver src/lib/permissoes/definir.ts.
 *
 *   <Permissao chave="members.lista.exportar" rotulo="Exportar" herda="members.view">
 *     <button>Exportar</button>
 *   </Permissao>
 *
 * Esconder não é bloquear: a rota da ação chama exigirPermissao com a mesma
 * chave (SPEC, D4).
 */
import type { ReactNode } from 'react';
import { usePermissions } from '../usePermissions';

function perfilLogado(): string {
  try {
    return JSON.parse(localStorage.getItem('mrm_user') || '{}').profileType ?? 'church';
  } catch {
    return 'church';
  }
}

export function Permissao({
  chave,
  children,
  fallback = null,
}: {
  chave: string;
  /** Lido pelo script da árvore; não muda o comportamento. */
  rotulo: string;
  /** Lido pelo script da árvore; a herança em si vem do arquivo gerado. */
  herda: string;
  children: ReactNode;
  /** O que mostrar sem permissão (padrão: nada). */
  fallback?: ReactNode;
}) {
  const { pode } = usePermissions(perfilLogado());
  return <>{pode(chave) ? children : fallback}</>;
}

/** Para quem precisa decidir em código (desabilitar, filtrar lista de menu). */
export function usePode(): (chave: string) => boolean {
  return usePermissions(perfilLogado()).pode;
}
