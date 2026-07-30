import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { campaignClosedReason } from '@/lib/secretariaCampaignService'

/**
 * Upload dos anexos do formulário de campanha — rota PÚBLICA.
 *
 * Existe pelo mesmo motivo da rota da ficha de adesão: quem preenche chegou por
 * um link do WhatsApp e não tem sessão, então `/api/whatsapp/upload` (withAuth)
 * devolveria 401.
 *
 * A credencial é o `share_token` da campanha. O caminho do arquivo é montado
 * aqui, nunca vem do cliente, e só passam os tipos que o formulário aceita.
 */

const MAX_IMAGE = 8 * 1024 * 1024   // 8MB — foto tirada no celular
const MAX_FILE = 15 * 1024 * 1024   // 15MB — PDF de documento digitalizado

const TIPOS_IMAGEM = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const TIPOS_ARQUIVO = ['application/pdf']

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params

  const { data: campaign } = await supabaseAdmin
    .from('secretaria_campaigns')
    .select('id, status, kind, opens_at, closes_at')
    .eq('share_token', token)
    .maybeSingle()

  if (!campaign) {
    return NextResponse.json({ error: 'Campanha não encontrada ou link expirado.' }, { status: 404 })
  }
  const bloqueio = campaignClosedReason(campaign)
  if (bloqueio) return NextResponse.json({ error: bloqueio }, { status: 409 })

  const formData = await req.formData().catch(() => null)
  const file = formData?.get('file')
  const kind = String(formData?.get('kind') ?? 'image')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Arquivo não encontrado.' }, { status: 400 })
  }

  const permitidos = kind === 'file' ? TIPOS_ARQUIVO : TIPOS_IMAGEM
  if (!permitidos.includes(file.type)) {
    return NextResponse.json(
      { error: kind === 'file' ? 'Envie um arquivo PDF.' : 'Envie uma imagem (JPG, PNG ou WEBP).' },
      { status: 400 }
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const limite = kind === 'file' ? MAX_FILE : MAX_IMAGE
  if (buffer.length > limite) {
    return NextResponse.json(
      { error: `Arquivo muito grande (máx ${Math.round(limite / 1024 / 1024)}MB).` },
      { status: 400 }
    )
  }

  const path = `campanhas/${campaign.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${EXT[file.type] ?? 'bin'}`

  const { error } = await supabaseAdmin.storage
    .from('dados')
    .upload(path, buffer, { contentType: file.type, upsert: false })

  if (error) {
    console.error('[POST /api/public/campanha/[token]/upload]', error)
    return NextResponse.json({ error: 'Falha ao enviar o arquivo.' }, { status: 500 })
  }

  const { data } = supabaseAdmin.storage.from('dados').getPublicUrl(path)
  return NextResponse.json({
    url: data.publicUrl,
    fileName: file.name.slice(0, 200),
    mimeType: file.type,
    size: buffer.length,
  })
}
