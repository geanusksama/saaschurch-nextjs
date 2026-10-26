/**
 * Peças comuns das rotas /api/engajamento/*.
 *
 * Escopo: sempre o campo ativo (master inclusive — ver campoAtivo.ts). Perfil
 * igreja só enxerga a própria igreja, venha o que vier na querystring.
 */
import { NextResponse } from 'next/server';
import type { AuthUser } from '@/lib/auth';
import { igrejaNoCampoAtivo } from '@/lib/campoAtivo';
import { validarPeriodos, type FiltroComparacao } from './comparacao';

export function erro(mensagem: string, status = 400) {
  return NextResponse.json({ error: mensagem }, { status });
}

export function semCache(corpo: unknown, status = 200) {
  return NextResponse.json(corpo, { status, headers: { 'Cache-Control': 'no-store' } });
}

/** Campo ativo obrigatório: sem ele não há o que mostrar. */
export function campoDoUsuario(user: AuthUser): string | null {
  return user.campoId || null;
}

/** Igreja pedida, conferida contra o campo; perfil igreja fica preso à dele. */
export async function igrejaPermitida(user: AuthUser, pedida: string | null): Promise<{ churchId: string | null } | { erro: NextResponse }> {
  if (user.profileType === 'church') return { churchId: user.churchId ?? '00000000-0000-0000-0000-000000000000' };
  if (!pedida || pedida === 'all') return { churchId: null };
  if (!(await igrejaNoCampoAtivo(user, pedida))) return { erro: erro('Igreja fora do campo ativo.', 403) };
  return { churchId: pedida };
}

export async function filtroDaQuery(user: AuthUser, sp: URLSearchParams): Promise<FiltroComparacao | NextResponse> {
  const campoId = campoDoUsuario(user);
  if (!campoId) return erro('Escolha um campo para usar o Engajamento.');
  const periodos = {
    refIni: sp.get('refIni') ?? '',
    refFim: sp.get('refFim') ?? '',
    recIni: sp.get('recIni') ?? '',
    recFim: sp.get('recFim') ?? '',
  };
  const invalido = validarPeriodos(periodos);
  if (invalido) return erro(invalido);
  return { ...periodos, campoId, soDomingos: sp.get('soDomingos') === '1' };
}
