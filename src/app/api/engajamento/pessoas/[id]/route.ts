import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { withAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { exigirPermissao } from '@/lib/permissoes/servidor';
import { campoDoUsuario, erro, semCache } from '@/lib/engajamento/rota';

type Params = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f-]{36}$/i;

async function pessoaDoCampo(campoId: string, id: string) {
  if (!UUID.test(id)) return null;
  const [p] = await prisma.$queryRaw<Array<{ id: string; nome: string | null; member_id: string | null; member_nome: string | null; rol: number | null; foto_url: string | null; oculta: boolean }>>(Prisma.sql`
    SELECT p.id, p.nome, p.member_id, m.full_name AS member_nome, m.rol, p.foto_url, p.oculta
      FROM engajamento_pessoas p LEFT JOIN members m ON m.id = p.member_id
     WHERE p.id = ${id}::uuid AND p.campo_id = ${campoId}::uuid`);
  return p ?? null;
}

/** A pessoa e cada foto em que ela aparece. */
export async function GET(req: NextRequest, { params }: Params) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'engajamento_pessoas.view');
    if (negado) return negado;
    const campoId = campoDoUsuario(user);
    if (!campoId) return erro('Escolha um campo para usar o Engajamento.');
    const { id } = await params;
    const p = await pessoaDoCampo(campoId, id);
    if (!p) return erro('Pessoa não encontrada.', 404);

    const rostos = await prisma.$queryRaw<Array<{ id: string; foto_url: string | null; publicacao_id: string; imagem_indice: number; data_evento: Date; permalink: string | null; imagens: Array<{ url: string }> }>>(Prisma.sql`
      SELECT r.id, r.foto_url, r.publicacao_id, r.imagem_indice, pub.data_evento, pub.permalink, pub.imagens
        FROM engajamento_rostos r
        JOIN engajamento_publicacoes pub ON pub.id = r.publicacao_id AND pub.deleted_at IS NULL
       WHERE r.pessoa_id = ${p.id}::uuid
       ORDER BY pub.data_evento DESC
       LIMIT 300`);

    return semCache({
      pessoa: { id: p.id, nome: p.member_nome ?? p.nome, nomeLivre: p.nome, memberId: p.member_id, rol: p.rol, foto: p.foto_url, oculta: p.oculta },
      rostos: rostos.map((r) => ({
        id: r.id,
        foto: r.foto_url,
        publicacaoId: r.publicacao_id,
        dataEvento: r.data_evento.toISOString().slice(0, 10),
        permalink: r.permalink,
        imagem: r.imagens?.[r.imagem_indice]?.url ?? r.imagens?.[0]?.url ?? null,
      })),
    });
  });
}

/** Dá nome, liga ao membro do cadastro, troca a foto de capa ou oculta do relatório. */
export async function PATCH(req: NextRequest, { params }: Params) {
  return withAuth(req, async (user) => {
    const corpo = (await req.json().catch(() => ({}))) as { nome?: string | null; memberId?: string | null; oculta?: boolean; foto?: string };
    const soOcultar = Object.keys(corpo).every((k) => k === 'oculta');
    const negado = await exigirPermissao(user, soOcultar ? 'engajamento_pessoas.pessoas.ocultar' : 'engajamento_pessoas.pessoas.nomear');
    if (negado) return negado;
    const campoId = campoDoUsuario(user);
    if (!campoId) return erro('Escolha um campo para usar o Engajamento.');
    const { id } = await params;
    const p = await pessoaDoCampo(campoId, id);
    if (!p) return erro('Pessoa não encontrada.', 404);

    let memberId = p.member_id;
    if ('memberId' in corpo) {
      memberId = null;
      if (corpo.memberId) {
        const [m] = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT id FROM members WHERE id = ${corpo.memberId}::uuid AND campo_id = ${campoId}::uuid AND deleted_at IS NULL`);
        if (!m) return erro('Membro não encontrado neste campo.', 404);
        memberId = m.id;
      }
    }
    const nome = 'nome' in corpo ? (String(corpo.nome ?? '').trim().slice(0, 255) || null) : p.nome;
    const oculta = typeof corpo.oculta === 'boolean' ? corpo.oculta : p.oculta;
    // capa: só um recorte que já é desta pessoa
    let foto = p.foto_url;
    if (corpo.foto) {
      const [r] = await prisma.$queryRaw<Array<{ foto_url: string }>>(Prisma.sql`
        SELECT foto_url FROM engajamento_rostos WHERE pessoa_id = ${p.id}::uuid AND foto_url = ${corpo.foto} LIMIT 1`);
      if (r) foto = r.foto_url;
    }

    await prisma.$executeRaw(Prisma.sql`
      UPDATE engajamento_pessoas
         SET nome = ${nome}, member_id = ${memberId}::uuid, oculta = ${oculta}, foto_url = ${foto},
             updated_at = now(), updated_by = ${user.id}::uuid
       WHERE id = ${p.id}::uuid`);
    return semCache({ ok: true });
  });
}
