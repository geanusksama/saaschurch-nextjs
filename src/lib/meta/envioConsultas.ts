/**
 * Leituras do envio em massa para as rotas (lista, detalhe paginado, opções do formulário).
 * Só leitura; toda lista com take e orderBy; tudo escopado pelo campo
 * (igrejas por church.regional.campoId, igual ao serviço de público).
 */
import { Prisma } from '@prisma/client'
import { prisma } from '../prisma'

const SELECT_LISTA = {
  id: true, nome: true, modeloNome: true, idioma: true, categoria: true, status: true, motivo: true,
  agendadoPara: true, total: true, enviados: true, entregues: true, lidos: true, falhos: true, criadoEm: true,
} as const

export async function listarDisparos(campoId: string) {
  return prisma.metaWhatsappDisparo.findMany({
    where: { campoId }, orderBy: [{ criadoEm: 'desc' }, { id: 'asc' }], take: 100, select: SELECT_LISTA,
  })
}

export async function detalheDisparo(campoId: string, id: string, pagina: number, porPagina: number) {
  const disparo = await prisma.metaWhatsappDisparo.findFirst({
    where: { id, campoId }, select: { ...SELECT_LISTA, atualizadoEm: true },
  })
  if (!disparo) return null
  const [totalItens, itens] = await Promise.all([
    prisma.metaWhatsappEnvio.count({ where: { disparoId: id, campoId } }),
    prisma.metaWhatsappEnvio.findMany({
      where: { disparoId: id, campoId },
      orderBy: [{ nome: 'asc' }, { id: 'asc' }],
      skip: (pagina - 1) * porPagina,
      take: porPagina,
      select: { id: true, nome: true, telefone: true, status: true, erroCodigo: true, erro: true, enviadoEm: true, atualizadoEm: true },
    }),
  ])
  return { disparo, totalItens, itens }
}

/**
 * Valores distintos de uma coluna de members no campo (mesmo escopo de church.regional.campoId).
 * DISTINCT + LIMIT no banco: o `findMany({ distinct })` do Prisma sem nativeDistinct lia todas
 * as linhas do campo para deduplicar em memória. `coluna` vem só da lista fixa abaixo.
 */
function distintosMembros(campoId: string, coluna: 'ecclesiastical_title' | 'membership_status', limite: number) {
  const col = coluna === 'ecclesiastical_title' ? Prisma.sql`m.ecclesiastical_title` : Prisma.sql`m.membership_status`
  return prisma.$queryRaw<Array<{ v: string }>>`
    SELECT DISTINCT ${col} AS v FROM members m
    JOIN churches ch ON ch.id = m.church_id
    JOIN regionais r ON r.id = ch.regional_id
    WHERE r.campo_id = ${campoId}::uuid AND m.deleted_at IS NULL AND ch.deleted_at IS NULL
      AND ${col} IS NOT NULL AND btrim(${col}) <> ''
    ORDER BY 1
    LIMIT ${limite}`
}

export async function opcoesDoCampo(campoId: string) {
  const [igrejas, titulos, origens, modelos, situacoes] = await Promise.all([
    prisma.church.findMany({
      where: { regional: { campoId }, deletedAt: null },
      orderBy: [{ name: 'asc' }, { id: 'asc' }], take: 500, select: { id: true, name: true },
    }),
    distintosMembros(campoId, 'ecclesiastical_title', 200),
    prisma.$queryRaw<Array<{ v: string }>>`
      SELECT DISTINCT l.source AS v FROM leads l
      JOIN churches ch ON ch.id = l.church_id
      JOIN regionais r ON r.id = ch.regional_id
      WHERE r.campo_id = ${campoId}::uuid AND l.deleted_at IS NULL AND ch.deleted_at IS NULL
        AND l.source IS NOT NULL AND btrim(l.source) <> ''
      ORDER BY 1
      LIMIT 200`,
    prisma.metaWhatsappModelo.findMany({
      where: { campoId, status: 'APPROVED' },
      orderBy: [{ nome: 'asc' }, { id: 'asc' }], take: 200,
      select: { id: true, nome: true, idioma: true, categoria: true, variaveis: true, componentes: true },
    }),
    distintosMembros(campoId, 'membership_status', 50),
  ])
  return {
    igrejas,
    titulos: titulos.map((t) => t.v).filter((t): t is string => !!t && !!t.trim()),
    origens: origens.map((o) => o.v).filter((s): s is string => !!s && !!s.trim()),
    modelos,
    situacoes: situacoes.map((s) => s.v).filter((s): s is string => !!s && !!s.trim()),
  }
}
