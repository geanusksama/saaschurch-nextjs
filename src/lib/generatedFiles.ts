/**
 * Onde ficam os arquivos que a IA gera (PDF, Excel e gráfico).
 *
 * Antes eles eram gravados em `public/temp-reports/` com fs.writeFileSync. Isso
 * funciona rodando local e QUEBRA no deploy: em função serverless o sistema de
 * arquivos é somente leitura fora de /tmp, e mesmo que gravasse, o arquivo não
 * seria servido pela URL `/temp-reports/...` — cada requisição pode cair numa
 * instância diferente. O link chegava ao usuário apontando para o nada.
 *
 * Agora vão para o Supabase Storage, o mesmo caminho que o resto do sistema já
 * usa para arquivo gerado (ver contabilidadeAgendamentoService e os uploads de
 * foto). A URL devolvida é pública e estável.
 *
 * A gravação local continua como plano B: se o Storage falhar (sem credencial
 * no ambiente de desenvolvimento, rede fora), o arquivo é escrito em disco e o
 * fluxo segue — em produção esse caminho não é alcançado porque o Storage
 * responde, e se não responder o erro aparece no log em vez de sumir.
 */

import { supabaseAdmin } from '@/lib/supabase-admin'
import fs from 'fs'
import path from 'path'

/** Pasta dentro do bucket `dados`, para não misturar com upload de usuário. */
const PASTA = 'ai-reports'
const BUCKET = 'dados'

export async function publicarArquivoGerado(
  conteudo: Buffer | string,
  fileName: string,
  contentType: string
): Promise<string> {
  const buffer = Buffer.isBuffer(conteudo) ? conteudo : Buffer.from(conteudo, 'utf8')
  const caminho = `${PASTA}/${fileName}`

  try {
    const { error } = await supabaseAdmin.storage.from(BUCKET).upload(caminho, buffer, {
      contentType,
      upsert: true,
    })
    if (error) throw error

    const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(caminho)
    if (data?.publicUrl) return data.publicUrl
    throw new Error('Storage não devolveu URL pública.')
  } catch (e) {
    console.error('[publicarArquivoGerado] Storage falhou, gravando em disco:', e)
    const destDir = path.join(process.cwd(), 'public', 'temp-reports')
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })
    fs.writeFileSync(path.join(destDir, fileName), buffer)
    return `/temp-reports/${fileName}`
  }
}
