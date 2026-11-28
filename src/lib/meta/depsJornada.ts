import { montarDependenciasCampanhaOficial } from './depsCampanhaOficial'
import { prisma } from '../prisma'
import { gravarAlertas } from './alertasRepo'
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
  const jaTem = await prisma.metaAlerta.findFirst({
    where: { campoId, tipo: 'envio_pausado', mensagem: { contains: chave }, ...(incluirResolvidos ? {} : { resolvidoEm: null }) },
    select: { id: true },
  })
  if (jaTem) return false
  await gravarAlertas([{ campoId, tipo: 'envio_pausado', mensagem, proposta: null }])
  return true
}

/** Campo (igreja -> regional -> campo) e nome da igreja dona da jornada. */
export async function campoEIgreja(churchId: string): Promise<{ campoId: string | null; nome: string }> {
  const ig = await prisma.church.findUnique({ where: { id: churchId }, select: { name: true, regional: { select: { campoId: true } } } })
  return { campoId: ig?.regional?.campoId ?? null, nome: ig?.name ?? '' }
}
