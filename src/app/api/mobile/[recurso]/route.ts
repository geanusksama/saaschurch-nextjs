import { NextRequest, NextResponse } from 'next/server';
import { RECURSOS } from '@/lib/mobile/definicoes';
import { criar, listar } from '@/lib/mobile/recursosServidor';
import { jsonSemCache, rotaMobile } from '@/lib/mobile/rota';

/**
 * Painel Mobile — lista e criação genéricas de um recurso do App Igreja v3.
 * O que cada recurso aceita está em src/lib/mobile/definicoes.ts; escopo e
 * efeitos em src/lib/mobile/recursosServidor.ts.
 *
 * GET  /api/mobile/:recurso?pagina=&q=&filtro=&pai=&tudo=1
 * POST /api/mobile/:recurso   (filho: corpo com __pai = id do registro-pai)
 */
type P = { params: Promise<{ recurso: string }> };

function naoExiste() {
  return NextResponse.json({ error: 'Recurso desconhecido.' }, { status: 404 });
}

export async function GET(req: NextRequest, { params }: P) {
  const { recurso } = await params;
  const def = RECURSOS[recurso];
  if (!def) return naoExiste();
  return rotaMobile(req, def.permKey, 'view', async (ctx) =>
    jsonSemCache(await listar(recurso, ctx, new URL(req.url).searchParams)));
}

export async function POST(req: NextRequest, { params }: P) {
  const { recurso } = await params;
  const def = RECURSOS[recurso];
  if (!def) return naoExiste();
  return rotaMobile(req, def.permKey, 'create', async (ctx) => {
    const corpo = await req.json().catch(() => ({}));
    return jsonSemCache(await criar(recurso, corpo, ctx), 201);
  });
}
