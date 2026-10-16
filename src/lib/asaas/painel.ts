/**
 * Consultas e ações do menu Pagamentos (painel). Toda função recebe o campo já
 * resolvido pela rota (campoDoPainel: campo ativo, master inclusive) e, para
 * secretário/tesoureiro de igreja, a igreja a que ele está restrito.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AsaasErro, ambienteDaChave, EVENTOS_WEBHOOK, hojeBR, soDigitos, type AmbienteAsaas, type FormaAsaas } from './api';
import { apiDaConfig, cifrar, configDoCampo, decifrar, novoTokenWebhook, SemAsaas, urlPublica } from './config';
import { atualizarDoAsaas, cobrarPix, estadoDe, garantirCliente, n2, Recusado, registrar, type Pessoa } from './servico';
import { processar, type EventoAsaas } from './webhook';

export interface Escopo { campoId: string; igreja: string | null; userId: string | null; master: boolean }

const ROTULO_FORMA: Record<string, string> = { PIX: 'Pix', CREDIT_CARD: 'Crédito', DEBIT_CARD: 'Débito', BOLETO: 'Boleto', UNDEFINED: 'A escolher' };

function whereCobranca(e: Escopo): Prisma.AsaasCobrancaWhereInput {
  return { campoId: e.campoId, ...(e.igreja ? { churchId: e.igreja } : {}) };
}

function inicioDoDiaBR(somaDias = 0) {
  return new Date(`${hojeBR(somaDias)}T00:00:00-03:00`);
}

// ── Visão geral ────────────────────────────────────────────────────────────
/** Período (de/até, AAAA-MM-DD, fuso de Brasília) da querystring; padrão: últimos 30 dias. */
export function periodoDe(sp: URLSearchParams, diasPadrao = 29) {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const de = iso.test(sp.get('de') ?? '') ? sp.get('de')! : hojeBR(-diasPadrao);
  const ate = iso.test(sp.get('ate') ?? '') ? sp.get('ate')! : hojeBR();
  return { de, ate, gte: new Date(`${de}T00:00:00-03:00`), lte: new Date(`${ate}T23:59:59.999-03:00`) };
}

export async function resumo(e: Escopo, sp: URLSearchParams) {
  const w = whereCobranca(e);
  const hoje = inicioDoDiaBR();
  const per = periodoDe(sp);
  const noPeriodo = { gte: per.gte, lte: per.lte };
  const pagos = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'];

  const [hojeAgg, mesAgg, aReceber, pendentes, ultimas, ult30, porForma, assinaturas, config] = await Promise.all([
    prisma.asaasCobranca.aggregate({ where: { ...w, status: { in: pagos }, pagoEm: { gte: hoje } }, _sum: { valor: true }, _count: true }),
    prisma.asaasCobranca.aggregate({ where: { ...w, status: { in: pagos }, pagoEm: noPeriodo }, _sum: { valor: true, valorLiquido: true }, _count: true }),
    prisma.asaasCobranca.aggregate({ where: { ...w, status: 'CONFIRMED' }, _sum: { valorLiquido: true, valor: true }, _count: true }),
    prisma.asaasCobranca.aggregate({ where: { ...w, status: { in: ['PENDING', 'OVERDUE'] } }, _sum: { valor: true }, _count: true }),
    prisma.asaasCobranca.findMany({ where: { ...w, createdAt: noPeriodo }, orderBy: { createdAt: 'desc' }, take: 2000 }),
    prisma.asaasCobranca.findMany({ where: { ...w, status: { in: pagos }, pagoEm: noPeriodo }, select: { valor: true, pagoEm: true } }),
    prisma.asaasCobranca.groupBy({ by: ['forma'], where: { ...w, status: { in: pagos }, pagoEm: noPeriodo }, _sum: { valor: true }, _count: true }),
    prisma.asaasAssinatura.groupBy({ by: ['status'], where: { campoId: e.campoId, ...(e.igreja ? { churchId: e.igreja } : {}) }, _sum: { valor: true }, _count: true }),
    prisma.asaasConfig.findFirst({ where: { campoId: e.campoId, deletedAt: null } }),
  ]);

  // Um ponto por dia do período (até 366).
  const dias = new Map<string, number>();
  for (let d = new Date(`${per.de}T12:00:00Z`), n = 0; d <= new Date(`${per.ate}T12:00:00Z`) && n < 366; d = new Date(d.getTime() + 86_400_000), n++) {
    dias.set(d.toISOString().slice(0, 10), 0);
  }
  for (const c of ult30) {
    const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(c.pagoEm!);
    if (dias.has(d)) dias.set(d, n2((dias.get(d) ?? 0) + n2(c.valor)));
  }

  let saldo: number | null = null;
  let erroSaldo: string | null = null;
  if (config?.ativo && !e.igreja) {
    try {
      saldo = (await apiDaConfig(config).financeiro.saldo()).balance;
    } catch (err) {
      erroSaldo = (err as Error).message;
    }
  }
  const ativa = assinaturas.find((a) => a.status === 'ATIVA');
  return {
    configurado: Boolean(config),
    ativo: Boolean(config?.ativo),
    ambiente: config?.ambiente ?? null,
    recebidoHoje: n2(hojeAgg._sum.valor),
    de: per.de,
    ate: per.ate,
    recebidoMes: n2(mesAgg._sum.valor),
    liquidoMes: n2(mesAgg._sum.valorLiquido),
    qtdMes: mesAgg._count,
    ticketMedio: mesAgg._count ? n2(n2(mesAgg._sum.valor) / mesAgg._count) : 0,
    aReceber: n2(aReceber._sum.valorLiquido ?? aReceber._sum.valor),
    qtdAReceber: aReceber._count,
    pendentes: n2(pendentes._sum.valor),
    qtdPendentes: pendentes._count,
    saldo,
    erroSaldo,
    recorrenteMensal: n2(ativa?._sum.valor),
    assinaturas: Object.fromEntries(assinaturas.map((a) => [a.status, a._count])),
    porDia: [...dias.entries()].map(([dia, valor]) => ({ dia, valor })),
    porForma: porForma.map((f) => ({ forma: f.forma, rotulo: ROTULO_FORMA[f.forma] ?? f.forma, valor: n2(f._sum.valor), qtd: f._count })),
    ultimas: ultimas.map(linhaCobranca),
  };
}

// ── Vendas / contribuições ─────────────────────────────────────────────────
export function linhaCobranca(c: Prisma.AsaasCobrancaGetPayload<object>) {
  return {
    id: c.id,
    asaasPaymentId: c.asaasPaymentId,
    origem: c.origem,
    forma: c.forma,
    formaRotulo: ROTULO_FORMA[c.forma] ?? c.forma,
    status: c.status,
    estado: estadoDe(c.status),
    valor: n2(c.valor),
    valorLiquido: c.valorLiquido === null ? null : n2(c.valorLiquido),
    taxa: c.valorLiquido === null ? null : n2(n2(c.valor) - n2(c.valorLiquido)),
    valorEstornado: n2(c.valorEstornado),
    parcelas: c.parcelas,
    descricao: c.descricao,
    pagadorNome: c.pagadorNome,
    perfilId: c.perfilId,
    memberId: c.memberId,
    contribuicaoId: c.contribuicaoId,
    pedidoId: c.pedidoId,
    assinaturaId: c.assinaturaId,
    linkId: c.linkId,
    invoiceUrl: c.invoiceUrl,
    cartao: c.cartaoFinal ? `${c.cartaoBandeira ?? 'Cartão'} •••• ${c.cartaoFinal}` : null,
    vencimento: c.vencimento?.toISOString().slice(0, 10) ?? null,
    pagoEm: c.pagoEm,
    estornadoEm: c.estornadoEm,
    criadoEm: c.createdAt,
  };
}

export async function listarCobrancas(e: Escopo, sp: URLSearchParams) {
  const pagina = Math.max(1, Number(sp.get('pagina')) || 1);
  // tudo=1: o período inteiro (a tabela da tela ordena, pagina e exporta).
  const tamanho = sp.get('tudo') ? 5000 : Math.min(200, Math.max(10, Number(sp.get('tamanho')) || 30));
  const where: Prisma.AsaasCobrancaWhereInput = { ...whereCobranca(e) };
  const de = sp.get('de');
  const ate = sp.get('ate');
  if (de || ate) where.createdAt = { ...(de ? { gte: new Date(`${de}T00:00:00-03:00`) } : {}), ...(ate ? { lte: new Date(`${ate}T23:59:59-03:00`) } : {}) };
  const estado = sp.get('estado');
  if (estado === 'PAGO') where.status = { in: ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'] };
  else if (estado === 'PENDENTE') where.status = 'PENDING';
  else if (estado === 'VENCIDO') where.status = 'OVERDUE';
  else if (estado === 'ESTORNADO') where.status = 'REFUNDED';
  else if (estado === 'CANCELADO') where.status = 'DELETED';
  if (sp.get('forma')) where.forma = sp.get('forma')!;
  if (sp.get('origem')) where.origem = sp.get('origem')!;
  if (sp.get('assinaturaId')) where.assinaturaId = sp.get('assinaturaId')!;
  if (sp.get('linkId')) where.linkId = sp.get('linkId')!;
  const q = (sp.get('q') ?? '').trim();
  if (q) where.OR = [{ pagadorNome: { contains: q, mode: 'insensitive' } }, { descricao: { contains: q, mode: 'insensitive' } }, { asaasPaymentId: q }];

  // Finalidade: DIZIMO | OFERTA (contribuição do app, recorrência ou link com essa finalidade) | LOJA (pedido) | OUTRA.
  const fin = sp.get('finalidade');
  if (fin === 'DIZIMO' || fin === 'OFERTA') {
    const ids = await prisma.$queryRaw<{ id: string }[]>`
      select c.id from public.asaas_cobrancas c
        join public.appv3_contribuicoes x on x.id = c.contribuicao_id
       where c.campo_id = ${e.campoId}::uuid and x.tipo = ${fin}`;
    where.AND = [{ OR: [{ id: { in: ids.map((i) => i.id) } }, { assinatura: { tipo: fin } }, { link: { finalidade: fin } }] }];
  } else if (fin === 'LOJA') {
    where.pedidoId = { not: null };
  } else if (fin === 'OUTRA') {
    where.AND = [{ contribuicaoId: null, pedidoId: null, assinaturaId: null }, { OR: [{ linkId: null }, { link: { finalidade: { notIn: ['DIZIMO', 'OFERTA'] } } }] }];
  }

  const [total, linhas, soma] = await Promise.all([
    prisma.asaasCobranca.count({ where }),
    prisma.asaasCobranca.findMany({
      where, orderBy: { createdAt: 'desc' }, skip: (pagina - 1) * tamanho, take: tamanho,
      include: { assinatura: { select: { tipo: true } }, link: { select: { finalidade: true, nome: true } } },
    }),
    prisma.asaasCobranca.aggregate({ where, _sum: { valor: true, valorLiquido: true } }),
  ]);
  const contribIds = linhas.map((l) => l.contribuicaoId).filter((x): x is string => Boolean(x));
  const tipos = new Map(
    (contribIds.length ? await prisma.appV3Contribuicao.findMany({ where: { id: { in: contribIds } }, select: { id: true, tipo: true } }) : []).map((c) => [c.id, c.tipo]),
  );
  const ROT: Record<string, string> = { DIZIMO: 'Dízimo', OFERTA: 'Oferta', CAMPANHA: 'Campanha', EVENTO: 'Evento', OUTRO: 'Outro' };
  return {
    total, pagina, tamanho, somaValor: n2(soma._sum.valor), somaLiquido: n2(soma._sum.valorLiquido),
    linhas: linhas.map((l) => {
      const tipo = (l.contribuicaoId && tipos.get(l.contribuicaoId)) || l.assinatura?.tipo || l.link?.finalidade || null;
      const finalidade = tipo ? ROT[tipo] ?? tipo : l.pedidoId ? 'Loja/ingresso' : l.origem === 'AVULSA' ? 'Cobrança avulsa' : 'Outro';
      return { ...linhaCobranca(l), finalidade, linkNome: l.link?.nome ?? null };
    }),
  };
}

async function minhaCobranca(e: Escopo, id: string) {
  const c = await prisma.asaasCobranca.findFirst({ where: { id, ...whereCobranca(e) } });
  if (!c) throw new Recusado('Cobrança não encontrada neste campo.');
  return c;
}

export async function detalheCobranca(e: Escopo, id: string) {
  const c = await minhaCobranca(e, id);
  const [eventos, contribuicao, pedido, perfil] = await Promise.all([
    prisma.$queryRaw<{ id: string; evento: string; recebido_em: Date; erro: string | null; status: string | null }[]>`
      select id, evento, recebido_em, erro, payload->'payment'->>'status' as status
        from public.asaas_webhook_eventos
       where payload->'payment'->>'id' = ${c.asaasPaymentId}
       order by recebido_em`,
    c.contribuicaoId ? prisma.appV3Contribuicao.findUnique({ where: { id: c.contribuicaoId }, select: { tipo: true, status: true, autenticacao: true, descricao: true } }) : null,
    c.pedidoId ? prisma.appV3Pedido.findUnique({ where: { id: c.pedidoId }, select: { numero: true, status: true, itens: { select: { nome: true, quantidade: true, total: true } } } }) : null,
    c.perfilId ? prisma.appV3Perfil.findUnique({ where: { id: c.perfilId }, select: { nome: true, email: true, celular: true, memberId: true } }) : null,
  ]);
  return {
    ...linhaCobranca(c),
    eventos,
    contribuicao,
    pedido: pedido ? { ...pedido, numero: Number(pedido.numero), itens: pedido.itens.map((i) => ({ ...i, total: n2(i.total) })) } : null,
    perfil,
  };
}

export async function estornar(e: Escopo, id: string, valor?: number) {
  const c = await minhaCobranca(e, id);
  if (estadoDe(c.status) !== 'PAGO') throw new Recusado('Só dá para estornar o que já foi pago.');
  const { api } = await configDoCampo(e.campoId, false);
  const parcial = valor && valor > 0 && valor < n2(c.valor) ? n2(valor) : undefined;
  if (c.asaasInstallmentId && parcial) throw new Recusado('Parcelamento só aceita estorno total.');
  const pg = await api.cobrancas.estornar(c.asaasPaymentId, parcial, 'Estorno pelo painel');
  await prisma.asaasCobranca.update({ where: { id: c.id }, data: { valorEstornado: { increment: parcial ?? n2(c.valor) } } });
  return linhaCobranca(await registrar({ config: (await configDoCampo(e.campoId, false)).config, campoId: c.campoId, origem: 'AVULSA' }, pg));
}

export async function cancelar(e: Escopo, id: string) {
  const c = await minhaCobranca(e, id);
  if (!['PENDING', 'OVERDUE'].includes(c.status)) throw new Recusado('Só cobranças em aberto podem ser canceladas. Para o que foi pago, use Estornar.');
  const { api } = await configDoCampo(e.campoId, false);
  await api.cobrancas.cancelar(c.asaasPaymentId);
  await prisma.asaasCobranca.update({ where: { id: c.id }, data: { status: 'DELETED' } });
  const { aplicarNoApp } = await import('./servico');
  await aplicarNoApp(c.id);
  return linhaCobranca(await prisma.asaasCobranca.findUniqueOrThrow({ where: { id: c.id } }));
}

export async function recebidaEmDinheiro(e: Escopo, id: string) {
  const c = await minhaCobranca(e, id);
  if (!['PENDING', 'OVERDUE'].includes(c.status)) throw new Recusado('Esta cobrança não está em aberto.');
  const { api, config } = await configDoCampo(e.campoId, false);
  const pg = await api.cobrancas.recebidaEmDinheiro(c.asaasPaymentId, n2(c.valor), hojeBR());
  return linhaCobranca(await registrar({ config, campoId: c.campoId, origem: 'AVULSA' }, pg));
}

export async function sincronizar(e: Escopo, id: string) {
  const c = await minhaCobranca(e, id);
  const { api } = await configDoCampo(e.campoId, false);
  return linhaCobranca(await atualizarDoAsaas(api, c.asaasPaymentId));
}

export async function pixDaCobranca(e: Escopo, id: string) {
  const c = await minhaCobranca(e, id);
  const { api } = await configDoCampo(e.campoId, false);
  const qr = await api.cobrancas.pix(c.asaasPaymentId);
  return { payload: qr.payload, imagem: qr.encodedImage, expira: qr.expirationDate ?? null };
}

// ── Cobrança rápida (balcão) ───────────────────────────────────────────────
export async function pessoasParaCobrar(e: Escopo, q: string) {
  const termo = q.trim();
  if (termo.length < 2) return [];
  const digitos = soDigitos(termo);
  const membros = await prisma.member.findMany({
    where: {
      deletedAt: null,
      church: { regional: { campoId: e.campoId } },
      ...(e.igreja ? { churchId: e.igreja } : {}),
      OR: [
        { fullName: { contains: termo, mode: 'insensitive' } },
        ...(digitos.length >= 3 ? [{ cpf: { contains: digitos } }] : []),
      ],
    },
    select: { id: true, fullName: true, cpf: true, email: true, mobile: true, churchId: true, church: { select: { name: true } } },
    take: 15,
    orderBy: { fullName: 'asc' },
  });
  return membros.map((m) => ({
    memberId: m.id,
    nome: m.fullName,
    cpfFinal: m.cpf ? soDigitos(m.cpf).slice(-4) : null,
    temCpf: Boolean(m.cpf && [11, 14].includes(soDigitos(m.cpf).length)),
    email: m.email,
    igreja: m.church?.name ?? null,
  }));
}

export async function cobrancaRapida(e: Escopo, corpo: Record<string, unknown>) {
  const { config, api } = await configDoCampo(e.campoId);
  const valor = n2(Number(corpo.valor));
  if (!(valor >= 5)) throw new Recusado('Valor mínimo de R$ 5,00.');
  const forma = (['PIX', 'UNDEFINED', 'CREDIT_CARD', 'BOLETO'].includes(String(corpo.forma)) ? corpo.forma : 'PIX') as FormaAsaas;
  const descricao = String(corpo.descricao || 'Cobrança').slice(0, 200);

  let pessoa: Pessoa;
  if (corpo.memberId) {
    const m = await prisma.member.findFirst({
      where: { id: String(corpo.memberId), deletedAt: null, church: { regional: { campoId: e.campoId } }, ...(e.igreja ? { churchId: e.igreja } : {}) },
      select: { id: true, fullName: true, cpf: true, email: true, mobile: true, churchId: true, addressZipcode: true, addressNumber: true },
    });
    if (!m) throw new Recusado('Membro não encontrado neste campo.');
    const perfil = await prisma.appV3Perfil.findFirst({ where: { memberId: m.id }, select: { id: true } });
    pessoa = {
      perfilId: perfil?.id ?? null, memberId: m.id, campoId: e.campoId, churchId: m.churchId, nome: m.fullName,
      cpf: soDigitos(corpo.cpf || m.cpf), email: m.email ?? '', celular: soDigitos(m.mobile), cep: soDigitos(m.addressZipcode), numero: m.addressNumber ?? '',
    };
  } else {
    pessoa = {
      perfilId: null, memberId: null, campoId: e.campoId, churchId: e.igreja, nome: String(corpo.nome ?? '').trim(),
      cpf: soDigitos(corpo.cpf), email: String(corpo.email ?? ''), celular: soDigitos(corpo.celular), cep: '', numero: '',
    };
    if (!pessoa.nome) throw new Recusado('Informe o nome de quem vai pagar.');
  }
  const customer = await garantirCliente(api, config, pessoa);
  const v = {
    config, campoId: e.campoId, churchId: pessoa.churchId ?? e.igreja, perfilId: pessoa.perfilId, memberId: pessoa.memberId,
    origem: 'AVULSA' as const, pagadorNome: pessoa.nome, criadoPor: e.userId,
  };
  const ref = `sc:avulsa:${e.campoId}:${Date.now()}`;
  if (forma === 'PIX') return cobrarPix(api, v, customer, valor, descricao, ref);

  const parcelas = Math.max(1, Math.min(Number(corpo.parcelas) || 1, 21));
  const base = { customer, billingType: forma, dueDate: hojeBR(Number(corpo.dias) || 0), description: descricao, externalReference: ref };
  const pg = await api.cobrancas.criar(forma === 'CREDIT_CARD' && parcelas > 1 ? { ...base, installmentCount: parcelas, totalValue: valor } : { ...base, value: valor });
  let pix = null;
  if (forma === 'UNDEFINED') {
    const qr = await api.cobrancas.pix(pg.id).catch(() => null);
    if (qr) pix = { payload: qr.payload, imagem: qr.encodedImage, expira: qr.expirationDate ?? null };
  }
  const cob = await registrar(v, pg, pix ? { pixPayload: pix.payload } : {});
  return { cobrancaId: cob.id, status: estadoDe(cob.status), valor: n2(cob.valor), invoiceUrl: pg.invoiceUrl ?? null, pix };
}

// ── Assinaturas ────────────────────────────────────────────────────────────
export async function listarAssinaturas(e: Escopo, sp: URLSearchParams) {
  const where: Prisma.AsaasAssinaturaWhereInput = { campoId: e.campoId, ...(e.igreja ? { churchId: e.igreja } : {}) };
  if (sp.get('status')) where.status = sp.get('status')!;
  if (sp.get('forma')) where.forma = sp.get('forma')!;
  const lista = await prisma.asaasAssinatura.findMany({ where, orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], take: 500 });
  const perfis = await prisma.appV3Perfil.findMany({ where: { id: { in: lista.map((a) => a.perfilId!).filter(Boolean) } }, select: { id: true, nome: true, church: { select: { name: true } } } });
  const pagos = await prisma.asaasCobranca.groupBy({
    by: ['assinaturaId'], where: { assinaturaId: { in: lista.map((a) => a.id) }, status: { in: ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'] } }, _sum: { valor: true }, _count: true,
  });
  return lista.map((a) => {
    const p = perfis.find((x) => x.id === a.perfilId);
    const g = pagos.find((x) => x.assinaturaId === a.id);
    return {
      id: a.id, tipo: a.tipo, valor: n2(a.valor), ciclo: a.ciclo, forma: a.forma, formaRotulo: ROTULO_FORMA[a.forma] ?? a.forma, status: a.status,
      proximo: a.proximoVencimento?.toISOString().slice(0, 10) ?? null, descricao: a.descricao,
      cartao: a.cartaoFinal ? `${a.cartaoBandeira ?? 'Cartão'} •••• ${a.cartaoFinal}` : null,
      pessoa: p?.nome ?? '—', igreja: p?.church?.name ?? null, memberId: a.memberId,
      totalPago: n2(g?._sum.valor), qtdPagas: g?._count ?? 0, criadaEm: a.createdAt, canceladaEm: a.canceladaEm,
    };
  });
}

export async function assinaturaDoEscopo(e: Escopo, id: string) {
  const a = await prisma.asaasAssinatura.findFirst({ where: { id, campoId: e.campoId, ...(e.igreja ? { churchId: e.igreja } : {}) } });
  if (!a) throw new Recusado('Contribuição recorrente não encontrada neste campo.');
  return a;
}

// ── Links de pagamento (ofertas, campanhas, eventos) ──────────────────────
/** Opções do formulário de link: sites de departamento e eventos do campo. */
export async function opcoesLink(e: Escopo) {
  const [sites, eventos] = await Promise.all([
    prisma.$queryRaw<{ id: string; titulo: string; slug: string; status: string }[]>`
      select id, titulo, slug, status from public.department_sites
       where campo_id = ${e.campoId}::uuid and deleted_at is null order by titulo`,
    prisma.appV3Evento.findMany({
      where: { campoId: e.campoId, escopo: 'CAMPO' }, orderBy: { inicio: 'desc' }, take: 200,
      select: { id: true, titulo: true, inicio: true, publicado: true, opcoes: { where: { ativo: true }, select: { preco: true } } },
    }),
  ]);
  return {
    sites,
    eventos: eventos.map((ev) => ({ id: ev.id, titulo: ev.titulo, inicio: ev.inicio, publicado: ev.publicado, menorPreco: ev.opcoes.length ? Math.min(...ev.opcoes.map((o) => n2(o.preco))) : null })),
  };
}

export async function listarLinks(e: Escopo) {
  const links = await prisma.asaasLink.findMany({ where: { campoId: e.campoId }, orderBy: [{ ativo: 'desc' }, { createdAt: 'desc' }] });
  const siteIds = [...new Set(links.map((l) => l.departmentSiteId).filter((x): x is string => Boolean(x)))];
  const eventoIds = [...new Set(links.map((l) => l.eventoId).filter((x): x is string => Boolean(x)))];
  const [sites, eventos] = await Promise.all([
    siteIds.length ? prisma.$queryRaw<{ id: string; titulo: string }[]>`select id, titulo from public.department_sites where id = any(${siteIds}::uuid[])` : [],
    eventoIds.length ? prisma.appV3Evento.findMany({ where: { id: { in: eventoIds } }, select: { id: true, titulo: true } }) : [],
  ]);
  const somas = await prisma.asaasCobranca.groupBy({
    by: ['linkId'], where: { linkId: { in: links.map((l) => l.id) }, status: { in: ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'] } }, _sum: { valor: true }, _count: true,
  });
  return links.map((l) => {
    const s = somas.find((x) => x.linkId === l.id);
    return {
      id: l.id, nome: l.nome, descricao: l.descricao, finalidade: l.finalidade, valor: l.valor === null ? null : n2(l.valor),
      forma: l.forma, tipoCobranca: l.tipoCobranca, maxParcelas: l.maxParcelas, ciclo: l.ciclo, url: l.url, ativo: l.ativo,
      encerraEm: l.encerraEm?.toISOString().slice(0, 10) ?? null, recebido: n2(s?._sum.valor), pagamentos: s?._count ?? 0, criadoEm: l.createdAt,
      departmentSiteId: l.departmentSiteId, departamento: sites.find((x) => x.id === l.departmentSiteId)?.titulo ?? null,
      eventoId: l.eventoId, evento: eventos.find((x) => x.id === l.eventoId)?.titulo ?? null,
    };
  });
}

export async function salvarLink(e: Escopo, corpo: Record<string, unknown>, id?: string) {
  const { config, api } = await configDoCampo(e.campoId);
  const nome = String(corpo.nome ?? '').trim().slice(0, 255);
  if (!nome) throw new Recusado('Dê um nome ao link.');
  const valor = corpo.valor === null || corpo.valor === '' || corpo.valor === undefined ? null : n2(Number(corpo.valor));
  if (valor !== null && !(valor >= 5)) throw new Recusado('Valor mínimo de R$ 5,00 (ou deixe em branco para valor livre).');
  const pix = corpo.pix !== false, credito = corpo.credito !== false, boleto = Boolean(corpo.boleto);
  const n = [pix, credito, boleto].filter(Boolean).length;
  if (!n) throw new Recusado('Marque ao menos uma forma de pagamento.');
  const forma: FormaAsaas = n > 1 ? 'UNDEFINED' : pix ? 'PIX' : credito ? 'CREDIT_CARD' : 'BOLETO';
  const recorrente = corpo.recorrente === true;
  const maxParcelas = credito && !recorrente ? Math.max(1, Math.min(Number(corpo.maxParcelas) || 1, 21)) : 1;
  const tipoCobranca = recorrente ? 'RECURRENT' : maxParcelas > 1 ? 'INSTALLMENT' : 'DETACHED';
  if (recorrente && valor === null) throw new Recusado('Recorrência precisa de valor fixo.');
  const encerraEm = corpo.encerraEm ? String(corpo.encerraEm) : null;
  const dados = {
    name: nome,
    description: String(corpo.descricao ?? '').slice(0, 500) || undefined,
    ...(valor !== null ? { value: valor } : {}),
    billingType: forma,
    chargeType: tipoCobranca,
    ...(tipoCobranca === 'INSTALLMENT' ? { maxInstallmentCount: maxParcelas } : {}),
    ...(recorrente ? { subscriptionCycle: 'MONTHLY' } : {}),
    dueDateLimitDays: 3,
    ...(encerraEm ? { endDate: encerraEm } : {}),
    notificationEnabled: false,
  };
  const finalidade = ['OFERTA', 'DIZIMO', 'CAMPANHA', 'EVENTO', 'OUTRO'].includes(String(corpo.finalidade)) ? String(corpo.finalidade) : 'OFERTA';
  let departmentSiteId: string | null = null;
  let eventoId: string | null = null;
  if (finalidade === 'CAMPANHA') {
    departmentSiteId = String(corpo.departmentSiteId ?? '') || null;
    if (!departmentSiteId) throw new Recusado('Escolha o departamento da campanha.');
    const ok = await prisma.$queryRaw<{ id: string }[]>`select id from public.department_sites where id = ${departmentSiteId}::uuid and campo_id = ${e.campoId}::uuid and deleted_at is null`;
    if (!ok.length) throw new Recusado('Departamento não encontrado neste campo.');
  }
  if (finalidade === 'EVENTO') {
    eventoId = String(corpo.eventoId ?? '') || null;
    if (!eventoId) throw new Recusado('Escolha o evento (ou crie um em Eventos e loja).');
    const ok = await prisma.appV3Evento.findFirst({ where: { id: eventoId, campoId: e.campoId }, select: { id: true } });
    if (!ok) throw new Recusado('Evento não encontrado neste campo.');
  }
  const local = {
    nome, descricao: dados.description ?? null, finalidade, valor, forma, tipoCobranca, maxParcelas, ciclo: recorrente ? 'MONTHLY' : null,
    departmentSiteId, eventoId,
    encerraEm: encerraEm ? new Date(`${encerraEm}T12:00:00Z`) : null,
  };
  if (id) {
    const l = await prisma.asaasLink.findFirst({ where: { id, campoId: e.campoId } });
    if (!l) throw new Recusado('Link não encontrado.');
    const r = await api.links.atualizar(l.asaasLinkId, dados);
    return prisma.asaasLink.update({ where: { id }, data: { ...local, url: r.url ?? l.url } });
  }
  const r = await api.links.criar(dados);
  return prisma.asaasLink.create({ data: { ...local, configId: config.id, campoId: e.campoId, asaasLinkId: r.id, url: r.url, ativo: r.active ?? true, criadoPor: e.userId } });
}

export async function ativarLink(e: Escopo, id: string, ativo: boolean) {
  const l = await prisma.asaasLink.findFirst({ where: { id, campoId: e.campoId } });
  if (!l) throw new Recusado('Link não encontrado.');
  const { api } = await configDoCampo(e.campoId, false);
  await api.links.atualizar(l.asaasLinkId, { active: ativo });
  return prisma.asaasLink.update({ where: { id }, data: { ativo } });
}

// ── Financeiro (conta Asaas inteira) ───────────────────────────────────────
const ROTULO_EXTRATO: Record<string, string> = {
  PAYMENT_RECEIVED: 'Recebimento', PAYMENT_FEE: 'Taxa de cobrança', TRANSFER: 'Transferência', TRANSFER_FEE: 'Taxa de transferência',
  PAYMENT_REFUND_CANCELLED: 'Estorno cancelado', PAYMENT_REVERSAL: 'Estorno', PAYMENT_CUSTODY_BLOCK: 'Bloqueio de custódia',
  PAYMENT_CUSTODY_BLOCK_REVERSAL: 'Desbloqueio de custódia', CHARGEBACK: 'Chargeback', CHARGEBACK_REVERSAL: 'Reversão de chargeback',
  PIX_TRANSACTION_DEBIT: 'Pix enviado', PIX_TRANSACTION_CREDIT: 'Pix recebido', PIX_TRANSACTION_DEBIT_FEE: 'Taxa de Pix',
  NOTIFICATION_FEE: 'Taxa de notificação', PAYMENT_MESSAGING_NOTIFICATION_FEE: 'Taxa de mensageria', INTERNAL_TRANSFER_CREDIT: 'Transferência recebida',
  INTERNAL_TRANSFER_DEBIT: 'Transferência enviada', CREDIT: 'Crédito', DEBIT: 'Débito', PROMOTIONAL_CODE_CREDIT: 'Crédito promocional',
};

export async function financeiro(e: Escopo, sp: URLSearchParams) {
  if (e.igreja) throw new Recusado('O financeiro da conta é visível só para o campo.');
  const { config, api } = await configDoCampo(e.campoId, false);
  const { de, ate } = periodoDe(sp);
  const offset = 0;
  // Extrato do período inteiro (100 por chamada; até 2.000 lançamentos).
  async function extratoTodo() {
    const todos: Awaited<ReturnType<typeof api.financeiro.extrato>>['data'] = [];
    let total = 0;
    let mais = true;
    for (let o = 0; mais && o < 2000; o += 100) {
      const pg = await api.financeiro.extrato(de, ate, o, 100);
      todos.push(...pg.data);
      total = pg.totalCount;
      mais = pg.hasMore;
    }
    return { data: todos, hasMore: mais, totalCount: total };
  }
  const [saldo, aReceber, recebido, extrato, outrosCampos] = await Promise.all([
    api.financeiro.saldo(),
    api.financeiro.estatisticas({ status: 'CONFIRMED' }).catch(() => null),
    api.financeiro.estatisticas({ status: 'RECEIVED', 'paymentDate[ge]': de, 'paymentDate[le]': ate }).catch(() => null),
    extratoTodo(),
    prisma.asaasConfig.count({ where: { deletedAt: null, id: { not: config.id }, apiKeyFinal: config.apiKeyFinal } }),
  ]);
  let entradas = 0, saidas = 0, taxas = 0;
  for (const t of extrato.data) {
    if (t.value >= 0) entradas += t.value;
    else saidas += t.value;
    if (/FEE/.test(t.type)) taxas += t.value;
  }
  // Confirmado e ainda não liquidado, agrupado pela data prevista de crédito (cobranças deste campo).
  const confirmadas = await prisma.asaasCobranca.findMany({ where: { campoId: e.campoId, status: 'CONFIRMED' }, select: { valor: true, valorLiquido: true, dados: true } });
  const porData = new Map<string, number>();
  for (const c of confirmadas) {
    const d = String((c.dados as Record<string, unknown> | null)?.estimatedCreditDate ?? 'sem data');
    porData.set(d, n2((porData.get(d) ?? 0) + n2(c.valorLiquido ?? c.valor)));
  }
  return {
    ambiente: config.ambiente,
    contaNome: config.contaNome,
    compartilhada: outrosCampos > 0,
    saldo: saldo.balance,
    aReceber: aReceber ? { qtd: aReceber.quantity, valor: aReceber.value, liquido: aReceber.netValue } : null,
    recebidoPeriodo: recebido ? { qtd: recebido.quantity, valor: recebido.value, liquido: recebido.netValue } : null,
    aReceberPorData: [...porData.entries()].sort().map(([data, valor]) => ({ data, valor })),
    de, ate, offset,
    totais: { entradas: n2(entradas), saidas: n2(saidas), taxas: n2(taxas) },
    extrato: {
      hasMore: extrato.hasMore,
      totalCount: extrato.totalCount,
      linhas: extrato.data.map((t) => ({ ...t, rotulo: ROTULO_EXTRATO[t.type] ?? t.type })),
    },
  };
}

// ── Configuração ───────────────────────────────────────────────────────────
function mostrarConfig(c: Awaited<ReturnType<typeof prisma.asaasConfig.findFirst>>, urlWebhook: string) {
  if (!c) return { configurado: false, urlWebhook };
  return {
    configurado: true,
    id: c.id,
    campoId: c.campoId,
    ambiente: c.ambiente,
    chave: c.apiKeyFinal ? `•••• ${c.apiKeyFinal}` : '••••',
    contaNome: c.contaNome,
    contaDocumento: c.contaDocumento,
    ativo: c.ativo,
    pixAtivo: c.pixAtivo,
    cartaoAtivo: c.cartaoAtivo,
    recorrenciaAtiva: c.recorrenciaAtiva,
    maxParcelas: c.maxParcelas,
    webhookRegistrado: Boolean(c.webhookId),
    ultimoEventoEm: c.ultimoEventoEm,
    urlWebhook,
  };
}

export async function lerConfig(e: Escopo, req: Request) {
  const c = await prisma.asaasConfig.findFirst({ where: { campoId: e.campoId, deletedAt: null } });
  const campo = await prisma.campo.findUnique({ where: { id: e.campoId }, select: { name: true } });
  const eventos = c
    ? await prisma.asaasWebhookEvento.findMany({ where: { configId: c.id }, orderBy: { recebidoEm: 'desc' }, take: 30, select: { id: true, evento: true, recebidoEm: true, processadoEm: true, ignorado: true, erro: true } })
    : [];
  return { ...mostrarConfig(c, `${urlPublica(req)}/api/asaas/webhook`), campoNome: campo?.name ?? null, eventos };
}

export async function salvarConfig(e: Escopo, corpo: Record<string, unknown>) {
  const atual = await prisma.asaasConfig.findFirst({ where: { campoId: e.campoId } });
  const chave = String(corpo.apiKey ?? '').trim();
  let dadosChave = {};
  if (chave) {
    const ambiente = ambienteDaChave(chave);
    if (!ambiente) throw new Recusado('Chave inválida: ela começa com $aact_prod_ (produção) ou $aact_hmlg_ (sandbox).');
    const { clienteAsaas } = await import('./api');
    let conta;
    try {
      conta = await clienteAsaas(chave, ambiente).conta();
    } catch (err) {
      throw new Recusado(`O Asaas não aceitou a chave: ${(err as Error).message}`);
    }
    dadosChave = { apiKeyEnc: cifrar(chave), apiKeyFinal: chave.slice(-6), ambiente, contaNome: conta.name ?? null, contaDocumento: conta.cpfCnpj ?? null, ...(atual && atual.apiKeyFinal !== chave.slice(-6) ? { webhookId: null, webhookTokenEnc: null } : {}) };
  } else if (!atual) {
    throw new Recusado('Cole a chave de API do Asaas.');
  }
  const opcoes = {
    ...(corpo.ativo !== undefined ? { ativo: Boolean(corpo.ativo) } : {}),
    ...(corpo.pixAtivo !== undefined ? { pixAtivo: Boolean(corpo.pixAtivo) } : {}),
    ...(corpo.cartaoAtivo !== undefined ? { cartaoAtivo: Boolean(corpo.cartaoAtivo) } : {}),
    ...(corpo.recorrenciaAtiva !== undefined ? { recorrenciaAtiva: Boolean(corpo.recorrenciaAtiva) } : {}),
    ...(corpo.maxParcelas !== undefined ? { maxParcelas: Math.max(1, Math.min(Number(corpo.maxParcelas) || 1, 12)) } : {}),
  };
  if (atual) {
    await prisma.asaasConfig.update({ where: { id: atual.id }, data: { ...dadosChave, ...opcoes, deletedAt: null } });
  } else {
    await prisma.asaasConfig.create({ data: { campoId: e.campoId, createdBy: e.userId, ...(dadosChave as { apiKeyEnc: string }), ...opcoes } });
  }
  return prisma.asaasConfig.findFirstOrThrow({ where: { campoId: e.campoId } });
}

export async function testarConexao(e: Escopo) {
  const { api, config } = await configDoCampo(e.campoId, false);
  const [conta, saldo, chaves, webhooks] = await Promise.all([
    api.conta(),
    api.financeiro.saldo(),
    api.pixChaves().catch(() => null),
    api.webhooks.listar().catch(() => null),
  ]);
  await prisma.asaasConfig.update({ where: { id: config.id }, data: { contaNome: conta.name ?? null, contaDocumento: conta.cpfCnpj ?? null } });
  return {
    ok: true,
    conta: { nome: conta.name, documento: conta.cpfCnpj, status: conta.status, tipo: conta.personType },
    saldo: saldo.balance,
    chavesPix: chaves?.data.map((k) => ({ tipo: k.type, chave: k.key })) ?? [],
    webhooks: webhooks?.data.map((w) => ({ id: w.id, nome: w.name, url: w.url, ativo: w.enabled, interrompido: w.interrupted })) ?? [],
  };
}

function enderecoLocal(url: string) {
  return /\/\/(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url);
}

export async function registrarWebhook(e: Escopo, req: Request, email: string) {
  const { api, config } = await configDoCampo(e.campoId, false);
  const url = `${urlPublica(req)}/api/asaas/webhook`;
  if (enderecoLocal(url)) throw new Recusado('O painel está aberto em um endereço local: o Asaas não consegue avisar aqui. Abra pelo endereço real da igreja para registrar o webhook.');
  // Outra config da mesma conta e do mesmo deploy já registrou: reaproveita o token.
  const irma = await prisma.asaasConfig.findFirst({ where: { id: { not: config.id }, apiKeyFinal: config.apiKeyFinal, webhookId: { not: null }, webhookTokenEnc: { not: null }, deletedAt: null } });
  const existentes = (await api.webhooks.listar()).data;
  const mesmo = existentes.find((w) => w.url === url);
  if (irma && mesmo && irma.webhookId === mesmo.id) {
    await prisma.asaasConfig.update({ where: { id: config.id }, data: { webhookId: irma.webhookId, webhookTokenEnc: irma.webhookTokenEnc } });
    return { ok: true, url, reaproveitado: true };
  }
  const token = novoTokenWebhook();
  const corpo = {
    name: 'saaschurch - pagamentos', url, email, enabled: true, interrupted: false, apiVersion: 3,
    authToken: token, sendType: 'SEQUENTIALLY', events: EVENTOS_WEBHOOK,
  };
  const r = mesmo ? await api.webhooks.atualizar(mesmo.id, corpo) : await api.webhooks.criar(corpo);
  // Todas as configs desta conta neste banco passam a usar o mesmo token.
  await prisma.asaasConfig.updateMany({
    where: { OR: [{ id: config.id }, { apiKeyFinal: config.apiKeyFinal, deletedAt: null }] },
    data: { webhookId: r.id ?? mesmo?.id, webhookTokenEnc: cifrar(token) },
  });
  return { ok: true, url, id: r.id ?? mesmo?.id };
}

export interface Passo { passo: string; ok: boolean; aviso?: boolean; detalhe: string }

/**
 * Assistente "Configurar": a igreja informa os dados da instituição e a chave
 * da PRÓPRIA conta Asaas (criada e aprovada) e o sistema faz o resto —
 * valida, confere titular e CNPJ, salva criptografado, liga as formas de
 * pagamento e registra o webhook. Devolve o checklist de cada passo.
 */
export async function configurarConta(e: Escopo, req: Request, corpo: Record<string, unknown>) {
  const passos: Passo[] = [];
  const nome = String(corpo.nome ?? '').trim();
  const documento = soDigitos(corpo.documento);
  const email = String(corpo.email ?? '').trim();
  const chave = String(corpo.apiKey ?? '').trim();
  if (nome.length < 3) throw new Recusado('Informe o nome da instituição (como está no Asaas).');
  if (![11, 14].includes(documento.length)) throw new Recusado('Informe o CNPJ (ou CPF) do titular da conta Asaas.');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Recusado('Informe um e-mail para os avisos do Asaas.');
  const ambiente = ambienteDaChave(chave);
  if (!ambiente) throw new Recusado('Chave inválida: ela começa com $aact_prod_ (produção) ou $aact_hmlg_ (sandbox).');

  // 1. Conta
  const { clienteAsaas } = await import('./api');
  const api = clienteAsaas(chave, ambiente);
  let conta;
  try {
    conta = await api.conta();
  } catch (err) {
    throw new Recusado(`O Asaas não aceitou a chave: ${(err as Error).message}`);
  }
  passos.push({ passo: 'Chave de API', ok: true, detalhe: `Aceita pelo Asaas (${ambiente === 'production' ? 'produção' : 'sandbox'}).` });

  const status = String(conta.status ?? '');
  if (status && status !== 'APPROVED') {
    passos.push({ passo: 'Conta aprovada', ok: false, detalhe: `A conta está "${status}" no Asaas. Termine o cadastro e aguarde a aprovação antes de configurar.` });
    return { ok: false, passos };
  }
  passos.push({ passo: 'Conta aprovada', ok: true, detalhe: `${conta.name ?? ''} · aprovada.` });

  // 2. Titular confere com o informado
  const docConta = soDigitos(conta.cpfCnpj);
  if (docConta && docConta !== documento) {
    passos.push({ passo: 'Titular', ok: false, detalhe: `Esta chave é da conta ${conta.name ?? ''} (${conta.cpfCnpj}), não do documento informado. Gere a chave na conta da própria igreja.` });
    return { ok: false, passos };
  }
  const nomeConfere = (conta.name ?? '').toLowerCase().includes(nome.toLowerCase().split(' ')[0]);
  passos.push({ passo: 'Titular', ok: true, aviso: !nomeConfere, detalhe: nomeConfere ? `CNPJ/CPF confere: ${conta.cpfCnpj}.` : `CNPJ/CPF confere, mas o nome no Asaas é "${conta.name}".` });

  // 3. Chave Pix (sem ela, o Pix não funciona)
  const chavesPix = await api.pixChaves().catch(() => null);
  const temPix = Boolean(chavesPix?.data.length);
  passos.push({ passo: 'Chave Pix', ok: temPix, aviso: !temPix, detalhe: temPix ? chavesPix!.data.map((k) => `${k.type} ${k.key}`).join(', ') : 'Nenhuma chave Pix na conta: cadastre uma no app do Asaas. Até lá, só cartão.' });

  // 4. Salva (criptografado) e liga as formas de pagamento
  await salvarConfig(e, { apiKey: chave, ativo: true, pixAtivo: temPix, cartaoAtivo: true, recorrenciaAtiva: true });
  passos.push({ passo: 'Configuração salva', ok: true, detalhe: `Chave criptografada; ${temPix ? 'Pix, ' : ''}cartão e recorrência ligados.` });

  // 5. Webhook (confirmação automática)
  try {
    const w = await registrarWebhook(e, req, email);
    passos.push({ passo: 'Webhook', ok: true, detalhe: `Registrado em ${w.url}. Avisos de falha vão para ${email}.` });
  } catch (err) {
    passos.push({ passo: 'Webhook', ok: false, aviso: true, detalhe: (err as Error).message });
  }

  // 6. Teste final
  try {
    const t = await testarConexao(e);
    passos.push({ passo: 'Teste de conexão', ok: true, detalhe: `Saldo ${t.saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}. Pronto para receber.` });
  } catch (err) {
    passos.push({ passo: 'Teste de conexão', ok: false, detalhe: (err as Error).message });
  }
  return { ok: passos.every((x) => x.ok || x.aviso), passos };
}

/** Master: em quais campos esta mesma conta Asaas recebe. */
export async function camposDaConta(e: Escopo) {
  if (!e.master) throw new Recusado('Só o master escolhe os campos.');
  const [campos, configs] = await Promise.all([
    prisma.campo.findMany({ where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.asaasConfig.findMany({ where: { deletedAt: null }, select: { campoId: true, ativo: true, apiKeyFinal: true, contaNome: true, ambiente: true } }),
  ]);
  const atual = configs.find((c) => c.campoId === e.campoId);
  return campos.map((c) => {
    const cfg = configs.find((x) => x.campoId === c.id);
    return {
      campoId: c.id, nome: c.name, atual: c.id === e.campoId,
      configurado: Boolean(cfg), ativo: Boolean(cfg?.ativo), contaNome: cfg?.contaNome ?? null, ambiente: cfg?.ambiente ?? null,
      mesmaConta: Boolean(cfg && atual && cfg.apiKeyFinal === atual.apiKeyFinal),
    };
  });
}

/** Master: liga/desliga a conta do campo atual em outro campo (copia a chave e o webhook). */
export async function aplicarContaNoCampo(e: Escopo, campoDestino: string, ativo: boolean) {
  if (!e.master) throw new Recusado('Só o master escolhe os campos.');
  const origem = await prisma.asaasConfig.findFirst({ where: { campoId: e.campoId, deletedAt: null } });
  if (!origem) throw new Recusado('Configure a conta neste campo primeiro.');
  const destino = await prisma.campo.findFirst({ where: { id: campoDestino, deletedAt: null }, select: { id: true } });
  if (!destino) throw new Recusado('Campo não encontrado.');
  if (destino.id === e.campoId) return prisma.asaasConfig.update({ where: { id: origem.id }, data: { ativo } });
  const atual = await prisma.asaasConfig.findFirst({ where: { campoId: destino.id } });
  const copia = {
    apiKeyEnc: origem.apiKeyEnc, apiKeyFinal: origem.apiKeyFinal, ambiente: origem.ambiente, webhookTokenEnc: origem.webhookTokenEnc, webhookId: origem.webhookId,
    contaNome: origem.contaNome, contaDocumento: origem.contaDocumento, pixAtivo: origem.pixAtivo, cartaoAtivo: origem.cartaoAtivo,
    recorrenciaAtiva: origem.recorrenciaAtiva, maxParcelas: origem.maxParcelas, ativo, deletedAt: null,
  };
  if (atual) {
    // Desligar não apaga a chave de outra conta que o campo já tenha.
    if (!ativo) return prisma.asaasConfig.update({ where: { id: atual.id }, data: { ativo: false } });
    return prisma.asaasConfig.update({ where: { id: atual.id }, data: copia });
  }
  if (!ativo) return null;
  return prisma.asaasConfig.create({ data: { ...copia, campoId: destino.id, createdBy: e.userId } });
}

/**
 * Ao salvar a chave, o master marca em quais campos ela vale: os marcados
 * recebem a mesma conta (ligada); os que usavam esta conta e foram
 * desmarcados são desligados. Campo com outra conta não marcado fica como está.
 */
export async function aplicarNosCampos(e: Escopo, campos: unknown) {
  if (!Array.isArray(campos) || !e.master) return;
  const marcados = new Set(campos.map(String));
  const atual = await prisma.asaasConfig.findFirst({ where: { campoId: e.campoId, deletedAt: null } });
  if (!atual) return;
  for (const id of marcados) await aplicarContaNoCampo(e, id, true);
  const desmarcar = await prisma.asaasConfig.findMany({
    where: { deletedAt: null, ativo: true, apiKeyFinal: atual.apiKeyFinal, campoId: { notIn: [...marcados] } },
    select: { campoId: true },
  });
  for (const c of desmarcar) await aplicarContaNoCampo(e, c.campoId, false);
}

export async function reprocessarEvento(e: Escopo, id: string) {
  const ev = await prisma.asaasWebhookEvento.findUnique({ where: { id } });
  const config = await prisma.asaasConfig.findFirst({ where: { campoId: e.campoId, deletedAt: null } });
  if (!ev || !config || ev.configId !== config.id) throw new Recusado('Evento não encontrado.');
  try {
    const r = await processar(ev.payload as unknown as EventoAsaas, [config]);
    await prisma.asaasWebhookEvento.update({ where: { id }, data: { processadoEm: new Date(), erro: null, ignorado: r === 'ignorado' } });
    return { ok: true, resultado: r };
  } catch (err) {
    await prisma.asaasWebhookEvento.update({ where: { id }, data: { erro: String((err as Error).message).slice(0, 2000) } });
    throw new Recusado(`Falhou de novo: ${(err as Error).message}`);
  }
}

export { AsaasErro, SemAsaas, decifrar };
export type { AmbienteAsaas };
