import { decifrar } from './cifra'
import { criarGraph } from './graph'
import { lerConfigMeta } from './configMeta'
import * as repo from './modelosRepo'
import * as conexoes from './conexaoRepo'
import { prisma } from '../prisma'
import type { DepsModelos } from './servicoModelos'

/** Dependências reais dos modelos (banco, Graph da versão configurada, chave de cifra). */
export async function montarDependenciasModelos(): Promise<DepsModelos> {
  const config = await lerConfigMeta()
  return {
    repo,
    conexoes,
    graph: criarGraph({ versao: config.graphVersion }),
    chave: config.chaveCifra,
    cifra: { decifrar },
  }
}

/** Campos com conexão ativa, para o cron de sincronização. */
export async function camposConectados(): Promise<string[]> {
  const l = await prisma.metaWhatsappConexao.findMany({
    where: { status: 'conectado' }, select: { campoId: true }, orderBy: { campoId: 'asc' }, take: 200,
  })
  return l.map((x) => x.campoId)
}
