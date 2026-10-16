/**
 * Permissão granular: um ponto da tela (botão, aba, menu) ou uma ação do
 * servidor com chave própria. Ver docs/modules/permissoes-granulares/SPEC.md.
 *
 * Toda chave nasce de uma das duas marcações, que o script
 * `scripts/gerar-arvore-permissoes.mjs` varre para montar a árvore:
 *
 *   <Permissao chave="members.lista.exportar" rotulo="Exportar" herda="members.view">
 *
 *   definirPermissao({ chave: 'members.lista.exportar', rotulo: 'Exportar', herda: 'members.view' })
 *
 * Só valores literais: o script lê o código, não o executa.
 */
export interface DefPermissao {
  /** "modulo.tela.componente" — minúsculas, números e _ entre os pontos. */
  chave: string;
  /** Como aparece na árvore da tela de grupos. */
  rotulo: string;
  /**
   * De quem a chave herda enquanto ninguém decidir sobre ela: uma chave de
   * módulo ("members.view") ou outra chave granular. É o que garante que
   * marcar um botão não muda o acesso de ninguém (SPEC, D6), e é também o pai
   * na árvore: pai negado nega o filho (D7).
   */
  herda: string;
  /** Arquivo onde a marcação foi achada (preenchido pelo script). */
  arquivo?: string;
}

/** Marcação para chaves usadas fora de JSX (rota da API, menu montado em lista). */
export function definirPermissao(def: DefPermissao): string {
  return def.chave;
}

export const ACOES_MODULO = ['view', 'create', 'edit', 'delete'] as const;
export type AcaoModulo = (typeof ACOES_MODULO)[number];

export const ROTULO_ACAO: Record<AcaoModulo, string> = {
  view: 'Ver',
  create: 'Criar',
  edit: 'Editar',
  delete: 'Excluir',
};
