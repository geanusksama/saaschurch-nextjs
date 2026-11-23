import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/auth'
import { exigirPermissao } from '@/lib/permissoes/servidor'
import * as conexaoRepo from '@/lib/meta/conexaoRepo'
import * as modelosRepo from '@/lib/meta/modelosRepo'
import { criarModelo } from '@/lib/meta/servicoModelos'
import { validarRascunho, type RascunhoModelo } from '@/lib/meta/modelos'
import { json, MSG_SEM_CAMPO, respostaDeErro } from '@/lib/meta/depsConexao'
import { montarDependenciasModelos } from '@/lib/meta/depsModelos'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'whatsapp_oficial.modelos.view')
    if (negado) return negado
    if (!user.campoId) return json({ error: MSG_SEM_CAMPO }, 400)
    try {
      const c = await conexaoRepo.buscarConexaoDoCampo(user.campoId)
      if (!c || c.status === 'desconectado') return json({ modelos: [], conectado: false })
      return json({ modelos: await modelosRepo.listar(user.campoId), conectado: true })
    } catch (e) {
      return respostaDeErro(e)
    }
  })
}

const ehTexto = (v: unknown) => v === undefined || v === null || typeof v === 'string'

/** Forma do corpo (tipos); as regras da Meta ficam em validarRascunho. Devolve erros ou o rascunho. */
function lerRascunho(b: unknown): { erros: string[] } | { rascunho: RascunhoModelo } {
  const o = (b && typeof b === 'object' ? b : {}) as Record<string, unknown>
  const erros: string[] = []
  if (typeof o.nome !== 'string') erros.push('Informe o nome do modelo.')
  if (o.categoria !== 'MARKETING' && o.categoria !== 'UTILITY') erros.push('Categoria inválida.')
  if (typeof o.corpo !== 'string') erros.push('Informe o texto do corpo.')
  for (const k of ['cabecalho', 'exemploCabecalho', 'tipoCabecalho', 'rodape'] as const) {
    if (!ehTexto(o[k])) erros.push(`Campo ${k} inválido.`)
  }
  const botoes = o.botoes ?? []
  if (!Array.isArray(botoes) || botoes.some((x) => !x || typeof (x as { texto?: unknown }).texto !== 'string')) {
    erros.push('Botões inválidos.')
  }
  const vars = o.variaveis ?? []
  if (!Array.isArray(vars) || vars.some((x) => {
    const v = x as { posicao?: unknown; tipo?: unknown; exemplo?: unknown }
    return !v || typeof v.posicao !== 'number' || typeof v.tipo !== 'string' || typeof v.exemplo !== 'string'
  })) erros.push('Variáveis inválidas.')
  if (erros.length) return { erros }
  const rascunho = {
    nome: o.nome, categoria: o.categoria, corpo: o.corpo,
    cabecalho: o.cabecalho ?? undefined, exemploCabecalho: o.exemploCabecalho ?? undefined,
    tipoCabecalho: o.tipoCabecalho ?? undefined, rodape: o.rodape ?? undefined,
    botoes, variaveis: vars,
  } as RascunhoModelo
  const regras = validarRascunho(rascunho)
  return regras.length ? { erros: regras } : { rascunho }
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'whatsapp_oficial.modelos.criar')
    if (negado) return negado
    if (!user.campoId) return json({ error: MSG_SEM_CAMPO }, 400)
    let corpo: unknown
    try {
      corpo = await req.json()
    } catch {
      return json({ error: 'Corpo da requisição inválido.' }, 400)
    }
    const l = lerRascunho(corpo)
    if ('erros' in l) return json({ error: l.erros.join(' '), erros: l.erros }, 400)
    try {
      return json(await criarModelo(await montarDependenciasModelos(), user.campoId, user.id, l.rascunho), 201)
    } catch (e) {
      return respostaDeErro(e)
    }
  })
}
