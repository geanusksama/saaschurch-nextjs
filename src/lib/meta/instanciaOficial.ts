/**
 * Instância espelho do número oficial (Meta) em whatsapp_instances, para que ele
 * apareça nas telas de Comunicação como mais uma instância. Chave:
 * (provider = 'meta', instance_id = 'meta:' + phoneNumberId). Sem token: o envio
 * oficial usa a conexão da Meta, não esta linha.
 */
import { supabaseAdmin } from '../supabase-admin'
import { prisma } from '../prisma'
import { primeiroMaster } from './alertasRepo'
import { linhaDaInstanciaOficial } from './instanciaCampo'

export { filtrarPorCampo } from './instanciaCampo'

export type ConexaoParaSincronizar = {
  id: string
  campoId: string
  phoneNumberId: string
  numero: string | null
  nomeExibicao: string | null
  status: string
  conectadoPor: string | null
}

/** Cria/atualiza a instância espelho e grava meta_whatsapp_conexoes.instancia_id. Devolve o id da instância. */
export async function sincronizarInstanciaOficial(c: ConexaoParaSincronizar): Promise<string> {
  const linha = linhaDaInstanciaOficial(c)
  const agora = new Date().toISOString()

  const buscar = async () => {
    const { data, error } = await supabaseAdmin
      .from('whatsapp_instances')
      .select('id')
      .eq('provider', 'meta')
      .eq('instance_id', linha.instance_id)
      .maybeSingle()
    if (error) throw new Error(`Falha ao ler a instância oficial: ${error.message}`)
    return data?.id as string | undefined
  }

  let id = await buscar()
  if (id) {
    // owner_user_id e metadata ficam como estão (podem ter sido ajustados na tela).
    const { error } = await supabaseAdmin.from('whatsapp_instances').update({ ...linha, updated_at: agora }).eq('id', id)
    if (error) throw new Error(`Falha ao atualizar a instância oficial: ${error.message}`)
  } else {
    const dono = c.conectadoPor ?? (await primeiroMaster())
    if (!dono) throw new Error('Sem usuário para ser dono da instância oficial.')
    const { data, error } = await supabaseAdmin
      .from('whatsapp_instances')
      .insert({ ...linha, owner_user_id: dono })
      .select('id')
      .single()
    if (error) {
      // Corrida com outra sincronização: o índice único barrou, a linha já existe.
      id = await buscar()
      if (!id) throw new Error(`Falha ao criar a instância oficial: ${error.message}`)
    } else {
      id = data.id as string
    }
  }

  await prisma.metaWhatsappConexao.update({ where: { id: c.id }, data: { instanciaId: id } })
  return id
}

/** Lê a conexão do campo e a espelha. Sem conexão, não faz nada. */
export async function sincronizarInstanciaDoCampo(campoId: string): Promise<void> {
  const c = await prisma.metaWhatsappConexao.findUnique({
    where: { campoId },
    select: { id: true, campoId: true, phoneNumberId: true, numero: true, nomeExibicao: true, status: true, conectadoPor: true },
  })
  if (c) await sincronizarInstanciaOficial(c)
}
