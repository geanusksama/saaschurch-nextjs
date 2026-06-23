import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { withAuth } from "../../../../lib/auth";

function isRestrictedToOwnChurch(user: { profileType: string; roleName?: string | null; churchId?: string | null }) {
  if (user.profileType === "church" && user.churchId) return true;
  if (!user.churchId) return false;
  const name = String(user.roleName || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return name.includes("secret") || name.includes("tesour");
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    if (!user.campoId) {
      return NextResponse.json({ error: "Contexto de campo não identificado." }, { status: 400 });
    }

    const { id } = await params;

    const ticket = await prisma.churchPresenceTicket.findUnique({
      where: { id }
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket não encontrado." }, { status: 404 });
    }

    if (ticket.campoId !== user.campoId) {
      return NextResponse.json({ error: "Sem acesso a este ticket." }, { status: 403 });
    }

    if (isRestrictedToOwnChurch(user)) {
      if (ticket.churchId !== user.churchId) {
        return NextResponse.json({ error: "Sem acesso a este ticket." }, { status: 403 });
      }
    }

    await prisma.churchPresenceTicket.delete({
      where: { id }
    });

    return new NextResponse(null, { status: 204 });
  });
}
