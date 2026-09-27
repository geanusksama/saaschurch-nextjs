import { NextRequest, NextResponse } from 'next/server';
import { RECURSOS } from '@/lib/mobile/definicoes';
import { acharNoEscopo, obter } from '@/lib/mobile/recursosServidor';
import { jsonSemCache, rotaMobile } from '@/lib/mobile/rota';
import { executar } from '@/lib/mobile/solicitacaoExecucao';

/**
 * Painel Mobile — POST: aprova a solicitação do app E grava o pedido no
 * cadastro (src/lib/mobile/solicitacaoExecucao.ts). Corpo: { resposta? }.
 * Só existe para recursos com `execucao` na definição (solicitações).
 */
type P = { params: Promise<{ recurso: string; id: string }> };

export async function POST(req: NextRequest, { params }: P) {
  const { recurso, id } = await params;
  const def = RECURSOS[recurso];
  if (!def?.execucao) return NextResponse.json({ error: 'Recurso desconhecido.' }, { status: 404 });
  return rotaMobile(req, def.permKey, 'edit', async (ctx, user) => {
    const corpo = (await req.json().catch(() => ({}))) as { resposta?: unknown };
    const resposta = typeof corpo.resposta === 'string' && corpo.resposta.trim() ? corpo.resposta.trim() : null;
    const row = await acharNoEscopo(recurso, id, ctx); // 404 fora do campo/igreja
    const plano = await executar(row, resposta, user.id ? String(user.id) : null);
    return jsonSemCache({ ...(await obter(recurso, id, ctx)), executado: plano });
  });
}
