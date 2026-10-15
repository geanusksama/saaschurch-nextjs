/**
 * POST /api/asaas/webhook — eventos do Asaas (cadastrado pelo botão em
 * Pagamentos › Configurações).
 *
 * 1. Header `asaas-access-token` tem que bater com o token de alguma config.
 * 2. O id do evento é a chave de asaas_webhook_eventos: repetido → 200 e fim
 *    (o Asaas entrega "pelo menos uma vez").
 * 3. Erro de regra fica gravado no evento (reprocessável pelo painel) e a
 *    resposta continua 200 — 5xx faz o Asaas reenviar e interromper a fila.
 */
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { configsDoToken } from '@/lib/asaas/config';
import { processar, type EventoAsaas } from '@/lib/asaas/webhook';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const configs = await configsDoToken(req.headers.get('asaas-access-token'));
  if (!configs.length) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const ev = (await req.json().catch(() => null)) as EventoAsaas | null;
  if (!ev?.id || !ev.event) return NextResponse.json({ ok: true, ignorado: 'sem id' });

  try {
    await prisma.asaasWebhookEvento.create({
      data: { id: ev.id, evento: ev.event, configId: configs[0].id, payload: ev as unknown as Prisma.InputJsonValue },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return NextResponse.json({ ok: true, duplicado: true });
    throw e;
  }

  await prisma.asaasConfig.updateMany({ where: { id: { in: configs.map((c) => c.id) } }, data: { ultimoEventoEm: new Date() } });

  try {
    const r = await processar(ev, configs);
    await prisma.asaasWebhookEvento.update({ where: { id: ev.id }, data: { processadoEm: new Date(), ignorado: r === 'ignorado' } });
  } catch (e) {
    console.error('[asaas webhook]', ev.event, e);
    await prisma.asaasWebhookEvento.update({ where: { id: ev.id }, data: { erro: String((e as Error)?.message ?? e).slice(0, 2000) } });
  }
  return NextResponse.json({ ok: true });
}
