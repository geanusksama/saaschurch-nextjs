/** Rota do leitor de QR Code da Secretaria (Batismo / Consagração). */
export const SCAN_READER_PATH = "/app-ui/qr-reader";

/**
 * Conteúdo gravado no QR Code impresso no canhoto do candidato.
 *
 * É uma URL para o próprio leitor já com o card carregado, e não o id puro, para
 * que a câmera nativa do celular também abra a tela — quem está recolhendo os
 * papéis no tanque não precisa entrar no app antes de ler.
 */
export function buildScanQrValue(cardId: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${SCAN_READER_PATH}?c=${encodeURIComponent(cardId)}`;
}
