import { criarConfigCentral, mesclarComEnv } from './configCentral'
import { decifrar } from './cifra'
import { lerLinha } from './configCentralRepo'

/** Instância de produção (banco/base reais). Carregada só sob demanda. */
export const configCentral = criarConfigCentral({
  env: process.env,
  fetch: (...a) => fetch(...a),
  agora: () => Date.now(),
  lerLinha,
  decifrar,
})

export { mesclarComEnv }
