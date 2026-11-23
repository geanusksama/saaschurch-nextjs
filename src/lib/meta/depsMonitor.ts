import { decifrar } from './cifra'
import { criarGraph } from './graph'
import { lerStatusNumero } from './conexaoMeta'
import { ehBase } from './configCentral'
import { lerConfigMeta } from './configMeta'
import * as repo from './alertasRepo'
import type { DepsExecucao, DepsMonitor, ConexaoMonitor } from './monitorMeta'
import { verificarMeta } from './monitorMeta'

async function configOuNull() {
  try { return await lerConfigMeta() } catch { return null }
}

/** Dependências reais do monitor (banco, Graph API, webhook próprio). */
export function depsMonitorReais(): DepsMonitor {
  return {
    agora: () => new Date(),
    ehBase: ehBase(process.env),
    versaoEmUso: async () => (await configOuNull())?.graphVersion || null,
    conexoes: async () => {
      const c = await configOuNull()
      const lista = await repo.conexoesParaMonitor()
      const saida: ConexaoMonitor[] = []
      for (const l of lista) {
        let status = l.status
        let qualidade: string | null = null
        if (c && l.status !== 'desconectado') {
          try {
            const graph = criarGraph({ versao: c.graphVersion })
            const s = await lerStatusNumero(graph, decifrar(l.tokenCifrado, c.chaveCifra), l.phoneNumberId)
            qualidade = s.qualidade
          } catch (e) {
            if ((e as { tokenInvalido?: boolean })?.tokenInvalido) status = 'erro'
          }
        }
        saida.push({ campoId: l.campoId, status, qualidade })
      }
      return saida
    },
    webhookResponde: async () => {
      const c = await configOuNull()
      if (!c) return false
      const desafio = String(Math.floor(Math.random() * 1e9))
      const qs = new URLSearchParams({ 'hub.mode': 'subscribe', 'hub.verify_token': c.verifyToken, 'hub.challenge': desafio })
      const r = await fetch(`${c.callbackBaseUrl}/api/meta/whatsapp/webhook?${qs.toString()}`, { signal: AbortSignal.timeout(10000), cache: 'no-store' })
      return r.ok && (await r.text()) === desafio
    },
    alertasAbertos: repo.abertosParaDedupe,
  }
}

/** Execução do cron com o envio existente (Z-API). Sem instância ou número: só registra. */
export function depsExecucaoReais(): DepsExecucao {
  return {
    verificar: () => verificarMeta(depsMonitorReais()),
    gravar: repo.gravarAlertas,
    numeroAviso: process.env.META_ALERTA_WHATSAPP ?? '',
    enviarWhatsapp: async (numero, texto) => {
      const { getActiveInstance, sendTextViaZApi, normalizarNumeroBrasil } = await import('../whatsappSendService')
      const dono = await repo.primeiroMaster()
      if (!dono) return false
      const instancia = await getActiveInstance(dono, 'master')
      if (!instancia) return false
      const para = normalizarNumeroBrasil(numero)
      if (!para) return false
      const r = await sendTextViaZApi(instancia, para, texto)
      return r.status !== 'error'
    },
  }
}

