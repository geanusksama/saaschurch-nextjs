import { decifrar } from './cifra'
import { criarGraph } from './graph'
import { lerConfigMeta } from './configMeta'
import { lerStatusNumero } from './conexaoMeta'
import * as conexoes from './conexaoRepo'
import * as modelosRepo from './modelosRepo'
import { enviadosDesde, telefonesExcluidos } from './envioRepo'
import { gravarAlertas } from './alertasRepo'
import { supabaseAdmin } from '../supabase-admin'
import { MSG_SEM_CONEXAO_ENVIO } from './servicoEnvio'
import { criarUsadosEm24h, type DepsCampanhaOficial } from './campanhaOficial'

/** Dependências reais do envio de campanha pelo número oficial. */
export async function montarDependenciasCampanhaOficial(): Promise<DepsCampanhaOficial> {
  const config = await lerConfigMeta()
  const graph = criarGraph({ versao: config.graphVersion })
  return {
    graph,
    conexao: async (campoId) => {
      const c = await conexoes.buscarConexaoDoCampo(campoId)
      if (!c || c.status === 'desconectado' || !c.tokenCifrado) throw new Error(MSG_SEM_CONEXAO_ENVIO)
      return { phoneNumberId: c.phoneNumberId, token: decifrar(c.tokenCifrado, config.chaveCifra) }
    },
    lerStatus: (token, phoneNumberId) => lerStatusNumero(graph, token, phoneNumberId),
    excluido: async (campoId, telefone) => (await telefonesExcluidos(campoId, [telefone])).size > 0,
    modelo: async (campoId, id) => modelosRepo.buscar(campoId, id),
    usadosEm24h: criarUsadosEm24h({
      disparos: (campoId, desde) => enviadosDesde(campoId, desde),
      campanhas: async (instanciaId, desde) => {
        const r = await supabaseAdmin
          .from('whatsapp_campaign_recipients')
          .select('id', { count: 'exact', head: true })
          .eq('instance_id', instanciaId)
          .eq('status', 'sent')
          .gte('sent_at', desde.toISOString())
        return r.count ?? 0
      },
      jornadas: async (instanciaId, desde) => {
        const r = await supabaseAdmin
          .from('pastoral_journey_sends')
          .select('id', { count: 'exact', head: true })
          .eq('instance_id', instanciaId)
          .eq('status', 'sent')
          .gte('sent_at', desde.toISOString())
        return r.count ?? 0
      },
    }),
  }
}

/** Alerta `envio_pausado` do campo (aparece na central do WhatsApp oficial). */
export async function alertarCampanhaPausada(campoId: string, mensagem: string): Promise<void> {
  await gravarAlertas([{ campoId, tipo: 'envio_pausado', mensagem, proposta: null }])
}
