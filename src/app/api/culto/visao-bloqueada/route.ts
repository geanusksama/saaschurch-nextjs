/**
 * O cadeado de visão do organograma.
 *
 * GET  → os nós bloqueados do campo, para o organograma desenhar o cadeado.
 * POST → liga/desliga o cadeado de um nó.
 *
 * Quem mexe é só quem enxerga a árvore inteira: master, admin ou o Pastor
 * Presidente do campo. Um dirigente de hospedeira não pode destrancar a
 * própria visão, senão o controle não valeria nada.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/auth';
import { getCultoScope } from '@/lib/cultoScope';

async function podeMexer(user: {
  profileType: string;
  id: string | null;
}): Promise<boolean> {
  if (user.profileType === 'master' || user.profileType === 'admin') return true;
  if (!user.id) return false;
  const presidente = await prisma.cultoPosicao.findFirst({
    where: { userId: user.id, papel: 'PRESIDENTE', isActive: true, deletedAt: null },
    select: { id: true },
  });
  return Boolean(presidente);
}

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    // A leitura é aberta a quem já vê a árvore: o organograma precisa mostrar
    // o cadeado para quem pode mexer e, para os demais, saber que ele existe
    // explica por que os valores sumiram.
    const scope = await getCultoScope(user);
    if (!scope.visaoCampo && !scope.irrestrito) {
      return NextResponse.json({ churchIds: [] });
    }
    const linhas = await prisma.$queryRawUnsafe<Array<{ church_id: string; blocos: string[] }>>(
      `SELECT church_id, blocos FROM culto_visao_bloqueada`,
    );
    return NextResponse.json({
      churchIds: linhas.map((l) => l.church_id),
      detalhes: linhas,
      podeMexer: await podeMexer(user),
    });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (!(await podeMexer(user))) {
      return NextResponse.json(
        { error: 'Só o Pastor Presidente do campo pode trancar ou destrancar um nó.' },
        { status: 403 },
      );
    }
    const body = (await req.json().catch(() => ({}))) as {
      churchId?: string;
      bloqueado?: boolean;
      motivo?: string;
    };
    if (!body.churchId) {
      return NextResponse.json({ error: 'Informe o nó (churchId).' }, { status: 400 });
    }

    if (body.bloqueado === false) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM culto_visao_bloqueada WHERE church_id = $1::uuid`,
        body.churchId,
      );
      return NextResponse.json({ churchId: body.churchId, bloqueado: false });
    }

    // Idempotente: trancar duas vezes o mesmo nó não é erro.
    await prisma.$executeRawUnsafe(
      `INSERT INTO culto_visao_bloqueada (church_id, campo_id, motivo, created_by)
       SELECT $1::uuid, r.campo_id, $2, $3::uuid
         FROM churches c JOIN regionais r ON r.id = c.regional_id
        WHERE c.id = $1::uuid
       ON CONFLICT (church_id) DO NOTHING`,
      body.churchId,
      body.motivo ?? null,
      user.id,
    );
    return NextResponse.json({ churchId: body.churchId, bloqueado: true });
  });
}
