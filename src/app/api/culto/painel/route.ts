/**
 * Painel hierárquico — o card do diagrama.
 *
 * Um card por hospedeira (ou por Regional, enquanto a organização por
 * hospedeiras não estiver feita): total de igrejas, quais concluíram e quais
 * faltam, com nome da igreja e do dirigente. Verde só quando não falta nenhuma.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getCultoScope, igrejasDaHospedeira } from '@/lib/cultoScope';
import { montarPainel, periodoDaQuery } from '@/lib/cultoService';

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (!user.campoId) {
      return NextResponse.json({ nivel: 'NENHUM', periodo: null, grupos: [] });
    }

    const { searchParams } = new URL(req.url);
    const { de, ate } = periodoDaQuery(searchParams);
    const tipoCulto = searchParams.get('tipo_culto');

    const scope = await getCultoScope(user);

    const nivel = scope.visaoCampo
      ? 'PRESIDENTE'
      : scope.papeis.includes('APROVADOR_HOSPEDEIRA')
        ? 'HOSPEDEIRA'
        : 'LOCAL';

    // Recorte do item "Hospedeiro" do menu: só a hospedeira e as filhas dela.
    // Cruza com o escopo do usuário — nunca amplia o que ele já podia ver.
    const hostChurchId = searchParams.get('host_church_id');
    let churchIds = scope.churchIds;
    if (hostChurchId) {
      const doGrupo = await igrejasDaHospedeira(hostChurchId);
      churchIds = churchIds === null ? doGrupo : churchIds.filter((c) => doGrupo.includes(c));
    }

    const grupos = await montarPainel({
      campoId: user.campoId,
      de,
      ate,
      tipoCulto,
      churchIds,
    });

    // Nome do campo: é a raiz do organograma na visão do presidente.
    const campo = await prisma.campo.findUnique({
      where: { id: user.campoId },
      select: { name: true },
    });

    return NextResponse.json({
      nivel,
      campoNome: campo?.name ?? null,
      periodo: { de: de.toISOString().slice(0, 10), ate: ate.toISOString().slice(0, 10) },
      totais: {
        grupos: grupos.length,
        igrejas: grupos.reduce((s, g) => s + g.totalIgrejas, 0),
        concluidas: grupos.reduce((s, g) => s + g.concluidas.length, 0),
        pendentes: grupos.reduce((s, g) => s + g.pendentes.length, 0),
      },
      grupos,
    });
  });
}
