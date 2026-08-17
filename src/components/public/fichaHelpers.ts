/**
 * Ajudantes da ficha de adesão — máscaras e busca de CEP.
 *
 * A mesma ficha é preenchida em dois lugares: pelo link com token
 * (MembershipFormPublic) e direto na home, na aba "Ficha completa"
 * (MembershipFullFormFields). As máscaras vêm de `@/lib/masks`, as mesmas do
 * cadastro de membro — reescrevê-las aqui faria a ficha gravar o CPF num
 * formato e a secretaria em outro.
 */

export {
  apenasDigitos as digitos,
  mascaraCep,
  mascaraCpf,
  mascaraRg,
  mascaraTelefone,
} from '@/lib/masks';

import { apenasDigitos as digitos } from '@/lib/masks';

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
