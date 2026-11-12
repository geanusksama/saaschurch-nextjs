/**
 * Serviços do botão de atendimento da home pública ("Atendimento <igreja>").
 *
 * Fonte única: a home (PublicHome) desenha os botões a partir daqui e o agente
 * de IA do WhatsApp oferece as mesmas opções — filtradas e renomeadas pela
 * configuração da igreja (home_configs.services).
 */

import type { HomeServicesConfig } from './homeConfig'

export const SERVICOS_HOME = [
  { id: 'membro_login', label: 'Já sou Membro' },
  { id: 'membership', label: 'Quero ser Membro' },
  { id: 'visita_pastoral', label: 'Visita Pastoral' },
  { id: 'aconselhamento', label: 'Aconselhamento' },
  { id: 'pedido_oracao', label: 'Pedido de Oração' },
  { id: 'emergencial', label: 'Atendimento Emergencial' },
  { id: 'reconciliacao', label: 'Reconciliação' },
  { id: 'familiar', label: 'Atendimento Familiar' },
  { id: 'jovem', label: 'Atendimento Jovem' },
  { id: 'infantil', label: 'Atendimento Infantil' },
  { id: 'financeiro', label: 'Atendimento Financeiro' },
  { id: 'ministerial', label: 'Atendimento Ministerial' },
  { id: 'online', label: 'Atendimento Online' },
  { id: 'presencial', label: 'Atendimento Presencial' },
  { id: 'casamento', label: 'Casamento' },
  { id: 'apresentacao_criancas', label: 'Apresentação de Crianças' },
] as const

export type ServicoHomeId = (typeof SERVICOS_HOME)[number]['id']

/** O que a home mostra para esta igreja: sem os escondidos, com os renomes. */
export function servicosVisiveis(cfg: Pick<HomeServicesConfig, 'hidden' | 'labels'>) {
  return SERVICOS_HOME
    .filter(s => !cfg.hidden.includes(s.id))
    .map(s => ({ id: s.id, label: cfg.labels[s.id] || s.label }))
}
