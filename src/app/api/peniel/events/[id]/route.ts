import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

// PATCH /api/peniel/events/[id]
// Updates an existing Peniel event
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    if (!["master", "admin", "campo"].includes(user.profileType || "")) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const {
      title, date, time, location, value, limit, status, description,
      dateLabel, departureLocation, eventLocation, latitude, longitude, extraFieldsConfig,
      isFeatured, paymentLink
    } = body;

    const event = await prisma.penielEvent.findUnique({
      where: { id }
    });

    if (!event || event.deletedAt) {
      return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
    }

    // Verify tenant authorization (unless master user)
    if (user.profileType !== "master" && event.campoId !== user.campoId) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    // Only one event per campo can be featured at a time
    if (isFeatured) {
      await prisma.penielEvent.updateMany({
        where: { campoId: event.campoId, isFeatured: true, id: { not: id } },
        data: { isFeatured: false }
      });
    }

    const updatedEvent = await prisma.penielEvent.update({
      where: { id },
      data: {
        title: title !== undefined ? title : undefined,
        date: date !== undefined ? new Date(date) : undefined,
        time: time !== undefined ? time : undefined,
        location: location !== undefined ? location : undefined,
        value: value !== undefined ? Number(value) : undefined,
        limit: limit !== undefined ? Number(limit) : undefined,
        status: status !== undefined ? status : undefined,
        isFeatured: isFeatured !== undefined ? !!isFeatured : undefined,
        paymentLink: paymentLink !== undefined ? (paymentLink || null) : undefined,
        description: description !== undefined ? description : undefined,
        dateLabel: dateLabel !== undefined ? dateLabel : undefined,
        departureLocation: departureLocation !== undefined ? departureLocation : undefined,
        eventLocation: eventLocation !== undefined ? eventLocation : undefined,
        latitude: latitude !== undefined ? latitude : undefined,
        longitude: longitude !== undefined ? longitude : undefined,
        extraFieldsConfig: extraFieldsConfig !== undefined ? extraFieldsConfig : undefined
      }
    });

    return NextResponse.json(updatedEvent);
  });
}

// DELETE /api/peniel/events/[id]
// Logical delete of a Peniel event
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    if (!["master", "admin", "campo"].includes(user.profileType || "")) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const { id } = await params;
    const event = await prisma.penielEvent.findUnique({
      where: { id }
    });

    if (!event || event.deletedAt) {
      return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
    }

    if (user.profileType !== "master" && event.campoId !== user.campoId) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    // Soft delete the event
    await prisma.penielEvent.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    // Soft delete registrations linked to this event
    await prisma.penielRegistration.updateMany({
      where: { eventId: id, deletedAt: null },
      data: { deletedAt: new Date() }
    });

    return NextResponse.json({ success: true });
  });
}
