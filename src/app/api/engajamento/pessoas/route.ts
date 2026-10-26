import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { withAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { exigirPermissao } from '@/lib/permissoes/servidor';
import { campoDoUsuario, erro, semCache } from '@/lib/engajamento/rota';

/**
 * Pessoas achadas nas fotos, das que mais aparecem para as que menos.
 * filtro: sem_nome | com_nome | ocultas (padrão: todas as visíveis).
 */
export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'engajamento_pessoas.view');
    if (negado) return negado;
    const campoId = campoDoUsuario(user);
    if (!campoId) return erro('Escolha um campo para usar o Engajamento.');
    const sp = new URL(req.url).searchParams;
    const filtro = sp.get('filtro') ?? '';
    const q = (sp.get('q') ?? '').trim();

    const condicao =
      filtro === 'ocultas' ? Prisma.sql`p.oculta`
      : filtro === 'sem_nome' ? Prisma.sql`NOT p.oculta AND p.nome IS NULL AND p.member_id IS NULL`
      : filtro === 'com_nome' ? Prisma.sql`NOT p.oculta AND (p.nome IS NOT NULL OR p.member_id IS NOT NULL)`
      : Prisma.sql`NOT p.oculta`;

    const rows = await prisma.$queryRaw<Array<{
      id: string; nome: string | null; member_id: string | null; member_nome: string | null; rol: number | null;
      foto_url: string | null; oculta: boolean; publicacoes: number; ultima: Date | null;
    }>>(Prisma.sql`
      SELECT p.id, p.nome, p.member_id, m.full_name AS member_nome, m.rol, p.foto_url, p.oculta,
             count(DISTINCT r.publicacao_id)::int AS publicacoes, max(pub.data_evento) AS ultima
        FROM engajamento_pessoas p
        LEFT JOIN members m ON m.id = p.member_id
        LEFT JOIN engajamento_rostos r ON r.pessoa_id = p.id
        LEFT JOIN engajamento_publicacoes pub ON pub.id = r.publicacao_id AND pub.deleted_at IS NULL
       WHERE p.campo_id = ${campoId}::uuid AND ${condicao}
         AND (${q} = '' OR p.nome ILIKE ${'%' + q + '%'} OR m.full_name ILIKE ${'%' + q + '%'})
       GROUP BY p.id, m.full_name, m.rol
       ORDER BY count(DISTINCT r.publicacao_id) DESC, p.created_at
       LIMIT 1000`);

    return semCache({
      pessoas: rows.map((r) => ({
        id: r.id,
        nome: r.member_nome ?? r.nome,
        memberId: r.member_id,
        rol: r.rol,
        foto: r.foto_url,
        oculta: r.oculta,
        publicacoes: r.publicacoes,
        ultima: r.ultima?.toISOString().slice(0, 10) ?? null,
      })),
    });
  });
}
