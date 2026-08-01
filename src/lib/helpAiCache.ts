/**
 * Cache das respostas da IA da Central de Ajuda.
 *
 * A mesma dúvida é feita por muita gente, e a documentação não muda entre uma
 * pergunta e outra — sem cache, cada repetição é uma chamada paga devolvendo o
 * mesmo texto.
 *
 * A chave não é só a pergunta: a documentação enviada à IA é recortada pelo que
 * cada pessoa pode ver. Servir a resposta de um admin para quem tem menos
 * acesso vazaria a existência de telas que a pessoa não deveria conhecer — por
 * isso o escopo entra na chave.
 *
 * Server-side apenas.
 */

import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-admin'

export interface HelpSource {
  sectionId: string
  articleId: string
  title: string
}

/** Sem acento, sem pontuação, sem "por favor": é o que agrupa as variações. */
export function normalizeQuestion(question: string): string {
  return String(question ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Assinatura do que esta pessoa enxerga da documentação. */
export function scopeHash(profileType: string, permKeysVisiveis: string[]): string {
  const base = `${profileType}|${[...permKeysVisiveis].sort().join(',')}`
  return createHash('sha256').update(base).digest('hex').slice(0, 32)
}

function cacheKey(questionNorm: string, scope: string): string {
  return createHash('sha256').update(`${questionNorm}|${scope}`).digest('hex')
}

export async function lookupCachedAnswer(questionNorm: string, scope: string) {
  if (!questionNorm) return null

  const { data } = await supabaseAdmin
    .from('help_ai_cache')
    .select('id, answer, sources, hits')
    .eq('cache_key', cacheKey(questionNorm, scope))
    .maybeSingle()

  if (!data) return null

  // Contabiliza o acerto sem segurar a resposta: o número só alimenta a lista
  // de "mais perguntadas", não vale travar o usuário por ele.
  supabaseAdmin
    .from('help_ai_cache')
    .update({ hits: (data.hits ?? 0) + 1, last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(undefined, (err) => console.error('[helpAiCache] falha ao contar hit', err))

  return { answer: data.answer as string, sources: (data.sources ?? []) as HelpSource[] }
}

export async function saveAnswer(opts: {
  question: string
  questionNorm: string
  scope: string
  answer: string
  sources: HelpSource[]
}) {
  const { error } = await supabaseAdmin.from('help_ai_cache').upsert(
    {
      cache_key: cacheKey(opts.questionNorm, opts.scope),
      question: opts.question,
      question_norm: opts.questionNorm,
      scope_hash: opts.scope,
      answer: opts.answer,
      sources: opts.sources,
      last_used_at: new Date().toISOString(),
    },
    { onConflict: 'cache_key' }
  )
  if (error) console.error('[helpAiCache] falha ao gravar', error)
}

/** As perguntas mais feitas por quem enxerga a mesma documentação. */
export async function perguntasFrequentes(scope: string, limite = 8): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from('help_ai_cache')
    .select('question, hits')
    .eq('scope_hash', scope)
    .order('hits', { ascending: false })
    .order('last_used_at', { ascending: false })
    .limit(limite)

  return (data ?? []).map((r) => r.question as string)
}
