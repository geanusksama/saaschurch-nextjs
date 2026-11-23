import { prisma } from '../prisma'
import type { AlertaMeta } from './monitorMeta'

export type AlertaLinha = {
  id: string; campoId: string | null; tipo: string; mensagem: string
  proposta: unknown; criadoEm: Date
}

export async function listarAbertos(): Promise<AlertaLinha[]> {
  return prisma.metaAlerta.findMany({
    where: { resolvidoEm: null }, orderBy: { criadoEm: 'desc' },
    select: { id: true, campoId: true, tipo: true, mensagem: true, proposta: true, criadoEm: true },
  })
}

export async function abertosParaDedupe(): Promise<Array<{ tipo: string; campoId: string | null }>> {
  return prisma.metaAlerta.findMany({ where: { resolvidoEm: null }, select: { tipo: true, campoId: true } })
}

export async function gravarAlertas(alertas: AlertaMeta[]): Promise<void> {
  await prisma.metaAlerta.createMany({
    data: alertas.map((a) => ({
      campoId: a.campoId, tipo: a.tipo, mensagem: a.mensagem,
      proposta: a.proposta ? (a.proposta as object) : undefined,
    })),
  })
}

export async function buscarAberto(id: string): Promise<AlertaLinha | null> {
  return prisma.metaAlerta.findFirst({
    where: { id, resolvidoEm: null },
    select: { id: true, campoId: true, tipo: true, mensagem: true, proposta: true, criadoEm: true },
  })
}

/** Resolve só se ainda estiver aberto (idempotente). Devolve se alterou. */
export async function resolverAlerta(id: string, userId: string | null): Promise<boolean> {
  const r = await prisma.metaAlerta.updateMany({ where: { id, resolvidoEm: null }, data: { resolvidoEm: new Date(), resolvidoPor: userId } })
  return r.count > 0
}

export async function conexoesParaMonitor(): Promise<Array<{ campoId: string; phoneNumberId: string; tokenCifrado: string; status: string }>> {
  return prisma.metaWhatsappConexao.findMany({ select: { campoId: true, phoneNumberId: true, tokenCifrado: true, status: true } })
}

export async function primeiroMaster(): Promise<string | null> {
  const u = await prisma.user.findFirst({ where: { profileType: 'master' }, select: { id: true } })
  return u?.id ?? null
}
