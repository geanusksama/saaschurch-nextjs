/**
 * Códigos de erro do `user_set_image.fcgi` (Control iD) traduzidos para
 * mensagens que fazem sentido para o membro.
 *
 * Fonte: https://www.controlid.com.br/docs/access-api-pt/reconhecimento-facial/cadastro-facial/
 */

export const FACEID_ERRORS: Record<number, { message: string; retry: boolean }> = {
  1: { message: 'Não foi possível processar a imagem. Tente novamente.', retry: true },
  2: { message: 'Não identificamos um rosto na foto.', retry: true },
  3: { message: 'Este rosto já está cadastrado.', retry: false },
  4: { message: 'Centralize o rosto na foto.', retry: true },
  5: { message: 'Você está muito longe — aproxime o celular.', retry: true },
  6: { message: 'Você está muito perto — afaste um pouco o celular.', retry: true },
  7: { message: 'Olhe direto para a câmera, sem inclinar o rosto.', retry: true },
  8: { message: 'A foto ficou tremida. Refaça com mais luz e firmeza.', retry: true },
  9: { message: 'Enquadre o rosto inteiro, longe das bordas.', retry: true },
}

export function describeFaceidError(
  code: number | null | undefined,
  fallback?: string | null
): { message: string; retry: boolean } {
  if (code && FACEID_ERRORS[code]) return FACEID_ERRORS[code]
  return { message: fallback || 'Não foi possível concluir o cadastro.', retry: true }
}

/**
 * Erro 3 ("Face exists") só é recuperável se o rosto pertencer ao próprio
 * membro — aí é recadastro e cabe oferecer "atualizar foto".
 * Se o match for outro user_id, é conflito real e precisa da secretaria.
 */
export function isSelfRematch(
  errorCode: number | null | undefined,
  matchUserId: number | null | undefined,
  rol: number
): boolean {
  return errorCode === 3 && matchUserId != null && Number(matchUserId) === Number(rol)
}
