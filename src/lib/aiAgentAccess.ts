/**
 * Quem pode ver/usar cada agente de IA.
 *
 * Regra de USO (quem pode escolher/conversar com o agente): só quem está
 * marcado no agente. Sem exceção de perfil — master não marcado não usa — e
 * sem exceção para agente sem ninguém marcado: se não marcou, ninguém usa.
 *
 * A tela de GESTÃO é outra história: lá o master continua vendo tudo, senão
 * ele marcaria um agente para outra pessoa e perderia o próprio botão de
 * editar — só o banco desfaria.
 *
 * Server-side apenas.
 */

import { supabaseAdmin } from '@/lib/supabase-admin'

export interface AgentAccessMap {
  /** agentes em que ESTE usuário está marcado — os únicos que ele pode usar */
  mine: Set<string>
}

export async function loadAgentAccess(userId: string | null): Promise<AgentAccessMap> {
  if (!userId) return { mine: new Set<string>() }
  const { data } = await supabaseAdmin
    .from('ai_agent_users')
    .select('agent_id')
    .eq('user_id', userId)
  return { mine: new Set((data ?? []).map(r => r.agent_id)) }
}

export function canUseAgent(agentId: string, access: AgentAccessMap): boolean {
  return access.mine.has(agentId)
}

/**
 * Filtra a lista pelo que o usuário pode USAR. Sem exceção de perfil: master
 * que não está marcado não vê o agente na hora de escolher.
 */
export async function filterAgentsForUser<T extends { id: string }>(
  agents: T[],
  userId: string | null
): Promise<T[]> {
  const access = await loadAgentAccess(userId)
  return agents.filter(a => canUseAgent(a.id, access))
}

/** Usuários autorizados de cada agente, para a tela de gestão. */
export async function loadAgentUserIds(agentIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>()
  if (!agentIds.length) return map
  const { data } = await supabaseAdmin
    .from('ai_agent_users')
    .select('agent_id, user_id')
    .in('agent_id', agentIds)
  for (const row of data ?? []) {
    const list = map.get(row.agent_id) ?? []
    list.push(row.user_id)
    map.set(row.agent_id, list)
  }
  return map
}

/**
 * Substitui a lista de autorizados de um agente pelo conjunto informado.
 * `userIds` vazio deixa o agente sem ninguém — e sem ninguém, ninguém usa;
 * ele passa a existir apenas na tela de gestão.
 */
export async function replaceAgentUsers(
  agentId: string,
  userIds: string[],
  addedBy: string | null
): Promise<void> {
  const wanted = Array.from(new Set(userIds.filter(Boolean)))

  await supabaseAdmin.from('ai_agent_users').delete().eq('agent_id', agentId)
  if (!wanted.length) return

  await supabaseAdmin.from('ai_agent_users').insert(
    wanted.map(userId => ({ agent_id: agentId, user_id: userId, added_by: addedBy }))
  )
}
