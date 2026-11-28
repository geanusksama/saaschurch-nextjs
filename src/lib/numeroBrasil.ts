/** Número de telefone brasileiro (função pura, sem banco: usada também nos testes em Node). */

/**
 * Põe um telefone brasileiro no formato que a Z-API espera: 55 + DDD + número.
 *
 * Devolve string vazia quando o número não tem como estar certo — melhor
 * recusar e mostrar o erro do que disparar para um destino inexistente e
 * marcar como enviado.
 *
 * PREMISSA: todo contato é brasileiro. Um número estrangeiro digitado sem o
 * DDI é indistinguível de um nacional (+1 415 555 2671 vira 11 dígitos, e "14"
 * é um DDD válido). Números de fora precisam ser cadastrados com o DDI.
 *
 * Regras:
 *   13 dígitos (55 + DDD + 9)     → mantém
 *   12 dígitos (55 + DDD + 8)     → fixo mantém; celular antigo ganha o 9
 *   11 dígitos (DDD + 9)          → 55 + número
 *   10 dígitos (DDD + 8)          → 55 + número, mesma regra do 9º dígito
 *   qualquer outro tamanho        → recusa
 */
export function normalizarNumeroBrasil(bruto: string): string {
  let d = (bruto || '').replace(/\D/g, '')

  if (d.length === 10 || d.length === 11) d = '55' + d
  if (!d.startsWith('55') || (d.length !== 12 && d.length !== 13)) return ''

  if (d.length === 12) {
    const assinante = d.slice(4)          // depois de 55 + DDD
    // No Brasil, fixo começa com 2–5 e celular com 6–9. Um número de 8 dígitos
    // começando por 6–9 é celular no formato antigo, anterior ao nono dígito:
    // "(19) 82568-356" na verdade é (19) 9 8256-8356.
    if (/^[6-9]/.test(assinante)) {
      d = d.slice(0, 4) + '9' + assinante
    }
  }

  return d
}
