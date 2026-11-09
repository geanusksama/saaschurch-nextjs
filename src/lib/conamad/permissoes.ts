import { definirPermissao } from '../permissoes/definir';

/**
 * Relatórios de Secretaria: cada um é um ponto da árvore de permissões, e a
 * rota recusa a mesma chave. `restritos` lista os dados pessoais que só esse
 * relatório devolve; os demais recebem a linha sem eles.
 */
export interface RelatorioSecretaria { chave: string; restritos: readonly string[] }

const FICHA = ['nascimento', 'idade', 'celular', 'estadoCivil', 'endereco', 'enderecoCidade'] as const;

export const PERM_SECRETARIA: Record<string, RelatorioSecretaria> = {
  'sec-cargo': { chave: definirPermissao({ chave: 'conamad.relatorios.sec_cargo', rotulo: 'Lista Geral - Por Cargo / Igreja — Conamad', herda: 'conamad.view' }), restritos: [] },
  'sec-cpf': { chave: definirPermissao({ chave: 'conamad.relatorios.sec_cpf', rotulo: 'Lista Geral CPF - Por Cargo / Igreja — Conamad', herda: 'conamad.view' }), restritos: ['documento'] },
  'sec-protocolo': { chave: definirPermissao({ chave: 'conamad.relatorios.sec_protocolo', rotulo: 'Lista de protocolo — Conamad', herda: 'conamad.view' }), restritos: ['documento'] },
  'sec-ficha': { chave: definirPermissao({ chave: 'conamad.relatorios.sec_ficha', rotulo: 'Ficha Cadastral Resumida — Conamad', herda: 'conamad.view' }), restritos: FICHA },
  'sec-credencial': { chave: definirPermissao({ chave: 'conamad.relatorios.sec_credencial', rotulo: 'Credencial Emitida por Membro — Conamad', herda: 'conamad.view' }), restritos: [] },
  'sec-arquivo': { chave: definirPermissao({ chave: 'conamad.relatorios.sec_arquivo', rotulo: 'Controle de Processo do Arquivo Digital — Conamad', herda: 'conamad.view' }), restritos: [] },
};

const TODOS_RESTRITOS = ['documento', ...FICHA];

export function relatorioSecretaria(id: string | null): RelatorioSecretaria | null {
  return id && Object.hasOwn(PERM_SECRETARIA, id) ? PERM_SECRETARIA[id] : null;
}

/** Tira da linha os dados pessoais que este relatório não mostra. */
export function semDadosRestritos<T extends Record<string, unknown>>(linha: T, rel: RelatorioSecretaria): T {
  const saida: Record<string, unknown> = { ...linha };
  for (const campo of TODOS_RESTRITOS) if (!rel.restritos.includes(campo)) delete saida[campo];
  return saida as T;
}
