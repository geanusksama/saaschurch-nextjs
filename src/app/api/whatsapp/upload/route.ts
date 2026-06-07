import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

const MAX_SIZE = 16 * 1024 * 1024 // 16MB

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    const formData = await req.formData().catch(() => null)
    if (!formData) return NextResponse.json({ error: 'FormData inválido' }, { status: 400 })

    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    if (buffer.length > MAX_SIZE) return NextResponse.json({ error: 'Arquivo muito grande (máx 16MB)' }, { status: 400 })

    const ext = file.name.split('.').pop() ?? 'bin'
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const path = `whatsapp/${fileName}`

    const { error } = await supabaseAdmin.storage
      .from('dados')
      .upload(path, buffer, { contentType: file.type, upsert: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const { data } = supabaseAdmin.storage.from('dados').getPublicUrl(path)
    return NextResponse.json({ url: data.publicUrl, fileName: file.name, mimeType: file.type })
  })
}
