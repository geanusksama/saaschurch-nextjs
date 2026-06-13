import { prisma } from "@/lib/prisma";

/** Slug simples: minúsculas, sem acento, só letras/números. */
export function campoSlug(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Resolve o campoId da página pública do Peniel a partir de:
 *  1. campoId explícito (UUID)
 *  2. nome do campo (?campo=campinas) — casado por slug
 *  3. fallback: campo que tem Peniel configurado, depois com evento, depois o 1º
 */
export async function resolvePublicCampoId(opts: { campoId?: string | null; campo?: string | null }): Promise<string | null> {
  if (opts.campoId) return opts.campoId;

  if (opts.campo) {
    const target = campoSlug(opts.campo);
    const campos = await prisma.campo.findMany({ where: { deletedAt: null }, select: { id: true, name: true } });
    const found = campos.find((c) => campoSlug(c.name) === target);
    if (found) return found.id;
  }

  const configured = await prisma.penielConfig.findFirst({ select: { campoId: true } });
  if (configured) return configured.campoId;

  const ev = await prisma.penielEvent.findFirst({ where: { deletedAt: null }, select: { campoId: true } });
  if (ev) return ev.campoId;

  const first = await prisma.campo.findFirst({ where: { deletedAt: null }, select: { id: true } });
  return first?.id ?? null;
}
