import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { generateCheckInCode, sendTicketWhatsApp } from "@/lib/penielTicket";

// GET /api/peniel/registrations
// Admin list of registrations with search and filters
export async function GET(req: NextRequest) {
  try {
    // Only authenticated users can access the registration list
    const user = await getAuthUser(req).catch(() => null);
    if (!user || !["master", "admin", "campo", "regional"].includes(user.profileType || "")) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get("eventId");
    const status = searchParams.get("status"); // inscrito | fila_espera | cancelado
    const search = searchParams.get("search");
    const startDate = searchParams.get("startDate"); // YYYY-MM-DD
    const endDate = searchParams.get("endDate"); // YYYY-MM-DD

    const targetCampoId = user.profileType === "master" && searchParams.get("campoId")
      ? searchParams.get("campoId")
      : user.campoId;

    if (!targetCampoId) {
      return NextResponse.json({ error: "Campo não especificado." }, { status: 400 });
    }

    // Build filter query
    const whereClause: any = {
      deletedAt: null,
      event: {
        campoId: targetCampoId,
        deletedAt: null
      }
    };

    if (eventId) {
      whereClause.eventId = eventId;
    }

    if (status) {
      whereClause.status = status;
    }

    // Filtro por intervalo de datas (data da inscrição)
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = new Date(`${startDate}T00:00:00.000`);
      if (endDate) whereClause.createdAt.lte = new Date(`${endDate}T23:59:59.999`);
    }

    if (search) {
      whereClause.OR = [
        { nome: { contains: search, mode: "insensitive" } },
        { celular: { contains: search, mode: "insensitive" } },
        { igrejaBase: { contains: search, mode: "insensitive" } },
        { checkInCode: { contains: search.toUpperCase(), mode: "insensitive" } }
      ];
    }

    const registrations = await prisma.penielRegistration.findMany({
      where: whereClause,
      include: {
        event: {
          select: {
            title: true,
            date: true,
            time: true,
            location: true,
            value: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json(registrations);
  } catch (error) {
    console.error("[GET /api/peniel/registrations] Error:", error);
    return NextResponse.json({ error: "Erro interno ao buscar inscrições." }, { status: 500 });
  }
}

// POST /api/peniel/registrations
// Register a participant (publicly or via administrative panel)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      eventId,
      tipoParticipante,
      nome,
      endereco,
      dataNascimento,
      estadoCivil,
      idade,
      celular,
      igrejaBase,
      batizadoAguas,
      participaGrupoFamiliar,
      grupoFamiliarQual,
      nomeLider,
      quemMotivou,
      porqueDecidiu,
      expectativas,
      peso,
      altura,
      medicamentos,
      alergiasRestricoes,
      importantContacts,
      additionalFields,
      forceWaitlist,
      paymentPromiseDate,
      paymentProofUrl
    } = body;

    if (
      !eventId ||
      !tipoParticipante ||
      !nome ||
      !endereco ||
      !dataNascimento ||
      !estadoCivil ||
      !idade ||
      !celular ||
      !igrejaBase ||
      batizadoAguas === undefined ||
      participaGrupoFamiliar === undefined ||
      !quemMotivou ||
      !porqueDecidiu ||
      !expectativas ||
      !peso ||
      !altura ||
      !importantContacts
    ) {
      return NextResponse.json({ error: "Todos os campos obrigatórios devem ser preenchidos." }, { status: 400 });
    }

    // Check if the event exists
    const event = await prisma.penielEvent.findUnique({
      where: { id: eventId },
      include: {
        registrations: {
          where: { status: "inscrito", deletedAt: null },
          select: { id: true }
        }
      }
    });

    if (!event || event.deletedAt) {
      return NextResponse.json({ error: "Evento não encontrado ou cancelado." }, { status: 404 });
    }

    const currentCount = event.registrations.length;
    const hasVacancies = currentCount < event.limit;

    let finalStatus = "inscrito";

    if (!hasVacancies) {
      if (forceWaitlist) {
        finalStatus = "fila_espera";
      } else {
        return NextResponse.json(
          {
            error: "no_vacancies",
            message: "Desculpe, as vagas para este encontro já se esgotaram. Deseja entrar na fila de espera?"
          },
          { status: 409 }
        );
      }
    }

    // Save registration
    const registration = await prisma.penielRegistration.create({
      data: {
        eventId,
        tipoParticipante,
        nome,
        endereco,
        dataNascimento: new Date(dataNascimento),
        estadoCivil,
        idade: Number(idade),
        celular,
        igrejaBase,
        batizadoAguas: Boolean(batizadoAguas),
        participaGrupoFamiliar: Boolean(participaGrupoFamiliar),
        grupoFamiliarQual: grupoFamiliarQual || null,
        nomeLider: nomeLider || null,
        quemMotivou,
        porqueDecidiu,
        expectativas,
        peso: Number(peso),
        altura: Number(altura),
        medicamentos: medicamentos || null,
        alergiasRestricoes: alergiasRestricoes || null,
        importantContacts,
        additionalFields: additionalFields || {},
        status: finalStatus,
        checkInCode: generateCheckInCode(),
        paymentStatus:
          Number(event.value) === 0
            ? "gratuito"
            : paymentProofUrl
              ? "comprovante_enviado"
              : "pendente",
        paymentPromiseDate: paymentPromiseDate ? new Date(paymentPromiseDate) : null,
        paymentProofUrl: paymentProofUrl || null
      },
      include: {
        event: {
          select: {
            title: true,
            date: true,
            time: true,
            location: true
          }
        }
      }
    });

    // ── Ingresso digital por WhatsApp (QR + dados) ──
    // Disparado de forma assíncrona para não atrasar a resposta da inscrição.
    sendTicketWhatsApp(registration.id).catch(err =>
      console.error("[Peniel ticket WhatsApp fail]", err)
    );

    return NextResponse.json(registration, { status: 201 });
  } catch (error) {
    console.error("[POST /api/peniel/registrations] Error:", error);
    return NextResponse.json({ error: "Erro interno ao processar inscrição." }, { status: 500 });
  }
}
