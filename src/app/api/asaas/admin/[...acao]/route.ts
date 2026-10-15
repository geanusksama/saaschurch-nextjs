/**
 * Menu Pagamentos (Asaas) do painel — src/app-ui/asaas.
 *
 * Permissões (matriz "Funções e Permissões"): asaas_pagamentos (ver / criar =
 * cobrança rápida e links / editar = links e recorrências / excluir = estornar
 * e cancelar) e asaas_config (configuração). Campo: o ativo (campoDoPainel),
 * master inclusive — mesma regra do isolamento por campo.
 *
 * GET  resumo | cobrancas | cobranca/:id | cobranca/:id/pix | pessoas?q= | assinaturas | links | financeiro | config | config/campos
 * POST cobranca | cobranca/:id/(estornar|cancelar|dinheiro|sincronizar) | assinatura/:id/(pausar|retomar|cancelar|valor)
 *      link | link/:id | link/:id/(ativar|desativar) | config | config/testar | config/webhook | config/campos | evento/:id/reprocessar
 */
import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthUser } from '@/lib/auth';
import { campoDoPainel, igrejaRestrita, negado, pode, type Acao } from '@/lib/mobile/acesso';
import { respostaDeErro } from '@/lib/asaas/appAuth';
import { executarAcaoAssinatura } from '@/lib/asaas/assinaturas';
import { apiDaConfig } from '@/lib/asaas/config';
import { prisma } from '@/lib/prisma';
import * as P from '@/lib/asaas/painel';

export const dynamic = 'force-dynamic';
type Params = { params: Promise<{ acao: string[] }> };

const json = (d: unknown, status = 200) => NextResponse.json(d, { status, headers: { 'Cache-Control': 'no-store' } });

function rota(req: NextRequest, perm: [string, Acao], fn: (e: P.Escopo, user: AuthUser) => Promise<unknown>) {
  return withAuth(req, async (user) => {
    if (!(await pode(user, perm[0], perm[1]))) return negado();
    const campoId = await campoDoPainel(user, new URL(req.url).searchParams.get('campoId'));
    if (!campoId) return negado('Seu usuário não tem campo definido.');
    const escopo: P.Escopo = { campoId, igreja: igrejaRestrita(user), userId: user.id, master: user.profileType === 'master' };
    try {
      return json(await fn(escopo, user));
    } catch (e) {
      return respostaDeErro(e);
    }
  });
}

const VER: [string, Acao] = ['asaas_pagamentos', 'view'];
const CRIAR: [string, Acao] = ['asaas_pagamentos', 'create'];
const EDITAR: [string, Acao] = ['asaas_pagamentos', 'edit'];
const EXCLUIR: [string, Acao] = ['asaas_pagamentos', 'delete'];
const CONFIG_VER: [string, Acao] = ['asaas_config', 'view'];
const CONFIG: [string, Acao] = ['asaas_config', 'edit'];

export async function GET(req: NextRequest, { params }: Params) {
  const [a, id, sub] = (await params).acao;
  const sp = new URL(req.url).searchParams;
  switch (a) {
    case 'resumo': return rota(req, VER, (e) => P.resumo(e));
    case 'cobrancas': return rota(req, VER, (e) => P.listarCobrancas(e, sp));
    case 'cobranca':
      if (id && sub === 'pix') return rota(req, VER, (e) => P.pixDaCobranca(e, id));
      if (id) return rota(req, VER, (e) => P.detalheCobranca(e, id));
      break;
    case 'pessoas': return rota(req, CRIAR, (e) => P.pessoasParaCobrar(e, sp.get('q') ?? ''));
    case 'assinaturas': return rota(req, VER, (e) => P.listarAssinaturas(e, sp));
    case 'links': return rota(req, VER, (e) => P.listarLinks(e));
    case 'financeiro': return rota(req, VER, (e) => P.financeiro(e, sp));
    case 'config':
      if (id === 'campos') return rota(req, CONFIG_VER, (e) => P.camposDaConta(e));
      return rota(req, CONFIG_VER, (e) => P.lerConfig(e, req));
  }
  return json({ error: 'Rota desconhecida.' }, 404);
}

export async function POST(req: NextRequest, { params }: Params) {
  const [a, id, sub] = (await params).acao;
  const corpo = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  switch (a) {
    case 'cobranca':
      if (!id) return rota(req, CRIAR, (e) => P.cobrancaRapida(e, corpo));
      if (sub === 'estornar') return rota(req, EXCLUIR, (e) => P.estornar(e, id, Number(corpo.valor) || undefined));
      if (sub === 'cancelar') return rota(req, EXCLUIR, (e) => P.cancelar(e, id));
      if (sub === 'dinheiro') return rota(req, CRIAR, (e) => P.recebidaEmDinheiro(e, id));
      if (sub === 'sincronizar') return rota(req, VER, (e) => P.sincronizar(e, id));
      break;
    case 'assinatura':
      if (id && sub) {
        if (sub === 'cartao') return json({ error: 'A troca de cartão é feita pela própria pessoa, no app.' }, 400);
        return rota(req, sub === 'cancelar' ? EXCLUIR : EDITAR, async (e) => {
          const ass = await P.assinaturaDoEscopo(e, id);
          const config = await prisma.asaasConfig.findUniqueOrThrow({ where: { id: ass.configId } });
          await executarAcaoAssinatura(apiDaConfig(config), ass.id, ass.asaasSubscriptionId, sub, corpo, { req });
          return { ok: true };
        });
      }
      break;
    case 'link':
      if (!id) return rota(req, CRIAR, (e) => P.salvarLink(e, corpo));
      if (sub === 'ativar') return rota(req, EDITAR, (e) => P.ativarLink(e, id, true));
      if (sub === 'desativar') return rota(req, EDITAR, (e) => P.ativarLink(e, id, false));
      return rota(req, EDITAR, (e) => P.salvarLink(e, corpo, id));
    case 'config':
      if (!id) return rota(req, CONFIG, async (e) => { await P.salvarConfig(e, corpo); return P.lerConfig(e, req); });
      if (id === 'testar') return rota(req, CONFIG_VER, (e) => P.testarConexao(e));
      if (id === 'webhook') return rota(req, CONFIG, (e, user) => P.registrarWebhook(e, req, String(corpo.email || user.email || '')));
      if (id === 'campos') return rota(req, CONFIG, (e) => P.aplicarContaNoCampo(e, String(corpo.campoId ?? ''), Boolean(corpo.ativo)));
      break;
    case 'evento':
      if (id && sub === 'reprocessar') return rota(req, CONFIG, (e) => P.reprocessarEvento(e, id));
      break;
  }
  return json({ error: 'Rota desconhecida.' }, 404);
}
