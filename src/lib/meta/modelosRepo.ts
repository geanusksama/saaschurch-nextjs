import { Prisma } from '@prisma/client'
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

/**
 * Sincroniza o espelho do campo preservando id, criado_em, criado_por e variaveis:
 * apaga só o que a Meta não devolveu e faz upsert em lote (um INSERT ... ON CONFLICT)
 * só nas colunas que vêm da Meta. Transação de array (o pooler não aceita interativa).
 */
export async function substituirDoCampo(campoId: string, linhas: LinhaModelo[]): Promise<void> {
  const ids = linhas.map((l) => l.metaTemplateId)
  const apagar = prisma.metaWhatsappModelo.deleteMany({
    where: { campoId, metaTemplateId: { notIn: ids } },
  })
  if (linhas.length === 0) {
    await prisma.$transaction([apagar])
    return
  }
  // Uma linha por modelo, tudo por parâmetro (nunca texto concatenado).
  const valores = linhas.map((l) => Prisma.sql`(
    ${campoId}::uuid, ${l.wabaId}, ${l.metaTemplateId}, ${l.nome}, ${l.idioma}, ${l.categoria},
    ${l.status}, ${l.motivoRecusa}, ${JSON.stringify(l.componentes ?? [])}::jsonb,
    ${JSON.stringify(l.variaveis ?? [])}::jsonb, ${l.criadoPor}::uuid, ${l.sincronizadoEm ?? new Date()}::timestamptz
  )`)
  const upsert = prisma.$executeRaw`
    INSERT INTO meta_whatsapp_modelos
      (campo_id, waba_id, meta_template_id, nome, idioma, categoria, status, motivo_recusa,
       componentes, variaveis, criado_por, sincronizado_em)
    VALUES ${Prisma.join(valores)}
    ON CONFLICT (campo_id, meta_template_id) DO UPDATE SET
      nome = EXCLUDED.nome, idioma = EXCLUDED.idioma, categoria = EXCLUDED.categoria,
      status = EXCLUDED.status, motivo_recusa = EXCLUDED.motivo_recusa,
      componentes = EXCLUDED.componentes, waba_id = EXCLUDED.waba_id,
      atualizado_em = now(), sincronizado_em = EXCLUDED.sincronizado_em`
  await prisma.$transaction([apagar, upsert])
}
