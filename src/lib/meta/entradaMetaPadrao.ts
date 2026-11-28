/**
 * Ligação real (Supabase, Prisma, Graph, cifra, storage) da Caixa de Entrada pelo número
 * oficial: mensagem recebida no webhook da Meta ⇒ registrarMensagemRecebida (a mesma da
 * Z-API, com o agente de IA) e status ⇒ whatsapp_messages. Núcleo testável em entradaMeta.ts.
 * Nunca registra o token.
 */
import { prisma } from '../prisma'
import { supabaseAdmin } from '../supabase-admin'
import { registrarMensagemRecebida } from '../whatsappRecebida'
import { criarGraph } from './graph'
import { decifrar } from './cifra'
import { lerConfigMeta } from './configMeta'
import { variantesTelefoneBR } from './envioLivre'
import { baixarMidiaMeta, converterMensagemMeta, statusConversaAvanca, type StatusConversa } from './entradaMeta'

const ROTULO = '[meta/webhook]'

/** Instância espelho do número oficial (provider 'meta', instance_id 'meta:<phone_number_id>'). */
async function instanciaOficial(phoneNumberId: string) {
  const { data } = await supabaseAdmin
    .from('whatsapp_instances')
    .select('id, owner_user_id, metadata')
    .eq('provider', 'meta')
    .eq('instance_id', `meta:${phoneNumberId}`)
    .maybeSingle()
  return data as { id: string; owner_user_id: string; metadata: unknown } | null
}

async function tokenDoNumero(phoneNumberId: string): Promise<string | null> {
  const c = await prisma.metaWhatsappConexao.findUnique({ where: { phoneNumberId }, select: { tokenCifrado: true } })
  if (!c?.tokenCifrado) return null
  const cfg = await lerConfigMeta()
  try {
    return decifrar(c.tokenCifrado, cfg.chaveCifra)
  } catch {
    return null
  }
}

async function baixarMidia(phoneNumberId: string, mediaId: string, dica: { mime?: string | null; nomeArquivo?: string | null }) {
  const token = await tokenDoNumero(phoneNumberId)
  if (!token) return null
  const cfg = await lerConfigMeta()
  return baixarMidiaMeta({
    graph: criarGraph({ versao: cfg.graphVersion }),
    baixar: async (url, tk) => {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${tk}` }, signal: AbortSignal.timeout(20_000) })
      const bytes = r.ok ? new Uint8Array(await r.arrayBuffer()) : new Uint8Array()
      return { ok: r.ok, status: r.status, bytes, tipo: r.headers.get('content-type') }
    },
    guardar: async (caminho, bytes, mime) => {
      const { error } = await supabaseAdmin.storage.from('dados').upload(caminho, Buffer.from(bytes), { contentType: mime, upsert: false })
      if (error) {
        console.error(`${ROTULO} upload da mídia falhou`, error.message)
        return null
      }
      return supabaseAdmin.storage.from('dados').getPublicUrl(caminho).data.publicUrl
    },
  }, mediaId, token, dica)
}

/** Mensagem recebida pelo número oficial ⇒ conversa da instância espelho. false = nada gravado. */
export async function registrarRecebidaMeta(phoneNumberId: string, msg: unknown, contatos: unknown): Promise<boolean> {
  const conv = converterMensagemMeta(msg, contatos)
  if (!conv) return false
  const instancia = await instanciaOficial(phoneNumberId)
  if (!instancia) return false

  const m = conv.mensagem
  const mediaId = typeof m.extra.meta_media_id === 'string' ? m.extra.meta_media_id : null
  if (mediaId) {
    // falha no download: grava sem a mídia (o meta_media_id fica no metadata)
    const midia = await baixarMidia(phoneNumberId, mediaId, { mime: m.mediaMime, nomeArquivo: (m.extra.fileName as string) ?? null })
    if (midia) {
      m.mediaUrl = midia.url
      m.mediaMime = midia.mime
    }
  }

  return registrarMensagemRecebida({
    instancia,
    telefone: conv.telefone,
    nomeRemetente: conv.nomeRemetente,
    mensagem: m,
    idExterno: conv.idExterno,
    chaveId: 'meta_message_id',
  }, ROTULO)
}

/** Status de mensagem livre enviada pelo número oficial ⇒ whatsapp_messages.status (sem regredir). */
export async function atualizarStatusConversaMeta(ev: StatusConversa): Promise<boolean> {
  const instancia = await instanciaOficial(ev.phoneNumberId)
  if (!instancia) return false
  const { data: convs } = await supabaseAdmin
    .from('whatsapp_conversations')
    .select('id')
    .eq('instance_id', instancia.id)
    .in('phone', variantesTelefoneBR(ev.telefone))
  if (!convs?.length) return false
  const { data: msgs } = await supabaseAdmin
    .from('whatsapp_messages')
    .select('id, status')
    .in('conversation_id', convs.map((c) => c.id))
    .eq('metadata->>meta_message_id', ev.wamid)
    .limit(5)
  let mudou = false
  for (const msg of msgs ?? []) {
    if (!statusConversaAvanca(msg.status as string | null, ev.status)) continue
    // troca condicionada: outro evento simultâneo não é sobrescrito para trás
    let q = supabaseAdmin.from('whatsapp_messages').update({ status: ev.status }).eq('id', msg.id)
    q = msg.status == null ? q.is('status', null) : q.eq('status', msg.status)
    const { error } = await q
    if (!error) mudou = true
  }
  return mudou
}

export function depsConversasMeta() {
  return { registrar: registrarRecebidaMeta, atualizarStatus: atualizarStatusConversaMeta }
}
