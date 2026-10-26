import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { exigirPermissao } from '@/lib/permissoes/servidor';
import { comparar } from '@/lib/engajamento/comparacao';
import { filtroDaQuery, semCache } from '@/lib/engajamento/rota';

/** Comparação entre período de referência e período recente, pelas fotos. */
export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'engajamento.view');
    if (negado) return negado;
    const filtro = await filtroDaQuery(user, new URL(req.url).searchParams);
    if (filtro instanceof NextResponse) return filtro;
    return semCache({ linhas: await comparar(filtro) });
  });
}
