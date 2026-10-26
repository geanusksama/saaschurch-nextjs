/**
 * A conta do Instagram conectada ao campo (engajamento_instagram).
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { decifrar } from './cripto';

export interface ContaInstagram {
  id: string;
  church_id: string | null;
  church_name: string | null;
  ig_user_id: string | null;
  username: string | null;
  token_enc: string | null;
  token_expira_em: Date | null;
  ultima_sincronizacao: Date | null;
  ultimo_erro: string | null;
  updated_at: Date;
}

export async function contaDoCampo(campoId: string): Promise<ContaInstagram | null> {
  const [c] = await prisma.$queryRaw<ContaInstagram[]>(Prisma.sql`
    SELECT e.id, e.church_id, ch.name AS church_name, e.ig_user_id, e.username, e.token_enc,
           e.token_expira_em, e.ultima_sincronizacao, e.ultimo_erro, e.updated_at
      FROM engajamento_instagram e
      LEFT JOIN churches ch ON ch.id = e.church_id
     WHERE e.campo_id = ${campoId}::uuid AND e.deleted_at IS NULL`);
  return c ?? null;
}

export function tokenDaConta(c: ContaInstagram): string | null {
  return c.token_enc ? decifrar(c.token_enc) : null;
}

/** O que a tela pode ver: nunca o token. */
export function contaPublica(c: ContaInstagram | null) {
  return {
    conectado: Boolean(c?.token_enc),
    username: c?.username ?? null,
    churchId: c?.church_id ?? null,
    igreja: c?.church_name ?? null,
    tokenExpiraEm: c?.token_expira_em?.toISOString() ?? null,
    ultimaSincronizacao: c?.ultima_sincronizacao?.toISOString() ?? null,
    ultimoErro: c?.ultimo_erro ?? null,
  };
}
