// Regras puras do envio em massa (sem banco, sem rede).
import type { VariavelModelo } from './modelos.ts'

export type Contato = { origem: 'membro' | 'interessado'; refId: string; nome: string; telefone: string; igrejaNome: string }

// Erros da Meta que param o disparo inteiro (bloqueio, conta, pagamento, token).
export const CODIGOS_PARAR_DISPARO = [131031, 131042, 368, 190]

// E.164 do Brasil só com dígitos: 55 + DDD + celular de 9 dígitos começando com 9.
export function normalizarTelefoneBR(bruto: string | null): string | null {
  if (!bruto) return null
  let d = bruto.replace(/\D/g, '')
  if (d.length >= 12 && d.startsWith('55')) d = d.slice(2)
  d = d.replace(/^0+/, '')
  if (!/^[1-9][1-9]9\d{8}$/.test(d)) return null
  return '55' + d
}

const PALAVRAS_SAIR = new Set(['sair', 'parar', 'stop', 'cancelar', 'descadastrar'])

export function ehPedidoDeSair(texto: string): boolean {
  const t = texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
  return PALAVRAS_SAIR.has(t)
}

export function primeiroNome(fullName: string, preferredName?: string | null): string {
  const preferido = preferredName?.trim()
  if (preferido) return preferido
  return fullName.trim().split(/\s+/)[0] ?? ''
}

// Mantém o primeiro por telefone; membro vem antes de interessado (ordem estável).
export function deduplicarPorTelefone(contatos: Contato[]): Contato[] {
  const ordenados = [...contatos].sort((a, b) => Number(a.origem === 'interessado') - Number(b.origem === 'interessado'))
  const vistos = new Set<string>()
  const saida: Contato[] = []
  for (const c of ordenados) {
    if (vistos.has(c.telefone)) continue
    vistos.add(c.telefone)
    saida.push(c)
  }
  return saida
}

// posicao 0 = cabeçalho; posições >= 1 = corpo, em ordem.
export function montarParametros(
  variaveis: VariavelModelo[],
  contato: Contato,
  valores: { data?: string; livre?: string },
): { header?: string[]; body: string[] } {
  const valor = (v: VariavelModelo): string => {
    if (v.tipo === 'nome') return primeiroNome(contato.nome)
    if (v.tipo === 'igreja') return contato.igrejaNome
    if (v.tipo === 'data') return valores.data ?? ''
    return valores.livre ?? ''
  }
  const ordenadas = [...variaveis].sort((a, b) => a.posicao - b.posicao)
  const cab = ordenadas.filter((v) => v.posicao === 0)
  const corpo = ordenadas.filter((v) => v.posicao >= 1).map(valor)
  return cab.length ? { header: cab.map(valor), body: corpo } : { body: corpo }
}

export function montarMensagemTemplate(
  telefone: string,
  modeloNome: string,
  idioma: string,
  params: { header?: string[]; body: string[] },
): { messaging_product: 'whatsapp'; to: string; type: 'template'; template: { name: string; language: { code: string }; components: unknown[] } } {
  const components: unknown[] = []
  const texto = (t: string) => ({ type: 'text', text: t })
  if (params.header?.length) components.push({ type: 'header', parameters: params.header.map(texto) })
  if (params.body.length) components.push({ type: 'body', parameters: params.body.map(texto) })
  return { messaging_product: 'whatsapp', to: telefone, type: 'template', template: { name: modeloNome, language: { code: idioma }, components } }
}

export function tamanhoDoLote(limiteRestante: number, pendentes: number, maxLote = 60): number {
  return Math.max(0, Math.min(limiteRestante, pendentes, maxLote))
}
