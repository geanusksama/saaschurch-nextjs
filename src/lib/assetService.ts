/**
 * Regras compartilhadas do módulo Patrimônio que dependem do Prisma (rodam
 * só no servidor). Regras client-safe (opções de local, normalização de
 * código, etc.) ficam em assetLocationOptions.ts, importável também pelas
 * telas.
 */
import { prisma } from "@/lib/prisma";

export * from "./assetLocationOptions";

/** Gera o próximo código sequencial "PAT-000123" olhando o maior código já usado. */
export async function nextAssetCode(): Promise<string> {
  const last = await prisma.asset.findFirst({
    orderBy: { createdAt: "desc" },
    select: { code: true },
  });
  const lastNumber = last?.code ? Number(last.code.replace(/\D/g, "")) || 0 : 0;
  const next = lastNumber + 1;
  return `PAT-${String(next).padStart(6, "0")}`;
}
