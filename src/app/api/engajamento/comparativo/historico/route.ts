import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { exigirPermissao } from '@/lib/permissoes/servidor';
import { linhaDoTempo } from '@/lib/engajamento/comparacao';
import { erro, filtroDaQuery, semCache } from '@/lib/engajamento/rota';

/** Cultos em que uma pessoa do relatório aparece (chave vinda do comparativo). */
export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'engajamento.view');
    if (negado) return negado;
    const sp = new URL(req.url).searchParams;
    const chave = sp.get('chave') ?? '';
    if (!/^(m|p):[0-9a-f-]{36}$|^n:.{1,255}$/i.test(chave)) return erro('Pessoa inválida.');
    const filtro = await filtroDaQuery(user, sp);
    if (filtro instanceof NextResponse) return filtro;
    // a consulta já amarra tudo ao campo ativo (rostos e publicações do campo)
    return semCache({ eventos: await linhaDoTempo(filtro, chave) });
  });
}
