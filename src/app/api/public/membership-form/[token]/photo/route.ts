import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * Upload da foto da ficha de adesão — rota PÚBLICA.
 *
 * Existe porque a ficha não tem sessão: quem preenche chegou por um link do
 * WhatsApp. Usar `/api/whatsapp/upload` aqui devolvia 401, já que aquela rota é
 * `withAuth`.
 *
 * A credencial é o mesmo `form_token` do formulário — ou seja, quem consegue
 * preencher a ficha consegue mandar a foto dela, e mais nada. A rota não aceita
 * caminho vindo do cliente, não devolve nada do cadastro e recusa qualquer
 * coisa que não seja imagem.
 */

const MAX_SIZE = 8 * 1024 * 1024 // 8MB — foto de rosto tirada no celular
const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params

  const { data: request } = await supabaseAdmin
    .from('new_member_requests')
    .select('id, status')
    .eq('form_token', token)
    .maybeSingle()

  if (!request) {
    return NextResponse.json({ error: 'Formulário não encontrado ou link expirado.' }, { status: 404 })
  }
  // decidido é decidido: não dá para trocar a foto depois da avaliação
  if (request.status === 'approved' || request.status === 'rejected') {
    return NextResponse.json({ error: 'Esta ficha já foi avaliada.' }, { status: 409 })
  }

  const formData = await req.formData().catch(() => null)
  const file = formData?.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Arquivo não encontrado.' }, { status: 400 })
  }
  if (!TIPOS.includes(file.type)) {
    return NextResponse.json({ error: 'Envie uma imagem (JPG, PNG ou WEBP).' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  if (buffer.length > MAX_SIZE) {
    return NextResponse.json({ error: 'Imagem muito grande (máx 8MB).' }, { status: 400 })
  }

  // o nome vem do servidor, nunca do cliente
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `membresia/${request.id}-${Date.now()}.${ext}`

  const { error } = await supabaseAdmin.storage
    .from('dados')
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (error) {
    console.error('[POST /api/public/membership-form/[token]/photo]', error)
    return NextResponse.json({ error: 'Falha ao enviar a foto.' }, { status: 500 })
  }

  const { data } = supabaseAdmin.storage.from('dados').getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl })
}
