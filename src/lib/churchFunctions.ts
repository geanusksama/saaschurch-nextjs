import { prisma } from "@/lib/prisma";

/**
 * Regra de unicidade de função ativa numa igreja.
 *
 * - Função de liderança (catálogo com `isLeaderRole`): só pode haver UMA ativa por
 *   igreja+função, independente de departamento (não existem dois dirigentes).
 * - Demais funções: a unicidade considera também o departamento, permitindo, por
 *   exemplo, um LIDER DE JOVENS por departamento distinto.
 *
 * Espelha o índice único parcial `church_function_history_active_department_unique`.
 * Retorna a mensagem de erro quando há conflito, ou `null` quando está livre.
 */
export async function findActiveFunctionConflict(params: {
  churchId: string;
  functionId: string;
  department: string | null;
  /** Id do próprio registro, para ignorá-lo ao editar. */
  ignoreId?: string;
}): Promise<string | null> {
  const { churchId, functionId, department, ignoreId } = params;

  const catalogFunction = await prisma.churchFunctionCatalog.findUnique({
    where: { id: functionId },
  });
  if (!catalogFunction) return null;

  const duplicate = await prisma.churchFunctionHistory.findFirst({
    where: {
      churchId,
      functionId,
      deletedAt: null,
      endDate: null,
      isActive: true,
      ...(ignoreId ? { id: { not: ignoreId } } : {}),
      ...(catalogFunction.isLeaderRole ? {} : { department }),
    },
  });
  if (!duplicate) return null;

  return catalogFunction.isLeaderRole
    ? "Já existe um dirigente ativo para esta igreja."
    : "Já existe uma função ativa desse tipo para esta igreja nesse departamento.";
}

/** Campos de relação retornados em toda listagem de funções. */
export const churchFunctionInclude = {
  member: { select: { id: true, fullName: true, rol: true } },
  church: { select: { id: true, name: true } },
  function: { select: { id: true, name: true, isLeaderRole: true } },
} as const;
