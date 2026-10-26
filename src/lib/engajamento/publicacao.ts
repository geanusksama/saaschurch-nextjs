import { Prisma } from '@prisma/client';
import type { AuthUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { campoDoUsuario } from './rota';

/** A publicação, desde que seja do campo ativo (e da igreja, para perfil igreja). */
export async function publicacaoDoCampo(user: AuthUser, id: string) {
  const campoId = campoDoUsuario(user);
  if (!campoId || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const igreja = user.profileType === 'church' ? user.churchId : null;
  const [p] = await prisma.$queryRaw<Array<{
    id: string; origem: string; tipo: string | null; titulo: string | null; legenda: string | null;
    permalink: string | null; data_evento: Date; publicado_em: Date | null; imagens: Array<{ url: string }>;
    church_id: string | null; church_name: string | null;
  }>>(Prisma.sql`
    SELECT p.id, p.origem, p.tipo, p.titulo, p.legenda, p.permalink, p.data_evento, p.publicado_em,
           p.imagens, p.church_id, c.name AS church_name
      FROM engajamento_publicacoes p
      LEFT JOIN churches c ON c.id = p.church_id
     WHERE p.id = ${id}::uuid AND p.campo_id = ${campoId}::uuid AND p.deleted_at IS NULL
       AND (${igreja}::uuid IS NULL OR p.church_id = ${igreja}::uuid)`);
  return p ?? null;
}
