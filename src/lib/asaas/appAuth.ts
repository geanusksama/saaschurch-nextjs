/**
 * Autenticação das rotas que o App Igreja v3 chama (/api/appv3/pagamentos).
 *
 * O app manda o JWT do Supabase da instância. Não usa withAuth de propósito:
 * ele cria um `users` "pending" para todo login, e membro do app não é
 * usuário do painel. Aqui o token só identifica o perfil do app.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { prisma } from '@/lib/prisma';
import { AsaasErro } from './api';
import { SemAsaas } from './config';
import { FaltaDado, Recusado } from './servico';

export interface PerfilApp { id: string; campoId: string; churchId: string | null; memberId: string | null; nome: string }

export async function perfilDoToken(req: NextRequest): Promise<PerfilApp> {
  const h = req.headers.get('authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) throw NextResponse.json({ error: 'Entre na sua conta.' }, { status: 401 });
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) throw NextResponse.json({ error: 'Sessão expirada. Entre de novo.' }, { status: 401 });
  const p = await prisma.appV3Perfil.findUnique({
    where: { authUserId: data.user.id },
    select: { id: true, campoId: true, churchId: true, memberId: true, nome: true, excluidoEm: true },
  });
  if (!p || p.excluidoEm) throw NextResponse.json({ error: 'Perfil do app não encontrado.' }, { status: 403 });
  return p;
}

export function ipDe(req: NextRequest): string {
  return (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || '0.0.0.0';
}

/** Converte os erros conhecidos em respostas que o app entende. */
export function respostaDeErro(e: unknown): NextResponse {
  if (e instanceof NextResponse) return e;
  if (e instanceof FaltaDado) return NextResponse.json({ error: e.message, faltam: e.campos }, { status: 422 });
  if (e instanceof Recusado) return NextResponse.json({ status: 'RECUSADO', error: e.message, mensagem: e.message }, { status: 402 });
  if (e instanceof SemAsaas) return NextResponse.json({ error: e.message }, { status: 409 });
  if (e instanceof AsaasErro) {
    console.error('[asaas]', e.status, e.erros);
    return NextResponse.json({ error: e.message || 'O Asaas recusou a operação.' }, { status: 502 });
  }
  console.error('[asaas]', e);
  return NextResponse.json({ error: (e as Error)?.message || 'Erro interno.' }, { status: 500 });
}
