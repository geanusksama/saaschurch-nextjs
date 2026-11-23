import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth'
import { exigirPermissao } from '@/lib/permissoes/servidor'
import { ehBase, visaoPublica } from '@/lib/meta/configCentral'
import { lerLinha } from '@/lib/meta/configCentralRepo'
import { json } from '@/lib/meta/depsConexao'

export const dynamic = 'force-dynamic'

/** Visão do master: valores atuais SEM a chave secreta (só se está definida). */
export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'meta_app.view')
    if (negado) return negado
    let linha = null
    try {
      linha = await lerLinha()
    } catch {
      /* tabela ainda não criada: mostra só o que vem do ambiente */
    }
    return json({ ...visaoPublica(linha, process.env), base: ehBase(process.env) })
  })
}
