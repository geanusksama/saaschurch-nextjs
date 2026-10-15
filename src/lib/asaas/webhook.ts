/**
 * Processamento dos eventos do webhook do Asaas.
 *
 * Como achar o dono do evento (a mesma conta pode servir outros sistemas):
 * 1. payment.id já registrado em asaas_cobrancas;
 * 2. payment.subscription de uma assinatura nossa → mensalidade nova;
 * 3. payment.installment de um parcelamento nosso → demais parcelas (só log);
 * 4. payment.paymentLink de um link nosso → pagamento pelo link;
 * 5. externalReference "sc:..." sem registro ainda → erro (reprocessável): a
 *    cobrança foi criada aqui, mas o evento chegou antes de gravarmos.
 * Fora disso o evento não é deste sistema: fica como ignorado.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { AssinaturaAsaas, PagamentoAsaas } from './api';
import { apiDaConfig, type ConfigAsaas } from './config';
import { registrar, registrarMensalidade } from './servico';

export interface EventoAsaas {
  id: string;
  event: string;
  dateCreated?: string;
  payment?: PagamentoAsaas;
  subscription?: AssinaturaAsaas;
}

export type Resultado = 'processado' | 'ignorado';

export async function processar(ev: EventoAsaas, configs: ConfigAsaas[]): Promise<Resultado> {
  if (ev.payment) return processarPagamento(ev, configs);
  if (ev.subscription) return processarAssinatura(ev);
  return 'ignorado';
}

async function processarPagamento(ev: EventoAsaas, configs: ConfigAsaas[]): Promise<Resultado> {
  const pg = { ...ev.payment!, deleted: ev.payment!.deleted || ev.event === 'PAYMENT_DELETED' };

  const cob = await prisma.asaasCobranca.findUnique({ where: { asaasPaymentId: pg.id } });
  if (cob) {
    const config = configs.find((c) => c.id === cob.configId) ?? (await prisma.asaasConfig.findUniqueOrThrow({ where: { id: cob.configId } }));
    await registrar({ config, campoId: cob.campoId, origem: cob.origem as 'AVULSA' }, pg);
    return 'processado';
  }

  if (pg.subscription) {
    const a = await prisma.asaasAssinatura.findUnique({ where: { asaasSubscriptionId: pg.subscription } });
    if (a) {
      const config = await prisma.asaasConfig.findUniqueOrThrow({ where: { id: a.configId } });
      await registrarMensalidade(apiDaConfig(config), config, a.id, pg, ev.event === 'PAYMENT_CREATED');
      return 'processado';
    }
  }

  if (pg.installment) {
    const irma = await prisma.asaasCobranca.findFirst({ where: { asaasInstallmentId: pg.installment } });
    // Demais parcelas do mesmo cartão: a primeira já representa o pagamento inteiro.
    if (irma) return 'processado';
  }

  if (pg.paymentLink) {
    const link = await prisma.asaasLink.findUnique({ where: { asaasLinkId: pg.paymentLink } });
    if (link) {
      const config = await prisma.asaasConfig.findUniqueOrThrow({ where: { id: link.configId } });
      const api = apiDaConfig(config);
      const cliente = await api.clientes.obter(pg.customer).catch(() => null);
      const local = await prisma.asaasCliente.findFirst({ where: { configId: config.id, asaasCustomerId: pg.customer } });
      await registrar(
        { config, campoId: link.campoId, origem: 'LINK', linkId: link.id, perfilId: local?.perfilId, memberId: local?.memberId, pagadorNome: cliente?.name ?? null },
        pg,
      );
      return 'processado';
    }
  }

  if (pg.externalReference?.startsWith('sc:')) throw new Error('Cobrança deste sistema ainda não registrada; reprocessar.');
  return 'ignorado';
}

async function processarAssinatura(ev: EventoAsaas): Promise<Resultado> {
  const s = ev.subscription!;
  const a = await prisma.asaasAssinatura.findUnique({ where: { asaasSubscriptionId: s.id } });
  if (!a) return 'ignorado';
  const data: Prisma.AsaasAssinaturaUpdateInput = {
    valor: s.value,
    ciclo: s.cycle,
    forma: s.billingType,
    proximoVencimento: s.nextDueDate ? new Date(`${s.nextDueDate}T12:00:00Z`) : undefined,
    descricao: s.description?.slice(0, 255),
  };
  if (ev.event === 'SUBSCRIPTION_DELETED' || s.deleted) Object.assign(data, { status: 'CANCELADA', canceladaEm: a.canceladaEm ?? new Date() });
  else if (s.status === 'INACTIVE' || ev.event === 'SUBSCRIPTION_INACTIVATED') Object.assign(data, { status: 'PAUSADA' });
  else if (s.status === 'ACTIVE' && a.status === 'PAUSADA') Object.assign(data, { status: 'ATIVA' });
  else if (s.status === 'EXPIRED') Object.assign(data, { status: 'CANCELADA', canceladaEm: a.canceladaEm ?? new Date() });
  await prisma.asaasAssinatura.update({ where: { id: a.id }, data });
  return 'processado';
}
