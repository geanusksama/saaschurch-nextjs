import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

// POST /api/peniel/checkin
// Lê o código (do QR ou digitado manualmente) e "queima" o ingresso,
// marcando a inscrição como check-in realizado (participou).
export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (!["master", "admin", "campo", "regional"].includes(user.profileType || "")) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const rawCode = (body.code || "").toString().trim().toUpperCase();

    if (!rawCode) {
      return NextResponse.json({ error: "Código não informado." }, { status: 400 });
    }

    const registration = await prisma.penielRegistration.findUnique({
      where: { checkInCode: rawCode },
      include: {
        event: {
          select: { title: true, date: true, time: true, location: true, campoId: true }
        }
      }
    });

    if (!registration || registration.deletedAt) {
      return NextResponse.json({ result: "not_found", error: "Ingresso não encontrado." }, { status: 404 });
    }

    // Verifica tenant (exceto master)
    if (user.profileType !== "master" && registration.event.campoId !== user.campoId) {
      return NextResponse.json({ error: "Ingresso de outro campo." }, { status: 403 });
    }

    if (registration.status === "cancelado") {
      return NextResponse.json({
        result: "cancelled",
        registration: { nome: registration.nome, status: registration.status },
        event: registration.event
      });
    }

    if (registration.status === "fila_espera") {
      return NextResponse.json({
        result: "waitlist",
        registration: { nome: registration.nome, status: registration.status },
        event: registration.event
      });
    }

    // Já fez check-in antes
    if (registration.checkedIn) {
      return NextResponse.json({
        result: "already",
        registration: {
          nome: registration.nome,
          checkedInAt: registration.checkedInAt,
          tipoParticipante: registration.tipoParticipante
        },
        event: registration.event
      });
    }

    const updated = await prisma.penielRegistration.update({
      where: { id: registration.id },
      data: { checkedIn: true, checkedInAt: new Date() }
    });

    return NextResponse.json({
      result: "ok",
      registration: {
        nome: updated.nome,
        celular: updated.celular,
        igrejaBase: updated.igrejaBase,
        tipoParticipante: updated.tipoParticipante,
        checkedInAt: updated.checkedInAt
      },
      event: registration.event
    });
  });
}
