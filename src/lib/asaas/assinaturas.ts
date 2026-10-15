/**
 * Ações sobre a contribuição recorrente (assinatura Asaas) — as mesmas no app
 * (a própria pessoa) e no painel (tesouraria). Trocar cartão só pelo app.
 */
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hojeBR, type ClienteAsaas } from './api';
import { ipDe } from './appAuth';
import { Recusado, bandeiraLegivel, meioDoCartao, n2, pessoaDoPerfil, proximaData, type CartaoDoApp, type ExtrasTitular } from './servico';

export function extras(corpo: Record<string, unknown>): ExtrasTitular {
  const t = (corpo.titular ?? {}) as Record<string, string>;
  return { cpf: t.cpf, cep: t.cep, numero: t.numero, email: t.email };
}

/** Ações de assinatura (mesmas no app e no painel). */
export async function executarAcaoAssinatura(
  api: ClienteAsaas, id: string, asaasId: string, acao: string, corpo: Record<string, unknown>,
  origem: { req: NextRequest; perfilId?: string },
) {
  if (acao === 'pausar') {
    await api.assinaturas.atualizar(asaasId, { status: 'INACTIVE' });
    await prisma.asaasAssinatura.update({ where: { id }, data: { status: 'PAUSADA' } });
  } else if (acao === 'retomar') {
    const prox = proximaData(Number(corpo.dia) || undefined) === hojeBR() ? hojeBR(1) : proximaData(Number(corpo.dia) || undefined);
    const s = await api.assinaturas.atualizar(asaasId, { status: 'ACTIVE', nextDueDate: prox });
    await prisma.asaasAssinatura.update({ where: { id }, data: { status: 'ATIVA', proximoVencimento: s.nextDueDate ? new Date(`${s.nextDueDate}T12:00:00Z`) : null } });
  } else if (acao === 'cancelar') {
    await api.assinaturas.cancelar(asaasId);
    await prisma.asaasAssinatura.update({ where: { id }, data: { status: 'CANCELADA', canceladaEm: new Date() } });
  } else if (acao === 'valor') {
    const valor = n2(Number(corpo.valor));
    if (!(valor >= 5 && valor <= 100_000)) throw new Recusado('Valor mínimo de R$ 5,00.');
    await api.assinaturas.atualizar(asaasId, { value: valor, updatePendingPayments: true });
    await prisma.asaasAssinatura.update({ where: { id }, data: { valor } });
  } else if (acao === 'cartao') {
    if (!origem.perfilId) throw new Recusado('Só a própria pessoa troca o cartão, pelo app.');
    const pessoa = await pessoaDoPerfil(origem.perfilId, extras(corpo));
    const meio = await meioDoCartao(origem.perfilId, (corpo.cartao ?? {}) as CartaoDoApp, pessoa);
    let s;
    try {
      s = await api.assinaturas.trocarCartao(asaasId, { ...meio.campos, remoteIp: ipDe(origem.req) });
    } catch (e) {
      if ((e as { status?: number }).status === 400) throw new Recusado((e as Error).message || 'O banco não autorizou o cartão.');
      throw e;
    }
    await prisma.asaasAssinatura.update({
      where: { id },
      data: {
        forma: 'CREDIT_CARD',
        cartaoBandeira: s.creditCard?.creditCardBrand ? bandeiraLegivel(s.creditCard.creditCardBrand) : undefined,
        cartaoFinal: s.creditCard?.creditCardNumber ? String(s.creditCard.creditCardNumber).slice(-4) : undefined,
      },
    });
  } else {
    throw new Recusado('Ação desconhecida.');
  }
}
