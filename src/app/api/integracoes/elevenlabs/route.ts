import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/auth'
import { exigirPermissao } from '@/lib/permissoes/servidor'
import {
  ELEVENLABS_SETTING_KEY,
  lerConfigElevenLabs,
  listarVozes,
  sintetizarFala,
  type ElevenLabsConfig,
} from '@/lib/elevenlabs'

/** Frase de exemplo do botão "Ouvir": como o agente fala de verdade. */
const FRASE_AMOSTRA = 'A paz do Senhor! Seja muito bem-vindo à nossa igreja. Eu faço parte da equipe pastoral. Como posso te ajudar hoje?'

/**
 * Configuração da ElevenLabs (voz do agente no WhatsApp) — por campo, em
 * settings.elevenlabs_configuration. Ver src/lib/elevenlabs.ts.
 *
 * GET  → config com a chave mascarada + vozes da conta (quando há chave)
 * POST → salva; ?test=true só confere a chave e devolve as vozes
 */

export const dynamic = 'force-dynamic'
const json = (d: unknown, status = 200) => NextResponse.json(d, { status, headers: { 'Cache-Control': 'no-store' } })

function mascarar(chave: string): string {
  if (!chave) return ''
  if (chave.length <= 10) return '••••••••'
  return `${chave.slice(0, 5)}••••••••${chave.slice(-4)}`
}

const mascarada = (v: unknown) => typeof v === 'string' && (v.includes('•••') || v.includes('***'))

async function linhaDoCampo(campoId: string | null) {
  return prisma.setting.findFirst({ where: { settingKey: ELEVENLABS_SETTING_KEY, campoId } })
}

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const negado = await exigirPermissao(user, 'elevenlabs_config.view')
    if (negado) return negado
    const row = await linhaDoCampo(user.campoId || null)
    const cfg = lerConfigElevenLabs(row?.settingValue ?? null)
    let vozes: Awaited<ReturnType<typeof listarVozes>> = []
    let erroVozes = ''
    if (cfg.apiKey) {
      try { vozes = await listarVozes(cfg.apiKey) } catch (e) { erroVozes = e instanceof Error ? e.message : 'Falha ao listar vozes' }
    }
    return json({ ...cfg, apiKey: mascarar(cfg.apiKey), temChave: !!cfg.apiKey, vozes, erroVozes })
  })
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const sp = new URL(req.url).searchParams
    const teste = sp.get('test') === 'true' || sp.get('amostra') === 'true'
    // mesmas chaves dos botões da tela (ElevenLabsConfig.tsx)
    const negado = await exigirPermissao(user, teste ? 'elevenlabs_config.eleven_labs.testar' : 'elevenlabs_config.eleven_labs.salvar')
    if (negado) return negado
    const campoId = user.campoId || null
    const body = (await req.json().catch(() => ({}))) as Partial<ElevenLabsConfig>
    const row = await linhaDoCampo(campoId)
    const atual = lerConfigElevenLabs(row?.settingValue ?? null)
    // chave mascarada/vazia na tela = mantém a gravada
    const apiKey = typeof body.apiKey === 'string' && body.apiKey.trim() && !mascarada(body.apiKey)
      ? body.apiKey.trim()
      : atual.apiKey

    // ?amostra=true: toca a frase de exemplo com a voz escolhida (não grava nada)
    if (sp.get('amostra') === 'true') {
      const voz = typeof (body as { voiceId?: unknown }).voiceId === 'string' ? (body as { voiceId: string }).voiceId : ''
      if (!apiKey) return json({ error: 'Informe a chave da ElevenLabs.' }, 400)
      if (!voz) return json({ error: 'Escolha uma voz.' }, 400)
      const mp3 = await sintetizarFala({ ...atual, apiKey, vozFeminina: voz, vozMasculina: voz }, FRASE_AMOSTRA, 'F')
      if (!mp3) return json({ error: 'A ElevenLabs não gerou a amostra (confira a chave e a voz).' }, 400)
      return new NextResponse(new Uint8Array(mp3), { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' } })
    }

    if (teste) {
      if (!apiKey) return json({ error: 'Informe a chave da ElevenLabs.' }, 400)
      try {
        const vozes = await listarVozes(apiKey)
        return json({ success: true, message: `Conexão com a ElevenLabs ok — ${vozes.length} vozes na conta.`, vozes })
      } catch (e) {
        return json({ error: e instanceof Error ? e.message : 'Falha na conexão' }, 400)
      }
    }

    const novo = lerConfigElevenLabs({ ...atual, ...body, apiKey })
    if (novo.ativo && !novo.apiKey) return json({ error: 'Para ligar, informe a chave da ElevenLabs.' }, 400)
    const settingValue = JSON.stringify(novo)

    if (row) {
      await prisma.setting.update({
        where: { id: row.id },
        data: { settingValue, updatedBy: user.id || null, updatedAt: new Date() },
      })
    } else {
      await prisma.setting.create({
        data: {
          campoId,
          churchId: null,
          settingKey: ELEVENLABS_SETTING_KEY,
          settingValue,
          settingType: 'json',
          description: 'ElevenLabs: transcrição e resposta em áudio do agente de IA no WhatsApp',
          updatedBy: user.id || null,
        },
      })
    }
    return json({ success: true, ...novo, apiKey: mascarar(novo.apiKey), temChave: !!novo.apiKey })
  })
}
