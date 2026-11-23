import { prisma } from '../prisma'
import type { Atualizacao, LinhaConfigCentral } from './configCentral'

const SELECT = {
  appId: true, esConfigId: true, graphVersion: true, webhookVerifyToken: true,
  appSecretCifrado: true, conexaoLiberada: true,
} as const

export async function lerLinha(): Promise<LinhaConfigCentral | null> {
  return prisma.metaAppConfig.findUnique({ where: { id: 1 }, select: SELECT })
}

export async function gravarLinha(d: Atualizacao & { appSecretCifrado?: string }, userId: string | null): Promise<void> {
  const { appSecret: _descartado, ...resto } = d
  void _descartado
  const dados = { ...resto, atualizadoPor: userId }
  await prisma.metaAppConfig.upsert({ where: { id: 1 }, create: { id: 1, ...dados }, update: dados })
}
