import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { withAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { exigirPermissao } from '@/lib/permissoes/servidor';
import { cifrar } from '@/lib/engajamento/cripto';
import { contaDoCampo, tokenDaConta } from '@/lib/engajamento/conta';
import { baixarEGuardar } from '@/lib/engajamento/imagens';
import { imagensDaMidia, midiasDesde, renovarToken } from '@/lib/engajamento/instagram';
import { campoDoUsuario, erro, semCache } from '@/lib/engajamento/rota';

export const maxDuration = 60;

/** Publicações novas por clique: cada uma baixa até 10 fotos. */
const POR_VEZ = 15;

/**
 * Traz as publicações dos últimos `dias` dias. A que já existe só tem legenda
 * e link atualizados — data do culto, igreja e marcações, que a equipe pode
 * ter corrigido, não são tocadas. Quando sobram publicações, a resposta diz
 * `restam: true` e a tela oferece continuar.
 */
export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'engajamento_instagram.instagram.sincronizar');
    if (negado) return negado;
    const campoId = campoDoUsuario(user);
    if (!campoId) return erro('Escolha um campo para usar o Engajamento.');
    const conta = await contaDoCampo(campoId);
    let token = conta ? tokenDaConta(conta) : null;
    if (!conta || !token) return erro('Conecte a conta do Instagram primeiro.');

    const corpo = (await req.json().catch(() => ({}))) as { dias?: number };
    const dias = Math.min(Math.max(Number(corpo.dias) || 90, 1), 365);
    const desde = new Date(Date.now() - dias * 86_400_000);

    const registrarErro = async (msg: string) => {
      await prisma.$executeRaw(Prisma.sql`
        UPDATE engajamento_instagram SET ultimo_erro = ${msg}, updated_at = now() WHERE id = ${conta.id}::uuid`);
      return erro(msg, 502);
    };

    // Renova quando faltar menos de 10 dias (o token vale 60).
    if (conta.token_expira_em && conta.token_expira_em.getTime() - Date.now() < 10 * 86_400_000) {
      try {
        const novo = await renovarToken(token);
        token = novo.token;
        await prisma.$executeRaw(Prisma.sql`
          UPDATE engajamento_instagram SET token_enc = ${cifrar(novo.token)}, token_expira_em = ${novo.expiraEm}
           WHERE id = ${conta.id}::uuid`);
      } catch (e) {
        return registrarErro(`Não foi possível renovar o token: ${e instanceof Error ? e.message : 'erro'}`);
      }
    }

    let midias;
    try {
      midias = await midiasDesde(token, desde, 500);
    } catch (e) {
      return registrarErro(`Instagram: ${e instanceof Error ? e.message : 'erro desconhecido'}`);
    }

    const existentes = new Map(
      (await prisma.$queryRaw<Array<{ ig_media_id: string; com_imagem: boolean }>>(Prisma.sql`
        SELECT ig_media_id, jsonb_array_length(imagens) > 0 AS com_imagem
          FROM engajamento_publicacoes
         WHERE campo_id = ${campoId}::uuid AND ig_media_id = ANY(${midias.map((m) => m.id)}::text[])`))
        .map((r) => [r.ig_media_id, r.com_imagem]),
    );

    let novas = 0;
    let atualizadas = 0;
    let falhas = 0;
    let restam = false;
    for (const m of midias) {
      if (existentes.get(m.id)) {
        await prisma.$executeRaw(Prisma.sql`
          UPDATE engajamento_publicacoes SET legenda = ${m.caption ?? null}, permalink = ${m.permalink ?? null}, updated_at = now()
           WHERE campo_id = ${campoId}::uuid AND ig_media_id = ${m.id}`);
        atualizadas++;
        continue;
      }
      if (novas >= POR_VEZ) { restam = true; continue; }

      const imagens: Array<{ url: string; origem: string }> = [];
      for (const [i, url] of imagensDaMidia(m).slice(0, 10).entries()) {
        try {
          imagens.push({ url: await baixarEGuardar(url, campoId, `ig_${m.id}_${i}`), origem: url });
        } catch {
          falhas++;
        }
      }
      if (!imagens.length) continue;
      const publicado = new Date(m.timestamp);
      // dia do culto no fuso de Brasília; a equipe corrige se a foto foi postada depois
      const dataEvento = new Date(publicado.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO engajamento_publicacoes
               (campo_id, church_id, origem, ig_media_id, permalink, tipo, legenda, publicado_em, data_evento, imagens, created_by)
        VALUES (${campoId}::uuid, ${conta.church_id}::uuid, 'INSTAGRAM', ${m.id}, ${m.permalink ?? null}, ${m.media_type},
                ${m.caption ?? null}, ${publicado}, ${dataEvento}::date, ${JSON.stringify(imagens)}::jsonb, ${user.id}::uuid)
        ON CONFLICT (campo_id, ig_media_id) WHERE ig_media_id IS NOT NULL
        DO UPDATE SET imagens = EXCLUDED.imagens, legenda = EXCLUDED.legenda, permalink = EXCLUDED.permalink, updated_at = now()`);
      novas++;
    }

    await prisma.$executeRaw(Prisma.sql`
      UPDATE engajamento_instagram SET ultima_sincronizacao = now(), ultimo_erro = NULL, updated_at = now()
       WHERE id = ${conta.id}::uuid`);
    return semCache({ novas, atualizadas, falhas, restam, encontradas: midias.length });
  });
}
