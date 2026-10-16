/**
 * Regras de pagamento Asaas ↔ App Igreja v3.
 *
 * - Quem paga é o perfil do app (appv3_perfis) e, se vinculado, o membro
 *   (members): CPF, e-mail, celular, CEP e número vêm do cadastro do membro.
 * - O que se paga já existe no app: contribuição (appv3_contribuicoes) ou
 *   pedido da loja/ingressos (appv3_pedidos). A cobrança (asaas_cobrancas)
 *   aponta para eles e `aplicarNoApp` leva o status do Asaas até eles —
 *   os gatilhos do app (appv3_alerta_status) avisam a pessoa.
 * - Pagamento só vale confirmado pelo Asaas (webhook ou consulta à API).
 * - Dados do cartão passam direto para o Asaas; aqui fica só bandeira, final
 *   e o token (quando a conta tem tokenização liberada).
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { cancelarIngressosDoPedido } from '@/lib/mobile/recursosServidor';
import { AsaasErro, hojeBR, soDigitos, type CartaoAsaas, type ClienteAsaas, type PagamentoAsaas, type TitularAsaas } from './api';
import type { ConfigAsaas } from './config';

export class FaltaDado extends Error {
  constructor(public campos: string[]) {
    super(`Complete: ${campos.join(', ')}`);
  }
}
export class Recusado extends Error {}

/** Estado do pagamento do ponto de vista do app. */
export type Estado = 'PAGO' | 'PENDENTE' | 'VENCIDO' | 'CANCELADO' | 'ESTORNADO' | 'RECUSADO';

const PAGOS = ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH', 'DUNNING_RECEIVED'];

export function estadoDe(status: string): Estado {
  if (PAGOS.includes(status)) return 'PAGO';
  if (status === 'REFUNDED') return 'ESTORNADO';
  if (status === 'OVERDUE') return 'VENCIDO';
  if (status === 'DELETED') return 'CANCELADO';
  if (status === 'REPROVED_BY_RISK_ANALYSIS' || status === 'CAPTURE_REFUSED') return 'RECUSADO';
  // Chargeback / estorno em andamento: o dinheiro entrou; o painel mostra o status cru.
  if (status.startsWith('CHARGEBACK') || status.startsWith('REFUND') || status === 'AWAITING_CHARGEBACK_REVERSAL') return 'PAGO';
  return 'PENDENTE';
}

export const n2 = (v: Prisma.Decimal | number | string | null | undefined) => Math.round(Number(v ?? 0) * 100) / 100;

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// ── Pagador ────────────────────────────────────────────────────────────────

export interface Pessoa {
  perfilId: string | null;
  memberId: string | null;
  campoId: string;
  churchId: string | null;
  nome: string;
  cpf: string;
  email: string;
  celular: string;
  cep: string;
  numero: string;
}

export interface ExtrasTitular { cpf?: string; cep?: string; numero?: string; nome?: string; email?: string }

export async function pessoaDoPerfil(perfilId: string, extras: ExtrasTitular = {}): Promise<Pessoa> {
  const p = await prisma.appV3Perfil.findUnique({
    where: { id: perfilId },
    select: {
      id: true, campoId: true, churchId: true, memberId: true, nome: true, celular: true, email: true,
      member: { select: { fullName: true, cpf: true, email: true, mobile: true, phone: true, addressZipcode: true, addressNumber: true } },
    },
  });
  if (!p) throw new Error('Perfil não encontrado.');
  const anterior = await prisma.asaasCliente.findFirst({ where: { perfilId }, orderBy: { updatedAt: 'desc' }, select: { cpfCnpj: true } });
  return {
    perfilId: p.id,
    memberId: p.memberId,
    campoId: p.campoId,
    churchId: p.churchId,
    nome: (extras.nome || p.member?.fullName || p.nome || '').trim(),
    cpf: soDigitos(extras.cpf || p.member?.cpf || anterior?.cpfCnpj),
    email: (extras.email || p.email || p.member?.email || '').trim(),
    celular: soDigitos(p.celular || p.member?.mobile || p.member?.phone),
    cep: soDigitos(extras.cep || p.member?.addressZipcode),
    numero: String(extras.numero || p.member?.addressNumber || '').trim(),
  };
}

export const cpfValido = (cpf: string) => cpf.length === 11 || cpf.length === 14;

/** O que falta para cobrar no cartão (o Asaas exige o titular completo). */
export function faltaParaCartao(p: Pessoa): string[] {
  const f: string[] = [];
  if (!cpfValido(p.cpf)) f.push('cpf');
  if (p.cep.length !== 8) f.push('cep');
  if (!p.numero) f.push('numero');
  if (!p.email) f.push('email');
  return f;
}

/** Cliente do Asaas para a pessoa: reaproveita o salvo, depois o do Asaas pelo CPF, senão cria. */
export async function garantirCliente(api: ClienteAsaas, config: ConfigAsaas, p: Pessoa): Promise<string> {
  if (!cpfValido(p.cpf)) throw new FaltaDado(['cpf']);
  const local = await prisma.asaasCliente.findFirst({
    where: { configId: config.id, OR: [...(p.perfilId ? [{ perfilId: p.perfilId }] : []), { cpfCnpj: p.cpf }] },
    orderBy: { updatedAt: 'desc' },
  });
  if (local && local.cpfCnpj === p.cpf) {
    if (p.perfilId && !local.perfilId) await prisma.asaasCliente.update({ where: { id: local.id }, data: { perfilId: p.perfilId, memberId: p.memberId } });
    return local.asaasCustomerId;
  }
  const remoto = (await api.clientes.porCpf(p.cpf)).data.find((c) => !c.deleted);
  const id = remoto?.id ?? (await api.clientes.criar({
    name: p.nome || 'Contribuinte',
    cpfCnpj: p.cpf,
    email: p.email || undefined,
    mobilePhone: p.celular || undefined,
    externalReference: p.perfilId ? `sc:perfil:${p.perfilId}` : undefined,
    // O app mostra o Pix e avisa; e-mail/SMS do Asaas ficariam em dobro (e SMS é cobrado).
    notificationDisabled: true,
  })).id;
  await prisma.asaasCliente.upsert({
    where: { configId_asaasCustomerId: { configId: config.id, asaasCustomerId: id } },
    create: { configId: config.id, perfilId: p.perfilId, memberId: p.memberId, asaasCustomerId: id, nome: p.nome || 'Contribuinte', cpfCnpj: p.cpf, email: p.email || null, celular: p.celular || null },
    update: { perfilId: p.perfilId ?? undefined, memberId: p.memberId ?? undefined, cpfCnpj: p.cpf },
  });
  return id;
}

function titularDe(p: Pessoa, nomeCartao: string): TitularAsaas {
  return {
    name: nomeCartao || p.nome,
    email: p.email,
    cpfCnpj: p.cpf,
    postalCode: p.cep,
    addressNumber: p.numero,
    ...(p.celular ? { mobilePhone: p.celular } : {}),
  };
}

// ── Cartão vindo do app ───────────────────────────────────────────────────

export interface CartaoDoApp { numero?: string; nome?: string; validade?: string; cvv?: string; salvoId?: string; salvar?: boolean }

export async function meioDoCartao(perfilId: string, c: CartaoDoApp, p: Pessoa) {
  if (c.salvoId) {
    const salvo = await prisma.appV3Cartao.findFirst({ where: { id: c.salvoId, perfilId, gateway: 'ASAAS' } });
    if (!salvo) throw new Recusado('Cartão salvo não encontrado. Use outro cartão.');
    return { campos: { creditCardToken: salvo.gatewayToken }, validade: salvo.validade, salvar: false };
  }
  const numero = soDigitos(c.numero);
  const [mes, ano] = String(c.validade ?? '').split('/').map((s) => soDigitos(s));
  if (numero.length < 13 || !mes || !ano || soDigitos(c.cvv).length < 3 || !c.nome?.trim()) throw new Recusado('Confira os dados do cartão.');
  const falta = faltaParaCartao(p);
  if (falta.length) throw new FaltaDado(falta);
  const cartao: CartaoAsaas = {
    holderName: c.nome.trim(),
    number: numero,
    expiryMonth: mes.padStart(2, '0'),
    expiryYear: ano.length === 2 ? `20${ano}` : ano,
    ccv: soDigitos(c.cvv),
  };
  return {
    campos: { creditCard: cartao, creditCardHolderInfo: titularDe(p, c.nome.trim()) },
    validade: `${cartao.expiryMonth}/${cartao.expiryYear.slice(-2)}`,
    salvar: Boolean(c.salvar),
  };
}

async function guardarCartao(perfilId: string, r: PagamentoAsaas['creditCard'], validade: string) {
  if (!r?.creditCardToken) return; // tokenização não liberada na conta: nada a guardar
  const final = String(r.creditCardNumber ?? '').slice(-4);
  const ja = await prisma.appV3Cartao.findFirst({ where: { perfilId, gateway: 'ASAAS', final, validade } });
  if (ja) {
    await prisma.appV3Cartao.update({ where: { id: ja.id }, data: { gatewayToken: r.creditCardToken } });
    return;
  }
  await prisma.appV3Cartao.create({
    data: { perfilId, gateway: 'ASAAS', gatewayToken: r.creditCardToken, final, validade, bandeira: bandeiraLegivel(r.creditCardBrand) },
  });
}

export function bandeiraLegivel(b?: string | null) {
  const m: Record<string, string> = { VISA: 'Visa', MASTERCARD: 'Mastercard', ELO: 'Elo', AMEX: 'Amex', HIPERCARD: 'Hipercard', DINERS: 'Diners', DISCOVER: 'Discover' };
  return b ? m[b] ?? b : 'Cartão';
}

function erroCartao(e: unknown): never {
  if (e instanceof AsaasErro && e.status === 400) {
    throw new Recusado(e.message && !/transa/i.test(e.message) ? e.message : 'O banco não autorizou o pagamento. Verifique os dados do cartão ou use outro.');
  }
  throw e;
}

// ── Registro local da cobrança ────────────────────────────────────────────

export interface Vinculo {
  config: ConfigAsaas;
  campoId: string;
  churchId?: string | null;
  perfilId?: string | null;
  memberId?: string | null;
  origem: 'CONTRIBUICAO' | 'PEDIDO' | 'ASSINATURA' | 'AVULSA' | 'LINK' | 'PENIEL' | 'DEPTO';
  contribuicaoId?: string | null;
  pedidoId?: string | null;
  assinaturaId?: string | null;
  linkId?: string | null;
  penielInscricaoId?: string | null;
  pagadorNome?: string | null;
  criadoPor?: string | null;
}

export async function registrar(v: Vinculo, pg: PagamentoAsaas, extra: { pixPayload?: string; pixExpira?: Date | null; validade?: string } = {}) {
  const pago = PAGOS.includes(pg.status);
  const dados = {
    status: pg.deleted ? 'DELETED' : pg.status,
    forma: pg.billingType,
    valorLiquido: pg.netValue ?? undefined,
    invoiceUrl: pg.invoiceUrl ?? undefined,
    asaasInstallmentId: pg.installment ?? undefined,
    vencimento: pg.dueDate ? new Date(`${pg.dueDate}T12:00:00Z`) : undefined,
    ...(pg.creditCard?.creditCardNumber ? { cartaoFinal: String(pg.creditCard.creditCardNumber).slice(-4), cartaoBandeira: bandeiraLegivel(pg.creditCard.creditCardBrand) } : {}),
    ...(extra.pixPayload ? { pixPayload: extra.pixPayload, pixExpira: extra.pixExpira ?? null } : {}),
    ...(pago ? { pagoEm: new Date(pg.clientPaymentDate || pg.paymentDate || pg.confirmedDate ? `${pg.clientPaymentDate || pg.paymentDate || pg.confirmedDate}T12:00:00-03:00` : Date.now()) } : {}),
    ...(pg.status === 'REFUNDED' ? { estornadoEm: new Date() } : {}),
    dados: pg as unknown as Prisma.InputJsonValue,
  };
  const cob = await prisma.asaasCobranca.upsert({
    where: { asaasPaymentId: pg.id },
    update: dados,
    create: {
      ...dados,
      configId: v.config.id,
      campoId: v.campoId,
      churchId: v.churchId ?? null,
      perfilId: v.perfilId ?? null,
      memberId: v.memberId ?? null,
      origem: v.origem,
      contribuicaoId: v.contribuicaoId ?? null,
      pedidoId: v.pedidoId ?? null,
      assinaturaId: v.assinaturaId ?? null,
      linkId: v.linkId ?? null,
      penielInscricaoId: v.penielInscricaoId ?? null,
      pagadorNome: v.pagadorNome ?? null,
      criadoPor: v.criadoPor ?? null,
      asaasPaymentId: pg.id,
      asaasCustomerId: pg.customer,
      valor: pg.installmentCount && pg.installmentCount > 1 ? pg.value * pg.installmentCount : pg.value,
      parcelas: pg.installmentCount ?? 1,
      descricao: pg.description?.slice(0, 255) ?? null,
    },
  });
  await aplicarNoApp(cob.id);
  return cob;
}

/** Atualiza a cobrança local a partir do Asaas (usado no polling e no reprocessamento). */
export async function atualizarDoAsaas(api: ClienteAsaas, asaasPaymentId: string) {
  const antes = await prisma.asaasCobranca.findUniqueOrThrow({ where: { asaasPaymentId } });
  const pg = await api.cobrancas.obter(asaasPaymentId);
  const status = pg.deleted ? 'DELETED' : pg.status;
  const cob = await prisma.asaasCobranca.update({
    where: { id: antes.id },
    data: {
      status,
      forma: pg.billingType,
      valorLiquido: pg.netValue ?? undefined,
      // Preserva a data original do pagamento.
      ...(PAGOS.includes(status) && !antes.pagoEm ? { pagoEm: new Date() } : {}),
      ...(status === 'REFUNDED' && !antes.estornadoEm ? { estornadoEm: new Date() } : {}),
      dados: pg as unknown as Prisma.InputJsonValue,
    },
  });
  await aplicarNoApp(cob.id);
  return cob;
}

/**
 * Leva o status da cobrança para a contribuição/pedido/assinatura do app.
 * Idempotente: chamar duas vezes (CONFIRMED e depois RECEIVED) não repete efeito.
 */
export async function aplicarNoApp(cobrancaId: string) {
  const c = await prisma.asaasCobranca.findUnique({ where: { id: cobrancaId } });
  if (!c) return;
  const e = estadoDe(c.status);

  if (c.contribuicaoId) {
    const alvo =
      e === 'PAGO' ? 'CONFIRMADA'
      : e === 'RECUSADO' ? 'RECUSADA'
      : e === 'ESTORNADO' || e === 'CANCELADO' ? 'CANCELADA'
      // Pix avulso vencido não será mais pago; mensalidade vencida continua em aberto para pagar.
      : e === 'VENCIDO' && c.origem !== 'ASSINATURA' ? 'CANCELADA'
      : null;
    if (alvo) {
      const cartaoDesc = c.cartaoFinal ? `${c.cartaoBandeira ?? 'Cartão'} •••• ${c.cartaoFinal}` : undefined;
      await prisma.appV3Contribuicao.updateMany({
        where: { id: c.contribuicaoId, status: { not: alvo } },
        data: {
          status: alvo,
          confirmadoEm: alvo === 'CONFIRMADA' ? c.pagoEm ?? new Date() : null,
          ...(c.forma === 'CREDIT_CARD' || c.forma === 'DEBIT_CARD' ? { metodo: 'CARTAO', cartaoDesc } : {}),
        },
      });
    }
  }

  if (c.pedidoId) {
    const ped = await prisma.appV3Pedido.findUnique({ where: { id: c.pedidoId }, select: { id: true, status: true, pagoEm: true } });
    if (ped) {
      const aguardando = ['AGUARDANDO_PAGAMENTO', 'AGUARDANDO_CONFERENCIA'].includes(ped.status);
      if (e === 'PAGO' && aguardando) {
        await prisma.$transaction([
          prisma.appV3Pedido.update({
            where: { id: ped.id },
            data: { status: 'PAGO', pagoEm: ped.pagoEm ?? c.pagoEm ?? new Date(), gatewayRef: c.asaasPaymentId, metodo: c.forma === 'PIX' ? 'PIX' : 'CARTAO', parcelas: c.parcelas },
          }),
          prisma.appV3Ingresso.updateMany({ where: { pedidoId: ped.id, status: 'AGUARDANDO_PAGAMENTO' }, data: { status: 'ATIVO' } }),
        ]);
      } else if ((e === 'VENCIDO' || e === 'CANCELADO') && aguardando) {
        // Só cancela se não houver outra cobrança viva/paga para o mesmo pedido (ex.: tentou Pix e pagou no cartão).
        const outra = await prisma.asaasCobranca.findFirst({ where: { pedidoId: ped.id, id: { not: c.id }, status: { notIn: ['OVERDUE', 'DELETED', 'REFUNDED'] } } });
        if (!outra) {
          await prisma.$transaction([
            prisma.appV3Pedido.update({ where: { id: ped.id }, data: { status: 'CANCELADO' } }),
            ...(await cancelarIngressosDoPedido(ped.id)),
          ]);
        }
      } else if (e === 'ESTORNADO' && ['PAGO', 'EM_SEPARACAO', 'ENTREGUE', 'REEMBOLSO_SOLICITADO'].includes(ped.status)) {
        await prisma.$transaction([
          prisma.appV3Pedido.update({ where: { id: ped.id }, data: { status: 'REEMBOLSADO' } }),
          prisma.appV3Reembolso.updateMany({ where: { pedidoId: ped.id, status: { in: ['SOLICITADO', 'APROVADO'] } }, data: { status: 'PAGO' } }),
          ...(await cancelarIngressosDoPedido(ped.id)),
        ]);
      }
    }
  }

  // Sites de departamento: o registro vem da referência externa (sc:dept-pedido:<id> / sc:dept-inscricao:<id>).
  const refExterna = String((c.dados as Record<string, unknown> | null)?.externalReference ?? '');
  const dept = /^sc:dept-(pedido|inscricao):([0-9a-f-]{36})$/.exec(refExterna);
  if (dept) {
    const alvo = e === 'PAGO' ? 'PAGO' : e === 'ESTORNADO' ? 'ESTORNADO' : e === 'CANCELADO' || e === 'VENCIDO' ? 'PENDENTE' : null;
    if (alvo && dept[1] === 'pedido') {
      await prisma.$executeRaw`update public.department_orders set payment_status = ${alvo}, payment_ref = ${c.id}, updated_at = now() where id = ${dept[2]}::uuid and payment_status <> ${alvo}`;
    }
    if (alvo && dept[1] === 'inscricao') {
      const mudou = await prisma.$executeRaw`update public.department_event_registrations set payment_status = ${alvo}, payment_ref = ${c.id}, updated_at = now() where id = ${dept[2]}::uuid and payment_status <> ${alvo}`;
      if (mudou && alvo === 'PAGO') {
        // Pago: reenvia o ingresso (QR) pelo WhatsApp, agora como confirmado.
        const { enviarIngressoDepartamento } = await import('@/lib/departmentTicket');
        await enviarIngressoDepartamento(dept[2]).catch((err) => console.error('[asaas dept ingresso]', err));
      }
    }
  }

  if (c.penielInscricaoId) {
    // Peniel: pago → vaga garantida e ingresso (QR) pelo WhatsApp, uma vez só.
    const alvo = e === 'PAGO' ? 'pago' : e === 'ESTORNADO' ? 'estornado' : null;
    if (alvo) {
      const mudou = await prisma.penielRegistration.updateMany({
        where: { id: c.penielInscricaoId, paymentStatus: { notIn: [alvo, 'gratuito'] } },
        data: { paymentStatus: alvo },
      });
      if (mudou.count && alvo === 'pago') {
        const { sendTicketWhatsApp } = await import('@/lib/penielTicket');
        await sendTicketWhatsApp(c.penielInscricaoId).catch((err) => console.error('[asaas peniel ticket]', err));
      }
    }
  }

  if (c.assinaturaId) {
    if (e === 'PAGO') await prisma.asaasAssinatura.updateMany({ where: { id: c.assinaturaId, status: 'INADIMPLENTE' }, data: { status: 'ATIVA' } });
    if (e === 'VENCIDO') await prisma.asaasAssinatura.updateMany({ where: { id: c.assinaturaId, status: 'ATIVA' }, data: { status: 'INADIMPLENTE' } });
  }
}

// ── Cobranças do app ──────────────────────────────────────────────────────

async function qrPix(api: ClienteAsaas, id: string) {
  // O QR pode levar um instante para existir logo após criar a cobrança.
  for (let i = 0; i < 3; i++) {
    try {
      return await api.cobrancas.pix(id);
    } catch (e) {
      if (i === 2) throw e;
      await new Promise((ok) => setTimeout(ok, 700));
    }
  }
  throw new Error('QR Pix indisponível.');
}

export interface ResultadoPix { cobrancaId: string; status: Estado; valor: number; pix: { payload: string; imagem: string; expira: string | null } }

export async function cobrarPix(api: ClienteAsaas, v: Vinculo, customer: string, valor: number, descricao: string, ref: string): Promise<ResultadoPix> {
  const pg = await api.cobrancas.criar({
    customer, billingType: 'PIX', value: n2(valor), dueDate: hojeBR(), description: descricao.slice(0, 500), externalReference: ref,
  });
  const qr = await qrPix(api, pg.id);
  const expira = qr.expirationDate ? new Date(qr.expirationDate.replace(' ', 'T') + '-03:00') : null;
  const cob = await registrar(v, pg, { pixPayload: qr.payload, pixExpira: expira });
  return { cobrancaId: cob.id, status: estadoDe(cob.status), valor: n2(cob.valor), pix: { payload: qr.payload, imagem: qr.encodedImage, expira: expira?.toISOString() ?? null } };
}

export interface ResultadoCartao { cobrancaId: string; status: Estado; valor: number; cartao: { bandeira: string; final: string } | null; autorizacao: string }

export async function cobrarCartao(
  api: ClienteAsaas, v: Vinculo, customer: string, valor: number, parcelas: number, descricao: string, ref: string,
  meio: Awaited<ReturnType<typeof meioDoCartao>>, remoteIp: string,
): Promise<ResultadoCartao> {
  const base = { customer, billingType: 'CREDIT_CARD', dueDate: hojeBR(), description: descricao.slice(0, 500), externalReference: ref, remoteIp, ...meio.campos };
  const corpo = parcelas > 1 ? { ...base, installmentCount: parcelas, totalValue: n2(valor) } : { ...base, value: n2(valor) };
  let pg: PagamentoAsaas;
  try {
    pg = await api.cobrancas.criar(corpo);
  } catch (e) {
    erroCartao(e);
  }
  const cob = await registrar(v, pg, { validade: meio.validade });
  if (meio.salvar && v.perfilId) await guardarCartao(v.perfilId, pg.creditCard, meio.validade).catch(() => undefined);
  return {
    cobrancaId: cob.id,
    status: estadoDe(cob.status),
    valor: n2(cob.valor),
    cartao: cob.cartaoFinal ? { bandeira: cob.cartaoBandeira ?? 'Cartão', final: cob.cartaoFinal } : null,
    autorizacao: pg.id,
  };
}

/** Pix ainda aberto da mesma contribuição/pedido: devolve o mesmo QR em vez de criar outro. */
export async function pixAberto(api: ClienteAsaas, where: { contribuicaoId?: string; pedidoId?: string }, valor: number): Promise<ResultadoPix | null> {
  const c = await prisma.asaasCobranca.findFirst({
    where: { ...where, forma: 'PIX', status: 'PENDING', pixPayload: { not: null } },
    orderBy: { createdAt: 'desc' },
  });
  if (!c || n2(c.valor) !== n2(valor) || (c.pixExpira && c.pixExpira.getTime() < Date.now() + 60_000)) return null;
  const qr = await qrPix(api, c.asaasPaymentId).catch(() => null);
  if (!qr) return null;
  return { cobrancaId: c.id, status: 'PENDENTE', valor: n2(c.valor), pix: { payload: qr.payload, imagem: qr.encodedImage, expira: c.pixExpira?.toISOString() ?? null } };
}

// ── Assinaturas (dízimo/oferta mensal) ────────────────────────────────────

export const ROTULO_CICLO: Record<string, string> = {
  WEEKLY: 'semanal', BIWEEKLY: 'quinzenal', MONTHLY: 'mensal', BIMONTHLY: 'bimestral', QUARTERLY: 'trimestral', SEMIANNUALLY: 'semestral', YEARLY: 'anual',
};

/**
 * Cria a contribuição do app para uma cobrança gerada pela assinatura. Usa a
 * mesma numeração de autenticação do app (appv3_codigo) para o comprovante.
 */
export async function contribuicaoDaMensalidade(assinaturaId: string, pg: PagamentoAsaas): Promise<string | null> {
  const a = await prisma.asaasAssinatura.findUnique({ where: { id: assinaturaId } });
  if (!a?.perfilId) return null;
  const venc = pg.dueDate ? new Date(`${pg.dueDate}T12:00:00Z`) : new Date();
  const nomeTipo = a.tipo === 'OFERTA' ? 'Oferta' : 'Dízimo';
  const descricao = `${nomeTipo} ${ROTULO_CICLO[a.ciclo] ?? 'recorrente'} · ${MESES[venc.getUTCMonth()]}`.slice(0, 120);
  const prefixo = a.tipo === 'OFERTA' ? 'OF' : 'DZ';
  const metodo = pg.billingType === 'PIX' ? 'PIX' : 'CARTAO';
  const cartaoDesc = metodo === 'CARTAO' && a.cartaoFinal ? `${a.cartaoBandeira ?? 'Cartão'} •••• ${a.cartaoFinal}` : null;
  const linhas = await prisma.$queryRaw<{ id: string }[]>`
    insert into public.appv3_contribuicoes (perfil_id, campo_id, church_id, member_id, tipo, valor, descricao, metodo, cartao_desc, autenticacao)
    values (${a.perfilId}::uuid, ${a.campoId}::uuid, ${a.churchId}::uuid, ${a.memberId}::uuid, ${a.tipo}, ${n2(pg.value)}, ${descricao},
            ${metodo}, ${cartaoDesc}, public.appv3_codigo(${prefixo}))
    returning id`;
  const id = linhas[0]?.id ?? null;
  if (id) await prisma.$executeRaw`update public.appv3_contribuicoes set pix_txid = replace(autenticacao, '-', '') where id = ${id}::uuid`;
  return id;
}

/** Aviso no sino do app quando a mensalidade em Pix é gerada (o Asaas não notifica: notificationDisabled). */
export async function avisarPixDaMensalidade(perfilId: string, valor: number, tipo: string) {
  const nome = tipo === 'OFERTA' ? 'oferta' : 'dízimo';
  await prisma.$executeRaw`select public.appv3_alertar(${perfilId}::uuid, 'ORDER', ${`Pix do seu ${nome} mensal`},
    ${`O Pix de ${valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} já está disponível. Toque para pagar.`}, 'contribuicoes')`.catch(() => undefined);
}

/** Registra no banco uma cobrança que chegou pela assinatura (webhook ou criação). */
export async function registrarMensalidade(api: ClienteAsaas, config: ConfigAsaas, assinaturaId: string, pg: PagamentoAsaas, avisar: boolean) {
  const ja = await prisma.asaasCobranca.findUnique({ where: { asaasPaymentId: pg.id } });
  if (ja) return ja;
  const a = await prisma.asaasAssinatura.findUniqueOrThrow({ where: { id: assinaturaId } });
  const contribuicaoId = await contribuicaoDaMensalidade(assinaturaId, pg);
  let extra: { pixPayload?: string; pixExpira?: Date | null } = {};
  if (pg.billingType === 'PIX' && pg.status === 'PENDING') {
    const qr = await qrPix(api, pg.id).catch(() => null);
    if (qr) extra = { pixPayload: qr.payload, pixExpira: qr.expirationDate ? new Date(qr.expirationDate.replace(' ', 'T') + '-03:00') : null };
  }
  const cob = await registrar(
    { config, campoId: a.campoId, churchId: a.churchId, perfilId: a.perfilId, memberId: a.memberId, origem: 'ASSINATURA', assinaturaId, contribuicaoId },
    pg, extra,
  );
  if (avisar && a.perfilId && pg.billingType === 'PIX' && pg.status === 'PENDING') await avisarPixDaMensalidade(a.perfilId, pg.value, a.tipo);
  return cob;
}

export function proximaData(diaDoMes: number | undefined): string {
  if (!diaDoMes) return hojeBR();
  const hoje = hojeBR();
  const [a, m, d] = hoje.split('-').map(Number);
  if (diaDoMes === d) return hoje;
  const alvo = diaDoMes > d ? new Date(Date.UTC(a, m - 1, diaDoMes)) : new Date(Date.UTC(a, m, diaDoMes));
  return alvo.toISOString().slice(0, 10);
}
