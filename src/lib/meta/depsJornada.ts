import { montarDependenciasCampanhaOficial } from './depsCampanhaOficial'
import { prisma } from '../prisma'
import { supabaseAdmin } from '../supabase-admin'
import type { DepsCampanhaOficial } from './campanhaOficial'

/** Dependências reais do envio de etapa de jornada pelo número oficial (as mesmas da campanha). */
export function montarDependenciasJornadaOficial(): Promise<DepsCampanhaOficial> {
  return montarDependenciasCampanhaOficial()
}

/**
 * Alerta `envio_pausado` do campo, sem repetir: o tick roda a cada minuto, então só grava se não
 * houver outro com a mesma `chave` (no texto). `incluirResolvidos` torna a regra "uma vez por período".
 */
export async function alertarEnvioPausadoUmaVez(
  campoId: string, chave: string, mensagem: string, incluirResolvidos: boolean,
): Promise<boolean> {
  // Trava de aviso por (campo, chave) até o fim da transação: dois ticks simultâneos não gravam duas vezes
  // (sem mudar o schema). Poucas instruções, cabe no limite da transação interativa.
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${campoId + '|' + chave}))`
    const jaTem = await tx.metaAlerta.findFirst({
      where: { campoId, tipo: 'envio_pausado', mensagem: { contains: chave }, ...(incluirResolvidos ? {} : { resolvidoEm: null }) },
      select: { id: true },
    })
    if (jaTem) return false
    await tx.metaAlerta.create({ data: { campoId, tipo: 'envio_pausado', mensagem } })
    return true
  })
}

/** O cronograma está ligado e usa o número oficial? (estado atual no banco) */
export async function cronogramaOficialAtivo(journeyId: string): Promise<boolean> {
  const { data: j } = await supabaseAdmin.from('pastoral_journeys').select('is_active').eq('id', journeyId).maybeSingle()
  if (!j?.is_active) return false
  const { data: links } = await supabaseAdmin.from('pastoral_journey_instances').select('instance_id').eq('journey_id', journeyId)
  const ids = (links ?? []).map((l) => l.instance_id)
  if (!ids.length) return false
  const { count } = await supabaseAdmin.from('whatsapp_instances').select('id', { count: 'exact', head: true }).in('id', ids).eq('provider', 'meta')
  return (count ?? 0) > 0
}

/** Campo (igreja -> regional -> campo) e nome da igreja dona da jornada. */
export async function campoEIgreja(churchId: string): Promise<{ campoId: string | null; nome: string }> {
  const ig = await prisma.church.findUnique({ where: { id: churchId }, select: { name: true, regional: { select: { campoId: true } } } })
  return { campoId: ig?.regional?.campoId ?? null, nome: ig?.name ?? '' }
}
