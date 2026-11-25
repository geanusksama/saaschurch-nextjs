/**
 * Relatórios de Secretaria e de Tesouraria no modelo do sistema de origem das
 * igrejas (grupo → relatório → filtros → impressão). O catálogo descreve cada
 * relatório; a rota /api/relatorios-igreja executa; a tela é montada daqui.
 *
 * Este arquivo é usado no navegador e no servidor: nada de import de servidor.
 */

export type Modulo = 'secretaria' | 'tesouraria';

export type TipoFiltro =
  | 'texto'       // campo livre
  | 'texto_modo'  // campo livre + "Começa com / Contenha"
  | 'opcao'       // lista fixa, uma escolha
  | 'marcar'      // caixa de marcar (sim/não)
  | 'data'        // uma data (AAAA-MM-DD)
  | 'mes'         // 1..12
  | 'ano'         // AAAA
  | 'numero'
  | 'regional' | 'igreja' | 'sede' | 'zona' | 'titulo' | 'funcao' | 'servico' | 'plano_conta' | 'forma_pagamento' | 'banco' | 'departamento' | 'membro';

export interface Opcao { valor: string; rotulo: string }

export interface FiltroDef {
  id: string;
  rotulo: string;
  tipo: TipoFiltro;
  opcoes?: Opcao[];
  /** Valor inicial, igual ao que a tela de origem abre preenchido. */
  padrao?: string;
  /** Só aparece nestes relatórios do grupo (ids). */
  so?: string[];
  /** Largura no formulário (1 = um terço, 2 = dois terços, 3 = linha toda). */
  largura?: 1 | 2 | 3;
}

export type TipoColuna = 'texto' | 'numero' | 'moeda' | 'data' | 'percentual';

export interface ColunaDef {
  id: string;
  rotulo: string;
  tipo?: TipoColuna;
  /** Largura no grid da tela (CSS). */
  larg?: string;
}

export interface TotalDef {
  rotulo: string;
  /** 'contagem' conta linhas; 'soma' soma a coluna. */
  tipo: 'contagem' | 'soma';
  coluna?: string;
}

export interface RelatorioDef {
  id: string;
  nome: string;
  /** Título impresso (o de origem), quando difere do nome na lista. */
  titulo?: string;
  colunas: ColunaDef[];
  /** Coluna que separa a lista em blocos com subtotal (quando "Agrupar"). */
  agruparPor?: string;
  /** Totais por bloco e no fim. */
  totais?: TotalDef[];
  orientacao?: 'portrait' | 'landscape';
  /** Observação sobre diferença conhecida em relação à origem. */
  nota?: string;
  /** 'etiquetas': impressão em etiquetas (mala direta), 3 por linha. */
  formato?: 'tabela' | 'etiquetas';
}

export interface GrupoDef {
  id: string;
  /** Nome com o número de origem: "1 - Igrejas". */
  nome: string;
  filtros: FiltroDef[];
  relatorios: RelatorioDef[];
}

/** Uma linha de resultado: valores já prontos para mostrar/ordenar. */
export type Linha = Record<string, string | number | null>;

export interface Resultado {
  linhas: Linha[];
  /** Nome que vai no topo da impressão (igreja-mãe do campo). */
  organizacao: string;
  /** Aviso quando a consulta foi limitada. */
  aviso?: string;
}

export const LIMITE_LINHAS = 20000;

export const SITUACAO_IGREJA: Opcao[] = [
  { valor: 'todas', rotulo: 'Todas' }, { valor: 'ativa', rotulo: 'Ativa' }, { valor: 'inativa', rotulo: 'Inativa' },
];
export const MODO_TEXTO: Opcao[] = [{ valor: 'comeca', rotulo: 'Começa com' }, { valor: 'contem', rotulo: 'Contenha' }];
export const MESES: Opcao[] = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  .map((m, i) => ({ valor: String(i + 1), rotulo: m }));
