import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { rotaMobile } from '@/lib/mobile/rota';

/**
 * Painel Mobile — envia imagem de conteúdo do app (evento, notícia, produto,
 * líder...) para o bucket público do app, appv3-publico, em
 * conteudo/<campo>/<pasta>/. Sai em JPEG até 1600 px: o app baixa isso pela
 * rede do celular. Ver appv3/docs/05-BANCO-DE-DADOS.md §6.
 */
const MAX = 8 * 1024 * 1024;

export async function POST(req: NextRequest) {
  // Quem pode subir imagem é quem pode editar algum conteúdo; a gravação da
  // URL no registro passa pela permissão do recurso.
  return rotaMobile(req, 'mobile_painel', 'view', async ({ campoId }) => {
    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'Nenhum arquivo.' }, { status: 400 });
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > MAX) return NextResponse.json({ error: 'Imagem muito grande. Máximo: 8 MB.' }, { status: 400 });

    let jpg: Buffer;
    try {
      jpg = await sharp(buf, { animated: false }).rotate().resize(1600, 1600, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 84 }).toBuffer();
    } catch {
      return NextResponse.json({ error: 'Arquivo não é uma imagem válida. Use JPG, PNG, HEIC ou WebP.' }, { status: 400 });
    }

    const pasta = String(form.get('pasta') ?? 'geral').replace(/[^a-z0-9-]/gi, '').slice(0, 40) || 'geral';
    const path = `conteudo/${campoId}/${pasta}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await supabaseAdmin.storage.from('appv3-publico').upload(path, jpg, { contentType: 'image/jpeg', upsert: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const { data } = supabaseAdmin.storage.from('appv3-publico').getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl });
  });
}
