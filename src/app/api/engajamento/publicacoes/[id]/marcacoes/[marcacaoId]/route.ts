import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { withAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { exigirPermissao } from '@/lib/permissoes/servidor';
import { publicacaoDoCampo } from '@/lib/engajamento/publicacao';
import { erro, semCache } from '@/lib/engajamento/rota';

/** Remove a marcação — é assim que se corrige uma pessoa marcada errado. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; marcacaoId: string }> }) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'engajamento_fotos.fotos.desmarcar');
    if (negado) return negado;
    const { id, marcacaoId } = await params;
    const p = await publicacaoDoCampo(user, id);
    if (!p) return erro('Publicação não encontrada.', 404);
    if (!/^[0-9a-f-]{36}$/i.test(marcacaoId)) return erro('Marcação inválida.');
    const n = await prisma.$executeRaw(Prisma.sql`
      DELETE FROM engajamento_marcacoes WHERE id = ${marcacaoId}::uuid AND publicacao_id = ${p.id}::uuid`);
    if (!n) return erro('Marcação não encontrada.', 404);
    return semCache({ ok: true });
  });
}
