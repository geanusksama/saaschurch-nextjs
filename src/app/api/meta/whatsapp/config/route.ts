import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth'
import { lerConfigMeta, ErroConfigMeta } from '@/lib/meta/configMeta'
import { json, respostaDeErro } from '@/lib/meta/depsConexao'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    try {
      const c = await lerConfigMeta()
      const podeConectar = c.conexaoLiberada || user.profileType === 'master'
      return json({ appId: c.appId, configId: c.configId, graphVersion: c.graphVersion, conexaoLiberada: c.conexaoLiberada, podeConectar })
    } catch (e) {
      if (e instanceof ErroConfigMeta) {
        // Configuração incompleta: a tela mostra "Em breve". Detalhe só no log do servidor.
        console.warn('[meta/whatsapp] configuração indisponível:', e.name)
        return json({ conexaoLiberada: false, podeConectar: false })
      }
      return respostaDeErro(e)
    }
  })
}
