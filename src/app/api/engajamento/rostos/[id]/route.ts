import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { withAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { exigirPermissao } from '@/lib/permissoes/servidor';
import { recalcularCentroide } from '@/lib/engajamento/rostos';
import { campoDoUsuario, erro, semCache } from '@/lib/engajamento/rota';

/**
 * "Não é esta pessoa": tira o rosto da pessoa. O rosto é apagado (não volta a
 * contar presença) e o centroide da pessoa é refeito sem ele; pessoa que fica
 * sem rosto nenhum é apagada.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'engajamento_pessoas.pessoas.tirar_rosto');
    if (negado) return negado;
    const campoId = campoDoUsuario(user);
    if (!campoId) return erro('Escolha um campo para usar o Engajamento.');
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return erro('Rosto inválido.');

    const [r] = await prisma.$queryRaw<Array<{ pessoa_id: string | null }>>(Prisma.sql`
      DELETE FROM engajamento_rostos WHERE id = ${id}::uuid AND campo_id = ${campoId}::uuid RETURNING pessoa_id`);
    if (!r) return erro('Rosto não encontrado.', 404);
    if (r.pessoa_id) {
      const [{ n }] = await prisma.$queryRaw<Array<{ n: number }>>(Prisma.sql`
        SELECT count(*)::int AS n FROM engajamento_rostos WHERE pessoa_id = ${r.pessoa_id}::uuid`);
      if (n === 0) await prisma.$executeRaw(Prisma.sql`DELETE FROM engajamento_pessoas WHERE id = ${r.pessoa_id}::uuid`);
      else await recalcularCentroide(r.pessoa_id);
    }
    return semCache({ ok: true });
  });
}
