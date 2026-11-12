/**
 * Rastreador do site público (Sistema → Rastreador do site).
 *
 * Gravação: o navegador manda páginas vistas e cliques para
 * POST /api/public/site-eventos (src/components/pwa/RastreadorSite.tsx).
 * Leitura: GET /api/site-rastreio monta o painel com estas funções.
 *
 * Privacidade (LGPD): sem IP, sem nome, sem dado pessoal. visitante_id é um
 * número aleatório guardado no navegador; sessao_id dura 30 min sem uso.
 * Robôs (Googlebot etc.) não são gravados.
 */

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// ── Classificação ────────────────────────────────────────────────────────────

/** Origem legível de uma visita pelo referrer e pelos parâmetros utm. */
export function classificarOrigem(referrer: string | null | undefined, utmSource: string | null | undefined, hostDoSite?: string | null): string {
  const utm = (utmSource ?? '').toLowerCase().trim()
  if (utm) {
    if (/qr/.test(utm)) return 'QR code'
    if (/insta/.test(utm)) return 'Instagram'
    if (/face|fb/.test(utm)) return 'Facebook'
    if (/whats|wa\b/.test(utm)) return 'WhatsApp'
    if (/you ?tube|yt/.test(utm)) return 'YouTube'
    if (/google/.test(utm)) return 'Google'
    if (/tiktok/.test(utm)) return 'TikTok'
    if (/mail/.test(utm)) return 'E-mail'
    return `Campanha: ${utm.slice(0, 30)}`
  }
  let host = ''
  try { host = referrer ? new URL(referrer).hostname.toLowerCase() : '' } catch { host = '' }
  if (!host) return 'Direto'
  if (hostDoSite && (host === hostDoSite || host.endsWith(`.${hostDoSite}`))) return 'Interno'
  if (/(^|\.)google\./.test(host)) return 'Google'
  if (/bing\.|duckduckgo\.|yahoo\.|ecosia\./.test(host)) return 'Outras buscas'
  if (/instagram\./.test(host)) return 'Instagram'
  if (/facebook\.|fb\.|messenger\./.test(host)) return 'Facebook'
  if (/whatsapp\.|wa\.me/.test(host)) return 'WhatsApp'
  if (/youtube\.|youtu\.be/.test(host)) return 'YouTube'
  if (/tiktok\./.test(host)) return 'TikTok'
  if (/t\.co$|twitter\.|x\.com/.test(host)) return 'X (Twitter)'
  return 'Outros sites'
}

export function classificarDispositivo(ua: string): string {
  const u = ua.toLowerCase()
  if (/ipad|tablet|(android(?!.*mobile))/.test(u)) return 'Tablet'
  if (/mobi|iphone|android/.test(u)) return 'Celular'
  return 'Computador'
}

export function classificarNavegador(ua: string): string {
  const u = ua.toLowerCase()
  if (/samsungbrowser/.test(u)) return 'Samsung'
  if (/edg\//.test(u)) return 'Edge'
  if (/opr\/|opera/.test(u)) return 'Opera'
  if (/fban|fbav|instagram/.test(u)) return 'App do Instagram/Facebook'
  if (/firefox|fxios/.test(u)) return 'Firefox'
  if (/chrome|crios/.test(u)) return 'Chrome'
  if (/safari/.test(u)) return 'Safari'
  return 'Outro'
}

export function ehRobo(ua: string): boolean {
  return !ua || /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|whatsapp\/|curl|wget|python|axios|node-fetch/i.test(ua)
}

/** Caminho que pode ser rastreado: só páginas públicas, nunca links pessoais com código. */
export function caminhoRastreavel(caminho: string): boolean {
  if (!caminho.startsWith('/')) return false
  if (/^\/(app-ui|auth|api|pending-activation|design-system|membro|campanha|gf-resumo|pastoral\/timeline|_next)(\/|$)/.test(caminho)) return false
  return true
}

// ── Painel ───────────────────────────────────────────────────────────────────

export interface Contagem { rotulo: string; total: number; visitantes?: number }

export interface PainelRastreio {
  periodo: { de: string; ate: string }
  totais: { visualizacoes: number; visitantes: number; sessoes: number; cliques: number; paginasPorSessao: number; novosVisitantes: number }
  porDia: Array<{ dia: string; visualizacoes: number; visitantes: number }>
  porOrigem: Contagem[]
  porDispositivo: Contagem[]
  porNavegador: Contagem[]
  paginas: Contagem[]
  cliques: Contagem[]
  sitesDeOrigem: Contagem[]
  campanhas: Contagem[]
  porHora: Contagem[]
}

const BRT = "interval '3 hours'"

function janela(de: string, ate: string) {
  const ini = new Date(new Date(`${de}T00:00:00Z`).getTime() + 3 * 3_600_000)
  const fim = new Date(new Date(`${ate}T00:00:00Z`).getTime() + 3 * 3_600_000 + 86_400_000)
  return { ini, fim }
}

const num = (v: unknown) => Number(v ?? 0)

export async function montarPainel(campoId: string | null, de: string, ate: string): Promise<PainelRastreio> {
  const { ini, fim } = janela(de, ate)
  // campo ativo filtra tudo; evento sem campo (site sem campo resolvido) não aparece
  const onde = Prisma.sql`campo_id = ${campoId}::uuid AND created_at >= ${ini} AND created_at < ${fim}`
  const q = <T,>(s: Prisma.Sql) => prisma.$queryRaw<T[]>(s)

  const [tot, novos, dias, origens, disp, nav, pags, clqs, refs, camps, horas] = await Promise.all([
    q<{ v: bigint; vis: bigint; ses: bigint; cli: bigint }>(Prisma.sql`
      SELECT count(*) FILTER (WHERE tipo='pagina') v, count(DISTINCT visitante_id) vis,
             count(DISTINCT sessao_id) ses, count(*) FILTER (WHERE tipo='clique') cli
      FROM site_eventos WHERE ${onde}`),
    // visitante cujo primeiro evento de todos caiu no período
    q<{ n: bigint }>(Prisma.sql`
      SELECT count(*) n FROM (SELECT visitante_id, min(created_at) p FROM site_eventos WHERE campo_id = ${campoId}::uuid
        GROUP BY visitante_id) t WHERE p >= ${ini} AND p < ${fim}`),
    q<{ dia: string; v: bigint; vis: bigint }>(Prisma.sql`
      SELECT to_char((created_at - ${Prisma.raw(BRT)})::date, 'YYYY-MM-DD') dia,
             count(*) FILTER (WHERE tipo='pagina') v, count(DISTINCT visitante_id) vis
      FROM site_eventos WHERE ${onde} GROUP BY 1 ORDER BY 1`),
    // origem conta SESSÕES (a origem é da entrada no site)
    q<{ r: string; n: bigint; vis: bigint }>(Prisma.sql`
      SELECT origem r, count(DISTINCT sessao_id) n, count(DISTINCT visitante_id) vis
      FROM site_eventos WHERE ${onde} AND origem <> 'Interno' GROUP BY 1 ORDER BY 2 DESC LIMIT 20`),
    q<{ r: string; n: bigint }>(Prisma.sql`
      SELECT coalesce(dispositivo,'?') r, count(DISTINCT visitante_id) n FROM site_eventos WHERE ${onde} GROUP BY 1 ORDER BY 2 DESC`),
    q<{ r: string; n: bigint }>(Prisma.sql`
      SELECT coalesce(navegador,'?') r, count(DISTINCT visitante_id) n FROM site_eventos WHERE ${onde} GROUP BY 1 ORDER BY 2 DESC LIMIT 10`),
    q<{ r: string; n: bigint; vis: bigint }>(Prisma.sql`
      SELECT caminho r, count(*) n, count(DISTINCT visitante_id) vis
      FROM site_eventos WHERE ${onde} AND tipo='pagina' GROUP BY 1 ORDER BY 2 DESC LIMIT 30`),
    q<{ r: string; n: bigint; vis: bigint }>(Prisma.sql`
      SELECT coalesce(nullif(alvo,''), alvo_url, '(sem texto)') r, count(*) n, count(DISTINCT visitante_id) vis
      FROM site_eventos WHERE ${onde} AND tipo='clique' GROUP BY 1 ORDER BY 2 DESC LIMIT 30`),
    q<{ r: string; n: bigint }>(Prisma.sql`
      SELECT substring(referrer from '^https?://([^/]+)') r, count(DISTINCT sessao_id) n
      FROM site_eventos WHERE ${onde} AND referrer IS NOT NULL AND origem NOT IN ('Interno','Direto')
      GROUP BY 1 HAVING substring(referrer from '^https?://([^/]+)') IS NOT NULL ORDER BY 2 DESC LIMIT 20`),
    q<{ r: string; n: bigint }>(Prisma.sql`
      SELECT concat_ws(' / ', utm_source, utm_medium, utm_campaign) r, count(DISTINCT sessao_id) n
      FROM site_eventos WHERE ${onde} AND utm_source IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 20`),
    q<{ r: string; n: bigint }>(Prisma.sql`
      SELECT lpad(extract(hour from created_at - ${Prisma.raw(BRT)})::text, 2, '0') || 'h' r, count(*) n
      FROM site_eventos WHERE ${onde} AND tipo='pagina' GROUP BY 1 ORDER BY 1`),
  ])

  const t = tot[0]
  const sessoes = num(t?.ses)
  const visualizacoes = num(t?.v)
  const lista = (rows: Array<{ r: string; n: bigint; vis?: bigint }>): Contagem[] =>
    rows.map(x => ({ rotulo: x.r ?? '?', total: num(x.n), ...(x.vis !== undefined ? { visitantes: num(x.vis) } : {}) }))
  return {
    periodo: { de, ate },
    totais: {
      visualizacoes,
      visitantes: num(t?.vis),
      sessoes,
      cliques: num(t?.cli),
      paginasPorSessao: sessoes ? Math.round((visualizacoes / sessoes) * 10) / 10 : 0,
      novosVisitantes: num(novos[0]?.n),
    },
    porDia: dias.map(d => ({ dia: d.dia, visualizacoes: num(d.v), visitantes: num(d.vis) })),
    porOrigem: lista(origens),
    porDispositivo: lista(disp),
    porNavegador: lista(nav),
    paginas: lista(pags),
    cliques: lista(clqs),
    sitesDeOrigem: lista(refs),
    campanhas: lista(camps),
    porHora: lista(horas),
  }
}

/** Detalhe de um pedaço do gráfico (o que abre na janela ao clicar). */
export type TipoDetalhe = 'origem' | 'pagina' | 'clique' | 'dia' | 'dispositivo'

export async function detalhar(campoId: string | null, de: string, ate: string, tipo: TipoDetalhe, valor: string): Promise<{ colunas: string[]; linhas: Array<Array<string | number>> }> {
  const { ini, fim } = janela(de, ate)
  const onde = Prisma.sql`campo_id = ${campoId}::uuid AND created_at >= ${ini} AND created_at < ${fim}`
  const v = valor.slice(0, 500)
  if (tipo === 'origem') {
    const r = await prisma.$queryRaw<Array<{ c: string; n: bigint; vis: bigint }>>(Prisma.sql`
      SELECT caminho c, count(*) n, count(DISTINCT visitante_id) vis FROM site_eventos
      WHERE ${onde} AND tipo='pagina' AND sessao_id IN (SELECT DISTINCT sessao_id FROM site_eventos WHERE ${onde} AND origem = ${v})
      GROUP BY 1 ORDER BY 2 DESC LIMIT 200`)
    return { colunas: ['Página visitada', 'Visualizações', 'Visitantes'], linhas: r.map(x => [x.c, num(x.n), num(x.vis)]) }
  }
  if (tipo === 'pagina') {
    const [orig, cliq] = await Promise.all([
      prisma.$queryRaw<Array<{ o: string; n: bigint }>>(Prisma.sql`
        SELECT origem o, count(DISTINCT sessao_id) n FROM site_eventos WHERE ${onde} AND caminho = ${v} GROUP BY 1 ORDER BY 2 DESC LIMIT 50`),
      prisma.$queryRaw<Array<{ a: string; n: bigint }>>(Prisma.sql`
        SELECT coalesce(nullif(alvo,''), alvo_url, '(sem texto)') a, count(*) n FROM site_eventos
        WHERE ${onde} AND tipo='clique' AND caminho = ${v} GROUP BY 1 ORDER BY 2 DESC LIMIT 100`),
    ])
    return {
      colunas: ['Tipo', 'Item', 'Quantidade'],
      linhas: [...orig.map(x => ['Origem da visita', x.o, num(x.n)]), ...cliq.map(x => ['Clique na página', x.a, num(x.n)])],
    }
  }
  if (tipo === 'clique') {
    const r = await prisma.$queryRaw<Array<{ c: string; u: string | null; n: bigint; vis: bigint }>>(Prisma.sql`
      SELECT caminho c, max(alvo_url) u, count(*) n, count(DISTINCT visitante_id) vis FROM site_eventos
      WHERE ${onde} AND tipo='clique' AND coalesce(nullif(alvo,''), alvo_url, '(sem texto)') = ${v}
      GROUP BY 1 ORDER BY 3 DESC LIMIT 200`)
    return { colunas: ['Página onde clicaram', 'Destino', 'Cliques', 'Visitantes'], linhas: r.map(x => [x.c, x.u ?? '', num(x.n), num(x.vis)]) }
  }
  if (tipo === 'dispositivo') {
    const r = await prisma.$queryRaw<Array<{ c: string; n: bigint }>>(Prisma.sql`
      SELECT caminho c, count(*) n FROM site_eventos WHERE ${onde} AND tipo='pagina' AND coalesce(dispositivo,'?') = ${v}
      GROUP BY 1 ORDER BY 2 DESC LIMIT 200`)
    return { colunas: ['Página', 'Visualizações'], linhas: r.map(x => [x.c, num(x.n)]) }
  }
  // dia
  const r = await prisma.$queryRaw<Array<{ c: string; o: string; n: bigint }>>(Prisma.sql`
    SELECT caminho c, origem o, count(*) n FROM site_eventos
    WHERE ${onde} AND tipo='pagina' AND to_char((created_at - ${Prisma.raw(BRT)})::date, 'YYYY-MM-DD') = ${v}
    GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 300`)
  return { colunas: ['Página', 'Origem', 'Visualizações'], linhas: r.map(x => [x.c, x.o, num(x.n)]) }
}
