/**
 * Projeto antigo do Supabase. Ele foi apagado (o domínio não resolve mais) e
 * as fotos de membros da pasta fotos/fotomembromaquina não foram copiadas para
 * o projeto atual — em 2026-10-17 eram 916 membros com a URL antiga gravada.
 * Pedir essas imagens só gera erro de rede no console (ERR_NAME_NOT_RESOLVED).
 */
const PROJETO_SUPABASE_ANTIGO = 'uoswswovjcycsamjawnl.supabase.co';

/** URL da foto quando ela pode existir; null quando não há ou é do projeto apagado. */
export function fotoDisponivel(url?: string | null): string | null {
  if (!url) return null;
  return url.includes(PROJETO_SUPABASE_ANTIGO) ? null : url;
}
