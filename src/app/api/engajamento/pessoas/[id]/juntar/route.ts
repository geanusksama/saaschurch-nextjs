import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { withAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { exigirPermissao } from '@/lib/permissoes/servidor';
import { juntarPessoas } from '@/lib/engajamento/rostos';
import { campoDoUsuario, erro, semCache } from '@/lib/engajamento/rota';

/** "É a mesma pessoa": os rostos de `outraId` passam para esta e a outra some. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'engajamento_pessoas.pessoas.juntar');
    if (negado) return negado;
    const campoId = campoDoUsuario(user);
    if (!campoId) return erro('Escolha um campo para usar o Engajamento.');
    const { id } = await params;
    const { outraId } = (await req.json().catch(() => ({}))) as { outraId?: string };
    if (!outraId || outraId === id) return erro('Escolha a outra pessoa.');

    const achadas = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id FROM engajamento_pessoas WHERE campo_id = ${campoId}::uuid AND id IN (${id}::uuid, ${outraId}::uuid)`);
    if (achadas.length !== 2) return erro('Pessoa não encontrada.', 404);

    await juntarPessoas(campoId, id, outraId, user.id);
    return semCache({ ok: true });
  });
}
