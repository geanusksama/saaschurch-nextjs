import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { sendPaymentReminder } from "@/lib/penielTicket";

// POST /api/peniel/registrations/[id]/remind
// Envia lembrete de pagamento pendente por WhatsApp.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    if (!["master", "admin", "campo", "regional"].includes(user.profileType || "")) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const { id } = await params;
    const reg = await prisma.penielRegistration.findUnique({
      where: { id },
      include: { event: { select: { campoId: true } } }
    });
    if (!reg || reg.deletedAt) {
      return NextResponse.json({ error: "Inscrição não encontrada." }, { status: 404 });
    }
    if (user.profileType !== "master" && reg.event.campoId !== user.campoId) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const res = await sendPaymentReminder(id);
    if (!res.ok) {
      const map: Record<string, string> = {
        no_instance: "Nenhuma instância de WhatsApp configurada para este campo.",
        no_owner: "Instância de WhatsApp sem responsável."
      };
      return NextResponse.json({ error: map[res.reason || ""] || `Falha ao enviar: ${res.reason}` }, { status: 502 });
    }
    return NextResponse.json({ success: true });
  });
}
