import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

// PATCH /api/peniel/registrations/[id]
// Admin updates registration status
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    if (!["master", "admin", "campo", "regional", "church"].includes(user.profileType || "")) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const {
      status, nome, celular, igrejaBase, endereco, idade, estadoCivil,
      dataNascimento, batizadoAguas, grupoFamiliarQual, nomeLider, medicamentos,
      alergiasRestricoes, paymentStatus, paymentPromiseDate
    } = body;

    const registration = await prisma.penielRegistration.findUnique({
      where: { id },
      include: {
        event: {
          select: {
            campoId: true
          }
        }
      }
    });

    if (!registration || registration.deletedAt) {
      return NextResponse.json({ error: "Inscrição não encontrada." }, { status: 404 });
    }

    // Verify tenant authorization
    if (user.profileType !== "master" && registration.event.campoId !== user.campoId) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const updated = await prisma.penielRegistration.update({
      where: { id },
      data: {
        status: status !== undefined ? status : undefined,
        nome: nome !== undefined ? nome : undefined,
        celular: celular !== undefined ? celular : undefined,
        igrejaBase: igrejaBase !== undefined ? igrejaBase : undefined,
        endereco: endereco !== undefined ? endereco : undefined,
        idade: idade !== undefined ? Number(idade) : undefined,
        estadoCivil: estadoCivil !== undefined ? estadoCivil : undefined,
        dataNascimento: dataNascimento !== undefined ? new Date(dataNascimento) : undefined,
        batizadoAguas: batizadoAguas !== undefined ? Boolean(batizadoAguas) : undefined,
        grupoFamiliarQual: grupoFamiliarQual !== undefined ? grupoFamiliarQual : undefined,
        nomeLider: nomeLider !== undefined ? nomeLider : undefined,
        medicamentos: medicamentos !== undefined ? medicamentos : undefined,
        alergiasRestricoes: alergiasRestricoes !== undefined ? alergiasRestricoes : undefined,
        paymentStatus: paymentStatus !== undefined ? paymentStatus : undefined,
        paymentPromiseDate: paymentPromiseDate !== undefined ? (paymentPromiseDate ? new Date(paymentPromiseDate) : null) : undefined
      }
    });

    return NextResponse.json(updated);
  });
}

// DELETE /api/peniel/registrations/[id]
// Soft delete of a registration
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    if (!["master", "admin", "campo", "regional", "church"].includes(user.profileType || "")) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const { id } = await params;

    const registration = await prisma.penielRegistration.findUnique({
      where: { id },
      include: {
        event: {
          select: {
            campoId: true
          }
        }
      }
    });

    if (!registration || registration.deletedAt) {
      return NextResponse.json({ error: "Inscrição não encontrada." }, { status: 404 });
    }

    if (user.profileType !== "master" && registration.event.campoId !== user.campoId) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const updated = await prisma.penielRegistration.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    return NextResponse.json(updated);
  });
}
