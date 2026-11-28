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
  // UMA instrução SQL (sem transação interativa: o pooler leva ~700 ms por ida e volta).
  if (incluirResolvidos) {
    // Uma vez por período (inclui resolvidos): o id é derivado de campo|chave, então a chave primária
    // garante a unicidade de forma atômica, mesmo com dois ticks ao mesmo tempo (sem mudar o schema).
    const n = await prisma.$executeRaw`
      INSERT INTO meta_alertas (id, campo_id, tipo, mensagem)
      VALUES (md5(${campoId + '|' + chave})::uuid, ${campoId}::uuid, 'envio_pausado', ${mensagem})
      ON CONFLICT (id) DO NOTHING`
    return n > 0
  }
  // Só enquanto houver outro aberto com a mesma chave. Sem trava: numa corrida o pior caso é um aviso
  // repetido (a instrução é uma só e o tick é um único processo do cron).
  const n = await prisma.$executeRaw`
    INSERT INTO meta_alertas (campo_id, tipo, mensagem)
    SELECT ${campoId}::uuid, 'envio_pausado', ${mensagem}
    WHERE NOT EXISTS (
      SELECT 1 FROM meta_alertas
      WHERE campo_id = ${campoId}::uuid AND tipo = 'envio_pausado' AND resolvido_em IS NULL
        AND position(${chave} in mensagem) > 0)`
  return n > 0
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
