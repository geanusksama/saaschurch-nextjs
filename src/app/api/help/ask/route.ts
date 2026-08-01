import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, type AuthUser } from '@/lib/auth'
import { generateAiText, type ChatTurn } from '@/lib/aiReplyService'
import { filterHelpSections, helpCorpus, searchHelp, type HelpSection } from '@/lib/helpContent'
import { mergeModules, type ProfileKey } from '@/app-ui/system/permissionCatalog'
import { resolvePermission } from '@/lib/resolvePermission'
import {
  lookupCachedAnswer,
  normalizeQuestion,
  perguntasFrequentes,
  saveAnswer,
  scopeHash,
} from '@/lib/helpAiCache'

/**
 * POST /api/help/ask — a IA da Central de Ajuda.
 *
 * Responde **apenas** com o que está na documentação (`src/lib/helpContent.ts`).
 * Não consulta o banco, não vê dados de membro, não executa nada: é ajuda de
 * uso do sistema, não análise de dados — isso é o Assistente de IA, que é outra
 * coisa e tem outro controle de acesso.
 *
 * Quando a resposta não está na documentação, o prompt manda dizer isso em vez
 * de inventar. Ajuda inventada é pior que ajuda nenhuma: manda a pessoa clicar
 * num botão que não existe.
 */

const MAX_PERGUNTA = 500
const MAX_HISTORICO = 6

/**
 * Recorta a documentação para o que ESTE usuário pode usar, no servidor.
 *
 * O filtro da tela não bastaria: bastaria perguntar no chat para receber a
 * explicação de uma tela sem acesso. Aqui o texto simplesmente não entra no
 * prompt, então não há o que a IA possa contar.
 *
 * Usa a mesma resolução do menu (`resolvePermission`), com a matriz salva
 * mesclada ao catálogo do código.
 */
async function documentacaoDoUsuario(user: AuthUser): Promise<{
  secoes: HelpSection[]
  permKeys: string[]
}> {
  let salva = null
  try {
    const row = await prisma.setting.findFirst({
      where: { settingKey: 'permissions_matrix', churchId: null },
    })
    if (row?.settingValue) salva = JSON.parse(row.settingValue as string)
  } catch {
    // matriz ilegível: cai no catálogo do código, que é o padrão seguro
  }

  const modules = mergeModules(salva)
  const userOverrides = (user.permissions ?? {}) as Record<string, boolean>

  const permKeys: string[] = []
  const secoes = filterHelpSections((permKey) => {
    const pode = resolvePermission({
      key: permKey,
      action: 'view',
      profileType: user.profileType as ProfileKey,
      modules,
      userOverrides,
      userRoleId: user.roleId,
    })
    if (pode) permKeys.push(permKey)
    return pode
  })

  return { secoes, permKeys }
}

function montarPrompt(pergunta: string, secoes: HelpSection[]): string {
  // Os artigos mais relevantes vão destacados no topo; o restante da
  // documentação vai junto porque cabe inteira no contexto e evita o caso
  // clássico de a busca errar o artigo certo e a IA responder "não sei".
  const relevantes = searchHelp(pergunta, 4, secoes)
    .map(h => `### ${h.article.title}\n${h.article.body.trim()}`)
    .join('\n\n')

  return `Você é o assistente de ajuda do MRM, o sistema de gestão da igreja.

Responda em português do Brasil, de forma direta e prática, para quem OPERA o
sistema (secretaria, tesouraria, liderança) — não para quem programa.

REGRAS:
- Use SOMENTE a documentação abaixo. Se a resposta não estiver nela, diga que
  não encontrou na documentação e sugira falar com quem administra o sistema.
- Nunca invente nome de botão, de tela ou de caminho de menu.
- Quando houver um caminho, escreva no formato: Menu → Submenu.
- A documentação abaixo já vem recortada para o acesso desta pessoa. Se ela
  perguntar sobre algo que não está aqui, responda que não encontrou e sugira
  falar com quem administra o sistema — nunca deduza que a tela existe.
- Seja curto: 2 a 6 frases, ou uma lista de passos. Sem introdução nem despedida.
- Não fale sobre banco de dados, tabelas, arquivos de código ou APIs.

${relevantes ? `TRECHOS MAIS RELEVANTES PARA ESTA PERGUNTA:\n\n${relevantes}\n\n` : ''}DOCUMENTAÇÃO COMPLETA:

${helpCorpus(secoes)}`
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = (await req.json().catch(() => ({}))) as {
      question?: string
      history?: { role: string; content: string }[]
    }

    const pergunta = String(body.question ?? '').trim().slice(0, MAX_PERGUNTA)
    if (!pergunta) return NextResponse.json({ error: 'Escreva sua dúvida.' }, { status: 400 })

    const historico: ChatTurn[] = (body.history ?? [])
      .slice(-MAX_HISTORICO)
      .filter(m => m?.content && (m.role === 'user' || m.role === 'assistant'))
      .map(m => ({ role: m.role as 'user' | 'assistant', content: String(m.content).slice(0, 2000) }))

    // corte por permissão ANTES de montar o prompt
    const { secoes, permKeys } = await documentacaoDoUsuario(user)

    // O cache vale só para a primeira pergunta da conversa: com histórico, a
    // resposta depende do que veio antes e deixa de ser a mesma para todos.
    const escopo = scopeHash(user.profileType, permKeys)
    const perguntaNorm = normalizeQuestion(pergunta)
    if (!historico.length) {
      const cacheada = await lookupCachedAnswer(perguntaNorm, escopo).catch(() => null)
      if (cacheada) {
        return NextResponse.json({ ...cacheada, cached: true })
      }
    }

    try {
      const answer = await generateAiText(user.campoId, montarPrompt(pergunta, secoes), [
        ...historico,
        { role: 'user', content: pergunta },
      ])

      const resposta = answer.trim()
      // os artigos usados viram atalhos clicáveis no painel
      const sources = searchHelp(pergunta, 3, secoes).map(h => ({
        sectionId: h.section.id,
        articleId: h.article.id,
        title: h.article.title,
      }))

      if (!historico.length && resposta) {
        // gravar não pode atrasar a resposta nem derrubá-la
        saveAnswer({ question: pergunta, questionNorm: perguntaNorm, scope: escopo, answer: resposta, sources })
          .catch(err => console.error('[help/ask] falha ao cachear', err))
      }

      return NextResponse.json({ answer: resposta, sources })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao consultar a IA'
      // sem chave configurada não é erro do usuário: a busca por texto continua servindo
      return NextResponse.json(
        { error: `${msg}. Use a busca da Central de Ajuda enquanto isso.` },
        { status: 503 }
      )
    }
  })
}

/**
 * GET /api/help/ask — as perguntas mais feitas por quem enxerga a mesma
 * documentação. Alimenta os atalhos da tela, para a pessoa não precisar
 * escrever (nem gastar IA) para uma dúvida que já foi respondida.
 */
export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const { permKeys } = await documentacaoDoUsuario(user)
    const perguntas = await perguntasFrequentes(scopeHash(user.profileType, permKeys)).catch(() => [])
    return NextResponse.json({ perguntas })
  })
}
