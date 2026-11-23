/**
 * Leituras do envio em massa para as rotas (lista, detalhe paginado, opções do formulário).
 * Só leitura; toda lista com take e orderBy; tudo escopado pelo campo
 * (igrejas por church.regional.campoId, igual ao serviço de público).
 */
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

export async function opcoesDoCampo(campoId: string) {
  const [igrejas, titulos, origens, modelos] = await Promise.all([
    prisma.church.findMany({
      where: { regional: { campoId }, deletedAt: null },
      orderBy: [{ name: 'asc' }, { id: 'asc' }], take: 500, select: { id: true, name: true },
    }),
    prisma.member.findMany({
      where: { deletedAt: null, ecclesiasticalTitle: { not: null }, church: { regional: { campoId }, deletedAt: null } },
      distinct: ['ecclesiasticalTitle'], orderBy: { ecclesiasticalTitle: 'asc' }, take: 200, select: { ecclesiasticalTitle: true },
    }),
    prisma.lead.findMany({
      where: { deletedAt: null, source: { not: null }, church: { regional: { campoId }, deletedAt: null } },
      distinct: ['source'], orderBy: { source: 'asc' }, take: 200, select: { source: true },
    }),
    prisma.metaWhatsappModelo.findMany({
      where: { campoId, status: 'APPROVED' },
      orderBy: [{ nome: 'asc' }, { id: 'asc' }], take: 200,
      select: { id: true, nome: true, idioma: true, categoria: true, variaveis: true },
    }),
  ])
  return {
    igrejas,
    titulos: titulos.map((t) => t.ecclesiasticalTitle).filter((t): t is string => !!t && !!t.trim()),
    origens: origens.map((o) => o.source).filter((s): s is string => !!s && !!s.trim()),
    modelos,
  }
}
