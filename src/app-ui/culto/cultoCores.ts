/**
 * Cores semânticas da Gestão de Culto.
 *
 * POR QUE HEX E NÃO `bg-emerald-500`:
 *
 * O app tem uma camada de tema em `src/app/globals.css` (linhas ~225-400) que
 * repinta à força TODA classe de cor do Tailwind com a cor escolhida pelo
 * usuário:
 *
 *   .app-shell [class*="bg-emerald-500"], .app-shell [class*="bg-rose-500"], …
 *     { background-color: var(--theme-strong-bg) !important; }
 *
 * O seletor casa por SUBSTRING da classe, então `bg-emerald-500` e
 * `text-rose-700` viram a cor do tema — com tema escuro, o verde e o vermelho
 * saem pretos. Foi o que aconteceu no organograma.
 *
 * Aqui verde e vermelho não são decoração: são o ESTADO do culto. Um valor
 * arbitrário (`bg-[#059669]`) não casa com aqueles seletores e escapa do tema.
 * É o mesmo recurso que o Livro Caixa já usa para receita × despesa
 * (`src/app-ui/finance/LancamentoNew.tsx:1658`).
 *
 * Regra de bolso: **status usa estas constantes; o resto segue o tema.**
 * Botão de ação (Enviar, Aprovar) continua com a cor do tema de propósito.
 */
import type { StatusCulto } from './cultoApi';

/** Bolinha/semáforo cheio. */
export const PONTO = {
  verde: 'bg-[#059669]',
  vermelho: 'bg-[#e11d48]',
  ambar: 'bg-[#d97706]',
  azul: 'bg-[#0284c7]',
  cinza: 'bg-[#94a3b8]',
} as const;

/** Texto colorido. */
export const TEXTO = {
  verde: 'text-[#047857] dark:text-[#34d399]',
  vermelho: 'text-[#be123c] dark:text-[#fb7185]',
  ambar: 'text-[#b45309] dark:text-[#fbbf24]',
  azul: 'text-[#0369a1] dark:text-[#38bdf8]',
  cinza: 'text-[#64748b] dark:text-[#94a3b8]',
} as const;

/** Pastilha: fundo claro + texto escuro da mesma família. */
export const PASTILHA = {
  verde: 'bg-[#d1fae5] text-[#047857] dark:bg-[#064e3b] dark:text-[#6ee7b7]',
  vermelho: 'bg-[#ffe4e6] text-[#be123c] dark:bg-[#4c0519] dark:text-[#fda4af]',
  ambar: 'bg-[#fef3c7] text-[#b45309] dark:bg-[#451a03] dark:text-[#fcd34d]',
  azul: 'bg-[#e0f2fe] text-[#0369a1] dark:bg-[#082f49] dark:text-[#7dd3fc]',
  cinza: 'bg-[#e2e8f0] text-[#475569] dark:bg-[#334155] dark:text-[#cbd5e1]',
} as const;

/** Borda colorida. */
export const BORDA = {
  verde: 'border-[#059669]',
  vermelho: 'border-[#e11d48]',
  ambar: 'border-[#d97706]',
  azul: 'border-[#0284c7]',
  cinza: 'border-[#cbd5e1] dark:border-[#475569]',
} as const;

export type Tom = keyof typeof PONTO;

/**
 * O tom de cada status. Verde só no concluído — todo o resto é pendência para
 * quem está acima, que é a semântica do diagrama.
 */
export const TOM_DO_STATUS: Record<StatusCulto, Tom> = {
  ABERTO: 'cinza',
  AGUARDANDO_LOCAL: 'ambar',
  APROVADO_LOCAL: 'azul',
  CONCLUIDO: 'verde',
  REJEITADO: 'vermelho',
};

/** Semáforo binário do rollup: concluído é verde, o resto é vermelho. */
export function tomDoSemaforo(concluido: boolean): Tom {
  return concluido ? 'verde' : 'vermelho';
}
