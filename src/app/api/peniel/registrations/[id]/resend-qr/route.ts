import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { sendTicketWhatsApp } from "@/lib/penielTicket";

// POST /api/peniel/registrations/[id]/resend-qr
// Reenvia o ingresso (QR + dados) por WhatsApp para o inscrito.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    if (!["master", "admin", "campo", "regional"].includes(user.profileType || "")) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const { id } = await params;

    const registration = await prisma.penielRegistration.findUnique({
      where: { id },
      include: { event: { select: { campoId: true } } }
    });

    if (!registration || registration.deletedAt) {
      return NextResponse.json({ error: "Inscrição não encontrada." }, { status: 404 });
    }

    if (user.profileType !== "master" && registration.event.campoId !== user.campoId) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const res = await sendTicketWhatsApp(id);

    if (!res.ok) {
      const reasonMap: Record<string, string> = {
        no_instance: "Nenhuma instância de WhatsApp configurada para este campo.",
        no_owner: "Instância de WhatsApp sem responsável definido.",
        not_found: "Inscrição não encontrada."
      };
      return NextResponse.json(
        { error: reasonMap[res.reason || ""] || `Falha ao enviar: ${res.reason || "erro desconhecido"}` },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true });
  });
}
