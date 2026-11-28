/** Banco do custo: cobranças por mensagem entregue e tabela de preços central. */
import { prisma } from '../prisma'
import { configCentral } from './configCentralPadrao'
import { ehBase } from './configCentral'
import type { DepsGasto } from './custo'
import type { Preco } from './custoFormato'

export type PrecoComVigencia = Preco & { vigencia: string | null }

export async function lerPrecosDoBanco(): Promise<PrecoComVigencia[]> {
  const l = await prisma.metaPreco.findMany({ orderBy: [{ categoria: 'asc' }, { moeda: 'asc' }], take: 100 })
  return l.map((x) => ({ categoria: x.categoria, moeda: x.moeda, preco: Number(x.preco), vigencia: x.vigencia ? x.vigencia.toISOString().slice(0, 10) : null }))
}

/** Base: banco. Demais igrejas: o base (cache de 5 min); indisponível ⇒ último valor ou lista vazia ("preço não configurado"). */
export async function lerPrecosCentrais(): Promise<PrecoComVigencia[]> {
  if (ehBase(process.env)) return lerPrecosDoBanco()
  return (await configCentral.lerPrecos()) ?? []
}

export async function gravarPrecos(precos: PrecoComVigencia[], userId: string | null): Promise<void> {
  const ops = precos.map((p) => prisma.metaPreco.upsert({
    where: { categoria_moeda: { categoria: p.categoria, moeda: p.moeda } },
    create: { categoria: p.categoria, moeda: p.moeda, preco: p.preco, vigencia: p.vigencia ? new Date(p.vigencia) : null, atualizadoPor: userId },
    update: { preco: p.preco, vigencia: p.vigencia ? new Date(p.vigencia) : null, atualizadoPor: userId },
  }))
  await prisma.$transaction(ops)
}

export async function registrarCobranca(l: { campoId: string; wamid: string; categoria: string; billable: boolean; entregueEm: Date }): Promise<boolean> {
  const n = await prisma.$executeRaw`
    INSERT INTO meta_whatsapp_cobrancas (campo_id, meta_message_id, categoria, billable, entregue_em)
    VALUES (${l.campoId}::uuid, ${l.wamid}, ${l.categoria}, ${l.billable}, ${l.entregueEm})
    ON CONFLICT (meta_message_id) DO NOTHING`
  return n > 0
}

export const depsGastoPadrao: DepsGasto = {
  async contarCobradas(campoId, desde, ate) {
    const g = await prisma.metaWhatsappCobranca.groupBy({
      by: ['categoria'], _count: { _all: true },
      where: { campoId, billable: true, entregueEm: { gte: desde, lt: ate } },
    })
    return Object.fromEntries(g.map((x) => [x.categoria, x._count._all]))
  },
  lerPrecos: lerPrecosCentrais,
}
