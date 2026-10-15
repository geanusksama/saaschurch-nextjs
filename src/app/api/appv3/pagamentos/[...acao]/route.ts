/**
 * Pagamentos do App Igreja v3 pelo Asaas (contrato em appv3/docs/02-SPEC-TECNICA.md §8).
 *
 * GET  config                       → o que o campo aceita + dados do titular que faltam + cartões salvos
 * POST contribuicao                 → { contribuicaoId, metodo: PIX|CARTAO, cartao?, titular? }
 * POST pedido                       → { pedidoId, metodo: PIX|CARTAO, parcelas?, cartao?, titular? }
 * GET  cobranca/:id                 → status (consulta o Asaas se ainda pendente) — tela "aguardando"
 * GET  assinaturas                  → contribuições recorrentes da pessoa
 * POST assinatura                   → { tipo, valor, forma: PIX|CARTAO, dia?, descricao?, cartao?, titular? }
 * POST assinatura/:id/:acao         → pausar | retomar | cancelar | valor {valor} | cartao {cartao, titular}
 * GET  assinatura/:id/pix           → QR do Pix em aberto da recorrência
 *
 * Autenticação: JWT do Supabase da instância (perfil do app). Nada aqui confia
 * em valor vindo do app: contribuição e pedido são relidos do banco.
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cancelarIngressosDoPedido } from '@/lib/mobile/recursosServidor';
import { apiDaConfig, configDoCampo } from '@/lib/asaas/config';
import { ipDe, perfilDoToken, respostaDeErro, type PerfilApp } from '@/lib/asaas/appAuth';
import { executarAcaoAssinatura, extras } from '@/lib/asaas/assinaturas';
import {
  ROTULO_CICLO, atualizarDoAsaas, bandeiraLegivel, cobrarCartao, cobrarPix, estadoDe, faltaParaCartao, garantirCliente,
  meioDoCartao, n2, pessoaDoPerfil, pixAberto, proximaData, registrarMensalidade, Recusado,
  type CartaoDoApp,
} from '@/lib/asaas/servico';

export const dynamic = 'force-dynamic';
type P = { params: Promise<{ acao: string[] }> };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Cache-Control': 'no-store',
};
const json = (d: unknown, status = 200) => NextResponse.json(d, { status, headers: CORS });

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

async function rodar(req: NextRequest, fn: (p: PerfilApp) => Promise<NextResponse>) {
  try {
    const r = await fn(await perfilDoToken(req));
    for (const [k, v] of Object.entries(CORS)) r.headers.set(k, v);
    return r;
  } catch (e) {
    const r = respostaDeErro(e);
    for (const [k, v] of Object.entries(CORS)) r.headers.set(k, v);
    return r;
  }
}

export async function GET(req: NextRequest, { params }: P) {
  const [a, id, sub] = (await params).acao;
  return rodar(req, async (perfil) => {
    if (a === 'config') return json(await config(perfil));
    if (a === 'cobranca' && id) return json(await statusCobranca(perfil, id));
    if (a === 'assinaturas') return json(await minhasAssinaturas(perfil));
    if (a === 'assinatura' && id && sub === 'pix') return json(await pixDaAssinatura(perfil, id));
    return json({ error: 'Rota desconhecida.' }, 404);
  });
}

export async function POST(req: NextRequest, { params }: P) {
  const [a, id, sub] = (await params).acao;
  const corpo = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return rodar(req, async (perfil) => {
    if (a === 'contribuicao') return json(await pagarContribuicao(req, perfil, corpo));
    if (a === 'pedido') return json(await pagarPedido(req, perfil, corpo));
    if (a === 'assinatura' && !id) return json(await assinar(req, perfil, corpo));
    if (a === 'assinatura' && id && sub) return json(await acaoAssinatura(req, perfil, id, sub, corpo));
    return json({ error: 'Rota desconhecida.' }, 404);
  });
}

// ── GET config ─────────────────────────────────────────────────────────────
async function config(perfil: PerfilApp) {
  const c = await prisma.asaasConfig.findFirst({ where: { campoId: perfil.campoId, deletedAt: null, ativo: true } });
  if (!c) return { ativo: false };
  const pessoa = await pessoaDoPerfil(perfil.id);
  const cartoes = await prisma.appV3Cartao.findMany({
    where: { perfilId: perfil.id, gateway: 'ASAAS' },
    select: { id: true, bandeira: true, final: true, validade: true },
    orderBy: { criadoEm: 'desc' },
  });
  return {
    ativo: true,
    pix: c.pixAtivo,
    cartao: c.cartaoAtivo,
    recorrencia: c.recorrenciaAtiva,
    maxParcelas: Math.min(c.maxParcelas, 3), // appv3_pedidos aceita até 3 (appv3_criar_pedido)
    // O que falta no cadastro para cobrar: o app pede só isso.
    faltamPix: pessoa.cpf.length === 11 || pessoa.cpf.length === 14 ? [] : ['cpf'],
    faltamCartao: faltaParaCartao(pessoa),
    titular: { nome: pessoa.nome, email: pessoa.email },
    cartoes,
  };
}


async function exigir(perfil: PerfilApp, forma: 'PIX' | 'CARTAO') {
  const { config: c, api } = await configDoCampo(perfil.campoId);
  if (forma === 'PIX' && !c.pixAtivo) throw new Recusado('Pix online não está ativo neste campo.');
  if (forma === 'CARTAO' && !c.cartaoAtivo) throw new Recusado('Cartão não está ativo neste campo.');
  return { config: c, api };
}

// ── Contribuição avulsa (dízimo/oferta) ────────────────────────────────────
async function pagarContribuicao(req: NextRequest, perfil: PerfilApp, corpo: Record<string, unknown>) {
  const metodo = corpo.metodo === 'CARTAO' ? 'CARTAO' : 'PIX';
  const contrib = await prisma.appV3Contribuicao.findFirst({ where: { id: String(corpo.contribuicaoId ?? ''), perfilId: perfil.id } });
  if (!contrib) throw new Recusado('Contribuição não encontrada.');
  if (contrib.status !== 'AGUARDANDO_CONFERENCIA') throw new Recusado('Esta contribuição já foi concluída.');
  const { config: c, api } = await exigir(perfil, metodo);
  const pessoa = await pessoaDoPerfil(perfil.id, extras(corpo));
  const valor = n2(contrib.valor);
  const nome = contrib.tipo === 'DIZIMO' ? 'Dízimo' : 'Oferta';
  const descricao = `${nome} · ${contrib.descricao ?? ''} · ${contrib.autenticacao}`;
  const ref = `sc:contribuicao:${contrib.id}`;
  const v = { config: c, campoId: contrib.campoId, churchId: contrib.churchId, perfilId: perfil.id, memberId: contrib.memberId, origem: 'CONTRIBUICAO' as const, contribuicaoId: contrib.id, pagadorNome: pessoa.nome };

  if (metodo === 'PIX') {
    const aberto = await pixAberto(api, { contribuicaoId: contrib.id }, valor);
    if (aberto) return aberto;
    const customer = await garantirCliente(api, c, pessoa);
    return cobrarPix(api, v, customer, valor, descricao, ref);
  }
  const meio = await meioDoCartao(perfil.id, (corpo.cartao ?? {}) as CartaoDoApp, pessoa);
  const customer = await garantirCliente(api, c, pessoa);
  await prisma.appV3Contribuicao.update({ where: { id: contrib.id }, data: { metodo: 'CARTAO' } });
  try {
    return await cobrarCartao(api, v, customer, valor, 1, descricao, ref, meio, ipDe(req));
  } catch (e) {
    // Recusado: a contribuição não fica "aguardando" no histórico; a próxima tentativa cria outra.
    if (e instanceof Recusado) await prisma.appV3Contribuicao.update({ where: { id: contrib.id }, data: { status: 'RECUSADA' } });
    throw e;
  }
}

// ── Pedido (loja / ingressos) ──────────────────────────────────────────────
async function pagarPedido(req: NextRequest, perfil: PerfilApp, corpo: Record<string, unknown>) {
  const metodo = corpo.metodo === 'CARTAO' ? 'CARTAO' : 'PIX';
  const ped = await prisma.appV3Pedido.findFirst({ where: { id: String(corpo.pedidoId ?? ''), perfilId: perfil.id }, include: { itens: { select: { nome: true, quantidade: true } } } });
  if (!ped) throw new Recusado('Pedido não encontrado.');
  if (!['AGUARDANDO_PAGAMENTO', 'AGUARDANDO_CONFERENCIA'].includes(ped.status)) throw new Recusado('Este pedido não está aguardando pagamento.');
  const { config: c, api } = await exigir(perfil, metodo);
  const pessoa = await pessoaDoPerfil(perfil.id, extras(corpo));
  const valor = n2(ped.total);
  const itens = ped.itens.map((i) => `${i.quantidade}x ${i.nome}`).join(', ');
  const descricao = `Pedido #${ped.numero} · ${itens}`;
  const ref = `sc:pedido:${ped.id}`;
  const v = { config: c, campoId: ped.campoId, churchId: ped.churchId, perfilId: perfil.id, memberId: pessoa.memberId, origem: 'PEDIDO' as const, pedidoId: ped.id, pagadorNome: pessoa.nome };

  if (metodo === 'PIX') {
    const aberto = await pixAberto(api, { pedidoId: ped.id }, valor);
    if (aberto) return aberto;
    const customer = await garantirCliente(api, c, pessoa);
    return cobrarPix(api, v, customer, valor, descricao, ref);
  }
  const parcelas = Math.max(1, Math.min(Number(corpo.parcelas ?? ped.parcelas) || 1, c.maxParcelas, 3));
  const meio = await meioDoCartao(perfil.id, (corpo.cartao ?? {}) as CartaoDoApp, pessoa);
  const customer = await garantirCliente(api, c, pessoa);
  try {
    return await cobrarCartao(api, v, customer, valor, parcelas, descricao, ref, meio, ipDe(req));
  } catch (e) {
    // Recusado: cancela o pedido para devolver as vagas dos ingressos; o app cria outro na nova tentativa.
    if (e instanceof Recusado) {
      await prisma.$transaction([
        prisma.appV3Pedido.update({ where: { id: ped.id }, data: { status: 'CANCELADO' } }),
        ...(await cancelarIngressosDoPedido(ped.id)),
      ]);
    }
    throw e;
  }
}

// ── Status (tela "aguardando confirmação") ─────────────────────────────────
async function statusCobranca(perfil: PerfilApp, id: string) {
  let c = await prisma.asaasCobranca.findFirst({ where: { id, perfilId: perfil.id } });
  if (!c) throw new Recusado('Cobrança não encontrada.');
  // Pendente: pergunta ao Asaas (não depende só do webhook chegar).
  if (estadoDe(c.status) === 'PENDENTE' && Date.now() - c.updatedAt.getTime() > 4_000) {
    const config = await prisma.asaasConfig.findUniqueOrThrow({ where: { id: c.configId } });
    c = await atualizarDoAsaas(apiDaConfig(config), c.asaasPaymentId).catch(() => c!);
  }
  return {
    cobrancaId: c.id,
    status: estadoDe(c.status),
    statusAsaas: c.status,
    valor: n2(c.valor),
    contribuicaoId: c.contribuicaoId,
    pedidoId: c.pedidoId,
    cartao: c.cartaoFinal ? { bandeira: c.cartaoBandeira, final: c.cartaoFinal } : null,
  };
}

// ── Recorrência ────────────────────────────────────────────────────────────
function formaAsaas(f: unknown): 'PIX' | 'CREDIT_CARD' {
  return f === 'CARTAO' || f === 'CREDIT_CARD' ? 'CREDIT_CARD' : 'PIX';
}

function assinaturaApp(a: Awaited<ReturnType<typeof prisma.asaasAssinatura.findFirst>> & object, pendente?: { id: string; valor: unknown } | null) {
  return {
    id: a.id,
    tipo: a.tipo,
    valor: n2(a.valor),
    ciclo: a.ciclo,
    cicloRotulo: ROTULO_CICLO[a.ciclo] ?? a.ciclo,
    forma: a.forma === 'CREDIT_CARD' ? 'CARTAO' : 'PIX',
    cartao: a.cartaoFinal ? `${a.cartaoBandeira ?? 'Cartão'} •••• ${a.cartaoFinal}` : null,
    proximo: a.proximoVencimento?.toISOString().slice(0, 10) ?? null,
    status: a.status,
    descricao: a.descricao,
    pixPendente: pendente ? { cobrancaId: pendente.id, valor: n2(pendente.valor as number) } : null,
  };
}

async function minhasAssinaturas(perfil: PerfilApp) {
  const lista = await prisma.asaasAssinatura.findMany({
    where: { perfilId: perfil.id, status: { not: 'CANCELADA' } },
    orderBy: { createdAt: 'desc' },
  });
  const pendentes = await prisma.asaasCobranca.findMany({
    where: { assinaturaId: { in: lista.map((a) => a.id) }, forma: 'PIX', status: { in: ['PENDING', 'OVERDUE'] } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, valor: true, assinaturaId: true },
  });
  return lista.map((a) => assinaturaApp(a, pendentes.find((p) => p.assinaturaId === a.id)));
}

async function assinar(req: NextRequest, perfil: PerfilApp, corpo: Record<string, unknown>) {
  const forma = formaAsaas(corpo.forma);
  const { config: c, api } = await exigir(perfil, forma === 'PIX' ? 'PIX' : 'CARTAO');
  if (!c.recorrenciaAtiva) throw new Recusado('Contribuição recorrente não está ativa neste campo.');
  const tipo = corpo.tipo === 'OFERTA' ? 'OFERTA' : 'DIZIMO';
  const valor = n2(Number(corpo.valor));
  if (!(valor >= 5 && valor <= 100_000)) throw new Recusado('Valor mínimo de R$ 5,00.');
  const dia = Number(corpo.dia) || undefined;
  if (dia && (dia < 1 || dia > 28)) throw new Recusado('Escolha um dia entre 1 e 28.');
  const pessoa = await pessoaDoPerfil(perfil.id, extras(corpo));
  const meio = forma === 'CREDIT_CARD' ? await meioDoCartao(perfil.id, (corpo.cartao ?? {}) as CartaoDoApp, pessoa) : null;
  const customer = await garantirCliente(api, c, pessoa);
  const nome = tipo === 'DIZIMO' ? 'Dízimo mensal' : 'Oferta mensal';
  const descricao = String(corpo.descricao || nome).slice(0, 120);

  let s;
  try {
    s = await api.assinaturas.criar({
      customer,
      billingType: forma,
      value: valor,
      nextDueDate: proximaData(dia),
      cycle: 'MONTHLY',
      description: descricao,
      externalReference: `sc:assinatura:${perfil.id}:${Date.now()}`,
      ...(meio ? { ...meio.campos, remoteIp: ipDe(req) } : {}),
    });
  } catch (e) {
    if (forma === 'CREDIT_CARD' && (e as { status?: number }).status === 400) throw new Recusado((e as Error).message || 'O banco não autorizou o cartão.');
    throw e;
  }

  const a = await prisma.asaasAssinatura.create({
    data: {
      configId: c.id, campoId: perfil.campoId, churchId: perfil.churchId, perfilId: perfil.id, memberId: pessoa.memberId,
      asaasSubscriptionId: s.id, asaasCustomerId: customer, tipo, valor, ciclo: s.cycle || 'MONTHLY', forma,
      proximoVencimento: s.nextDueDate ? new Date(`${s.nextDueDate}T12:00:00Z`) : null,
      status: s.status === 'INACTIVE' ? 'PAUSADA' : 'ATIVA', descricao,
      cartaoBandeira: s.creditCard?.creditCardBrand ? bandeiraLegivel(s.creditCard.creditCardBrand) : null,
      cartaoFinal: s.creditCard?.creditCardNumber ? String(s.creditCard.creditCardNumber).slice(-4) : null,
    },
  });

  // A primeira cobrança já existe quando o vencimento é hoje: registra (e devolve o Pix).
  const primeira = (await api.assinaturas.cobrancas(s.id).catch(() => ({ data: [] }))).data
    .sort((x, y) => String(x.dueDate).localeCompare(String(y.dueDate)))[0];
  let cob = null;
  if (primeira) cob = await registrarMensalidade(api, c, a.id, primeira, false);
  if (meio?.salvar && s.creditCard?.creditCardToken) {
    const final = String(s.creditCard.creditCardNumber ?? '').slice(-4);
    const ja = await prisma.appV3Cartao.findFirst({ where: { perfilId: perfil.id, gateway: 'ASAAS', final } });
    if (!ja) await prisma.appV3Cartao.create({ data: { perfilId: perfil.id, gateway: 'ASAAS', gatewayToken: s.creditCard.creditCardToken, final, validade: meio.validade, bandeira: bandeiraLegivel(s.creditCard.creditCardBrand) } });
  }

  let pix = null;
  if (cob && forma === 'PIX' && cob.status === 'PENDING') {
    const qr = await api.cobrancas.pix(cob.asaasPaymentId).catch(() => null);
    if (qr) pix = { payload: qr.payload, imagem: qr.encodedImage, expira: cob.pixExpira?.toISOString() ?? null };
  }
  const atual = await prisma.asaasAssinatura.findUniqueOrThrow({ where: { id: a.id } });
  return {
    assinatura: assinaturaApp(atual),
    cobranca: cob ? { cobrancaId: cob.id, status: estadoDe(cob.status), valor: n2(cob.valor) } : null,
    pix,
  };
}

async function minhaAssinatura(perfil: PerfilApp, id: string) {
  const a = await prisma.asaasAssinatura.findFirst({ where: { id, perfilId: perfil.id } });
  if (!a) throw new Recusado('Contribuição recorrente não encontrada.');
  const config = await prisma.asaasConfig.findUniqueOrThrow({ where: { id: a.configId } });
  return { a, config, api: apiDaConfig(config) };
}

async function pixDaAssinatura(perfil: PerfilApp, id: string) {
  const { a, api } = await minhaAssinatura(perfil, id);
  const c = await prisma.asaasCobranca.findFirst({
    where: { assinaturaId: a.id, forma: 'PIX', status: { in: ['PENDING', 'OVERDUE'] } },
    orderBy: { createdAt: 'desc' },
  });
  if (!c) throw new Recusado('Nenhum Pix em aberto nesta contribuição.');
  const qr = await api.cobrancas.pix(c.asaasPaymentId);
  return { cobrancaId: c.id, status: estadoDe(c.status), valor: n2(c.valor), pix: { payload: qr.payload, imagem: qr.encodedImage, expira: qr.expirationDate ?? null } };
}

async function acaoAssinatura(req: NextRequest, perfil: PerfilApp, id: string, acao: string, corpo: Record<string, unknown>) {
  const { a, config, api } = await minhaAssinatura(perfil, id);
  if (a.status === 'CANCELADA') throw new Recusado('Esta contribuição recorrente já foi cancelada.');
  await executarAcaoAssinatura(api, a.id, a.asaasSubscriptionId, acao, corpo, { req, perfilId: perfil.id });
  void config;
  const atual = await prisma.asaasAssinatura.findUniqueOrThrow({ where: { id: a.id } });
  return assinaturaApp(atual);
}
