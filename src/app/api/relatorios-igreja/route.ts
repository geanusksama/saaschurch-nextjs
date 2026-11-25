import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { campoAtivoId } from '@/lib/campoAtivo';
import { exigirPermissao } from '@/lib/permissoes/servidor';
import { PERM_ABA, permissaoGrupo } from '@/lib/relatoriosIgreja/catalogo';
import { executarRelatorio, opcoesFiltros, type Filtros } from '@/lib/relatoriosIgreja/servidor';
import type { Modulo } from '@/lib/relatoriosIgreja/tipos';

export const dynamic = 'force-dynamic';

const RESERVADOS = new Set(['modulo', 'grupo', 'rel', 'lista']);

/**
 * GET ?modulo=secretaria&grupo=igrejas&rel=hierarquia&<filtros>  → { linhas, organizacao }
* GET ?modulo=secretaria&lista=opcoes                            → listas dos filtros
 */
export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const p = req.nextUrl.searchParams;
    const modulo = p.get('modulo') as Modulo;
    if (modulo !== 'secretaria' && modulo !== 'tesouraria') return NextResponse.json({ error: 'Módulo inválido.' }, { status: 400 });
    const negadoAba = await exigirPermissao(user, PERM_ABA[modulo]);
    if (negadoAba) return negadoAba;
    const campoId = campoAtivoId(user);
    const headers = { 'Cache-Control': 'no-store' };

    if (p.get('lista') === 'opcoes') return NextResponse.json(await opcoesFiltros(campoId, modulo), { headers });

    const grupo = p.get('grupo') ?? '';
    const chave = permissaoGrupo(modulo, grupo);
    if (!chave) return NextResponse.json({ error: 'Relatório inválido.' }, { status: 400 });
    const negado = await exigirPermissao(user, chave);
    if (negado) return negado;

    const filtros: Filtros = {};
    p.forEach((v, k) => { if (!RESERVADOS.has(k) && v.length <= 200) filtros[k] = v; });
    const r = await executarRelatorio(modulo, grupo, p.get('rel') ?? '', campoId, filtros);
    if (!r) return NextResponse.json({ error: 'Relatório inválido.' }, { status: 400 });
    return NextResponse.json(r, { headers });
  });
}
