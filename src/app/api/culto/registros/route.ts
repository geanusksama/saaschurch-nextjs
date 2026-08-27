/**
 * Registros de culto — lista (com filtro por intervalo de datas) e abertura.
 *
 * A lista já sai podada: os blocos que o usuário não pode ver não entram na
 * resposta. Ver docs/modules/gestao-culto/SPEC.md, seção 4.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/auth';
import { getCultoScope, filtroDeIgrejas, podarLancamentos } from '@/lib/cultoScope';
import {
  blocosExigidosPorIgreja,
  dateParaHora,
  filtroDeHora,
  horaParaDate,
  periodoDaQuery,
  recalcularStatus,
} from '@/lib/cultoService';

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (!user.campoId) return NextResponse.json([]);

    const { searchParams } = new URL(req.url);
    const { de, ate } = periodoDaQuery(searchParams);
    const churchId = searchParams.get('church_id');
    const status = searchParams.get('status');
    const tipoCulto = searchParams.get('tipo_culto');
    const hostChurchId = searchParams.get('host_church_id');

    const scope = await getCultoScope(user);
    const escopo = filtroDeIgrejas(scope);

    // church_id da query só restringe; nunca amplia o que o escopo já permite.
    const filtroIgreja =
      churchId && (scope.churchIds === null || scope.churchIds.includes(churchId))
        ? { churchId }
        : churchId
          ? { churchId: '00000000-0000-0000-0000-000000000000' }
          : escopo;

    const registros = await prisma.cultoRegistro.findMany({
      where: {
        campoId: user.campoId,
        deletedAt: null,
        dataCulto: { gte: de, lte: ate },
        ...filtroIgreja,
        ...(status ? { status } : {}),
        ...(tipoCulto ? { tipoCulto } : {}),
        ...(hostChurchId ? { hostChurchId } : {}),
        ...filtroDeHora(searchParams),
      },
      include: {
        church: { select: { id: true, name: true, isHost: true, hostChurchId: true, currentLeaderName: true } },
        hostChurch: { select: { id: true, name: true } },
        regional: { select: { id: true, name: true } },
        lancamentos: {
          include: { enviadoPorUser: { select: { id: true, fullName: true } } },
        },
        aprovacoes: {
          include: { aprovador: { select: { id: true, fullName: true } } },
        },
      },
      orderBy: [{ dataCulto: 'desc' }, { horaInicio: 'desc' }, { createdAt: 'desc' }],
      take: 2000,
    });

    // Uma query para todas as igrejas da lista. Em laço eram 85 idas ao banco
    // (65 s contra o pooler) — ver blocosExigidosPorIgreja em cultoService.ts.
    const idsIgrejas = Array.from(new Set(registros.map((r) => r.churchId)));
    const exigidosPorIgreja = await blocosExigidosPorIgreja(idsIgrejas);

    return NextResponse.json(
      registros.map((r) => {
        const exigidos = exigidosPorIgreja.get(r.churchId) ?? [];
        const enviados = r.lancamentos.filter((l) => l.enviadoEm).map((l) => l.bloco);
        return {
          ...r,
          // TIME vira "19:30" na resposta; Date cru confundiria o front.
          horaInicio: dateParaHora(r.horaInicio),
          horaFim: dateParaHora(r.horaFim),
          lancamentos: podarLancamentos(scope, r.lancamentos),
          blocosExigidos: exigidos,
          blocosEnviados: enviados,
          blocosFaltando: exigidos.filter((b) => !enviados.includes(b)),
        };
      }),
    );
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (!user.campoId) {
      return NextResponse.json({ error: 'Contexto de campo não identificado.' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { churchId, dataCulto, tipoCulto, observacao, horaInicio, horaFim } = body as {
      churchId?: string;
      dataCulto?: string;
      tipoCulto?: string;
      observacao?: string;
      horaInicio?: string;
      horaFim?: string;
    };

    if (!dataCulto) {
      return NextResponse.json({ error: 'Informe a data do culto.' }, { status: 400 });
    }

    const scope = await getCultoScope(user);
    const alvo = churchId ?? scope.podeEnviar[0]?.churchId ?? user.churchId;
    if (!alvo) {
      return NextResponse.json({ error: 'Informe a igreja do culto.' }, { status: 400 });
    }
    if (scope.churchIds !== null && !scope.churchIds.includes(alvo)) {
      return NextResponse.json({ error: 'Sem acesso a esta igreja.' }, { status: 403 });
    }

    const igreja = await prisma.church.findFirst({
      where: { id: alvo, deletedAt: null, regional: { campoId: user.campoId } },
      select: { id: true, regionalId: true, hostChurchId: true, isHost: true },
    });
    if (!igreja) {
      return NextResponse.json({ error: 'Igreja não encontrada no seu campo.' }, { status: 404 });
    }

    const tipo = (tipoCulto || 'CULTO').toUpperCase().slice(0, 60);
    const data = new Date(`${dataCulto}T00:00:00.000Z`);

    const inicio = horaParaDate(horaInicio);
    const fim = horaParaDate(horaFim);

    // A hora faz parte da identidade do culto: mesma igreja, mesmo dia e mesmo
    // tipo em horários diferentes são dois cultos (manhã e noite).
    const jaExiste = await prisma.cultoRegistro.findFirst({
      where: {
        churchId: alvo,
        dataCulto: data,
        tipoCulto: tipo,
        horaInicio: inicio,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (jaExiste) {
      return NextResponse.json(
        { error: 'Já existe um registro deste culto para esta igreja e data.', id: jaExiste.id },
        { status: 409 },
      );
    }

    const criado = await prisma.cultoRegistro.create({
      data: {
        campoId: user.campoId,
        regionalId: igreja.regionalId,
        churchId: alvo,
        // Congelado agora: se a igreja mudar de hospedeira depois, este culto
        // continua contando para a hospedeira certa (D3 da SPEC).
        hostChurchId: igreja.hostChurchId ?? (igreja.isHost ? igreja.id : null),
        dataCulto: data,
        horaInicio: inicio,
        horaFim: fim,
        tipoCulto: tipo,
        observacao: observacao ?? null,
        createdBy: user.id,
      },
    });

    await recalcularStatus(criado.id);
    return NextResponse.json(criado, { status: 201 });
  });
}
