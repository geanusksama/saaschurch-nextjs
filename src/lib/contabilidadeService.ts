/**
 * contabilidadeService — acesso externo da contabilidade ao livro caixa.
 *
 * Fluxo: telefone + hash -> codigo de 6 digitos no WhatsApp -> sessao curta
 * -> filtro de periodo -> CSV.
 *
 * Regra dura: 3 tentativas erradas (hash OU codigo) desativam o acesso.
 */

import { supabaseAdmin } from '@/lib/supabase-admin'

export const MAX_TENTATIVAS = 3

/** Tempo maximo de uma geracao antes da trava ser considerada orfa. */
const LOCK_STALE_MS = 15 * 60 * 1000

export interface ContabilidadeAcesso {
  id: string
  nome: string
  campo: string
  telefone: string
  hash: string
  ativo: boolean
  tentativas: number
  gerando: boolean
  gerando_desde: string | null
}

export function onlyDigits(v: string): string {
  return (v || '').replace(/\D/g, '')
}

export async function findAcessoByTelefone(telefone: string): Promise<ContabilidadeAcesso | null> {
  const { data } = await supabaseAdmin
    .from('contabilidade_acessos')
    .select('*')
    .eq('telefone', onlyDigits(telefone))
    .maybeSingle()

  return (data as ContabilidadeAcesso | null) ?? null
}

export async function findAcessoById(id: string): Promise<ContabilidadeAcesso | null> {
  const { data } = await supabaseAdmin
    .from('contabilidade_acessos')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  return (data as ContabilidadeAcesso | null) ?? null
}

/**
 * Registra uma tentativa errada. Ao atingir MAX_TENTATIVAS desativa o acesso.
 * Retorna quantas tentativas restam (0 = bloqueado).
 */
export async function registrarTentativaErrada(acesso: ContabilidadeAcesso): Promise<number> {
  const tentativas = (acesso.tentativas ?? 0) + 1
  const bloqueou = tentativas >= MAX_TENTATIVAS

  await supabaseAdmin
    .from('contabilidade_acessos')
    .update({
      tentativas,
      ativo: !bloqueou,
      bloqueado_em: bloqueou ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', acesso.id)

  return Math.max(0, MAX_TENTATIVAS - tentativas)
}

/** Acesso liberado: zera o contador de tentativas. */
export async function registrarAcessoOk(acessoId: string): Promise<void> {
  await supabaseAdmin
    .from('contabilidade_acessos')
    .update({
      tentativas: 0,
      ultimo_acesso: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', acessoId)
}

/**
 * Trava de geracao — impede duas buscas simultaneas do mesmo acesso.
 * Retorna false se ja existe uma geracao em andamento (nao orfa).
 */
export async function adquirirTravaGeracao(acesso: ContabilidadeAcesso): Promise<boolean> {
  if (acesso.gerando) {
    const desde = acesso.gerando_desde ? new Date(acesso.gerando_desde).getTime() : 0
    if (Date.now() - desde < LOCK_STALE_MS) return false
  }

  await supabaseAdmin
    .from('contabilidade_acessos')
    .update({ gerando: true, gerando_desde: new Date().toISOString() })
    .eq('id', acesso.id)

  return true
}

export async function liberarTravaGeracao(acessoId: string): Promise<void> {
  await supabaseAdmin
    .from('contabilidade_acessos')
    .update({ gerando: false, gerando_desde: null })
    .eq('id', acessoId)
}

// ── CSV ──────────────────────────────────────────────────────────────────────

/** Colunas exatas do modelo docs/base3 (1).csv — nao alterar ordem nem nomes. */
export const CSV_HEADER = 'datalancamento;formapg;categoria;planodeconta;valor'

export interface LivroCaixaRow {
  data_lancamento: string | null
  forma_pg: string | null
  categoria: string | null
  /** Fallback da categoria: lancamentos novos gravam so o tipo. */
  tipo: string | null
  plano_de_conta: string | null
  valor: number | string | null
}

/** yyyy-MM-dd -> dd/MM/yyyy */
function formatarData(iso: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  return d && m && y ? `${d}/${m}/${y}` : ''
}

/** 130.00 -> "130" | 31.70 -> "31.7" — igual ao modelo. */
function formatarValor(v: number | string | null): string {
  const n = typeof v === 'string' ? parseFloat(v) : v
  if (n == null || Number.isNaN(n)) return '0'
  return String(Number(n.toFixed(2)))
}

/** Campo texto sem quebrar o separador ";" do modelo. */
function limpar(v: string | null): string {
  return (v ?? '').replace(/[;\r\n]+/g, ' ').trim()
}

export function linhaCsv(row: LivroCaixaRow): string {
  return [
    formatarData(row.data_lancamento),
    limpar(row.forma_pg),
    limpar(row.categoria || row.tipo),
    limpar(row.plano_de_conta),
    formatarValor(row.valor),
  ].join(';')
}

const CHUNK = 1000

/**
 * Filtros do relatorio contabil — precisam bater com o modelo docs/base3.csv:
 *
 * - forma_pg = DINHEIRO: a contabilidade so recebe dinheiro em especie.
 *   PIX, cartao, deposito e TED NUNCA entram.
 * - valor > 0: o modelo nao tem linha zerada.
 * - campo do contador OU campo nulo: o legado importado gravou "campinas" no
 *   campo; os lancamentos novos feitos no sistema vem com campo nulo.
 *
 * Nao filtra por situacao/deleted_at de proposito: a carga do legado marcou
 * todo o historico como excluido: filtrar por isso zera o relatorio.
 */
/** Monta o filtro de campo sem deixar caractere de sintaxe do PostgREST passar. */
function orCampo(campo: string): string {
  const limpo = campo.replace(/[^\p{L}\p{N} _-]/gu, '')
  return `campo.ilike.${limpo},campo.is.null`
}

function baseQuery(campo: string, inicio: string, fim: string) {
  return supabaseAdmin
    .from('livro_caixa')
    .select('data_lancamento,forma_pg,categoria,tipo,plano_de_conta,valor')
    .or(orCampo(campo))
    .eq('forma_pg', 'DINHEIRO')
    .gt('valor', 0)
    .gte('data_lancamento', inicio)
    .lte('data_lancamento', fim)
}

export async function contarLancamentos(campo: string, inicio: string, fim: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('livro_caixa')
    .select('id', { count: 'exact', head: true })
    .or(orCampo(campo))
    .eq('forma_pg', 'DINHEIRO')
    .gt('valor', 0)
    .gte('data_lancamento', inicio)
    .lte('data_lancamento', fim)

  if (error) throw new Error(error.message)
  return count ?? 0
}

/**
 * Busca os lancamentos em blocos de 1000 (limite do PostgREST) e devolve cada
 * bloco ja convertido em linhas de CSV, para o chamador reportar o progresso.
 */
export async function* buscarLancamentosEmBlocos(
  campo: string,
  inicio: string,
  fim: string
): AsyncGenerator<string[]> {
  let offset = 0

  for (;;) {
    const { data, error } = await baseQuery(campo, inicio, fim)
      .order('data_lancamento', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + CHUNK - 1)

    if (error) throw new Error(error.message)

    const rows = (data ?? []) as LivroCaixaRow[]
    if (rows.length === 0) return

    yield rows.map(linhaCsv)

    if (rows.length < CHUNK) return
    offset += CHUNK
  }
}
