import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth'
import { lerConfigMeta, ErroConfigMeta } from '@/lib/meta/configMeta'
import { json, respostaDeErro } from '@/lib/meta/depsConexao'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      const c = await lerConfigMeta()
      return json({ appId: c.appId, configId: c.configId, graphVersion: c.graphVersion, conexaoLiberada: c.conexaoLiberada })
    } catch (e) {
      if (e instanceof ErroConfigMeta) {
        // Configuração incompleta: a tela mostra "Em breve". Detalhe só no log do servidor.
        console.warn('[meta/whatsapp] configuração indisponível:', e.name)
        return json({ conexaoLiberada: false })
      }
      return respostaDeErro(e)
    }
  })
}
