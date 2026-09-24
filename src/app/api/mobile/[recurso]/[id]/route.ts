import { NextRequest, NextResponse } from 'next/server';
import { RECURSOS } from '@/lib/mobile/definicoes';
import { atualizar, excluir, obter } from '@/lib/mobile/recursosServidor';
import { jsonSemCache, rotaMobile } from '@/lib/mobile/rota';

/**
 * Painel Mobile — um registro de um recurso do App Igreja v3.
 * GET (detalhe; solicitação traz link assinado do anexo), PATCH, DELETE.
 * O registro só é encontrado se estiver no campo do painel.
 */
type P = { params: Promise<{ recurso: string; id: string }> };

function naoExiste() {
  return NextResponse.json({ error: 'Recurso desconhecido.' }, { status: 404 });
}

export async function GET(req: NextRequest, { params }: P) {
  const { recurso, id } = await params;
  const def = RECURSOS[recurso];
  if (!def) return naoExiste();
  return rotaMobile(req, def.permKey, 'view', async (ctx) => jsonSemCache(await obter(recurso, id, ctx)));
}

export async function PATCH(req: NextRequest, { params }: P) {
  const { recurso, id } = await params;
  const def = RECURSOS[recurso];
  if (!def) return naoExiste();
  return rotaMobile(req, def.permKey, 'edit', async (ctx) => {
    const corpo = await req.json().catch(() => ({}));
    return jsonSemCache(await atualizar(recurso, id, corpo, ctx));
  });
}

export async function DELETE(req: NextRequest, { params }: P) {
  const { recurso, id } = await params;
  const def = RECURSOS[recurso];
  if (!def) return naoExiste();
  return rotaMobile(req, def.permKey, 'delete', async (ctx) => {
    await excluir(recurso, id, ctx);
    return jsonSemCache({ ok: true });
  });
}
