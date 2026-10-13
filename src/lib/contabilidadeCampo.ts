/**
 * Contadores (contabilidade_acessos) por campo.
 *
 * O contador guarda o campo como TEXTO (nome ou código, o mesmo que
 * resolverCampoId aceita). Estas funções cruzam esse texto com o campo ativo
 * do usuário: estando em Aguaí, contador de Campinas não aparece, não abre e
 * não dispara — para todo perfil, master inclusive (ver lib/campoAtivo.ts).
 */
import type { AuthUser } from './auth'
import { prisma } from './prisma'
import { supabaseAdmin } from './supabase-admin'

function normalizar(valor: unknown) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
}

/** Nome e código do campo ativo, normalizados. Vazio quando não há campo. */
export async function nomesDoCampoAtivo(user: AuthUser): Promise<Set<string>> {
  if (!user.campoId) return new Set()
  const campo = await prisma.campo.findFirst({
    where: { id: user.campoId, deletedAt: null },
    select: { name: true, code: true },
  })
  return new Set([normalizar(campo?.name), normalizar(campo?.code)].filter(Boolean))
}

export function campoTextoEhDoCampoAtivo(campoTexto: unknown, nomes: Set<string>) {
  const valor = normalizar(campoTexto)
  return Boolean(valor) && nomes.has(valor)
}

/** O contador pertence ao campo ativo? Usado nas rotas que recebem o id. */
export async function acessoContabilNoCampoAtivo(user: AuthUser, acessoId: string) {
  const [nomes, { data }] = await Promise.all([
    nomesDoCampoAtivo(user),
    supabaseAdmin.from('contabilidade_acessos').select('campo').eq('id', acessoId).maybeSingle(),
  ])
  return Boolean(data) && campoTextoEhDoCampoAtivo(data?.campo, nomes)
}
