/**
 * Ligação real (Prisma, Supabase, Graph, cifra) do envio livre da Meta.
 * Separado de envioLivre.ts para que o núcleo seja testável sem banco nem rede.
 */
import { prisma } from '../prisma'
import { supabaseAdmin } from '../supabase-admin'
import { criarGraph } from './graph'
import { decifrar } from './cifra'
import { lerConfigMeta } from './configMeta'
import { enviarLivreMeta, type ConteudoLivre, type ResultadoEnvioLivre } from './envioLivre'

/** Resolve o uuid da instância espelho a partir do instance_id ('meta:<phone_number_id>'). */
async function idDaInstancia(instanceId: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from('whatsapp_instances').select('id').eq('instance_id', instanceId).eq('provider', 'meta').maybeSingle()
  return (data?.id as string | undefined) ?? null
}

export async function enviarLivreMetaPadrao(
  instancia: { id?: string; instance_id: string },
  para: string,
  conteudo: ConteudoLivre,
): Promise<ResultadoEnvioLivre> {
  try {
    const id = instancia.id ?? (await idDaInstancia(instancia.instance_id))
    if (!id) return { messageId: '', status: 'error', error: 'instancia_meta_nao_encontrada' }
    const cfg = await lerConfigMeta()
    return await enviarLivreMeta({
      graph: criarGraph({ versao: cfg.graphVersion }),
      obterConexao: async (instId) => {
        const c = await prisma.metaWhatsappConexao.findFirst({
          where: { instanciaId: instId, status: 'conectado' },
          select: { phoneNumberId: true, tokenCifrado: true },
        })
        if (!c || !c.tokenCifrado) return null
        return { phoneNumberId: c.phoneNumberId, token: decifrar(c.tokenCifrado, cfg.chaveCifra) }
      },
      ultimaRecebidaEm: async (instId, telefone) => {
        const { data: conv } = await supabaseAdmin.from('whatsapp_conversations').select('id').eq('instance_id', instId).eq('phone', telefone).maybeSingle()
        if (!conv) return null
        const { data: msg } = await supabaseAdmin.from('whatsapp_messages').select('created_at')
          .eq('conversation_id', conv.id).eq('direction', 'inbound').order('created_at', { ascending: false }).limit(1).maybeSingle()
        return msg?.created_at ? new Date(msg.created_at as string) : null
      },
    }, { id }, para, conteudo)
  } catch (e) {
    return { messageId: '', status: 'error', error: e instanceof Error ? e.message : 'erro ao enviar pela Meta' }
  }
}
