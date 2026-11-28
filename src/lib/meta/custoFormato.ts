/**
 * Parte pura (segura para o navegador) do custo do WhatsApp Oficial: estimativa e formatação.
 * A Meta cobra por mensagem entregue, direto no cartão do campo; o sistema só estima com a
 * tabela de preços central (meta_precos). Funções puras no topo; o banco entra por injeção
 * (ou importado sob demanda) para testar sem Next/Prisma. Não converte moedas.
 */
export type Preco = { categoria: string; moeda: string; preco: number }
export type CategoriaEstimavel = 'MARKETING' | 'UTILITY'

export const MOEDA_PADRAO = 'BRL'
export const LINK_TABELA_OFICIAL = 'https://business.whatsapp.com/products/platform-pricing#rates'
export const LINK_GERENCIADOR_PAGAMENTOS = 'https://business.facebook.com/latest/billing_hub/'
export const MSG_SEM_PRECO = 'Preço desta categoria não configurado — o master pode preencher em Meta Oficial → App.'

export function estimarCusto(
  qtd: number, categoria: CategoriaEstimavel | string, precos: Preco[], moeda: string,
): { valor: number; moeda: string } | { semPreco: true } {
  const cat = String(categoria).toUpperCase()
  const p = precos.find((x) => x.categoria.toUpperCase() === cat && x.moeda === moeda)
  if (!p || !Number.isFinite(p.preco) || !Number.isFinite(qtd)) return { semPreco: true }
  return { valor: qtd * p.preco, moeda }
}

const SIMBOLO: Record<string, string> = { USD: 'US$', BRL: 'R$', EUR: '€' }

export function formatarValor(valor: number, moeda: string): string {
  const n = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(valor)
  return `${SIMBOLO[moeda] ?? moeda} ${n}`
}

/** Moeda mostrada ao campo: a das linhas da tabela central (USD preferida); sem linhas, USD. */
export function moedaDosPrecos(precos: Preco[]): string {
  if (!precos.length || precos.some((p) => p.moeda === MOEDA_PADRAO)) return MOEDA_PADRAO
  return precos[0].moeda
}

/** Texto fixo mostrado antes do disparo / ao ligar a jornada. */
const CATEGORIA_PT: Record<string, string> = { MARKETING: 'marketing', UTILITY: 'utilidade', AUTHENTICATION: 'autenticação' }

export function textoEstimativa(qtd: number, categoria: string, precos: Preco[], moeda: string = moedaDosPrecos(precos)): string {
  const r = estimarCusto(qtd, categoria, precos, moeda)
  if ('semPreco' in r) return MSG_SEM_PRECO
  return `Valor estimado: ${formatarValor(r.valor, r.moeda)} (${qtd} mensagens de ${CATEGORIA_PT[String(categoria).toUpperCase()] ?? String(categoria).toLowerCase()}). Valor estimado com a tabela da Meta; a Meta cobra no cartão do campo só as mensagens entregues.`
}

/** Soma cobradas/previstas por categoria × preço. null se alguma categoria com mensagens não tem preço. */
export function valorDeCategorias(porCategoria: Record<string, number>, precos: Preco[], moeda: string): number | null {
  let valor: number | null = 0
  for (const [cat, n] of Object.entries(porCategoria)) {
    const r = estimarCusto(n, cat, precos, moeda)
    valor = valor === null || 'semPreco' in r ? null : valor + r.valor
  }
  return valor
}
