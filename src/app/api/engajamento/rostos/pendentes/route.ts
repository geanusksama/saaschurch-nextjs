import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { withAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { exigirPermissao } from '@/lib/permissoes/servidor';
import { campoDoUsuario, erro, semCache } from '@/lib/engajamento/rota';

/** Próximas publicações sem reconhecimento de rosto, mais novas primeiro. */
export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'engajamento_instagram.instagram.sincronizar');
    if (negado) return negado;
    const campoId = campoDoUsuario(user);
    if (!campoId) return erro('Escolha um campo para usar o Engajamento.');

    const [fila, total] = await Promise.all([
      prisma.$queryRaw<Array<{ id: string; imagens: Array<{ url: string }>; data_evento: Date }>>(Prisma.sql`
        SELECT id, imagens, data_evento FROM engajamento_publicacoes
         WHERE campo_id = ${campoId}::uuid AND deleted_at IS NULL AND rostos_analisados_em IS NULL
         ORDER BY data_evento DESC
         LIMIT 10`),
      prisma.$queryRaw<Array<{ n: number }>>(Prisma.sql`
        SELECT count(*)::int AS n FROM engajamento_publicacoes
         WHERE campo_id = ${campoId}::uuid AND deleted_at IS NULL AND rostos_analisados_em IS NULL`),
    ]);
    return semCache({
      restantes: total[0]?.n ?? 0,
      publicacoes: fila.map((p) => ({ id: p.id, dataEvento: p.data_evento.toISOString().slice(0, 10), imagens: (p.imagens ?? []).map((i) => i.url) })),
    });
  });
}
