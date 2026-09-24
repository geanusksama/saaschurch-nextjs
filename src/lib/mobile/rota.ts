/**
 * Painel Mobile — o que toda rota /api/mobile/* faz antes do trabalho:
 * autentica, confere a permissão da matriz, resolve o campo e a restrição de
 * igreja, e traduz ErroMobile em resposta HTTP. Sem cache (tela de edição).
 */
import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthUser } from '@/lib/auth';
import { serializeBigInts } from '@/lib/helpers';
import { campoDoPainel, igrejaRestrita, negado, pode, type Acao } from './acesso';
import { ErroMobile, type Contexto } from './recursosServidor';

export function jsonSemCache(dados: unknown, status = 200) {
  return NextResponse.json(serializeBigInts(dados), { status, headers: { 'Cache-Control': 'no-store' } });
}

export function rotaMobile(
  req: NextRequest,
  permKey: string | ((user: AuthUser) => string),
  acao: Acao,
  trabalho: (ctx: Contexto, user: AuthUser) => Promise<NextResponse>,
) {
  return withAuth(req, async (user) => {
    const key = typeof permKey === 'function' ? permKey(user) : permKey;
    if (!(await pode(user, key, acao))) return negado();
    const campoId = await campoDoPainel(user, new URL(req.url).searchParams.get('campoId'));
    if (!campoId) return negado('Seu usuário não tem campo definido.');
    try {
      return await trabalho({ campoId, igreja: igrejaRestrita(user) }, user);
    } catch (e) {
      if (e instanceof ErroMobile) return NextResponse.json({ error: e.message }, { status: e.status });
      if ((e as { code?: string }).code === 'P2002') {
        return NextResponse.json({ error: 'Já existe um cadastro com esse nome.' }, { status: 409 });
      }
      console.error('[mobile]', e);
      return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
    }
  });
}
