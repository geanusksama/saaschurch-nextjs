/**
 * Filtros de coluna do Contas a Pagar.
 *
 * A tela filtra credor, plano de contas e departamento direto no cabeçalho da
 * tabela, com seleção múltipla. Cada um chega como lista separada por vírgula;
 * o valor especial "sem" representa o registro que não informou aquele campo
 * (departamento nulo, por exemplo) e pode vir junto com ids normais.
 */

export type FiltroColuna = { ids: string[]; incluiSem: boolean };

export function lerFiltroColuna(raw: string | null | undefined): FiltroColuna | null {
  if (!raw) return null;
  const itens = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (!itens.length) return null;
  return {
    ids: itens.filter((i) => i !== "sem"),
    incluiSem: itens.includes("sem"),
  };
}

/**
 * Condição Prisma para uma coluna. Devolve `null` quando não há filtro — quem
 * chama só empurra no `AND` o que voltar preenchido.
 */
export function condicaoDeColuna(raw: string | null | undefined, campo: string) {
  const filtro = lerFiltroColuna(raw);
  if (!filtro) return null;
  if (filtro.incluiSem && filtro.ids.length) {
    return { OR: [{ [campo]: null }, { [campo]: { in: filtro.ids } }] };
  }
  if (filtro.incluiSem) return { [campo]: null };
  return { [campo]: { in: filtro.ids } };
}
