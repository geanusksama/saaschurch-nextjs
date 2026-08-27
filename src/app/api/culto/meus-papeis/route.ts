/**
 * Papéis do usuário logado na Gestão de Culto.
 *
 * O front usa isto para decidir o que renderizar: um tesoureiro vê o formulário
 * financeiro, um dirigente vê os botões de aprovar, o presidente vê só o painel.
 * A decisão de verdade continua sendo do servidor em cada rota — isto aqui é
 * para a tela não oferecer o que vai ser negado depois.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { getCultoScope, ROTULO_PAPEL, type Papel } from '@/lib/cultoScope';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const scope = await getCultoScope(user);

    const churchIds = Array.from(
      new Set(scope.posicoes.map((p) => p.churchId).filter((v): v is string => Boolean(v))),
    );
    const igrejas = churchIds.length
      ? await prisma.church.findMany({
          where: { id: { in: churchIds } },
          select: { id: true, name: true, isHost: true, hostChurchId: true },
        })
      : [];
    const nomes = new Map(igrejas.map((c) => [c.id, c.name]));

    return NextResponse.json({
      papeis: scope.papeis,
      posicoes: scope.posicoes.map((p) => ({
        papel: p.papel,
        rotulo: ROTULO_PAPEL[p.papel as Papel] ?? p.papel,
        titulo: p.titulo,
        churchId: p.churchId,
        churchName: p.churchId ? nomes.get(p.churchId) ?? null : null,
      })),
      blocosVisiveis: scope.blocosVisiveis,
      podeEnviar: scope.podeEnviar,
      podeAprovar: scope.podeAprovar.map((a) => a.nivel),
      visaoCampo: scope.visaoCampo,
      irrestrito: scope.irrestrito,
      churchIdPadrao: scope.podeEnviar[0]?.churchId ?? user.churchId ?? null,
    });
  });
}
