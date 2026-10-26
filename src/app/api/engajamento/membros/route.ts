import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { withAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { exigirPermissao } from '@/lib/permissoes/servidor';
import { campoDoUsuario, erro, semCache } from '@/lib/engajamento/rota';

/**
 * Busca de membro para marcar na foto: nome ou ROL, só do campo ativo, 15 por
 * vez. Própria do Engajamento para não exigir a permissão da Lista de Membros.
 */
export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'engajamento_fotos.view');
    if (negado) return negado;
    const campoId = campoDoUsuario(user);
    if (!campoId) return erro('Escolha um campo para usar o Engajamento.');
    const q = (new URL(req.url).searchParams.get('q') ?? '').trim();
    if (q.length < 2) return semCache({ membros: [] });

    const rol = /^\d+$/.test(q) ? Number(q) : null;
    const igreja = user.profileType === 'church' ? user.churchId : null;
    const membros = await prisma.$queryRaw<Array<{ id: string; full_name: string; rol: number | null; church_name: string | null; ecclesiastical_title: string | null }>>(Prisma.sql`
      SELECT m.id, m.full_name, m.rol, c.name AS church_name, m.ecclesiastical_title
        FROM members m
        LEFT JOIN churches c ON c.id = m.church_id
       WHERE m.campo_id = ${campoId}::uuid AND m.deleted_at IS NULL
         AND (${igreja}::uuid IS NULL OR m.church_id = ${igreja}::uuid)
         AND ${rol === null
           ? Prisma.sql`m.full_name ILIKE ${'%' + q + '%'}`
           : Prisma.sql`m.rol = ${rol}`}
       ORDER BY m.full_name
       LIMIT 15`);
    return semCache({
      membros: membros.map((m) => ({ id: m.id, nome: m.full_name, rol: m.rol, igreja: m.church_name, titulo: m.ecclesiastical_title })),
    });
  });
}
