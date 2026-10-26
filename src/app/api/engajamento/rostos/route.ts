import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { withAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { exigirPermissao } from '@/lib/permissoes/servidor';
import { publicacaoDoCampo } from '@/lib/engajamento/publicacao';
import { apagarRecortes } from '@/lib/engajamento/imagens';
import { gravarRostos, rostoValido, type RostoRecebido } from '@/lib/engajamento/rostos';
import { campoDoUsuario, erro, semCache } from '@/lib/engajamento/rota';

export const maxDuration = 60;

/** Rostos que o navegador achou numa publicação (todas as fotos dela de uma vez). */
export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'engajamento_instagram.instagram.sincronizar');
    if (negado) return negado;
    const campoId = campoDoUsuario(user);
    if (!campoId) return erro('Escolha um campo para usar o Engajamento.');

    const corpo = (await req.json().catch(() => ({}))) as { publicacaoId?: string; rostos?: RostoRecebido[] };
    const p = await publicacaoDoCampo(user, String(corpo.publicacaoId ?? ''));
    if (!p) return erro('Publicação não encontrada.', 404);
    const rostos = Array.isArray(corpo.rostos) ? corpo.rostos : [];
    if (rostos.length > 200) return erro('Rostos demais numa publicação.');
    if (!rostos.every(rostoValido)) return erro('Rosto em formato inválido.');

    return semCache(await gravarRostos(campoId, p.id, rostos));
  });
}

/**
 * Apaga TODO dado de rosto do campo (pessoas, vetores e os recortes no storage). As fotos e
 * as marcações feitas à mão continuam. É o "esquecer" da LGPD.
 */
export async function DELETE(req: NextRequest) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'engajamento_pessoas.pessoas.apagar_rostos');
    if (negado) return negado;
    const campoId = campoDoUsuario(user);
    if (!campoId) return erro('Escolha um campo para usar o Engajamento.');
    await prisma.$transaction([
      prisma.$executeRaw(Prisma.sql`DELETE FROM engajamento_rostos WHERE campo_id = ${campoId}::uuid`),
      prisma.$executeRaw(Prisma.sql`DELETE FROM engajamento_pessoas WHERE campo_id = ${campoId}::uuid`),
      prisma.$executeRaw(Prisma.sql`UPDATE engajamento_publicacoes SET rostos_analisados_em = NULL WHERE campo_id = ${campoId}::uuid`),
    ]);
    return semCache({ ok: true, recortesApagados: await apagarRecortes(campoId) });
  });
}
