import { prisma } from '../prisma'
import type { AlertaMeta } from './monitorMeta'
import type { Atualizacao } from './configCentral'

export type AlertaLinha = {
  id: string; campoId: string | null; tipo: string; mensagem: string
  proposta: unknown; criadoEm: Date; origem?: string | null
}

export async function listarAbertos(): Promise<Array<AlertaLinha & { campoNome: string | null }>> {
  const alertas: AlertaLinha[] = await prisma.metaAlerta.findMany({
    where: { resolvidoEm: null }, orderBy: { criadoEm: 'desc' }, take: 200,
    select: { id: true, campoId: true, tipo: true, mensagem: true, proposta: true, criadoEm: true, origem: true },
  })
  const ids = [...new Set(alertas.map((a) => a.campoId).filter((x): x is string => !!x))]
  const campos = ids.length ? await prisma.campo.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : []
  const nomes = new Map(campos.map((c) => [c.id, c.name]))
  // Alerta vindo de outra igreja: o nome mostrado é a origem ("<domínio> · <campo>").
  return alertas.map((a) => ({ ...a, campoNome: a.origem ?? (a.campoId ? nomes.get(a.campoId) ?? null : null) }))
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
  return prisma.metaAlerta.findMany({ where: { resolvidoEm: null, origem: null }, select: { tipo: true, campoId: true }, take: 1000 })
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
    where: { status: { not: 'desconectado' } },
    select: { campoId: true, phoneNumberId: true, tokenCifrado: true, status: true },
    orderBy: { campoId: 'asc' }, take: 200,
  })
}

export async function primeiroMaster(): Promise<string | null> {
  const u = await prisma.user.findFirst({ where: { profileType: 'master' }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true } })
  return u?.id ?? null
}

/** Base: alertas em aberto com a origem (dedupe dos que chegam das igrejas). */
export async function abertosComOrigem(): Promise<Array<{ tipo: string; origem: string | null }>> {
  return prisma.metaAlerta.findMany({ where: { resolvidoEm: null, origem: { not: null } }, select: { tipo: true, origem: true }, take: 1000 })
}

/** Base: grava os alertas recebidos de outras igrejas (sem campo local, sem proposta). */
export async function gravarRecebidos(alertas: Array<{ tipo: string; mensagem: string; origem: string }>): Promise<void> {
  await prisma.metaAlerta.createMany({ data: alertas.map((a) => ({ campoId: null, tipo: a.tipo, mensagem: a.mensagem, origem: a.origem })) })
}

/** Igreja: alertas em aberto de algum campo, com o nome do campo (para encaminhar ao base). */
export async function abertosLocaisParaEncaminhar(): Promise<Array<{ id: string; tipo: string; mensagem: string; campoNome: string | null }>> {
  const linhas = await prisma.metaAlerta.findMany({
    where: { resolvidoEm: null, campoId: { not: null }, origem: null },
    orderBy: { criadoEm: 'asc' }, take: 100,
    select: { id: true, tipo: true, mensagem: true, campoId: true },
  })
  const ids = [...new Set(linhas.map((l) => l.campoId).filter((x): x is string => !!x))]
  const campos = ids.length ? await prisma.campo.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : []
  const nomes = new Map(campos.map((c) => [c.id, c.name]))
  return linhas.map((l) => ({ id: l.id, tipo: l.tipo, mensagem: l.mensagem, campoNome: l.campoId ? nomes.get(l.campoId) ?? null : null }))
}

/** Igreja: resolve os alertas já entregues ao base (a cópia que vale passa a ser a do base). */
export async function resolverEncaminhados(ids: string[]): Promise<void> {
  if (!ids.length) return
  await prisma.metaAlerta.updateMany({ where: { id: { in: ids }, resolvidoEm: null }, data: { resolvidoEm: new Date() } })
}
