// Regras puras dos modelos de mensagem (sem banco, sem rede).

export type VariavelModelo = { posicao: number; tipo: 'nome' | 'igreja' | 'data' | 'livre'; exemplo: string }
export type BotaoModelo = { texto: string }
export type RascunhoModelo = {
  nome: string
  categoria: 'MARKETING' | 'UTILITY'
  cabecalho?: string
  exemploCabecalho?: string
  tipoCabecalho?: VariavelModelo['tipo']
  corpo: string
  rodape?: string
  botoes?: BotaoModelo[]
  variaveis: VariavelModelo[]
}

export const ROTULO_STATUS: Record<string, string> = {
  APPROVED: 'Aprovado',
  PENDING: 'Em análise',
  REJECTED: 'Recusado',
  PAUSED: 'Pausado',
  DISABLED: 'Desativado',
}

const REGEX_VARIAVEL = /\{\{(\d+)\}\}/g

function numerosDasVariaveis(texto: string): number[] {
  return [...texto.matchAll(REGEX_VARIAVEL)].map((m) => Number(m[1]))
}

export function nomeDoTitulo(titulo: string): string {
  return titulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 512)
}

export function validarRascunho(r: RascunhoModelo): string[] {
  const erros: string[] = []
  if (!/^[a-z0-9_]{1,512}$/.test(r.nome)) {
    erros.push('O nome do modelo deve ter de 1 a 512 caracteres, só letras minúsculas, números e sublinhado.')
  }
  if (r.categoria !== 'MARKETING' && r.categoria !== 'UTILITY') {
    erros.push('A categoria deve ser Marketing ou Utilidade.')
  }

  const cab = r.cabecalho ?? ''
  if (cab.length > 60) erros.push('O cabeçalho deve ter no máximo 60 caracteres.')
  const nCabecalho = numerosDasVariaveis(cab)
  if (nCabecalho.length > 1) erros.push('O cabeçalho pode ter no máximo 1 variável.')
  else if (nCabecalho.length === 1) {
    if (nCabecalho[0] !== 1) erros.push('A variável do cabeçalho deve ser {{1}}.')
    if (!r.exemploCabecalho || r.exemploCabecalho.trim() === '') erros.push('A variável do cabeçalho precisa de um exemplo.')
  }

  const corpo = r.corpo ?? ''
  if (corpo.trim().length < 1 || corpo.length > 1024) erros.push('O corpo deve ter de 1 a 1024 caracteres.')
  if (/^\s*\{\{\d+\}\}/.test(corpo)) erros.push('O corpo não pode começar com uma variável.')
  if (/\{\{\d+\}\}\s*$/.test(corpo)) erros.push('O corpo não pode terminar com uma variável.')

  const usadas = [...new Set(numerosDasVariaveis(corpo))].sort((a, b) => a - b)
  if (usadas.some((n, i) => n !== i + 1)) {
    erros.push('As variáveis do corpo devem ser sequenciais a partir de {{1}}, sem pular número.')
  }
  for (const n of usadas) {
    const v = r.variaveis.find((x) => x.posicao === n)
    if (!v || !v.exemplo || v.exemplo.trim() === '') erros.push(`A variável {{${n}}} precisa de um exemplo.`)
  }

  const rod = r.rodape ?? ''
  if (rod.length > 60) erros.push('O rodapé deve ter no máximo 60 caracteres.')
  if (numerosDasVariaveis(rod).length > 0) erros.push('O rodapé não pode ter variável.')

  const botoes = r.botoes ?? []
  if (botoes.length > 3) erros.push('São permitidos no máximo 3 botões.')
  botoes.forEach((b, i) => {
    const t = (b.texto ?? '').trim()
    if (t.length < 1 || t.length > 25) erros.push(`O texto do botão ${i + 1} deve ter de 1 a 25 caracteres.`)
  })
  return erros
}

export function montarCorpoGraph(r: RascunhoModelo): { name: string; language: 'pt_BR'; category: string; components: unknown[] } {
  const exemploDe = (n: number) => r.variaveis.find((v) => v.posicao === n)?.exemplo ?? ''
  const components: unknown[] = []

  if (r.cabecalho && r.cabecalho.trim() !== '') {
    const c: Record<string, unknown> = { type: 'HEADER', format: 'TEXT', text: r.cabecalho }
    if (numerosDasVariaveis(r.cabecalho).length > 0) c.example = { header_text: [r.exemploCabecalho ?? ''] }
    components.push(c)
  }

  const corpo: Record<string, unknown> = { type: 'BODY', text: r.corpo }
  const nCorpo = [...new Set(numerosDasVariaveis(r.corpo))].sort((a, b) => a - b)
  if (nCorpo.length > 0) corpo.example = { body_text: [nCorpo.map(exemploDe)] }
  components.push(corpo)

  if (r.rodape && r.rodape.trim() !== '') components.push({ type: 'FOOTER', text: r.rodape })

  if (r.botoes && r.botoes.length > 0) {
    components.push({ type: 'BUTTONS', buttons: r.botoes.map((b) => ({ type: 'QUICK_REPLY', text: b.texto })) })
  }
  return { name: r.nome, language: 'pt_BR', category: r.categoria, components }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizarDaMeta(t: any): {
  metaTemplateId: string
  nome: string
  idioma: string
  categoria: string
  status: string
  motivoRecusa: string | null
  componentes: unknown[]
} {
  const motivo = t?.rejected_reason
  return {
    metaTemplateId: String(t?.id ?? ''),
    nome: String(t?.name ?? ''),
    idioma: String(t?.language ?? 'pt_BR'),
    categoria: String(t?.category ?? ''),
    status: String(t?.status ?? ''),
    motivoRecusa: motivo && motivo !== 'NONE' ? String(motivo) : null,
    componentes: Array.isArray(t?.components) ? t.components : [],
  }
}

const TIPOS_VARIAVEL = ['nome', 'igreja', 'data', 'livre']
const MAX_VARIAVEIS = 20
const MAX_BOTOES = 3
const MAX_EXEMPLO = 200

/**
 * Forma do corpo vindo do cliente: só as chaves conhecidas, tipos estritos e limites
 * (20 variáveis, 3 botões, exemplo até 200). O que não casar vira erro. As regras da Meta
 * ficam em validarRascunho; esta função não as repete.
 */
export function normalizarRascunho(b: unknown): { erros: string[] } | { rascunho: RascunhoModelo } {
  const o = (b && typeof b === 'object' && !Array.isArray(b) ? b : {}) as Record<string, unknown>
  const erros: string[] = []
  if (typeof o.nome !== 'string') erros.push('Informe o nome do modelo.')
  if (o.categoria !== 'MARKETING' && o.categoria !== 'UTILITY') erros.push('Categoria inválida.')
  if (typeof o.corpo !== 'string') erros.push('Informe o texto do corpo.')
  const opcional = (k: string) => {
    const v = o[k]
    if (v === undefined || v === null) return undefined
    if (typeof v !== 'string') { erros.push(`Campo ${k} inválido.`); return undefined }
    return v
  }
  const cabecalho = opcional('cabecalho')
  const exemploCabecalho = opcional('exemploCabecalho')
  const rodape = opcional('rodape')
  const tipoCab = opcional('tipoCabecalho')
  if (tipoCab !== undefined && !TIPOS_VARIAVEL.includes(tipoCab)) erros.push('Tipo da variável do cabeçalho inválido.')
  if (exemploCabecalho !== undefined && exemploCabecalho.length > MAX_EXEMPLO) erros.push('Exemplo do cabeçalho longo demais.')

  const botoesBrutos = o.botoes ?? []
  const botoes: BotaoModelo[] = []
  if (!Array.isArray(botoesBrutos) || botoesBrutos.length > MAX_BOTOES) erros.push('São permitidos no máximo 3 botões.')
  else for (const x of botoesBrutos) {
    const t = (x as { texto?: unknown } | null)?.texto
    if (typeof t !== 'string') { erros.push('Botões inválidos.'); break }
    botoes.push({ texto: t })
  }

  const varsBrutas = o.variaveis ?? []
  const variaveis: VariavelModelo[] = []
  if (!Array.isArray(varsBrutas) || varsBrutas.length > MAX_VARIAVEIS) erros.push('São permitidas no máximo 20 variáveis.')
  else for (const x of varsBrutas) {
    const v = x as { posicao?: unknown; tipo?: unknown; exemplo?: unknown } | null
    if (!v || typeof v.posicao !== 'number' || !Number.isInteger(v.posicao) || v.posicao < 0
      || typeof v.tipo !== 'string' || !TIPOS_VARIAVEL.includes(v.tipo)
      || typeof v.exemplo !== 'string' || v.exemplo.length > MAX_EXEMPLO) {
      erros.push('Variáveis inválidas.')
      break
    }
    variaveis.push({ posicao: v.posicao, tipo: v.tipo as VariavelModelo['tipo'], exemplo: v.exemplo })
  }
  if (erros.length) return { erros }
  return {
    rascunho: {
      nome: o.nome as string, categoria: o.categoria as RascunhoModelo['categoria'], corpo: o.corpo as string,
      cabecalho, exemploCabecalho, tipoCabecalho: tipoCab as VariavelModelo['tipo'] | undefined,
      rodape, botoes, variaveis,
    },
  }
}
