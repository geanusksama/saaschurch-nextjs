/**
 * Vitrine pública (site): Eventos, Compras e Peniel pagos pelo Asaas.
 *
 * Mesmas tabelas do App Igreja v3 (appv3_eventos, appv3_produtos, appv3_pedidos,
 * appv3_ingressos) — o que se cadastra no Mobile ou em Pagamentos › Eventos e
 * loja aparece no app e aqui. Quem compra pelo site não tem conta no app: o
 * pedido guarda o comprador (origem SITE, perfil nulo).
 *
 * Nada aqui confia em preço vindo do navegador: tudo é relido do banco, como
 * em appv3_criar_pedido. O pagamento só vale confirmado pelo Asaas (webhook ou
 * consulta), e aí `aplicarNoApp` marca o pedido/inscrição como pago.
 */
import { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveCampoFromRequest } from '@/lib/publicTenant';
import { cancelarIngressosDoPedido } from '@/lib/mobile/recursosServidor';
import { hojeBR, soDigitos } from './api';
import { apiDaConfig, configDoCampo, SemAsaas } from './config';
import { atualizarDoAsaas, cobrarPix, estadoDe, garantirCliente, n2, Recusado, registrar, type Pessoa } from './servico';

/** Campo do site: domínio/?campo= (publicTenant) ou, sem isso (localhost), o campo principal do banco. */
export async function campoDoSite(req: NextRequest): Promise<string> {
  const c = await resolveCampoFromRequest(req);
  if (c) return c;
  const campos = await prisma.campo.findMany({ where: { deletedAt: null }, select: { id: true, _count: { select: { regionais: true } } } });
  campos.sort((a, b) => b._count.regionais - a._count.regionais);
  if (!campos[0]) throw new Recusado('Campo não encontrado.');
  return campos[0].id;
}

function cpfValido(bruto: string): boolean {
  const cpf = soDigitos(bruto);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  for (const [tam, pos] of [[9, 10], [10, 11]] as const) {
    let soma = 0;
    for (let i = 0; i < tam; i++) soma += Number(cpf[i]) * (pos - i);
    if (((soma * 10) % 11) % 10 !== Number(cpf[tam])) return false;
  }
  return true;
}

// ── Catálogo ───────────────────────────────────────────────────────────────

export async function vitrine(campoId: string) {
  const agora = new Date(Date.now() - 6 * 3600_000); // evento de hoje continua à venda até umas horas depois do início
  const [eventos, produtos, config, campo] = await Promise.all([
    prisma.appV3Evento.findMany({
      where: { campoId, escopo: 'CAMPO', publicado: true, OR: [{ fim: { gte: agora } }, { fim: null, inicio: { gte: agora } }] },
      orderBy: [{ destaque: 'desc' }, { inicio: 'asc' }],
      include: { opcoes: { where: { ativo: true }, orderBy: [{ ordem: 'asc' }, { preco: 'asc' }] } },
      take: 100,
    }),
    prisma.appV3Produto.findMany({
      where: { campoId, ativo: true },
      orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
      include: { cores: { orderBy: { ordem: 'asc' } }, imagens: { orderBy: { ordem: 'asc' } } },
      take: 300,
    }),
    prisma.asaasConfig.findFirst({ where: { campoId, deletedAt: null, ativo: true }, select: { pixAtivo: true, cartaoAtivo: true } }),
    prisma.campo.findUnique({ where: { id: campoId }, select: { name: true } }),
  ]);
  const minIds = [...new Set([...eventos.map((e) => e.ministerioId), ...produtos.map((p) => p.ministerioId)].filter((x): x is string => Boolean(x)))];
  const [ministerios, sites] = await Promise.all([
    minIds.length ? prisma.ministry.findMany({ where: { id: { in: minIds } }, select: { id: true, name: true } }) : [],
    minIds.length
      ? prisma.$queryRaw<{ department_id: string; slug: string }[]>`select department_id, slug from public.department_sites where deleted_at is null and status = 'PUBLICADO' and department_id = any(${minIds}::uuid[])`
      : [],
  ]);
  const min = (id: string | null) => {
    const m = ministerios.find((x) => x.id === id);
    if (!m) return null;
    return { id: m.id, nome: m.name, site: sites.find((s) => s.department_id === m.id)?.slug ?? null };
  };
  return {
    campo: campo?.name ?? null,
    pagamento: config ? { pix: config.pixAtivo, cartao: config.cartaoAtivo } : null,
    ministerios: ministerios.map((m) => min(m.id)).filter(Boolean),
    eventos: eventos.map((e) => ({
      id: e.id, titulo: e.titulo, tituloCurto: e.tituloCurto, categoria: e.categoria, descricao: e.descricao,
      local: e.local, endereco: e.endereco, inicio: e.inicio, fim: e.fim, imagemUrl: e.imagemUrl, destaque: e.destaque,
      ctaTexto: e.ctaTexto, vagas: e.capacidade === null ? null : Math.max(0, e.capacidade - e.vendidos), ministerio: min(e.ministerioId),
      opcoes: e.opcoes.map((o) => ({ id: o.id, rotulo: o.rotulo, preco: n2(o.preco) })),
    })),
    produtos: produtos.map((p) => ({
      id: p.id, nome: p.nome, categoria: p.categoria, descricao: p.descricao, preco: n2(p.preco), novo: p.novo,
      tamanhos: p.tamanhos, ministerio: min(p.ministerioId),
      cores: p.cores.map((c) => ({ id: c.id, nome: c.nome, hex: c.hex })),
      imagens: p.imagens.map((i) => ({ url: i.url, corId: i.corId, vista: i.vista })),
    })),
  };
}

// ── Pedido do site ─────────────────────────────────────────────────────────

export interface ItemSite { tipo: 'PRODUTO' | 'INGRESSO'; produtoId?: string; opcaoId?: string; quantidade?: number; tamanho?: string; corId?: string }
export interface Comprador { nome: string; cpf: string; celular: string; email?: string }

function validarComprador(c: Partial<Comprador>): Comprador {
  const nome = String(c.nome ?? '').trim();
  if (nome.length < 3) throw new Recusado('Informe seu nome completo.');
  if (!cpfValido(String(c.cpf ?? ''))) throw new Recusado('CPF inválido.');
  const celular = soDigitos(c.celular);
  if (celular.length < 10) throw new Recusado('Informe o celular com DDD.');
  const email = String(c.email ?? '').trim();
  if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new Recusado('E-mail inválido.');
  return { nome, cpf: soDigitos(c.cpf), celular, email };
}

const codigo = (prefixo: string) => `${prefixo}-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

/** Cria o pedido (preços e vagas do banco, numa transação) e devolve id, número e total. */
async function criarPedidoSite(campoId: string, itens: ItemSite[], comprador: Comprador) {
  if (!Array.isArray(itens) || !itens.length) throw new Recusado('Carrinho vazio.');
  if (itens.length > 30) throw new Recusado('Itens demais no carrinho.');
  return prisma.$transaction(async (tx) => {
    const ped = await tx.appV3Pedido.create({
      data: {
        campoId, metodo: 'PIX', parcelas: 1, status: 'AGUARDANDO_PAGAMENTO', origem: 'SITE',
        compradorNome: comprador.nome, compradorCpf: comprador.cpf, compradorCelular: comprador.celular, compradorEmail: comprador.email || null,
      },
    });
    let total = new Prisma.Decimal(0);
    for (const it of itens) {
      const qtd = Math.max(1, Math.min(Number(it.quantidade) || 1, 20));
      if (it.tipo === 'PRODUTO') {
        const prod = await tx.appV3Produto.findFirst({ where: { id: String(it.produtoId ?? ''), campoId, ativo: true } });
        if (!prod) throw new Recusado('Um produto do carrinho não está mais disponível.');
        const tam = it.tamanho ? String(it.tamanho) : null;
        if (tam && !prod.tamanhos.includes(tam)) throw new Recusado(`Tamanho ${tam} indisponível para ${prod.nome}.`);
        const cor = it.corId ? await tx.appV3ProdutoCor.findFirst({ where: { id: String(it.corId), produtoId: prod.id }, select: { nome: true } }) : null;
        const sub = prod.preco.mul(qtd);
        await tx.appV3PedidoItem.create({
          data: {
            pedidoId: ped.id, tipo: 'PRODUTO', produtoId: prod.id, nome: prod.nome,
            variante: [tam ? `Tamanho ${tam}` : null, cor?.nome].filter(Boolean).join(' · ') || null,
            tamanho: tam, cor: cor?.nome ?? null, quantidade: qtd, precoUnit: prod.preco, total: sub,
          },
        });
        total = total.add(sub);
      } else if (it.tipo === 'INGRESSO') {
        const op = await tx.appV3EventoOpcao.findFirst({ where: { id: String(it.opcaoId ?? ''), ativo: true } });
        const ev = op ? await tx.appV3Evento.findFirst({ where: { id: op.eventoId, publicado: true, escopo: 'CAMPO', campoId } }) : null;
        if (!op || !ev) throw new Recusado('Este evento não está mais disponível.');
        // Reserva a vaga com a mesma regra do app: atualização condicional, sem passar da capacidade.
        const reservado = await tx.$executeRaw`
          update public.appv3_eventos set vendidos = vendidos + ${qtd}
           where id = ${ev.id}::uuid and (capacidade is null or vendidos + ${qtd} <= capacidade)`;
        if (!reservado) throw new Recusado(`Ingressos esgotados para ${ev.tituloCurto || ev.titulo}.`);
        const sub = op.preco.mul(qtd);
        const item = await tx.appV3PedidoItem.create({
          data: {
            pedidoId: ped.id, tipo: 'INGRESSO', eventoId: ev.id, opcaoId: op.id, nome: ev.tituloCurto || ev.titulo,
            variante: op.rotulo, quantidade: qtd, precoUnit: op.preco, total: sub,
          },
        });
        await tx.appV3Ingresso.create({
          data: {
            pedidoId: ped.id, itemId: item.id, eventoId: ev.id, opcaoId: op.id, codigo: codigo('ING'),
            rotulo: `${op.rotulo} · ${qtd} ${qtd > 1 ? 'ingressos' : 'ingresso'}`, quantidade: qtd, valorPago: sub,
            status: op.preco.isZero() ? 'ATIVO' : 'AGUARDANDO_PAGAMENTO',
            reembolsoAte: op.preco.isZero() ? null : new Date(ev.inicio.getTime() - ev.reembolsoAteHoras * 3600_000),
          },
        });
        total = total.add(sub);
      } else {
        throw new Recusado('Item inválido.');
      }
    }
    const gratis = total.isZero();
    const atual = await tx.appV3Pedido.update({
      where: { id: ped.id },
      data: {
        subtotal: total, total, status: gratis ? 'PAGO' : 'AGUARDANDO_PAGAMENTO', metodo: gratis ? 'GRATUITO' : 'PIX',
        pagoEm: gratis ? new Date() : null,
      },
    });
    await tx.$executeRaw`update public.appv3_pedidos set pix_txid = 'PED' || numero where id = ${ped.id}::uuid`;
    return { id: atual.id, numero: Number(atual.numero), total: n2(atual.total), gratis };
  }, { timeout: 20_000, maxWait: 10_000 });
}

function pessoaDoComprador(campoId: string, c: Comprador): Pessoa {
  return { perfilId: null, memberId: null, campoId, churchId: null, nome: c.nome, cpf: c.cpf, email: c.email ?? '', celular: c.celular, cep: '', numero: '' };
}

/**
 * Checkout do site. Pix: QR na tela. Cartão: página segura do Asaas (crédito,
 * débito, parcelas) — o site não recebe dado de cartão.
 */
export async function checkoutSite(req: NextRequest, corpo: Record<string, unknown>) {
  const campoId = await campoDoSite(req);
  const comprador = validarComprador((corpo.comprador ?? {}) as Partial<Comprador>);
  const metodo = corpo.metodo === 'CARTAO' ? 'CARTAO' : 'PIX';
  const { config, api } = await configDoCampo(campoId).catch(() => {
    throw new SemAsaas('Pagamento online indisponível no momento. Procure a secretaria.');
  });
  const ped = await criarPedidoSite(campoId, corpo.itens as ItemSite[], comprador);
  const ingressos = async () => (await prisma.appV3Ingresso.findMany({ where: { pedidoId: ped.id }, select: { codigo: true, rotulo: true, status: true } }));
  if (ped.gratis) return { pedidoNumero: ped.numero, status: 'PAGO', valor: 0, ingressos: await ingressos() };

  try {
    const customer = await garantirCliente(api, config, pessoaDoComprador(campoId, comprador));
    const itens = await prisma.appV3PedidoItem.findMany({ where: { pedidoId: ped.id }, select: { nome: true, quantidade: true } });
    const descricao = `Pedido #${ped.numero} · ${itens.map((i) => `${i.quantidade}x ${i.nome}`).join(', ')}`;
    const v = { config, campoId, origem: 'PEDIDO' as const, pedidoId: ped.id, pagadorNome: comprador.nome };
    const ref = `sc:pedido:${ped.id}`;
    if (metodo === 'PIX') {
      const r = await cobrarPix(api, v, customer, ped.total, descricao, ref);
      return { pedidoNumero: ped.numero, cobrancaId: r.cobrancaId, status: r.status, valor: r.valor, pix: r.pix };
    }
    await prisma.appV3Pedido.update({ where: { id: ped.id }, data: { metodo: 'CARTAO' } });
    const pg = await api.cobrancas.criar({ customer, billingType: 'UNDEFINED', value: ped.total, dueDate: hojeBR(), description: descricao.slice(0, 500), externalReference: ref });
    const cob = await registrar(v, pg);
    return { pedidoNumero: ped.numero, cobrancaId: cob.id, status: estadoDe(cob.status), valor: n2(cob.valor), invoiceUrl: pg.invoiceUrl ?? null };
  } catch (e) {
    // Falhou ao cobrar: devolve as vagas e cancela o pedido, para não prender ingresso.
    await prisma.$transaction([
      prisma.appV3Pedido.update({ where: { id: ped.id }, data: { status: 'CANCELADO' } }),
      ...(await cancelarIngressosDoPedido(ped.id)),
    ]).catch(() => undefined);
    throw e;
  }
}

/** Status para a tela "aguardando pagamento" do site (id da cobrança é o segredo). */
export async function statusSite(cobrancaId: string) {
  let c = await prisma.asaasCobranca.findUnique({ where: { id: cobrancaId } });
  if (!c || !(c.pedidoId || c.penielInscricaoId)) throw new Recusado('Pagamento não encontrado.');
  if (estadoDe(c.status) === 'PENDENTE' && Date.now() - c.updatedAt.getTime() > 4_000) {
    const config = await prisma.asaasConfig.findUniqueOrThrow({ where: { id: c.configId } });
    c = await atualizarDoAsaas(apiDaConfig(config), c.asaasPaymentId).catch(() => c!);
  }
  const estado = estadoDe(c.status);
  const pago = estado === 'PAGO';
  const [ped, ingressos, inscricao] = await Promise.all([
    c.pedidoId ? prisma.appV3Pedido.findUnique({ where: { id: c.pedidoId }, select: { numero: true, status: true } }) : null,
    pago && c.pedidoId ? prisma.appV3Ingresso.findMany({ where: { pedidoId: c.pedidoId }, select: { codigo: true, rotulo: true, status: true } }) : [],
    pago && c.penielInscricaoId ? prisma.penielRegistration.findUnique({ where: { id: c.penielInscricaoId }, select: { checkInCode: true, qrCodeUrl: true, nome: true } }) : null,
  ]);
  return {
    status: estado, valor: n2(c.valor), invoiceUrl: c.invoiceUrl,
    pedidoNumero: ped ? Number(ped.numero) : null, pedidoStatus: ped?.status ?? null,
    ingressos, peniel: inscricao,
  };
}

// ── Peniel ─────────────────────────────────────────────────────────────────

/**
 * Pagamento da inscrição do Peniel pelo Asaas. A inscrição é identificada pelo
 * id + código de check-in (os dois juntos, como na consulta pública).
 */
export async function pagarPeniel(corpo: Record<string, unknown>) {
  const reg = await prisma.penielRegistration.findFirst({
    where: { id: String(corpo.inscricaoId ?? ''), checkInCode: String(corpo.codigo ?? '').toUpperCase(), deletedAt: null },
    include: { event: true },
  });
  if (!reg) throw new Recusado('Inscrição não encontrada.');
  if (['pago', 'gratuito'].includes(reg.paymentStatus)) throw new Recusado('Esta inscrição já está paga.');
  const valor = n2(reg.event.value);
  if (valor <= 0) throw new Recusado('Este encontro é gratuito.');
  const cpf = soDigitos(corpo.cpf);
  if (!cpfValido(cpf)) throw new Recusado('CPF inválido.');
  const metodo = corpo.metodo === 'CARTAO' ? 'CARTAO' : 'PIX';
  const { config, api } = await configDoCampo(reg.event.campoId);

  // Pix ainda aberto desta inscrição: devolve o mesmo.
  const aberta = await prisma.asaasCobranca.findFirst({ where: { penielInscricaoId: reg.id, status: 'PENDING' }, orderBy: { createdAt: 'desc' } });
  if (aberta && ((metodo === 'PIX' && aberta.forma === 'PIX' && aberta.pixPayload) || (metodo === 'CARTAO' && aberta.forma === 'UNDEFINED'))) {
    const qr = aberta.forma === 'PIX' ? await api.cobrancas.pix(aberta.asaasPaymentId).catch(() => null) : null;
    return { cobrancaId: aberta.id, status: 'PENDENTE', valor: n2(aberta.valor), invoiceUrl: aberta.invoiceUrl, ...(qr ? { pix: { payload: qr.payload, imagem: qr.encodedImage, expira: qr.expirationDate ?? null } } : {}) };
  }

  const pessoa: Pessoa = { perfilId: null, memberId: null, campoId: reg.event.campoId, churchId: null, nome: reg.nome, cpf, email: String(corpo.email ?? ''), celular: soDigitos(reg.celular), cep: '', numero: '' };
  const customer = await garantirCliente(api, config, pessoa);
  const descricao = `${reg.event.title} · inscrição de ${reg.nome} · ${reg.checkInCode}`;
  const v = { config, campoId: reg.event.campoId, origem: 'PENIEL' as const, penielInscricaoId: reg.id, pagadorNome: reg.nome };
  const ref = `sc:peniel:${reg.id}`;
  if (metodo === 'PIX') {
    return cobrarPix(api, v, customer, valor, descricao, ref);
  }
  const pg = await api.cobrancas.criar({ customer, billingType: 'UNDEFINED', value: valor, dueDate: hojeBR(), description: descricao.slice(0, 500), externalReference: ref });
  const cob = await registrar(v, pg);
  return { cobrancaId: cob.id, status: estadoDe(cob.status), valor: n2(cob.valor), invoiceUrl: pg.invoiceUrl ?? null };
}

/** O campo da inscrição tem Asaas ativo? (o modal decide entre pagar agora ou o fluxo antigo). */
export async function penielTemAsaas(eventId: string) {
  const ev = await prisma.penielEvent.findUnique({ where: { id: eventId }, select: { campoId: true } });
  if (!ev) return false;
  return Boolean(await prisma.asaasConfig.findFirst({ where: { campoId: ev.campoId, deletedAt: null, ativo: true }, select: { id: true } }));
}
