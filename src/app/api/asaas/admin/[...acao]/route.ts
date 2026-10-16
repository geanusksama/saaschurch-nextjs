/**
 * Pagamentos (Asaas) do painel — src/app-ui/asaas.
 *
 * Uma chave por tela na matriz "Funções e Permissões" (permissionCatalog.ts):
 * asaas_visao, asaas_cobrar, asaas_vendas, asaas_recorrencias, asaas_links,
 * asaas_financeiro e asaas_config. Cada rota aceita uma ou mais chaves (basta
 * uma) — ex.: a lista de cobranças serve Vendas e o histórico de Recorrências.
 * Campo: o ativo (campoDoPainel), master inclusive — isolamento por campo.
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

type Perm = [string, Acao];

function rota(req: NextRequest, perms: Perm[], fn: (e: P.Escopo, user: AuthUser) => Promise<unknown>) {
  return withAuth(req, async (user) => {
    let ok = false;
    for (const [k, a] of perms) if (!ok) ok = await pode(user, k, a);
    if (!ok) return negado();
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

const VISAO: Perm[] = [['asaas_visao', 'view']];
// Lista/detalhe de cobrança: Vendas, a tela de Cobrança rápida (acompanha a que gerou) e o histórico de Recorrências.
const VER_COBRANCA: Perm[] = [['asaas_vendas', 'view'], ['asaas_cobrar', 'view'], ['asaas_recorrencias', 'view']];
const COBRAR: Perm[] = [['asaas_cobrar', 'create']];
const RECEBER_DINHEIRO: Perm[] = [['asaas_cobrar', 'create'], ['asaas_vendas', 'create']];
const CANCELAR: Perm[] = [['asaas_vendas', 'delete'], ['asaas_cobrar', 'create']];
const ESTORNAR: Perm[] = [['asaas_vendas', 'delete']];
const RECORRENCIAS: Perm[] = [['asaas_recorrencias', 'view']];
const RECORRENCIA_EDITAR: Perm[] = [['asaas_recorrencias', 'edit']];
const RECORRENCIA_CANCELAR: Perm[] = [['asaas_recorrencias', 'delete']];
const LINKS: Perm[] = [['asaas_links', 'view']];
const LINK_CRIAR: Perm[] = [['asaas_links', 'create']];
const LINK_EDITAR: Perm[] = [['asaas_links', 'edit']];
const FINANCEIRO: Perm[] = [['asaas_financeiro', 'view']];
const CONFIG_VER: Perm[] = [['asaas_config', 'view']];
const CONFIG: Perm[] = [['asaas_config', 'edit']];

export async function GET(req: NextRequest, { params }: Params) {
  const [a, id, sub] = (await params).acao;
  const sp = new URL(req.url).searchParams;
  switch (a) {
    case 'resumo': return rota(req, VISAO, (e) => P.resumo(e, sp));
    case 'cobrancas': return rota(req, VER_COBRANCA, (e) => P.listarCobrancas(e, sp));
    case 'cobranca':
      if (id && sub === 'pix') return rota(req, VER_COBRANCA, (e) => P.pixDaCobranca(e, id));
      if (id) return rota(req, VER_COBRANCA, (e) => P.detalheCobranca(e, id));
      break;
    case 'pessoas': return rota(req, COBRAR, (e) => P.pessoasParaCobrar(e, sp.get('q') ?? ''));
    case 'assinaturas': return rota(req, RECORRENCIAS, (e) => P.listarAssinaturas(e, sp));
    case 'links':
      if (id === 'opcoes') return rota(req, LINKS, (e) => P.opcoesLink(e));
      return rota(req, LINKS, (e) => P.listarLinks(e));
    case 'financeiro': return rota(req, FINANCEIRO, (e) => P.financeiro(e, sp));
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
      if (!id) return rota(req, COBRAR, (e) => P.cobrancaRapida(e, corpo));
      if (sub === 'estornar') return rota(req, ESTORNAR, (e) => P.estornar(e, id, Number(corpo.valor) || undefined));
      if (sub === 'cancelar') return rota(req, CANCELAR, (e) => P.cancelar(e, id));
      if (sub === 'dinheiro') return rota(req, RECEBER_DINHEIRO, (e) => P.recebidaEmDinheiro(e, id));
      if (sub === 'sincronizar') return rota(req, VER_COBRANCA, (e) => P.sincronizar(e, id));
      break;
    case 'assinatura':
      if (id && sub) {
        if (sub === 'cartao') return json({ error: 'A troca de cartão é feita pela própria pessoa, no app.' }, 400);
        return rota(req, sub === 'cancelar' ? RECORRENCIA_CANCELAR : RECORRENCIA_EDITAR, async (e) => {
          const ass = await P.assinaturaDoEscopo(e, id);
          const config = await prisma.asaasConfig.findUniqueOrThrow({ where: { id: ass.configId } });
          await executarAcaoAssinatura(apiDaConfig(config), ass.id, ass.asaasSubscriptionId, sub, corpo, { req });
          return { ok: true };
        });
      }
      break;
    case 'link':
      if (!id) return rota(req, LINK_CRIAR, (e) => P.salvarLink(e, corpo));
      if (sub === 'ativar') return rota(req, LINK_EDITAR, (e) => P.ativarLink(e, id, true));
      if (sub === 'desativar') return rota(req, LINK_EDITAR, (e) => P.ativarLink(e, id, false));
      return rota(req, LINK_EDITAR, (e) => P.salvarLink(e, corpo, id));
    case 'config':
      if (!id) return rota(req, CONFIG, async (e) => { await P.salvarConfig(e, corpo); await P.aplicarNosCampos(e, corpo.campos); return P.lerConfig(e, req); });
      if (id === 'testar') return rota(req, CONFIG_VER, (e) => P.testarConexao(e));
      if (id === 'configurar') return rota(req, CONFIG, (e) => P.configurarConta(e, req, corpo));
      if (id === 'webhook') return rota(req, CONFIG, (e, user) => P.registrarWebhook(e, req, String(corpo.email || user.email || '')));
      if (id === 'campos') return rota(req, CONFIG, (e) => P.aplicarContaNoCampo(e, String(corpo.campoId ?? ''), Boolean(corpo.ativo)));
      break;
    case 'evento':
      if (id && sub === 'reprocessar') return rota(req, CONFIG, (e) => P.reprocessarEvento(e, id));
      break;
  }
  return json({ error: 'Rota desconhecida.' }, 404);
}
