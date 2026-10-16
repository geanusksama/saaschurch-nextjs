/**
 * Quem já responde pela posição segundo o cadastro de funções da igreja.
 *
 * A tela de Posições abria vazia mesmo quando a igreja já tinha dirigente e
 * secretário lançados em church_function_history. Esta rota devolve esses
 * titulares, já traduzidos para o papel do culto, para a tela mostrá-los
 * setados. Só leitura: a posição continua sendo gravada pelo POST de
 * /api/culto/posicoes, porque ela exige USUÁRIO (decisão D1 da SPEC) e o
 * titular da função é MEMBRO.
 *
 * O usuário do titular é achado por fato, nunca por nome:
 *   1. members.user_id, quando o membro já foi ligado a um usuário;
 *   2. users.email igual ao e-mail do membro (sem diferença de maiúsculas).
 * Sem nenhum dos dois, vai `user: null` e a tela oferece criar o acesso.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, type AuthUser } from '@/lib/auth';
import { igrejaNoCampoAtivo } from '@/lib/campoAtivo';
import { papeisDaFuncao, type Papel } from '@/lib/cultoScope';

function podeGerenciar(user: AuthUser): boolean {
  return ['master', 'admin', 'campo'].includes(user.profileType);
}

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (!podeGerenciar(user)) {
      return NextResponse.json({ error: 'Sem permissão para ver as posições.' }, { status: 403 });
    }
    const churchId = new URL(req.url).searchParams.get('church_id');
    if (!churchId) {
      return NextResponse.json({ error: 'Informe a igreja.' }, { status: 400 });
    }
    if (!(await igrejaNoCampoAtivo(user, churchId))) {
      return NextResponse.json({ error: 'Igreja fora do seu campo.' }, { status: 403 });
    }

    const igreja = await prisma.church.findUnique({
      where: { id: churchId },
      select: { isHost: true },
    });

    // Função vigente: ativa, sem data de saída e sem exclusão, do membro que
    // continua no cadastro. Uma igreja tem poucas — o teto é só proteção.
    const funcoes = await prisma.churchFunctionHistory.findMany({
      where: {
        churchId,
        isActive: true,
        endDate: null,
        deletedAt: null,
        member: { deletedAt: null },
      },
      select: {
        id: true,
        startDate: true,
        function: { select: { name: true } },
        member: {
          select: {
            id: true,
            fullName: true,
            rol: true,
            email: true,
            phone: true,
            mobile: true,
            churchId: true,
            church: { select: { name: true } },
            user: { select: { id: true, fullName: true, email: true, deletedAt: true } },
          },
        },
      },
      orderBy: { startDate: 'desc' },
      take: 50,
    });

    const relevantes = funcoes.filter((f) => papeisDaFuncao(f.function.name).length > 0);

    // Membros sem usuário ligado: tenta o e-mail, de uma vez só.
    const emails = [
      ...new Set(
        relevantes
          .filter((f) => !f.member.user || f.member.user.deletedAt)
          .map((f) => f.member.email?.trim().toLowerCase())
          .filter((e): e is string => Boolean(e)),
      ),
    ];
    const porEmail = new Map<string, { id: string; fullName: string; email: string }>();
    if (emails.length) {
      const usuarios = await prisma.user.findMany({
        where: {
          deletedAt: null,
          OR: emails.map((e) => ({ email: { equals: e, mode: 'insensitive' as const } })),
        },
        select: { id: true, fullName: true, email: true },
      });
      for (const u of usuarios) porEmail.set(u.email.toLowerCase(), u);
    }

    const resposta = relevantes.flatMap((f) => {
      const m = f.member;
      const ligado = m.user && !m.user.deletedAt ? m.user : null;
      const doEmail = m.email ? porEmail.get(m.email.trim().toLowerCase()) : undefined;
      const usuario = ligado
        ? { id: ligado.id, fullName: ligado.fullName, email: ligado.email, origem: 'VINCULO' as const }
        : doEmail
          ? { ...doEmail, origem: 'EMAIL' as const }
          : null;

      return papeisDaFuncao(f.function.name)
        .filter((papel: Papel) => papel !== 'APROVADOR_HOSPEDEIRA' || igreja?.isHost)
        .map((papel) => ({
          papel,
          funcao: f.function.name,
          desde: f.startDate,
          membro: {
            id: m.id,
            fullName: m.fullName,
            rol: m.rol,
            email: m.email,
            phone: m.phone,
            mobile: m.mobile,
            churchId: m.churchId,
            church: m.church,
          },
          usuario,
        }));
    });

    return NextResponse.json(resposta, { headers: { 'Cache-Control': 'no-store' } });
  });
}
