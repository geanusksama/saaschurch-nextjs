import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolveCampoFromRequest } from '@/lib/publicTenant'
import {
  caminhoRastreavel, classificarDispositivo, classificarNavegador, classificarOrigem, ehRobo,
} from '@/lib/siteRastreio'

/**
 * POST /api/public/site-eventos — páginas vistas e cliques do site público
 * (src/components/pwa/RastreadorSite.tsx manda por sendBeacon).
 * Sem login. Nunca falha para o visitante: sempre 204.
 * Sem IP e sem dado pessoal (ver src/lib/siteRastreio.ts).
 */

export const dynamic = 'force-dynamic'

const ID = /^[a-z0-9-]{8,64}$/i
const corta = (v: unknown, n: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null)

// trava por visitante E por IP (o id do visitante é inventado pelo navegador;
// o IP fica só nesta memória, nunca no banco): no máximo N eventos/min
const janelas = new Map<string, { inicio: number; n: number }>()
function dentroDoLimite(chave: string, quantos: number, limite: number): boolean {
  const agora = Date.now()
  const j = janelas.get(chave)
  if (!j || agora - j.inicio > 60_000) {
    if (janelas.size > 20_000) {
      for (const [k, v] of janelas) if (agora - v.inicio > 60_000) janelas.delete(k)
    }
    janelas.set(chave, { inicio: agora, n: quantos })
    return quantos <= limite
  }
  j.n += quantos
  return j.n <= limite
}

/** URL sem parâmetros nem âncora (tokens e e-mails vêm em ?…): só origem + caminho. */
function semParametros(v: string | null): string | null {
  if (!v) return null
  try { const u = new URL(v); return `${u.origin}${u.pathname}`.slice(0, 500) } catch { return null }
}

// o campo vem SÓ do DOMÍNIO (publicTenant) — um ?campo= na chamada não vale
// aqui, senão qualquer um desviaria as visitas de outra igreja. 5 min de cache.
const cacheCampo = new Map<string, { quando: number; id: string | null }>()
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
async function campoDoSite(req: NextRequest): Promise<string | null> {
  const host = (req.headers.get('host') ?? '').toLowerCase().slice(0, 120)
  const c = cacheCampo.get(host)
  if (c && Date.now() - c.quando < 300_000) return c.id
  if (cacheCampo.size > 200) cacheCampo.clear()
  const bruto = await resolveCampoFromRequest({
    nextUrl: { searchParams: new URLSearchParams() },
    headers: { get: (k: string) => (k === 'host' ? host : null) },
  } as unknown as NextRequest)
  const id = bruto && UUID.test(bruto) ? bruto : null
  cacheCampo.set(host, { quando: Date.now(), id })
  return id
}

export async function POST(req: NextRequest) {
  try {
    const ua = req.headers.get('user-agent') ?? ''
    if (ehRobo(ua)) return new NextResponse(null, { status: 204 })

    const texto = await req.text()
    if (texto.length > 20_000) return new NextResponse(null, { status: 204 })
    const body = JSON.parse(texto || '{}') as Record<string, unknown>

    const visitante = corta(body.visitante, 64)
    const sessao = corta(body.sessao, 64)
    if (!visitante || !sessao || !ID.test(visitante) || !ID.test(sessao)) return new NextResponse(null, { status: 204 })

    const eventos = (Array.isArray(body.eventos) ? body.eventos : []).slice(0, 20) as Array<Record<string, unknown>>
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'sem-ip'
    if (!eventos.length || !dentroDoLimite(`v:${visitante}`, eventos.length, 120) || !dentroDoLimite(`ip:${ip}`, eventos.length, 600)) {
      return new NextResponse(null, { status: 204 })
    }

    // referrer sem parâmetros: a origem só precisa do site de onde veio
    const referrer = semParametros(corta(body.referrer, 500))
    const utmSource = corta(body.utmSource, 100)
    const host = req.headers.get('host')?.split(':')[0]?.replace(/^www\./, '') ?? null
    const origem = classificarOrigem(referrer, utmSource, host)
    const campoId = await campoDoSite(req)

    const linhas = eventos
      .map(e => ({
        tipo: e.tipo === 'clique' ? 'clique' : 'pagina',
        caminho: corta(e.caminho, 500) ?? '',
        titulo: corta(e.titulo, 255),
        alvo: corta(e.alvo, 255),
        alvoUrl: semParametros(corta(e.alvoUrl, 500)),
      }))
      // link pessoal (formulário com código, campanha...): fica só o texto do botão
      .map(e => (e.alvoUrl && !caminhoRastreavel(new URL(e.alvoUrl).pathname) && /^https?:\/\/[^/]*\//.test(e.alvoUrl) ? { ...e, alvoUrl: null } : e))
      .filter(e => caminhoRastreavel(e.caminho))
      .map(e => ({
        ...e,
        campoId,
        visitanteId: visitante,
        sessaoId: sessao,
        origem,
        referrer,
        utmSource,
        utmMedium: corta(body.utmMedium, 100),
        utmCampaign: corta(body.utmCampaign, 100),
        dispositivo: classificarDispositivo(ua),
        navegador: classificarNavegador(ua),
      }))
    if (linhas.length) await prisma.siteEvento.createMany({ data: linhas })
  } catch (err) {
    console.error('[site-eventos]', err)
  }
  return new NextResponse(null, { status: 204 })
}
