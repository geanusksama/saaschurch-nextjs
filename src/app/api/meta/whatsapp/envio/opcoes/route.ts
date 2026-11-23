import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth'
import { exigirPermissao } from '@/lib/permissoes/servidor'
import { limiteRestante } from '@/lib/meta/servicoEnvio'
import { opcoesDoCampo } from '@/lib/meta/envioConsultas'
import * as conexaoRepo from '@/lib/meta/conexaoRepo'
import { json, MSG_SEM_CAMPO, respostaDeErro } from '@/lib/meta/depsConexao'
import { montarDependenciasEnvio } from '@/lib/meta/depsEnvio'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'whatsapp_oficial.envio.view')
    if (negado) return negado
    if (!user.campoId) return json({ error: MSG_SEM_CAMPO }, 400)
    try {
      const [opcoes, conexao] = await Promise.all([opcoesDoCampo(user.campoId), conexaoRepo.buscarConexaoDoCampo(user.campoId)])
      const conectado = !!conexao && conexao.status === 'conectado'
      // O limite vem de uma leitura (sem custo) na Meta; se falhar, a tela segue sem ele.
      let limite: { limite: number; usados: number; restante: number; qualidade: string } | null = null
      if (conectado) {
        try {
          limite = await limiteRestante(await montarDependenciasEnvio(), user.campoId, new Date())
        } catch {
          limite = null
        }
      }
      return json({ ...opcoes, conectado, limite })
    } catch (e) {
      return respostaDeErro(e)
    }
  })
}
