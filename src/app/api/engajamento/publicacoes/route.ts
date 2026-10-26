import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { withAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { exigirPermissao } from '@/lib/permissoes/servidor';
import { guardarImagem } from '@/lib/engajamento/imagens';
import { campoDoUsuario, erro, igrejaPermitida, semCache } from '@/lib/engajamento/rota';

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const MAX_FOTOS = 10;
const MAX_BYTES = 15 * 1024 * 1024;

/** Publicações do campo no intervalo, com quantas pessoas já foram marcadas. */
export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'engajamento_fotos.view');
    if (negado) return negado;
    const campoId = campoDoUsuario(user);
    if (!campoId) return erro('Escolha um campo para usar o Engajamento.');
    const sp = new URL(req.url).searchParams;
    const de = sp.get('de') ?? '';
    const ate = sp.get('ate') ?? '';
    if (!DIA.test(de) || !DIA.test(ate)) return erro('Informe o período.');
    const igreja = await igrejaPermitida(user, sp.get('churchId'));
    if ('erro' in igreja) return igreja.erro;
    const q = (sp.get('q') ?? '').trim();
    const pendentes = sp.get('pendentes') === '1';

    const rows = await prisma.$queryRaw<Array<{
      id: string; origem: string; tipo: string | null; titulo: string | null; legenda: string | null;
      permalink: string | null; data_evento: Date; publicado_em: Date | null; imagens: Array<{ url: string }>;
      church_id: string | null; church_name: string | null; marcados: number; sem_cadastro: number;
    }>>(Prisma.sql`
      SELECT p.id, p.origem, p.tipo, p.titulo, p.legenda, p.permalink, p.data_evento, p.publicado_em,
             p.imagens, p.church_id, c.name AS church_name,
             count(mk.id)::int AS marcados,
             count(mk.id) FILTER (WHERE mk.member_id IS NULL)::int AS sem_cadastro
        FROM engajamento_publicacoes p
        LEFT JOIN churches c ON c.id = p.church_id
        LEFT JOIN engajamento_marcacoes mk ON mk.publicacao_id = p.id
       WHERE p.campo_id = ${campoId}::uuid AND p.deleted_at IS NULL
         AND p.data_evento BETWEEN ${de}::date AND ${ate}::date
         AND (${igreja.churchId}::uuid IS NULL OR p.church_id = ${igreja.churchId}::uuid)
         AND (${q} = '' OR p.titulo ILIKE ${'%' + q + '%'} OR p.legenda ILIKE ${'%' + q + '%'})
       GROUP BY p.id, c.name
      HAVING NOT ${pendentes} OR count(mk.id) = 0
       ORDER BY p.data_evento DESC, p.publicado_em DESC NULLS LAST
       LIMIT 300`);

    return semCache({
      publicacoes: rows.map((r) => ({
        id: r.id,
        origem: r.origem,
        tipo: r.tipo,
        titulo: r.titulo,
        legenda: r.legenda,
        permalink: r.permalink,
        dataEvento: r.data_evento.toISOString().slice(0, 10),
        publicadoEm: r.publicado_em?.toISOString() ?? null,
        imagens: (r.imagens ?? []).map((i) => i.url),
        churchId: r.church_id,
        igreja: r.church_name,
        marcados: r.marcados,
        semCadastro: r.sem_cadastro,
      })),
    });
  });
}

/** Publicação lançada à mão: fotos de um culto que não vieram do Instagram. */
export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'engajamento_fotos.fotos.nova');
    if (negado) return negado;
    const campoId = campoDoUsuario(user);
    if (!campoId) return erro('Escolha um campo para usar o Engajamento.');

    const form = await req.formData();
    const dataEvento = String(form.get('dataEvento') ?? '');
    if (!DIA.test(dataEvento)) return erro('Informe a data do culto ou evento.');
    const titulo = String(form.get('titulo') ?? '').trim().slice(0, 200) || null;
    const permalink = String(form.get('permalink') ?? '').trim().slice(0, 500) || null;
    if (permalink && !/^https:\/\//i.test(permalink)) return erro('O link precisa começar com https://');
    const igreja = await igrejaPermitida(user, String(form.get('churchId') ?? '') || null);
    if ('erro' in igreja) return igreja.erro;

    const arquivos = form.getAll('fotos').filter((f): f is File => typeof f !== 'string');
    if (!arquivos.length) return erro('Envie ao menos uma foto.');
    if (arquivos.length > MAX_FOTOS) return erro(`No máximo ${MAX_FOTOS} fotos por publicação.`);

    const base = `${dataEvento}_${Date.now()}`;
    const imagens: Array<{ url: string }> = [];
    for (const [i, arq] of arquivos.entries()) {
      if (arq.size > MAX_BYTES) return erro(`"${arq.name}" passa de 15 MB.`);
      try {
        imagens.push({ url: await guardarImagem(Buffer.from(await arq.arrayBuffer()), campoId, `${base}_${i}`) });
      } catch (e) {
        return erro(e instanceof Error && e.message.startsWith('Não foi') ? e.message : `"${arq.name}" não é uma imagem válida.`);
      }
    }

    const [criada] = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      INSERT INTO engajamento_publicacoes (campo_id, church_id, origem, tipo, titulo, permalink, data_evento, imagens, created_by)
      VALUES (${campoId}::uuid, ${igreja.churchId}::uuid, 'MANUAL', 'MANUAL', ${titulo}, ${permalink},
              ${dataEvento}::date, ${JSON.stringify(imagens)}::jsonb, ${user.id}::uuid)
      RETURNING id`);
    return semCache({ id: criada.id }, 201);
  });
}
