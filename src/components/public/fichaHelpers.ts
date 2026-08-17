/**
 * Máscaras e validações da ficha de adesão.
 *
 * Ficam separadas porque a mesma ficha é preenchida em dois lugares: pelo link
 * com token (MembershipFormPublic) e direto na home, na aba "Ficha completa"
 * (MembershipFullFormFields). Duplicar a máscara faria os dois caminhos
 * gravarem o CPF em formatos diferentes.
 *
 * Todas trabalham sobre os dígitos e reconstroem a formatação, então apagar no
 * meio do texto continua funcionando. O valor vai formatado para o banco — é
 * assim que o cadastro de membros já guarda CPF e telefone.
 */

export const digitos = (v: string) => v.replace(/\D/g, '');

export function mascaraCpf(v: string) {
  const d = digitos(v).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export function mascaraTelefone(v: string) {
  const d = digitos(v).slice(0, 11);
  if (d.length <= 10) {
    // fixo: (19) 3333-3333
    return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d{1,4})$/, '$1-$2');
  }
  // celular: (19) 99999-9999
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d{1,4})$/, '$1-$2');
}

export function mascaraCep(v: string) {
  return digitos(v).slice(0, 8).replace(/(\d{5})(\d{1,3})$/, '$1-$2');
}

export function mascaraRg(v: string) {
  // RG varia por estado; mantemos números, letras e traço, sem impor formato
  return v.replace(/[^0-9A-Za-z.\-]/g, '').slice(0, 15);
}

/** Validação de CPF (dígitos verificadores) — espelha a checagem do servidor. */
export function cpfValido(raw: string): boolean {
  const d = digitos(String(raw));
  // 11 digitos e nunca todos iguais (111.111.111-11 passaria na conta)
  if (d.length !== 11 || new RegExp(`^(\\d)\\1{10}$`).test(d)) return false;
  const calc = (fatorInicial: number) => {
    let soma = 0;
    for (let i = 0; i < fatorInicial - 1; i++) soma += Number(d[i]) * (fatorInicial - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return calc(10) === Number(d[9]) && calc(11) === Number(d[10]);
}

/**
 * Busca o endereço pelo CEP (ViaCEP). Devolve null quando não achou ou quando
 * o serviço está fora — nesse caso a pessoa preenche à mão, sem travar.
 */
export async function buscarEnderecoPorCep(cep: string): Promise<{
  logradouro: string; bairro: string; localidade: string; uf: string;
} | null> {
  const d = digitos(cep);
  if (d.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${d}/json/`);
    const data = await res.json();
    if (data.erro) return null;
    return {
      logradouro: data.logradouro ?? '',
      bairro: data.bairro ?? '',
      localidade: data.localidade ?? '',
      uf: data.uf ?? '',
    };
  } catch {
    return null;
  }
}
