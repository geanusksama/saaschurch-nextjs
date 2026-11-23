import crypto from 'node:crypto'
import { decifrar } from './cifra'
import { criarGraph } from './graph'
import { lerConfigMeta } from './configMeta'
import { lerStatusNumero } from './conexaoMeta'
import * as repo from './envioRepo'
import * as conexoes from './conexaoRepo'
import * as modelosRepo from './modelosRepo'
import { gravarAlertas } from './alertasRepo'
import type { DepsEnvio } from './servicoEnvio'

export { camposComDisparoAtivo } from './envioRepo'

/** Dependências reais do envio em massa (banco, Graph da versão configurada, chave de cifra). */
export async function montarDependenciasEnvio(): Promise<DepsEnvio> {
  const config = await lerConfigMeta()
  const graph = criarGraph({ versao: config.graphVersion })
  return {
    repo,
    modelos: { buscar: modelosRepo.buscar },
    conexoes,
    graph,
    lerStatus: (token, phoneNumberId) => lerStatusNumero(graph, token, phoneNumberId),
    alertas: {
      gravar: (campoId, mensagem) => gravarAlertas([{ campoId, tipo: 'envio_pausado', mensagem, proposta: null }]),
    },
    chave: config.chaveCifra,
    cifra: { decifrar },
    novoId: () => crypto.randomUUID(),
  }
}
