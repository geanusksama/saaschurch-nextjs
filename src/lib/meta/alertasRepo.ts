import { prisma } from '../prisma'
import type { AlertaMeta } from './monitorMeta'
import type { Atualizacao } from './configCentral'

export type AlertaLinha = {
  id: string; campoId: string | null; tipo: string; mensagem: string
  proposta: unknown; criadoEm: Date
}

export async function listarAbertos(): Promise<Array<AlertaLinha & { campoNome: string | null }>> {
  const alertas: AlertaLinha[] = await prisma.metaAlerta.findMany({
    where: { resolvidoEm: null }, orderBy: { criadoEm: 'desc' },
    select: { id: true, campoId: true, tipo: true, mensagem: true, proposta: true, criadoEm: true },
  })
  const ids = [...new Set(alertas.map((a) => a.campoId).filter((x): x is string => !!x))]
  const campos = ids.length ? await prisma.campo.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : []
  const nomes = new Map(campos.map((c) => [c.id, c.name]))
  return alertas.map((a) => ({ ...a, campoNome: a.campoId ? nomes.get(a.campoId) ?? null : null }))
}

/** Aprovar: grava a configuração e resolve o alerta na mesma transação (forma de array). */
export async function aprovarEResolver(dados: Atualizacao & { appSecretCifrado?: string }, id: string, userId: string | null): Promise<boolean> {
  const { appSecret: _d, ...resto } = dados
  void _d
  const cfg = { ...resto, atualizadoPor: userId }
  const [, r] = await prisma.$transaction([
    prisma.metaAppConfig.upsert({ where: { id: 1 }, create: { id: 1, ...cfg }, update: cfg }),
    prisma.metaAlerta.updateMany({ where: { id, resolvidoEm: null }, data: { resolvidoEm: new Date(), resolvidoPor: userId } }),
  ])
  return r.count > 0
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
  return prisma.metaWhatsappConexao.findMany({
    select: { campoId: true, phoneNumberId: true, tokenCifrado: true, status: true },
    orderBy: { campoId: 'asc' }, take: 200,
  })
}

export async function primeiroMaster(): Promise<string | null> {
  const u = await prisma.user.findFirst({ where: { profileType: 'master' }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true } })
  return u?.id ?? null
}
