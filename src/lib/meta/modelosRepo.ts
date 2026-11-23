import { prisma } from '../prisma'
import type { LinhaModelo, ModeloResumo } from './servicoModelos'

const SELECT = {
  id: true, campoId: true, wabaId: true, metaTemplateId: true, nome: true, idioma: true,
  categoria: true, status: true, motivoRecusa: true, componentes: true, variaveis: true,
  criadoPor: true, criadoEm: true, atualizadoEm: true, sincronizadoEm: true,
} as const

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dados = (l: LinhaModelo): any => ({ ...l, componentes: l.componentes ?? [], variaveis: l.variaveis ?? [] })

export async function listar(campoId: string): Promise<ModeloResumo[]> {
  return prisma.metaWhatsappModelo.findMany({
    where: { campoId }, orderBy: { atualizadoEm: 'desc' }, take: 200, select: SELECT,
  })
}

export async function buscar(campoId: string, id: string): Promise<ModeloResumo | null> {
  return prisma.metaWhatsappModelo.findFirst({ where: { id, campoId }, select: SELECT })
}

export async function inserir(linha: LinhaModelo): Promise<ModeloResumo> {
  return prisma.metaWhatsappModelo.upsert({
    where: { campoId_metaTemplateId: { campoId: linha.campoId, metaTemplateId: linha.metaTemplateId } },
    create: dados(linha),
    update: { ...dados(linha), campoId: undefined },
    select: SELECT,
  })
}

export async function remover(id: string): Promise<void> {
  await prisma.metaWhatsappModelo.deleteMany({ where: { id } })
}

/** Substitui o espelho do campo (deleteMany + createMany em transação de array). */
export async function substituirDoCampo(campoId: string, linhas: LinhaModelo[]): Promise<void> {
  await prisma.$transaction([
    prisma.metaWhatsappModelo.deleteMany({ where: { campoId } }),
    prisma.metaWhatsappModelo.createMany({ data: linhas.map(dados) }),
  ])
}
