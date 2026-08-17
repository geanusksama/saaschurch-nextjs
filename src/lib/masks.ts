/**
 * Máscaras dos campos de documento e contato.
 *
 * Uma cópia só: cada tela que reescrevia a máscara acabava com um limite
 * diferente (ou nenhum), e foi assim que o telefone do cadastro passou a
 * aceitar número de qualquer tamanho.
 *
 * Todas trabalham sobre os dígitos e reconstroem a formatação, então apagar no
 * meio do texto continua funcionando. O valor sai formatado — é assim que o
 * cadastro de membros já guarda CPF, telefone e CEP.
 *
 * Sem dependência de React ou de servidor: serve cliente e API.
 */

export const apenasDigitos = (v: string) => String(v ?? '').replace(/\D/g, '')

/** Telefone fixo ou celular brasileiro, no máximo 11 dígitos. */
export function mascaraTelefone(v: string) {
  const d = apenasDigitos(v).slice(0, 11)
  if (!d) return ''
  if (d.length <= 10) {
    // fixo: (19) 3333-3333
    return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d{1,4})$/, '$1-$2')
  }
  // celular: (19) 99999-9999
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{1,4})$/, '$1-$2')
}

/** CPF: 11 dígitos, 000.000.000-00. */
export function mascaraCpf(v: string) {
  const d = apenasDigitos(v).slice(0, 11)
  if (!d) return ''
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

/** CNPJ: 14 dígitos, 00.000.000/0000-00. */
export function mascaraCnpj(v: string) {
  const d = apenasDigitos(v).slice(0, 14)
  if (!d) return ''
  return d
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

/** CEP: 8 dígitos, 00000-000. */
export function mascaraCep(v: string) {
  const d = apenasDigitos(v).slice(0, 8)
  if (d.length <= 5) return d
  return d.replace(/(\d{5})(\d{1,3})$/, '$1-$2')
}

/** RG varia por estado: mantém números, letras e traço, sem impor formato. */
export function mascaraRg(v: string) {
  return String(v ?? '').replace(/[^0-9A-Za-z.\-]/g, '').slice(0, 15)
}
