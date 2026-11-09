import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { campoAtivoId } from '@/lib/campoAtivo';
import { exigirPermissao } from '@/lib/permissoes/servidor';
import {
  anosDisponiveis, inadimplentesPorIgreja, listaGeral, listarAnuidades, listarInadimplentes, listarJubilados, listarMinistros, regionaisDisponiveis, resumoPorAno, type FiltrosConamad,
} from '@/lib/conamad/service';
import { relatorioSecretaria, semDadosRestritos } from '@/lib/conamad/permissoes';

export const dynamic = 'force-dynamic';

const lista = (p: URLSearchParams, nome: string) => (p.get(nome) ?? '').split(',').map((v) => v.trim()).filter(Boolean);

function filtros(p: URLSearchParams): FiltrosConamad {
  const ano = (nome: string) => {
    const n = Number(p.get(nome));
    return Number.isInteger(n) && n >= 2000 && n <= 2100 ? n : undefined;
  };
  return {
    anoDe: ano('anoDe'),
    anoAte: ano('anoAte'),
    anos: lista(p, 'anos').map(Number).filter((n) => Number.isInteger(n) && n >= 2000 && n <= 2100),
    situacoes: lista(p, 'situacoes'),
    situacoesMinistro: lista(p, 'situacoesMinistro'),
    titulos: lista(p, 'titulos'),
    sexos: lista(p, 'sexos'),
    estadosCivis: lista(p, 'estadosCivis'),
    // Vem do cadastro e pode ter vírgula no nome: um parâmetro por regional.
    regionais: p.getAll('regionais').map((v) => v.trim()).filter(Boolean),
    credenciais: lista(p, 'credenciais'),
    busca: p.get('busca')?.trim() || undefined,
  };
}

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'conamad.view');
    if (negado) return negado;
    const campoId = campoAtivoId(user);
    const p = req.nextUrl.searchParams;
    const f = filtros(p);
    const headers = { 'Cache-Control': 'no-store' };
    switch (p.get('tipo')) {
      case 'jubilados': return NextResponse.json(await listarJubilados(campoId, f), { headers });
      case 'ministros': {
        const rel = relatorioSecretaria(p.get('rel'));
        if (!rel) return NextResponse.json({ error: 'Relatório inválido.' }, { status: 400 });
        const negadoRel = await exigirPermissao(user, rel.chave);
        if (negadoRel) return negadoRel;
        return NextResponse.json((await listarMinistros(campoId, f)).map((l) => semDadosRestritos(l, rel)), { headers });
      }
      case 'regionais': return NextResponse.json(await regionaisDisponiveis(campoId), { headers });
      case 'anos': return NextResponse.json(await anosDisponiveis(campoId), { headers });
      case 'por-ano': return NextResponse.json(await resumoPorAno(campoId, f), { headers });
      case 'inadimplentes': return NextResponse.json(await listarInadimplentes(campoId, f), { headers });
      case 'por-igreja': return NextResponse.json(await inadimplentesPorIgreja(campoId, f), { headers });
      case 'anuidades': return NextResponse.json(await listarAnuidades(campoId, f), { headers });
      case 'lista-geral': return NextResponse.json(await listaGeral(campoId, f), { headers });
      default: return NextResponse.json({ error: 'Relatório inválido.' }, { status: 400 });
    }
  });
}
