import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  // Só o padrão do nome gerado (recibo_<id>_<timestamp>): sem barras nem "..",
  // para não permitir montar um caminho arbitrário dentro do bucket.
  if (!id || !/^[A-Za-z0-9._-]+$/.test(id)) {
    return new NextResponse('ID inválido', { status: 400 })
  }

  // URL assinada de curta duração em vez de link público permanente: o recibo
  // deixa de ficar acessível para sempre por quem adivinhar o nome do arquivo.
  const filePath = `recibos/${id}.pdf`
  const { data, error } = await supabaseAdmin.storage
    .from('dados')
    .createSignedUrl(filePath, 60)

  if (error || !data?.signedUrl) {
    return new NextResponse('Arquivo não encontrado', { status: 404 })
  }

  return NextResponse.redirect(data.signedUrl)
}
