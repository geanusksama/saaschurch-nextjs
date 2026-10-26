import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { withAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { exigirPermissao } from '@/lib/permissoes/servidor';
import { publicacaoDoCampo } from '@/lib/engajamento/publicacao';
import { campoDoUsuario, erro, semCache } from '@/lib/engajamento/rota';

/**
 * Marca uma pessoa na foto. Com memberId = membro do cadastro (conferido no
 * campo ativo); sem ele = pessoa sem cadastro, só nome e @ do Instagram.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'engajamento_fotos.fotos.marcar');
    if (negado) return negado;
    const { id } = await params;
    const p = await publicacaoDoCampo(user, id);
    if (!p) return erro('Publicação não encontrada.', 404);

    const corpo = (await req.json().catch(() => ({}))) as { memberId?: string; nome?: string; instagram?: string; imagemIndice?: number };
    const imagemIndice = Number.isInteger(corpo.imagemIndice) && corpo.imagemIndice! >= 0 ? corpo.imagemIndice! : 0;
    const instagram = String(corpo.instagram ?? '').trim().replace(/^@/, '').slice(0, 100) || null;

    let memberId: string | null = null;
    let nome = String(corpo.nome ?? '').trim().slice(0, 255);
    if (corpo.memberId) {
      const [m] = await prisma.$queryRaw<Array<{ id: string; full_name: string }>>(Prisma.sql`
        SELECT id, full_name FROM members
         WHERE id = ${corpo.memberId}::uuid AND campo_id = ${campoDoUsuario(user)}::uuid AND deleted_at IS NULL`);
      if (!m) return erro('Membro não encontrado neste campo.', 404);
      memberId = m.id;
      nome = m.full_name;
    }
    if (!nome) return erro('Escolha o membro ou digite o nome da pessoa.');

    const [criada] = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      INSERT INTO engajamento_marcacoes (publicacao_id, member_id, nome, instagram, imagem_indice, created_by)
      VALUES (${p.id}::uuid, ${memberId}::uuid, ${nome}, ${instagram}, ${imagemIndice}, ${user.id}::uuid)
      ON CONFLICT (publicacao_id, member_id) WHERE member_id IS NOT NULL DO NOTHING
      RETURNING id`);
    if (!criada) return erro('Essa pessoa já está marcada nesta publicação.', 409);
    return semCache({ id: criada.id }, 201);
  });
}
