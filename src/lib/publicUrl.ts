/**
 * Base pública do site, para links que saem do sistema (WhatsApp, PDF, e-mail).
 *
 * Nunca devolve localhost: um link de desenvolvimento enviado para o celular
 * de alguém simplesmente não abre. Em produção use NEXT_PUBLIC_APP_URL.
 */
const FALLBACK = 'https://www.adcampinas.com.br'

export function publicBaseUrl(): string {
  const raw = String(process.env.NEXT_PUBLIC_APP_URL ?? '').trim()
  if (!raw || /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(raw)) return FALLBACK
  return raw.replace(/\/$/, '')
}
