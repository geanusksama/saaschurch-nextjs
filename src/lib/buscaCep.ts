/**
 * Busca de endereço pelo CEP (ViaCEP), a mesma do cadastro de membro
 * (MemberRegistration.tsx): dispara quando o oitavo dígito entra e preenche
 * rua, bairro, cidade e UF. Usada nas telas de edição de membro.
 */

export type CepStatus = 'idle' | 'loading' | 'ok' | 'err';

export type EnderecoDoCep = { street: string; neighborhood: string; city: string; state: string };

export async function lookupCep(cep: string): Promise<EnderecoDoCep | null> {
  const digits = cep.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.erro) return null;
    return {
      street: data.logradouro || '',
      neighborhood: data.bairro || '',
      city: data.localidade || '',
      state: data.uf || '',
    };
  } catch {
    return null;
  }
}

/** Mensagens exibidas abaixo do campo de CEP, iguais às do cadastro. */
export const CEP_MENSAGEM: Record<CepStatus, { texto: string; cor: string }> = {
  idle: { texto: 'Rua, bairro, cidade e estado são preenchidos automaticamente.', cor: 'text-slate-500' },
  loading: { texto: 'Buscando endereço…', cor: 'text-slate-500' },
  ok: { texto: 'Endereço encontrado. Só falta o número.', cor: 'text-[#15803d] dark:text-[#4ade80]' },
  err: { texto: 'CEP não encontrado. Preencha manualmente.', cor: 'text-red-700 dark:text-red-400' },
};
