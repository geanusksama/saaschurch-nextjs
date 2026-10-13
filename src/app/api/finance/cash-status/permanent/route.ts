import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { isRestrictedToOwnChurch } from "@/lib/helpers";
import { campoAtivoId } from "@/lib/campoAtivo";

// Define se o caixa de uma ou mais igrejas fica permanentemente aberto.
// Quando permanentemente aberto, o caixa nunca é fechado nem monitorado.
export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const { churchIds, permanentOpen } = body;
    const ids = Array.isArray(churchIds) ? churchIds.filter((i) => typeof i === "string" && i.trim()) : [];
    if (!ids.length) return NextResponse.json({ error: "Selecione pelo menos uma igreja." }, { status: 400 });
    if (typeof permanentOpen !== "boolean") return NextResponse.json({ error: "Informe o estado da abertura permanente." }, { status: 400 });

    // Operadores restritos só podem alterar a própria igreja.
    if (isRestrictedToOwnChurch(user)) {
      if (!user.churchId || ids.some((id) => id !== user.churchId)) {
        return NextResponse.json({ error: "Voce nao tem acesso a este caixa." }, { status: 403 });
      }
    }

    const updated = await prisma.$executeRawUnsafe(
      // Só igrejas do campo ativo (master inclusive) — id de outro campo é ignorado.
      `UPDATE churches SET cashbook_permanent_open = $1::boolean, updated_at = now()
        WHERE id = ANY($2::uuid[]) AND deleted_at IS NULL
          AND regional_id IN (SELECT id FROM regionais WHERE campo_id = $3::uuid)`,
      permanentOpen, ids, campoAtivoId(user)
    );

    return NextResponse.json({ updatedCount: updated, permanentOpen });
  });
}
