import { decifrar } from './cifra'
import { criarGraph } from './graph'
import { lerStatusNumero } from './conexaoMeta'
import { ehBase } from './configCentral'
import { lerConfigMeta } from './configMeta'
import * as repo from './alertasRepo'
import type { DepsExecucao, DepsMonitor, ConexaoMonitor } from './monitorMeta'
import { verificarMeta, lerComOrcamento } from './monitorMeta'

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
      return lerComOrcamento(lista, async (l): Promise<ConexaoMonitor> => {
        if (!c || l.status === 'desconectado') return { campoId: l.campoId, status: l.status, qualidade: null }
        try {
          const graph = criarGraph({ versao: c.graphVersion })
          const s = await lerStatusNumero(graph, decifrar(l.tokenCifrado, c.chaveCifra), l.phoneNumberId)
          return { campoId: l.campoId, status: l.status, qualidade: s.qualidade }
        } catch (e) {
          if ((e as { tokenInvalido?: boolean })?.tokenInvalido) return { campoId: l.campoId, status: 'erro', qualidade: null }
          return { campoId: l.campoId, status: l.status, qualidade: null, falhou: true }
        }
      })
    },
    webhookResponde: async () => {
      const c = await configOuNull()
      if (!c) return false
      const desafio = String(Math.floor(Math.random() * 1e9))
      const qs = new URLSearchParams({ 'hub.mode': 'subscribe', 'hub.verify_token': c.verifyToken, 'hub.challenge': desafio })
      const r = await fetch(`${c.callbackBaseUrl}/api/meta/whatsapp/webhook?${qs.toString()}`, { signal: AbortSignal.timeout(5000), cache: 'no-store' })
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
    // O aviso sai de UMA instância Z-API: a indicada em META_ALERTA_INSTANCIA_ID (id em
    // whatsapp_instances) ou, sem ela, a conectada mais antiga (created_at, id). Somente leitura.
    enviarWhatsapp: async (numero, texto) => {
      const { sendTextViaZApi, normalizarNumeroBrasil } = await import('../whatsappSendService')
      const { supabaseAdmin } = await import('../supabase-admin')
      const fixa = (process.env.META_ALERTA_INSTANCIA_ID ?? '').trim()
      let q = supabaseAdmin.from('whatsapp_instances').select('*').eq('is_active', true).eq('status', 'connected').neq('provider', 'meta')
      q = fixa ? q.eq('id', fixa) : q.order('created_at', { ascending: true }).order('id', { ascending: true })
      const { data } = await q.limit(1)
      const instancia = data?.[0]
      if (!instancia) return false
      const para = normalizarNumeroBrasil(numero)
      if (!para) return false
      const r = await sendTextViaZApi(instancia, para, texto)
      return r.status !== 'error'
    },
  }
}
