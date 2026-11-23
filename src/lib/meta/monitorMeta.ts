/**
 * Monitor diário da Meta ("agente"): VERIFICA e AVISA. Nunca muda a configuração
 * sozinho: quando há uma correção possível, grava uma `proposta` e espera o
 * "Aprovar" do master na tela. Dependências injetadas (relógio, config,
 * conexões, webhook, alertas abertos) para testar sem banco nem rede.
 */
export type TipoAlerta =
  | 'versao_graph' | 'versao_desconhecida' | 'conexao_erro'
  | 'qualidade_baixa' | 'qualidade_media' | 'webhook_falhou'

export type PropostaAtualizarVersao = { tipo: 'atualizar_versao_graph'; de: string; para: string }
export type Proposta = PropostaAtualizarVersao

export type AlertaMeta = {
  campoId: string | null
  tipo: TipoAlerta
  mensagem: string
  proposta: Proposta | null
}

/**
 * Versões da Graph API conhecidas e quando a Meta as desativa (ISO, ou null se ainda
 * não divulgada). NÃO inventar datas: só preencher com a data oficial da Meta.
 * O master pode atualizar esta lista pelo fluxo de proposta/aprovação (etapa futura);
 * por ora a tabela é editada no código quando a Meta divulgar as datas.
 */
export type VersaoGraph = { versao: string; desativaEm: string | null }
export const VERSOES_GRAPH: VersaoGraph[] = [{ versao: 'v27.0', desativaEm: null }]

export const DIAS_AVISO_VERSAO = 60
const DIA_MS = 24 * 60 * 60 * 1000

export type ConexaoMonitor = { campoId: string; status: string; qualidade: string | null }

export type DepsMonitor = {
  agora: () => Date
  /** Versão da Graph API em uso (null = configuração indisponível: pula a checagem). */
  versaoEmUso: () => Promise<string | null>
  conexoes: () => Promise<ConexaoMonitor[]>
  /** true só no sistema base. */
  ehBase: boolean
  /** Autoteste do desafio do webhook (só chamado no base). */
  webhookResponde: () => Promise<boolean>
  alertasAbertos: () => Promise<Array<{ tipo: string; campoId: string | null }>>
  tabela?: VersaoGraph[]
}

const num = (v: string) => v.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0)
export function compararVersoes(a: string, b: string): number {
  const [x, y] = [num(a), num(b)]
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0)
    if (d) return d
  }
  return 0
}

export function maisNova(tabela: VersaoGraph[]): string | null {
  return tabela.reduce<string | null>((m, v) => (m === null || compararVersoes(v.versao, m) > 0 ? v.versao : m), null)
}

export async function verificarMeta(deps: DepsMonitor): Promise<AlertaMeta[]> {
  const candidatos: AlertaMeta[] = []
  const tabela = deps.tabela ?? VERSOES_GRAPH

  // (a) versão da Graph API
  const versao = await deps.versaoEmUso()
  if (versao) {
    const entrada = tabela.find((v) => v.versao === versao)
    if (!entrada) {
      candidatos.push({
        campoId: null, tipo: 'versao_desconhecida', proposta: null,
        mensagem: `A versão ${versao} da Graph API em uso não está na tabela de versões do sistema. Confira o prazo de desativação na Meta.`,
      })
    } else if (entrada.desativaEm) {
      const dias = Math.ceil((new Date(entrada.desativaEm).getTime() - deps.agora().getTime()) / DIA_MS)
      if (Number.isFinite(dias) && dias <= DIAS_AVISO_VERSAO) {
        const nova = maisNova(tabela)
        const proposta = nova && nova !== versao ? { tipo: 'atualizar_versao_graph' as const, de: versao, para: nova } : null
        candidatos.push({
          campoId: null, tipo: 'versao_graph', proposta,
          mensagem: dias >= 0
            ? `A versão ${versao} da Graph API será desativada em ${dias} dia(s).${proposta ? ` Proposta: atualizar para ${proposta.para}.` : ''}`
            : `A versão ${versao} da Graph API já foi desativada.${proposta ? ` Proposta: atualizar para ${proposta.para}.` : ''}`,
        })
      }
    }
  }

  // (b) e (c) conexões
  for (const c of await deps.conexoes()) {
    if (c.status === 'erro') {
      candidatos.push({ campoId: c.campoId, tipo: 'conexao_erro', proposta: null, mensagem: 'A conexão do WhatsApp oficial deste campo está com erro e precisa ser reconectada.' })
    }
    if (c.qualidade === 'RED') {
      candidatos.push({ campoId: c.campoId, tipo: 'qualidade_baixa', proposta: null, mensagem: 'A qualidade do número do WhatsApp oficial deste campo está baixa (vermelha). Há risco de limitação de envio.' })
    } else if (c.qualidade === 'YELLOW') {
      candidatos.push({ campoId: c.campoId, tipo: 'qualidade_media', proposta: null, mensagem: 'A qualidade do número do WhatsApp oficial deste campo está média (amarela). Acompanhe os envios.' })
    }
  }

  // (d) webhook, só no base
  if (deps.ehBase) {
    let ok = false
    try { ok = await deps.webhookResponde() } catch { ok = false }
    if (!ok) {
      candidatos.push({ campoId: null, tipo: 'webhook_falhou', proposta: null, mensagem: 'O webhook da Meta não respondeu corretamente ao desafio de verificação.' })
    }
  }

  // Sem duplicar: já existe alerta aberto com o mesmo tipo + campo (ou repetido nesta rodada).
  const abertos = await deps.alertasAbertos()
  const chave = (t: string, c: string | null) => `${t}|${c ?? ''}`
  const vistos = new Set(abertos.map((a) => chave(a.tipo, a.campoId)))
  return candidatos.filter((a) => {
    const k = chave(a.tipo, a.campoId)
    if (vistos.has(k)) return false
    vistos.add(k)
    return true
  })
}

export type DepsExecucao = {
  verificar: () => Promise<AlertaMeta[]>
  gravar: (alertas: AlertaMeta[]) => Promise<void>
  /** Número (só dígitos) vindo de META_ALERTA_WHATSAPP; vazio = não avisar. */
  numeroAviso: string
  /** Envia o texto; devolve false se não houver instância. Nunca lança por falta de instância. */
  enviarWhatsapp: (numero: string, texto: string) => Promise<boolean>
}

export function textoAviso(alertas: AlertaMeta[]): string {
  const n = alertas.length
  return `Monitor da Meta: ${n} novo(s) alerta(s) no WhatsApp oficial. Abra Sistema > Meta – App oficial para ver e resolver.`
}

/** Lógica da rota do cron: grava os alertas novos e só avisa por WhatsApp quando houve novos. */
export async function executarMonitor(deps: DepsExecucao) {
  const novos = await deps.verificar()
  if (!novos.length) return { novos: 0, avisou: false }
  await deps.gravar(novos)
  const numero = (deps.numeroAviso ?? '').replace(/\D/g, '')
  if (!numero) return { novos: novos.length, avisou: false }
  let avisou = false
  try { avisou = await deps.enviarWhatsapp(numero, textoAviso(novos)) } catch { avisou = false }
  return { novos: novos.length, avisou }
}

/** Aplica a proposta aprovada pelo master. Devolve a atualização da config central. */
export function atualizacaoDaProposta(p: unknown): { graphVersion: string } | null {
  if (!p || typeof p !== 'object') return null
  const o = p as Record<string, unknown>
  if (o.tipo === 'atualizar_versao_graph' && typeof o.para === 'string') return { graphVersion: o.para }
  return null
}
