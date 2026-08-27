/**
 * Resumo consolidado de um nó da hierarquia.
 *
 * `GET /api/culto/resumo?nivel=CAMPO|GRUPO|IGREJA&id=&tipo_grupo=&de=&ate=`
 *
 * Devolve o total daquele nível e a lista do nível imediatamente abaixo, cada
 * um já somado — é o que o modal mostra ao clicar num card, num nó do
 * organograma ou numa linha da tabela.
 *
 * A soma respeita a matriz de visibilidade: bloco que o usuário não pode ver
 * não entra na conta (ver seção 4 da SPEC).
 */
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCultoScope } from '@/lib/cultoScope';
import { periodoDaQuery } from '@/lib/cultoService';
import { montarResumo, type NivelResumo, type TipoGrupo } from '@/lib/cultoResumo';

const NIVEIS: NivelResumo[] = ['CAMPO', 'GRUPO', 'IGREJA'];

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (!user.campoId) {
      return NextResponse.json({ error: 'Contexto de campo não identificado.' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const nivel = (searchParams.get('nivel') || 'CAMPO').toUpperCase() as NivelResumo;
    if (!NIVEIS.includes(nivel)) {
      return NextResponse.json({ error: `Nível inválido: ${nivel}` }, { status: 400 });
    }

    const id = searchParams.get('id');
    if (nivel !== 'CAMPO' && !id) {
      return NextResponse.json({ error: 'Informe o id do nó.' }, { status: 400 });
    }

    const tipoGrupoRaw = (searchParams.get('tipo_grupo') || '').toUpperCase();
    const tipoGrupo: TipoGrupo | null =
      tipoGrupoRaw === 'REGIONAL' || tipoGrupoRaw === 'HOSPEDEIRA' ? tipoGrupoRaw : null;

    const { de, ate } = periodoDaQuery(searchParams);
    const scope = await getCultoScope(user);

    // Um lançador que peça o resumo do campo recebe o resumo da própria igreja:
    // churchIdsPermitidos poda o conjunto, então o total nunca vaza para fora
    // do escopo dele.
    const campo = await prisma.campo.findUnique({
      where: { id: user.campoId },
      select: { name: true },
    });

    const resumo = await montarResumo({
      campoId: user.campoId,
      nivel,
      id,
      tipoGrupo,
      de,
      ate,
      tipoCulto: searchParams.get('tipo_culto'),
      churchIdsPermitidos: scope.churchIds,
      blocosVisiveis: scope.blocosVisiveis,
      campoNome: campo?.name ?? null,
    });

    return NextResponse.json(resumo);
  });
}
