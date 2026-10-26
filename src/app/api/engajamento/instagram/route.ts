import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { withAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { exigirPermissao } from '@/lib/permissoes/servidor';
import { cifrar } from '@/lib/engajamento/cripto';
import { contaDoCampo, contaPublica } from '@/lib/engajamento/conta';
import { appInstagram, perfil, trocarCodigo } from '@/lib/engajamento/instagram';
import { campoDoUsuario, erro, semCache } from '@/lib/engajamento/rota';

/** Situação da conta + o App ID público, que a tela usa para abrir o login do Instagram. */
export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'engajamento_instagram.view');
    if (negado) return negado;
    const campoId = campoDoUsuario(user);
    if (!campoId) return erro('Escolha um campo para usar o Engajamento.');
    return semCache({ ...contaPublica(await contaDoCampo(campoId)), appId: appInstagram()?.appId ?? null });
  });
}

/**
 * Volta do "Entrar com Instagram": a tela recebe o `code` na URL e manda para
 * cá com a mesma redirect_uri usada no login (o Instagram confere as duas).
 */
export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'engajamento_instagram.instagram.conectar');
    if (negado) return negado;
    const campoId = campoDoUsuario(user);
    if (!campoId) return erro('Escolha um campo para usar o Engajamento.');

    const corpo = (await req.json().catch(() => ({}))) as { code?: string; redirectUri?: string };
    const code = String(corpo.code ?? '').replace(/#_$/, '').trim();
    const redirectUri = String(corpo.redirectUri ?? '');
    if (!code || !/^https?:\/\/[^/]+\/app-ui\/engajamento\/instagram$/.test(redirectUri)) return erro('Login do Instagram incompleto.');

    let token: { token: string; expiraEm: Date };
    let conta: { id: string; username: string };
    try {
      token = await trocarCodigo(code, redirectUri);
      conta = await perfil(token.token);
    } catch (e) {
      return erro(e instanceof Error ? e.message : 'O Instagram recusou o login.');
    }

    const atual = await contaDoCampo(campoId);
    if (atual) {
      await prisma.$executeRaw(Prisma.sql`
        UPDATE engajamento_instagram
           SET ig_user_id = ${conta.id}, username = ${conta.username}, token_enc = ${cifrar(token.token)},
               token_expira_em = ${token.expiraEm}, ultimo_erro = NULL, updated_at = now()
         WHERE id = ${atual.id}::uuid`);
    } else {
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO engajamento_instagram (campo_id, ig_user_id, username, token_enc, token_expira_em, created_by)
        VALUES (${campoId}::uuid, ${conta.id}, ${conta.username}, ${cifrar(token.token)}, ${token.expiraEm}, ${user.id}::uuid)`);
    }
    return semCache({ ...contaPublica(await contaDoCampo(campoId)), appId: appInstagram()?.appId ?? null });
  });
}

/** Desconecta: apaga o token. Fotos, pessoas e marcações continuam. */
export async function DELETE(req: NextRequest) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'engajamento_instagram.instagram.desconectar');
    if (negado) return negado;
    const campoId = campoDoUsuario(user);
    if (!campoId) return erro('Escolha um campo para usar o Engajamento.');
    await prisma.$executeRaw(Prisma.sql`
      UPDATE engajamento_instagram SET token_enc = NULL, token_expira_em = NULL, updated_at = now()
       WHERE campo_id = ${campoId}::uuid AND deleted_at IS NULL`);
    return semCache({ ...contaPublica(await contaDoCampo(campoId)), appId: appInstagram()?.appId ?? null });
  });
}
