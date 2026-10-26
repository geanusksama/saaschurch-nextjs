/**
 * Cópia das fotos no storage (bucket "dados", pasta engajamento/<campo>/).
 * A URL da CDN do Instagram expira em dias; a foto lançada à mão precisa de
 * um lugar. JPEG de até 1600 px: dá para reconhecer rosto e pesa ~300 KB.
 */
import sharp from 'sharp';
import { supabaseAdmin } from '@/lib/supabase-admin';

const BUCKET = 'dados';

export async function guardarImagem(buffer: Buffer, campoId: string, nome: string): Promise<string> {
  const jpeg = await sharp(buffer, { animated: false })
    .rotate()
    .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
  const caminho = `engajamento/${campoId}/${nome.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)}.jpg`;
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(caminho, jpeg, { upsert: true, contentType: 'image/jpeg' });
  if (error) throw new Error(`Não foi possível guardar a foto: ${error.message}`);
  return supabaseAdmin.storage.from(BUCKET).getPublicUrl(caminho).data.publicUrl;
}

export async function baixarEGuardar(url: string, campoId: string, nome: string): Promise<string> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Instagram não entregou a imagem (${res.status}).`);
  return guardarImagem(Buffer.from(await res.arrayBuffer()), campoId, nome);
}

/** Apaga do storage todos os recortes de rosto do campo (arquivos rosto_*). */
export async function apagarRecortes(campoId: string): Promise<number> {
  const pasta = `engajamento/${campoId}`;
  let apagados = 0;
  for (;;) {
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).list(pasta, { search: 'rosto_', limit: 1000 });
    if (error) throw new Error(`Não foi possível listar os recortes: ${error.message}`);
    const nomes = (data ?? []).filter((f) => f.name.startsWith('rosto_')).map((f) => `${pasta}/${f.name}`);
    if (!nomes.length) return apagados;
    const { error: e2 } = await supabaseAdmin.storage.from(BUCKET).remove(nomes);
    if (e2) throw new Error(`Não foi possível apagar os recortes: ${e2.message}`);
    apagados += nomes.length;
  }
}
