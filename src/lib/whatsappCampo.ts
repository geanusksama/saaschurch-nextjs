/**
 * Campo de cada instância de WhatsApp.
 *
 * whatsapp_instances não tem coluna de campo. O campo da instância é o do
 * AGENTE DE RECEPÇÃO configurado nela (metadata.recepcao.agentId →
 * ai_agents.campo_id) — é o agente que define para qual campo o número atende.
 * Instância sem agente configurado não tem campo definido.
 *
 * Usado pela Caixa (lista de conversas) e pelos Relatórios: "campo ativo
 * filtra tudo, master inclusive" (docs/architecture/ISOLAMENTO-CAMPO.md).
 */

import { prisma } from '@/lib/prisma'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { lerRecepcao } from '@/lib/recepcaoWhatsapp'

export interface InstanciaComCampo {
  id: string
  metadata: unknown
  /** null = sem agente de recepção (campo não definido) */
  campoId: string | null
}

/** Instâncias (opcionalmente só as acessíveis) com o campo de cada uma. */
export async function instanciasComCampo(acessiveis: Set<string> | null): Promise<InstanciaComCampo[]> {
  let q = supabaseAdmin.from('whatsapp_instances').select('id, metadata').limit(100)
  if (acessiveis) q = q.in('id', acessiveis.size ? [...acessiveis] : ['00000000-0000-0000-0000-000000000000'])
  const { data, error } = await q
  if (error) throw new Error(`Falha ao ler as instâncias: ${error.message}`)
  const agentes = [...new Set((data ?? []).map(i => lerRecepcao(i.metadata).agentId).filter((x): x is string => !!x))]
  const campoDoAgente = new Map(
    (agentes.length ? await prisma.aiAgent.findMany({ where: { id: { in: agentes } }, select: { id: true, campoId: true } }) : [])
      .map(a => [a.id, a.campoId]),
  )
  return (data ?? []).map(i => {
    const ag = lerRecepcao(i.metadata).agentId
    return { id: i.id, metadata: i.metadata, campoId: ag ? campoDoAgente.get(ag) ?? null : null }
  })
}

/**
 * Ids das instâncias visíveis no campo ativo: as do campo + as sem campo
 * definido (não somem de ninguém até alguém configurar o agente delas).
 */
export async function instanciasVisiveisNoCampo(campoId: string | null, acessiveis: Set<string> | null): Promise<string[]> {
  const todas = await instanciasComCampo(acessiveis)
  return todas.filter(i => i.campoId === null || (!!campoId && i.campoId === campoId)).map(i => i.id)
}
