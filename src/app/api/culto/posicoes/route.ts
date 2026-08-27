/**
 * Posições da Gestão de Culto — "procuro a pessoa e anexo na posição".
 *
 * Anexa USUÁRIO do sistema (não membro): quem envia e quem aprova precisa
 * logar. Ver decisão D1 em docs/modules/gestao-culto/SPEC.md.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthUser } from '@/lib/auth';
import { PAPEIS, ROTULO_PAPEL, type Papel } from '@/lib/cultoScope';

/** Quem pode mexer no cadastro de posições: master, admin e perfil de campo. */
function podeGerenciar(user: AuthUser): boolean {
  return ['master', 'admin', 'campo'].includes(user.profileType);
}

async function igrejaDoCampo(churchId: string, campoId: string) {
  return prisma.church.findFirst({
    where: { id: churchId, deletedAt: null, regional: { campoId } },
    select: { id: true, regionalId: true },
  });
}

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (!user.campoId) return NextResponse.json([]);
    const { searchParams } = new URL(req.url);
    const churchId = searchParams.get('church_id');
    const papel = searchParams.get('papel');

    // Usuário de igreja só enxerga o quadro da própria igreja.
    const escopoIgreja = podeGerenciar(user) ? churchId : user.churchId;

    const posicoes = await prisma.cultoPosicao.findMany({
      where: {
        campoId: user.campoId,
        deletedAt: null,
        ...(escopoIgreja ? { churchId: escopoIgreja } : {}),
        ...(papel ? { papel } : {}),
      },
      include: {
        user: { select: { id: true, fullName: true, email: true, avatarUrl: true, profileType: true } },
        church: { select: { id: true, name: true, isHost: true } },
      },
      orderBy: [{ papel: 'asc' }, { createdAt: 'asc' }],
    });

    return NextResponse.json(
      posicoes.map((p) => ({
        id: p.id,
        papel: p.papel,
        rotuloPapel: ROTULO_PAPEL[p.papel as Papel] ?? p.papel,
        titulo: p.titulo,
        isActive: p.isActive,
        churchId: p.churchId,
        churchName: p.church?.name ?? null,
        user: p.user,
        createdAt: p.createdAt,
      })),
    );
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (!podeGerenciar(user)) {
      return NextResponse.json({ error: 'Sem permissão para anexar posições.' }, { status: 403 });
    }
    if (!user.campoId) {
      return NextResponse.json({ error: 'Contexto de campo não identificado.' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { userId, papel, churchId, titulo } = body as {
      userId?: string;
      papel?: string;
      churchId?: string | null;
      titulo?: string | null;
    };

    if (!userId || !papel) {
      return NextResponse.json({ error: 'Informe o usuário e o papel.' }, { status: 400 });
    }
    if (!PAPEIS.includes(papel as Papel)) {
      return NextResponse.json({ error: `Papel inválido: ${papel}` }, { status: 400 });
    }

    // PRESIDENTE é do campo inteiro; todo o resto exige igreja.
    const ehPresidente = papel === 'PRESIDENTE';
    if (!ehPresidente && !churchId) {
      return NextResponse.json({ error: 'Informe a igreja da posição.' }, { status: 400 });
    }
    if (ehPresidente && user.profileType !== 'master') {
      return NextResponse.json(
        { error: 'Só o perfil master anexa o Pastor Presidente.' },
        { status: 403 },
      );
    }

    if (churchId && !(await igrejaDoCampo(churchId, user.campoId))) {
      return NextResponse.json({ error: 'Igreja fora do seu campo.' }, { status: 403 });
    }

    const alvo = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, campoId: true, churchId: true, fullName: true },
    });
    if (!alvo) return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });

    // Reativa em vez de duplicar quando a posição já existiu e foi removida.
    const existente = await prisma.cultoPosicao.findFirst({
      where: { churchId: ehPresidente ? null : churchId, userId, papel },
    });
    if (existente) {
      const reativada = await prisma.cultoPosicao.update({
        where: { id: existente.id },
        data: { isActive: true, deletedAt: null, titulo: titulo ?? existente.titulo },
      });
      return NextResponse.json(reativada, { status: 200 });
    }

    const criada = await prisma.cultoPosicao.create({
      data: {
        campoId: user.campoId,
        churchId: ehPresidente ? null : churchId!,
        userId,
        papel,
        titulo: titulo ?? ROTULO_PAPEL[papel as Papel] ?? null,
        createdBy: user.id,
      },
    });

    return NextResponse.json(criada, { status: 201 });
  });
}
