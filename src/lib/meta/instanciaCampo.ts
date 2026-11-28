/**
 * Regras puras (sem banco) da instância espelho do número oficial da Meta em
 * whatsapp_instances. Separado de instanciaOficial.ts para testar sem Next/Prisma.
 */

export type ComProvedor = { provider?: string | null; campo_id?: string | null }

/**
 * Isolamento por campo: instâncias Z-API passam sempre (comportamento antigo);
 * a oficial (provider 'meta') só aparece no campo a que pertence. Sem campo
 * ativo, nenhuma oficial.
 */
export function filtrarPorCampo<T extends ComProvedor>(lista: T[], campoAtivo: string | null | undefined): T[] {
  return lista.filter((i) => i.provider !== 'meta' || (!!campoAtivo && i.campo_id === campoAtivo))
}

/** Campo da instância: coluna campo_id para a oficial; agente de recepção para a Z-API. */
export function campoDaInstancia(
  i: ComProvedor,
  campoDoAgente: string | null,
): string | null {
  return i.provider === 'meta' ? i.campo_id ?? null : campoDoAgente
}

export type ConexaoParaEspelho = {
  campoId: string
  phoneNumberId: string
  numero: string | null
  nomeExibicao: string | null
  status: string
}

/** Colunas da linha espelho em whatsapp_instances (sem owner_user_id, resolvido por quem grava). */
export function linhaDaInstanciaOficial(c: ConexaoParaEspelho) {
  const conectado = c.status === 'conectado'
  return {
    provider: 'meta' as const,
    instance_id: `meta:${c.phoneNumberId}`,
    campo_id: c.campoId,
    name: `Oficial Meta – ${c.numero ?? c.nomeExibicao ?? c.phoneNumberId}`,
    phone_number: c.numero,
    status: conectado ? 'connected' : 'disconnected',
    is_active: conectado,
  }
}
