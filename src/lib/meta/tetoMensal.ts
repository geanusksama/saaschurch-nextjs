/**
 * Teto mensal de mensagens do número oficial (por campo). Regras puras no topo; as consultas
 * ao banco importam o cliente só quando chamadas (para testar sem Next/Prisma).
 * O mês vai do dia 1 às 00:00 até o fim do mês em America/Sao_Paulo (UTC-3 fixo, sem horário de verão).
 */

const BRT_MS = 3 * 60 * 60 * 1000

/** Vazio (null) = sem teto. Com teto, só envia enquanto os enviados no mês forem menores que ele. */
export function podeEnviarNoMes(teto: number | null, enviadosNoMes: number): boolean {
  if (teto === null || teto === undefined) return true
  return enviadosNoMes < teto
}

/** Instante (UTC) da meia-noite do dia 1 do mês de `agora`, no horário de Brasília. */
export function inicioDoMes(agora: Date): Date {
  const b = new Date(agora.getTime() - BRT_MS)
  return new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), 1) + BRT_MS)
}

/** Instante (UTC) da meia-noite do dia 1 do mês seguinte, no horário de Brasília. */
export function inicioDoProximoMes(agora: Date): Date {
  const b = new Date(agora.getTime() - BRT_MS)
  return new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth() + 1, 1) + BRT_MS)
}

/** "AAAA-MM" do mês de Brasília (chave de deduplicação do alerta). */
export function chaveDoMes(agora: Date): string {
  const b = new Date(agora.getTime() - BRT_MS)
  return `${b.getUTCFullYear()}-${String(b.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Aceita só inteiro >= 1; vazio vira null (sem teto). Retorna undefined se inválido. */
export function lerTeto(valor: unknown): number | null | undefined {
  if (valor === null || valor === undefined || valor === '') return null
  const n = typeof valor === 'number' ? valor : Number(String(valor).trim())
  if (!Number.isInteger(n) || n < 1 || n > 10_000_000) return undefined
  return n
}

/**
 * Mensagens do número oficial do campo desde o dia 1 do mês: `outbound` com
 * metadata.meta_message_id nas conversas das instâncias oficiais do campo.
 */
export async function contarEnviadosNoMes(campoId: string, agora: Date): Promise<number> {
  const { supabaseAdmin } = await import('../supabase-admin')
  const { data: inst } = await supabaseAdmin
    .from('whatsapp_instances')
    .select('id')
    .eq('provider', 'meta')
    .eq('campo_id', campoId)
  const ids = (inst ?? []).map((i: { id: string }) => i.id)
  if (!ids.length) return 0
  const { count } = await supabaseAdmin
    .from('whatsapp_messages')
    .select('id, whatsapp_conversations!inner(instance_id)', { count: 'exact', head: true })
    .eq('direction', 'outbound')
    .not('metadata->>meta_message_id', 'is', null)
    .gte('created_at', inicioDoMes(agora).toISOString())
    .in('whatsapp_conversations.instance_id', ids)
  // Envio de jornada aceito pela Meta cujo histórico falhou (sem conversa gravada): conta do mesmo jeito.
  const { count: semHistorico } = await supabaseAdmin
    .from('pastoral_journey_sends')
    .select('id', { count: 'exact', head: true })
    .in('instance_id', ids)
    .eq('status', 'sent')
    .not('wa_message_id', 'is', null)
    .is('conversation_id', null)
    .gte('sent_at', inicioDoMes(agora).toISOString())
  return (count ?? 0) + (semHistorico ?? 0)
}

/** Teto mensal gravado na conexão do campo (null = sem teto). */
export async function lerTetoDoCampo(campoId: string): Promise<number | null> {
  const { prisma } = await import('../prisma')
  const c = await prisma.metaWhatsappConexao.findUnique({ where: { campoId }, select: { tetoMensal: true } })
  return c?.tetoMensal ?? null
}

/**
 * Estimativa mostrada ao ligar a jornada: envios ainda pendentes até o fim do mês
 * (inscritos ativos × etapas ativas que ainda vão sair no mês — a fila já é materializada
 * por inscrito, então a contagem é exata para quem já está inscrito).
 */
export async function previsaoMensal(jornada: { id: string }, agora: Date = new Date()): Promise<number> {
  const { supabaseAdmin } = await import('../supabase-admin')
  const { count } = await supabaseAdmin
    .from('pastoral_journey_sends')
    .select('id', { count: 'exact', head: true })
    .eq('journey_id', jornada.id)
    .eq('status', 'pending')
    .lt('scheduled_at', inicioDoProximoMes(agora).toISOString())
  return count ?? 0
}

/**
 * Mesma previsão, separada pela categoria do modelo de cada etapa (para estimar o valor).
 * Etapa sem modelo não entra (o cronograma oficial nem a liga sem modelo).
 */
export async function previsaoPorCategoria(jornada: { id: string }, agora: Date = new Date()): Promise<Record<string, number>> {
  const { supabaseAdmin } = await import('../supabase-admin')
  const { prisma } = await import('../prisma')
  const { data: etapas } = await supabaseAdmin
    .from('pastoral_journey_steps').select('id, meta_modelo_id').eq('journey_id', jornada.id).not('meta_modelo_id', 'is', null).limit(200)
  const ids = [...new Set((etapas ?? []).map((e: { meta_modelo_id: string }) => e.meta_modelo_id))]
  if (!ids.length) return {}
  const modelos = await prisma.metaWhatsappModelo.findMany({ where: { id: { in: ids } }, select: { id: true, categoria: true }, take: 200 })
  const categoria = new Map(modelos.map((m) => [m.id, m.categoria.toUpperCase()]))
  const fim = inicioDoProximoMes(agora).toISOString()
  const saida: Record<string, number> = {}
  const contagens = await Promise.all((etapas ?? []).map(async (e: { id: string; meta_modelo_id: string }) => {
    const { count } = await supabaseAdmin
      .from('pastoral_journey_sends').select('id', { count: 'exact', head: true })
      .eq('journey_id', jornada.id).eq('step_id', e.id).eq('status', 'pending').lt('scheduled_at', fim)
    return [categoria.get(e.meta_modelo_id), count ?? 0] as const
  }))
  for (const [cat, n] of contagens) if (cat && n) saida[cat] = (saida[cat] ?? 0) + n
  return saida
}

/** Grava o teto na conexão do campo. false = o campo não tem conexão. */
export async function gravarTetoDoCampo(campoId: string, teto: number | null): Promise<boolean> {
  const { prisma } = await import('../prisma')
  const r = await prisma.metaWhatsappConexao.updateMany({ where: { campoId }, data: { tetoMensal: teto } })
  return r.count > 0
}
