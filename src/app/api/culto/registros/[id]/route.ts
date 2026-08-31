import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/auth';
import { getCultoScope, podarLancamentos } from '@/lib/cultoScope';
import { blocosExigidos, dateParaHora, horaParaDate } from '@/lib/cultoService';

async function carregar(id: string) {
  return prisma.cultoRegistro.findFirst({
    where: { id, deletedAt: null },
    include: {
      church: {
        select: { id: true, name: true, isHost: true, hostChurchId: true, currentLeaderName: true },
      },
      hostChurch: { select: { id: true, name: true } },
      regional: { select: { id: true, name: true } },
      lancamentos: { include: { enviadoPorUser: { select: { id: true, fullName: true } } } },
      aprovacoes: { include: { aprovador: { select: { id: true, fullName: true } } } },
    },
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const registro = await carregar(id);
    if (!registro) return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 });

    const scope = await getCultoScope(user);
    if (scope.churchIds !== null && !scope.churchIds.includes(registro.churchId)) {
      return NextResponse.json({ error: 'Sem acesso a este registro.' }, { status: 403 });
    }

    const exigidos = await blocosExigidos(registro.churchId);
    const enviados = registro.lancamentos.filter((l) => l.enviadoEm).map((l) => l.bloco);

    return NextResponse.json({
      ...registro,
      horaInicio: dateParaHora(registro.horaInicio),
      horaFim: dateParaHora(registro.horaFim),
      // Poda no servidor: o bloco do outro lançador não sai daqui.
      lancamentos: podarLancamentos(scope, registro.lancamentos),
      blocosExigidos: exigidos,
      blocosEnviados: enviados,
      blocosFaltando: exigidos.filter((b) => !enviados.includes(b)),
      minhasPermissoes: {
        podeEnviar: scope.podeEnviar.filter((p) => p.churchId === registro.churchId).map((p) => p.bloco),
        podeAprovar: scope.podeAprovar
          .filter((a) => scope.irrestrito || a.churchIds.includes(registro.churchId))
          .map((a) => a.nivel),
      },
    });
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await params;
    const registro = await prisma.cultoRegistro.findFirst({ where: { id, deletedAt: null } });
    if (!registro) return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 });

    const scope = await getCultoScope(user);
    if (scope.churchIds !== null && !scope.churchIds.includes(registro.churchId)) {
      return NextResponse.json({ error: 'Sem acesso a este registro.' }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    if (typeof body.observacao === 'string') data.observacao = body.observacao.trim() || null;
    // A observação do presidente é dele: quem não é presidente (nem master)
    // não escreve nesse campo, mesmo tendo acesso ao registro.
    if (typeof body.observacaoPresidente === 'string') {
      const ehPresidente =
        scope.irrestrito || scope.posicoes.some((p) => p.papel === 'PRESIDENTE');
      if (!ehPresidente) {
        return NextResponse.json(
          { error: 'Só o Pastor Presidente escreve a observação do presidente.' },
          { status: 403 },
        );
      }
      data.observacaoPresidente = body.observacaoPresidente.trim() || null;
    }
    if (typeof body.tipoCulto === 'string' && body.tipoCulto.trim()) {
      data.tipoCulto = body.tipoCulto.trim().toUpperCase().slice(0, 60);
    }
    if (typeof body.dataCulto === 'string' && body.dataCulto) {
      data.dataCulto = new Date(`${body.dataCulto}T00:00:00.000Z`);
    }
    if (typeof body.horaInicio === 'string') data.horaInicio = horaParaDate(body.horaInicio);
    if (typeof body.horaFim === 'string') data.horaFim = horaParaDate(body.horaFim);
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 400 });
    }

    // Depois que foi para aprovação, data e tipo travam: mudar isso por baixo
    // do dirigente que já aprovou seria trocar o objeto da decisão.
    //
    // A observação do presidente é a exceção: ele comenta o culto DEPOIS de
    // fechado, que é quando ele lê o consolidado. Travá-la junto deixaria o
    // campo inútil.
    const soObservacaoPresidente =
      Object.keys(data).length === 1 && 'observacaoPresidente' in data;
    if (
      !scope.irrestrito &&
      !soObservacaoPresidente &&
      !['ABERTO', 'REJEITADO'].includes(registro.status)
    ) {
      return NextResponse.json(
        { error: 'Registro já enviado para aprovação — não pode mais ser editado.' },
        { status: 409 },
      );
    }

    const atualizado = await prisma.cultoRegistro.update({ where: { id }, data });
    return NextResponse.json(atualizado);
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    if (user.profileType !== 'master') {
      return NextResponse.json({ error: 'Só o perfil master exclui um registro.' }, { status: 403 });
    }
    const { id } = await params;
    const registro = await prisma.cultoRegistro.findFirst({ where: { id, deletedAt: null } });
    if (!registro) return NextResponse.json({ error: 'Registro não encontrado.' }, { status: 404 });

    await prisma.cultoRegistro.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ ok: true });
  });
}
