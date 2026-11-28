/**
 * Custo claro do WhatsApp Oficial: gasto do mês e validação da tabela de preços (servidor).
 * A estimativa e a formatação (puras, usadas também nas telas) ficam em custoFormato.ts.
 * O banco entra por injeção (ou importado sob demanda) para testar sem Next/Prisma.
 */
import { inicioDoMes, inicioDoProximoMes } from './tetoMensal.ts'
import { moedaDosPrecos, valorDeCategorias, type Preco } from './custoFormato.ts'

export * from './custoFormato.ts'

export type GastoDoMes = { cobradas: number; porCategoria: Record<string, number>; valor: number | null; moeda: string }

export type DepsGasto = {
  /** Cobranças com billable=true entre os instantes, por categoria. */
  contarCobradas(campoId: string, desde: Date, ate: Date): Promise<Record<string, number>>
  lerPrecos(): Promise<Preco[]>
}

/**
 * Gasto estimado do mês (Brasília) do campo: cobradas × preço da categoria.
 * `valor` fica null se alguma categoria cobrada não tem preço (nunca inventa valor).
 */
export async function gastoDoMes(campoId: string, agora: Date, deps?: DepsGasto): Promise<GastoDoMes> {
  const d = deps ?? (await import('./custoRepo')).depsGastoPadrao
  const [porCategoria, precos] = await Promise.all([
    d.contarCobradas(campoId, inicioDoMes(agora), inicioDoProximoMes(agora)),
    d.lerPrecos(),
  ])
  const moeda = moedaDosPrecos(precos)
  const cobradas = Object.values(porCategoria).reduce((a, n) => a + n, 0)
  return { cobradas, porCategoria, valor: valorDeCategorias(porCategoria, precos, moeda), moeda }
}

/** Valida o corpo do PUT da tabela de preços. */
export function validarPrecos(corpo: unknown):
  { ok: true; precos: Array<Preco & { vigencia: string | null }> } | { ok: false; erro: string } {
  const lista = corpo && typeof corpo === 'object' ? (corpo as { precos?: unknown }).precos : null
  if (!Array.isArray(lista) || lista.length > 50) return { ok: false, erro: 'Lista de preços inválida.' }
  const vistos = new Set<string>()
  const saida: Array<Preco & { vigencia: string | null }> = []
  for (const x of lista) {
    if (!x || typeof x !== 'object') return { ok: false, erro: 'Lista de preços inválida.' }
    const o = x as Record<string, unknown>
    const categoria = typeof o.categoria === 'string' ? o.categoria.trim().toUpperCase() : ''
    const moeda = typeof o.moeda === 'string' ? o.moeda.trim().toUpperCase() : ''
    if (!['MARKETING', 'UTILITY', 'AUTHENTICATION'].includes(categoria)) return { ok: false, erro: 'Categoria inválida.' }
    if (!/^[A-Z]{3}$/.test(moeda)) return { ok: false, erro: 'Moeda inválida (use 3 letras, como USD ou BRL).' }
    const preco = typeof o.preco === 'number' ? o.preco : Number(String(o.preco ?? '').replace(',', '.'))
    if (!Number.isFinite(preco) || preco <= 0 || preco >= 1000) return { ok: false, erro: `Preço de ${categoria} inválido.` }
    const vig = o.vigencia === null || o.vigencia === undefined || o.vigencia === '' ? null : String(o.vigencia)
    if (vig !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(vig) || Number.isNaN(Date.parse(vig)))) return { ok: false, erro: 'Data de vigência inválida.' }
    const chave = `${categoria}|${moeda}`
    if (vistos.has(chave)) return { ok: false, erro: 'Categoria repetida na mesma moeda.' }
    vistos.add(chave)
    saida.push({ categoria, moeda, preco, vigencia: vig })
  }
  return { ok: true, precos: saida }
}
