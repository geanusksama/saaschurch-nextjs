/**
 * Quem pode ver/usar cada agente de IA.
 *
 * Regra de USO (quem pode escolher/conversar com o agente):
 *  - agente COM usuários marcados só aparece para quem está marcado —
 *    inclusive para o master, que aqui NÃO tem passe livre;
 *  - agente SEM ninguém marcado continua visível para todos — é o estado dos
 *    agentes antigos, que não podem sumir da tela de um dia para o outro.
 *
 * A tela de GESTÃO é outra história: lá o master continua vendo tudo, senão
 * ele marcaria um agente para outra pessoa e perderia o próprio botão de
 * editar — só o banco desfaria.
 *
 * Server-side apenas.
 */

import { supabaseAdmin } from '@/lib/supabase-admin'

export interface AgentAccessMap {
  /** agentes que têm lista de autorizados definida */
  restricted: Set<string>
  /** agentes em que ESTE usuário está marcado */
  mine: Set<string>
}

export async function loadAgentAccess(userId: string | null): Promise<AgentAccessMap> {
  const { data } = await supabaseAdmin.from('ai_agent_users').select('agent_id, user_id')
  const restricted = new Set<string>()
  const mine = new Set<string>()
  for (const row of data ?? []) {
    restricted.add(row.agent_id)
    if (userId && row.user_id === userId) mine.add(row.agent_id)
  }
  return { restricted, mine }
}

export function canUseAgent(agentId: string, access: AgentAccessMap): boolean {
  return !access.restricted.has(agentId) || access.mine.has(agentId)
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
 * `userIds` vazio libera o agente para todos (volta a ser irrestrito).
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
