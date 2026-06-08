import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!id) {
    return new NextResponse('ID inválido', { status: 400 })
  }

  // Get the public URL of the receipt PDF
  const filePath = `recibos/${id}.pdf`
  const { data } = supabaseAdmin.storage.from('dados').getPublicUrl(filePath)

  if (!data?.publicUrl) {
    return new NextResponse('Arquivo não encontrado', { status: 404 })
  }

  // Redirect the user to the public URL for download
  return NextResponse.redirect(data.publicUrl)
}
