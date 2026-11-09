import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { campoAtivoId } from '@/lib/campoAtivo';
import { exigirPermissao } from '@/lib/permissoes/servidor';
import { aplicarPlanilha, ErroPlanilha, previaPlanilha, type LinhaPlanilha } from '@/lib/conamad/service';

export const dynamic = 'force-dynamic';

const LIMITE_LINHAS = 20000;

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'conamad.atualizar.importar');
    if (negado) return negado;
    const corpo = await req.json().catch(() => null) as { linhas?: unknown; nomeArquivo?: string; acao?: string; assinatura?: string } | null;
    if (!Array.isArray(corpo?.linhas) || !corpo.linhas.every((l) => l && typeof l === 'object' && !Array.isArray(l))) {
      return NextResponse.json({ error: 'Planilha inválida.' }, { status: 400 });
    }
    if (corpo.linhas.length > LIMITE_LINHAS) {
      return NextResponse.json({ error: `A planilha deve ter até ${LIMITE_LINHAS} linhas.` }, { status: 400 });
    }
    const linhas = corpo.linhas as LinhaPlanilha[];
    const campoId = campoAtivoId(user);
    try {
      if (corpo.acao === 'aplicar') {
        const negadoAplicar = await exigirPermissao(user, 'conamad.atualizar.aplicar');
        if (negadoAplicar) return negadoAplicar;
        return NextResponse.json(await aplicarPlanilha(campoId, user.id, linhas, corpo.nomeArquivo ?? 'planilha.xlsx', corpo.assinatura ?? ''));
      }
      return NextResponse.json(await previaPlanilha(campoId, linhas));
    } catch (e) {
      if (e instanceof ErroPlanilha) return NextResponse.json({ error: e.message }, { status: 400 });
      throw e;
    }
  });
}
