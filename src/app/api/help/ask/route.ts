import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { generateAiText, type ChatTurn } from '@/lib/aiReplyService'
import { helpCorpus, searchHelp } from '@/lib/helpContent'

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

function montarPrompt(pergunta: string): string {
  // Os artigos mais relevantes vão destacados no topo; o restante da
  // documentação vai junto porque cabe inteira no contexto e evita o caso
  // clássico de a busca errar o artigo certo e a IA responder "não sei".
  const relevantes = searchHelp(pergunta, 4)
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
- Seja curto: 2 a 6 frases, ou uma lista de passos. Sem introdução nem despedida.
- Não fale sobre banco de dados, tabelas, arquivos de código ou APIs.

${relevantes ? `TRECHOS MAIS RELEVANTES PARA ESTA PERGUNTA:\n\n${relevantes}\n\n` : ''}DOCUMENTAÇÃO COMPLETA:

${helpCorpus()}`
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

    try {
      const answer = await generateAiText(user.campoId, montarPrompt(pergunta), [
        ...historico,
        { role: 'user', content: pergunta },
      ])

      return NextResponse.json({
        answer: answer.trim(),
        // os artigos usados viram atalhos clicáveis no painel
        sources: searchHelp(pergunta, 3).map(h => ({
          sectionId: h.section.id,
          articleId: h.article.id,
          title: h.article.title,
          path: h.article.path ?? null,
        })),
      })
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
