import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth'
import { lerConfigMeta } from '@/lib/meta/configMeta'
import { json, respostaDeErro } from '@/lib/meta/depsConexao'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    try {
      const c = await lerConfigMeta()
      return json({ appId: c.appId, configId: c.configId, graphVersion: c.graphVersion })
    } catch (e) {
      return respostaDeErro(e)
    }
  })
}
