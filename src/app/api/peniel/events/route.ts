import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

// GET /api/peniel/events
// Public lookup or admin list of Peniel events
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let campoId = searchParams.get("campoId");
    const futureOnly = searchParams.get("futureOnly") === "true";
    const all = searchParams.get("all") === "true";

    // Prepare where clause
    const whereClause: any = {
      deletedAt: null
    };

    if (!all) {
      if (!campoId) {
        // Resolve to the campo that actually has Peniel in use (events first,
        // then config) instead of an arbitrary first campo, so the public page
        // shows the right church when multiple campos exist.
        const eventCampo = await prisma.penielEvent.findFirst({
          where: { deletedAt: null },
          orderBy: { date: "asc" },
          select: { campoId: true }
        });
        if (eventCampo) {
          campoId = eventCampo.campoId;
        } else {
          const configuredCampo = await prisma.penielConfig.findFirst({
            select: { campoId: true }
          });
          if (configuredCampo) {
            campoId = configuredCampo.campoId;
          } else {
            const firstCampo = await prisma.campo.findFirst({
              where: { deletedAt: null },
              select: { id: true }
            });
            if (firstCampo) {
              campoId = firstCampo.id;
            }
          }
        }
      }

      if (!campoId) {
        return NextResponse.json({ error: "Nenhum campo encontrado no sistema." }, { status: 404 });
      }
      whereClause.campoId = campoId;
    }

    if (futureOnly) {
      // Use the church's local timezone (America/Sao_Paulo) to decide what is
      // "today", so an event is only hidden after its day actually ends in
      // Brazil — not at UTC midnight, which would hide same-day events ~3h early.
      const brToday = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }); // YYYY-MM-DD
      const startOfToday = new Date(`${brToday}T00:00:00.000Z`);
      whereClause.date = {
        gte: startOfToday
      };
      whereClause.status = "active";
    }

    const events = await prisma.penielEvent.findMany({
      where: whereClause,
      orderBy: { date: "asc" },
      include: {
        campo: {
          select: {
            name: true
          }
        },
        registrations: {
          where: { deletedAt: null },
          select: {
            id: true,
            status: true,
            paymentStatus: true
          }
        }
      }
    });

    // Calculate dynamic stats for each event
    const formattedEvents = events.map(event => {
      const inscritos = event.registrations.filter(r => r.status === "inscrito");
      const totalInscritos = inscritos.length;
      const filaEspera = event.registrations.filter(r => r.status === "fila_espera").length;
      const vagasDisponiveis = Math.max(0, event.limit - totalInscritos);
      // Arrecadado = apenas inscritos com pagamento confirmado (pago) ou comprovante
      // anexado, ou eventos gratuitos. Pendentes não entram no total arrecadado.
      const pagos = inscritos.filter(r => ["pago", "comprovante_enviado", "gratuito"].includes(r.paymentStatus || "")).length;
      const pendentesPagamento = inscritos.filter(r => (r.paymentStatus || "pendente") === "pendente").length;
      const valorArrecadado = Number(event.value) * pagos;
      const valorPendente = Number(event.value) * pendentesPagamento;

      // Clean registrations relation so we don't dump all items to public
      const { registrations, campo, ...rest } = event;

      return {
        ...rest,
        campo: campo ? { nome: campo.name } : null,
        totalInscritos,
        vagasDisponiveis,
        filaEspera,
        valorArrecadado,
        valorPendente
      };
    });

    return NextResponse.json(formattedEvents);
  } catch (error) {
    console.error("[GET /api/peniel/events] Error:", error);
    return NextResponse.json({ error: "Erro interno ao buscar eventos." }, { status: 500 });
  }
}

// POST /api/peniel/events
// Creates a new Peniel event/date
export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    if (!["master", "admin", "campo"].includes(user.profileType || "")) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      title, date, time, location, value, limit, status, description,
      dateLabel, departureLocation, eventLocation, latitude, longitude, extraFieldsConfig,
      isFeatured, paymentLink
    } = body;

    if (!title || !date || !time || !location || value === undefined || limit === undefined) {
      return NextResponse.json({ error: "Título, data, horário, local, valor e limite de participantes são obrigatórios." }, { status: 400 });
    }

    const targetCampoId = user.profileType === "master" && body.campoId ? body.campoId : user.campoId;

    if (!targetCampoId) {
      return NextResponse.json({ error: "Campo não especificado." }, { status: 400 });
    }

    // Only one event per campo can be featured at a time
    if (isFeatured) {
      await prisma.penielEvent.updateMany({
        where: { campoId: targetCampoId, isFeatured: true },
        data: { isFeatured: false }
      });
    }

    const event = await prisma.penielEvent.create({
      data: {
        campoId: targetCampoId,
        title,
        date: new Date(date),
        time,
        location,
        value: Number(value),
        limit: Number(limit),
        status: status || "active",
        isFeatured: !!isFeatured,
        paymentLink: paymentLink || null,
        description: description || "",
        dateLabel: dateLabel || null,
        departureLocation: departureLocation || null,
        eventLocation: eventLocation || null,
        latitude: latitude || null,
        longitude: longitude || null,
        extraFieldsConfig: extraFieldsConfig || {}
      }
    });

    return NextResponse.json(event, { status: 201 });
  });
}
