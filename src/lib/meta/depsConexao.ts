import { NextResponse } from 'next/server'
import { cifrar, decifrar } from './cifra'
import { criarGraph } from './graph'
import { trocarCodigo, registrarNumero, assinarWebhookDaConta, cancelarAssinaturaWebhook, lerStatusNumero, gerarPin } from './conexaoMeta'
import { lerConfigMeta, ErroConfigMeta } from './configMeta'
import { ErroServico, type Dependencias } from './servicoConexao'
import * as repo from './conexaoRepo'

export async function montarDependencias(): Promise<Dependencias> {
  const config = await lerConfigMeta()
  return {
    repo,
    graph: criarGraph({ versao: config.graphVersion }),
    config,
    cifra: { cifrar, decifrar },
    meta: { trocarCodigo, registrarNumero, assinarWebhookDaConta, cancelarAssinaturaWebhook, lerStatusNumero, gerarPin },
  }
}

export const SEM_CACHE = { 'Cache-Control': 'no-store' }
export const MSG_SEM_CAMPO = 'Selecione um campo antes de conectar o WhatsApp oficial.'

export function json(corpo: unknown, status = 200) {
  return NextResponse.json(corpo, { status, headers: SEM_CACHE })
}

export function respostaDeErro(e: unknown) {
  if (e instanceof ErroConfigMeta) return json({ error: e.message }, 503)
  if (e instanceof ErroServico) return json({ error: e.message }, e.status)
  console.error('[meta/whatsapp] erro inesperado:', (e as Error)?.name)
  return json({ error: 'Erro interno ao processar a conexão do WhatsApp oficial.' }, 500)
}
