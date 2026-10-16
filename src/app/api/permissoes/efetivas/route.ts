/**
 * Permissões efetivas de quem está logado.
 *
 * O navegador só grava o `mrm_user` no login; sem esta rota, quem fosse posto
 * num grupo só sentiria a mudança depois de sair e entrar de novo. O
 * usePermissions chama isto ao abrir, como já faz com a matriz.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) =>
    NextResponse.json(
      {
        emGrupo: user.emGrupo,
        grupos: user.grupos,
        // Fora de grupo o navegador continua com o que já tem (mrm_user).
        permissoes: user.emGrupo ? user.permissions : null,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    ),
  );
}
