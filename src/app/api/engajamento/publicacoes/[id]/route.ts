import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { withAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { exigirPermissao } from '@/lib/permissoes/servidor';
import { publicacaoDoCampo } from '@/lib/engajamento/publicacao';
import { erro, igrejaPermitida, semCache } from '@/lib/engajamento/rota';

type Params = { params: Promise<{ id: string }> };
const DIA = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest, { params }: Params) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'engajamento_fotos.view');
    if (negado) return negado;
    const { id } = await params;
    const p = await publicacaoDoCampo(user, id);
    if (!p) return erro('Publicação não encontrada.', 404);

    const marcacoes = await prisma.$queryRaw<Array<{
      id: string; member_id: string | null; nome: string; instagram: string | null; imagem_indice: number;
      rol: number | null; church_name: string | null; created_at: Date;
    }>>(Prisma.sql`
      SELECT mk.id, mk.member_id, coalesce(m.full_name, mk.nome) AS nome, mk.instagram, mk.imagem_indice,
             m.rol, c.name AS church_name, mk.created_at
        FROM engajamento_marcacoes mk
        LEFT JOIN members m ON m.id = mk.member_id
        LEFT JOIN churches c ON c.id = m.church_id
       WHERE mk.publicacao_id = ${p.id}::uuid
       ORDER BY mk.imagem_indice, coalesce(m.full_name, mk.nome)`);

    return semCache({
      publicacao: {
        id: p.id,
        origem: p.origem,
        tipo: p.tipo,
        titulo: p.titulo,
        legenda: p.legenda,
        permalink: p.permalink,
        dataEvento: p.data_evento.toISOString().slice(0, 10),
        publicadoEm: p.publicado_em?.toISOString() ?? null,
        imagens: (p.imagens ?? []).map((i) => i.url),
        churchId: p.church_id,
        igreja: p.church_name,
      },
      marcacoes: marcacoes.map((m) => ({
        id: m.id,
        memberId: m.member_id,
        nome: m.nome,
        instagram: m.instagram,
        imagemIndice: m.imagem_indice,
        rol: m.rol,
        igreja: m.church_name,
      })),
    });
  });
}

/** Corrige data do culto, igreja e título (a legenda do Instagram não muda). */
export async function PATCH(req: NextRequest, { params }: Params) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'engajamento_fotos.fotos.editar');
    if (negado) return negado;
    const { id } = await params;
    const p = await publicacaoDoCampo(user, id);
    if (!p) return erro('Publicação não encontrada.', 404);

    const corpo = (await req.json().catch(() => ({}))) as { dataEvento?: string; churchId?: string | null; titulo?: string | null };
    const dataEvento = corpo.dataEvento ?? p.data_evento.toISOString().slice(0, 10);
    if (!DIA.test(dataEvento)) return erro('Data do culto inválida.');
    const igreja = 'churchId' in corpo ? await igrejaPermitida(user, corpo.churchId || null) : { churchId: p.church_id };
    if ('erro' in igreja) return igreja.erro;
    const titulo = 'titulo' in corpo ? (String(corpo.titulo ?? '').trim().slice(0, 200) || null) : p.titulo;

    await prisma.$executeRaw(Prisma.sql`
      UPDATE engajamento_publicacoes
         SET data_evento = ${dataEvento}::date, church_id = ${igreja.churchId}::uuid, titulo = ${titulo}, updated_at = now()
       WHERE id = ${p.id}::uuid`);
    return semCache({ ok: true });
  });
}

/** Tira a publicação da análise (exclusão lógica; as marcações deixam de contar). */
export async function DELETE(req: NextRequest, { params }: Params) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'engajamento_fotos.fotos.excluir');
    if (negado) return negado;
    const { id } = await params;
    const p = await publicacaoDoCampo(user, id);
    if (!p) return erro('Publicação não encontrada.', 404);
    await prisma.$executeRaw(Prisma.sql`UPDATE engajamento_publicacoes SET deleted_at = now() WHERE id = ${p.id}::uuid`);
    return semCache({ ok: true });
  });
}
