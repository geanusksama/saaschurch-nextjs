import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth'
import { exigirPermissao } from '@/lib/permissoes/servidor'
import { prisma } from '@/lib/prisma'
import { generateAiText } from '@/lib/aiReplyService'
import { sugerirModelo } from '@/lib/meta/sugestaoModelo'
import { json, MSG_SEM_CAMPO } from '@/lib/meta/depsConexao'

export const dynamic = 'force-dynamic'

const MAX_DESCRICAO = 500

/** Só devolve o rascunho para a pessoa revisar; nunca fala com a Meta nem grava modelo. */
export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'whatsapp_oficial.modelos.criar')
    if (negado) return negado
    if (!user.campoId) return json({ error: MSG_SEM_CAMPO }, 400)
    const campoId = user.campoId
    const b = (await req.json().catch(() => null)) as { descricao?: unknown; categoria?: unknown } | null
    const descricao = typeof b?.descricao === 'string' ? b.descricao.trim() : ''
    if (!descricao) return json({ error: 'Descreva o que a mensagem deve dizer.' }, 400)
    if (descricao.length > MAX_DESCRICAO) return json({ error: `A descrição deve ter no máximo ${MAX_DESCRICAO} caracteres.` }, 400)
    const categoria = b?.categoria === 'MARKETING' ? 'MARKETING' : 'UTILITY'
    try {
      const campo = await prisma.campo.findUnique({ where: { id: campoId }, select: { name: true } })
      const r = await sugerirModelo(
        { descricao, categoria, igrejaNome: campo?.name || 'a igreja' },
        (prompt) => generateAiText(campoId, prompt, [{ role: 'user', content: 'Gere o modelo agora.' }]),
      )
      if (!r.ok) return json({ error: r.erro }, 422)
      return json({ rascunho: r.rascunho })
    } catch {
      return json({ error: 'Não foi possível gerar a sugestão agora. Tente de novo.' }, 500)
    }
  })
}
