// Sugestão de modelo de mensagem pela IA (sem banco, sem rede: o gerador é injetado).
import { nomeDoTitulo, normalizarRascunho, validarRascunho, type RascunhoModelo } from './modelos.ts'

export type PedidoSugestao = { descricao: string; categoria: 'MARKETING' | 'UTILITY'; igrejaNome: string }
export type ResultadoSugestao = { ok: true; rascunho: RascunhoModelo } | { ok: false; erro: string }

const ERRO_FORMA = 'A IA não conseguiu montar um modelo com este pedido. Tente descrever de outro jeito.'

export function montarPromptSugestao(p: PedidoSugestao, erroAnterior?: string[]): string {
  const cat = p.categoria === 'UTILITY'
    ? 'UTILITY (utilidade: aviso ou confirmação ligado a algo que a pessoa já fez ou pediu)'
    : 'MARKETING (convites, campanhas e divulgação)'
  const linhas = [
    `Você escreve modelos de mensagem do WhatsApp oficial (Meta) para a igreja "${p.igrejaNome}".`,
    `Categoria do modelo: ${cat}.`,
    `O que a mensagem deve dizer: ${p.descricao}`,
    '',
    'Responda SOMENTE com um objeto JSON, sem texto antes ou depois e sem markdown, com os campos:',
    '{ "titulo": string, "cabecalho": string (opcional), "exemploCabecalho": string (só se o cabeçalho tiver {{1}}),',
    '  "tipoCabecalho": "nome"|"igreja"|"data"|"livre" (só se o cabeçalho tiver {{1}}), "corpo": string, "rodape": string (opcional),',
    '  "botoes": string[] (opcional), "variaveis": [{ "posicao": number, "tipo": "nome"|"igreja"|"data"|"livre", "exemplo": string }] }',
    '',
    'Regras da Meta que o modelo deve seguir:',
    '- Corpo com 1 a 1024 caracteres; NÃO pode começar nem terminar com uma variável.',
    '- Variáveis sequenciais {{1}}, {{2}}... sem pular número, cada uma com um exemplo realista em "variaveis".',
    '- Cabeçalho (opcional) com no máximo 60 caracteres e no máximo a variável {{1}}.',
    '- Rodapé (opcional) com no máximo 60 caracteres e sem variáveis.',
    '- Até 3 botões de resposta rápida, cada um com no máximo 25 caracteres.',
    '- Não use encurtadores de link (bit.ly e similares) nem links desnecessários.',
    '- Tom amigável e acolhedor de igreja, em português do Brasil (pt_BR).',
  ]
  if (erroAnterior?.length) {
    linhas.push('', 'Sua resposta anterior foi recusada pelos motivos abaixo. Corrija e responda de novo só com o JSON:', ...erroAnterior.map((e) => `- ${e}`))
  }
  return linhas.join('\n')
}

function extrairJson(texto: string): unknown {
  const t = texto.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const ini = t.indexOf('{')
  const fim = t.lastIndexOf('}')
  if (ini < 0 || fim <= ini) return null
  try {
    return JSON.parse(t.slice(ini, fim + 1))
  } catch {
    return null
  }
}

function paraRascunho(bruto: unknown, p: PedidoSugestao): { erros: string[] } | { rascunho: RascunhoModelo } {
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return { erros: ['A resposta precisa ser um objeto JSON.'] }
  const o = bruto as Record<string, unknown>
  const texto = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined)
  const botoes = Array.isArray(o.botoes)
    ? o.botoes.map((b) => ({ texto: typeof b === 'string' ? b.trim() : String((b as { texto?: unknown } | null)?.texto ?? '').trim() })).filter((b) => b.texto !== '')
    : []
  const nome = nomeDoTitulo(texto(o.titulo) ?? texto(o.nome) ?? p.descricao).slice(0, 60) || 'modelo_sugerido'
  const n = normalizarRascunho({
    nome,
    categoria: p.categoria,
    cabecalho: texto(o.cabecalho),
    exemploCabecalho: texto(o.exemploCabecalho),
    tipoCabecalho: texto(o.tipoCabecalho),
    corpo: typeof o.corpo === 'string' ? o.corpo.trim() : o.corpo,
    rodape: texto(o.rodape),
    botoes,
    variaveis: Array.isArray(o.variaveis) ? o.variaveis : [],
  })
  if ('erros' in n) return n
  const regras = validarRascunho(n.rascunho)
  return regras.length ? { erros: regras } : n
}

/** Pede o modelo à IA; inválido => uma nova tentativa com o erro no prompt; depois ok:false. */
export async function sugerirModelo(p: PedidoSugestao, gerar: (prompt: string) => Promise<string>): Promise<ResultadoSugestao> {
  let erros: string[] | undefined
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    let resposta: string
    try {
      resposta = await gerar(montarPromptSugestao(p, erros))
    } catch (e) {
      return { ok: false, erro: e instanceof Error && e.message ? e.message : 'Não foi possível falar com a IA agora.' }
    }
    const bruto = extrairJson(resposta)
    if (bruto === null) {
      erros = ['A resposta não era um JSON válido.']
      continue
    }
    const r = paraRascunho(bruto, p)
    if ('rascunho' in r) return { ok: true, rascunho: r.rascunho }
    erros = r.erros
  }
  return { ok: false, erro: `${ERRO_FORMA} (${erros?.[0] ?? 'resposta inválida'})` }
}
