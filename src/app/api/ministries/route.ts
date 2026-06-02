import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const { searchParams } = new URL(req.url);
    const churchId = searchParams.get("churchId");
    const campoId = searchParams.get("campoId");

    const where: Record<string, unknown> = { isActive: true, deletedAt: null };
    if (churchId) {
      where.churchId = churchId;
    } else if (campoId) {
      where.campoId = campoId;
    } else if (user.churchId) {
      where.churchId = user.churchId;
    }

    const ministries = await prisma.ministry.findMany({
      where,
      include: {
        leader: { select: { id: true, fullName: true, photoUrl: true } },
        members: {
          where: { isActive: true, leftAt: null },
          select: { id: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(
      ministries.map((m) =>
        serializeBigInts({ ...m, totalMembers: m.members.length, activeMembers: m.members.length })
      )
    );
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const body = await req.json().catch(() => ({}));
    const {
      churchId,
      name,
      description,
      leaderId,
      parentMinistryId,
      email,
      phone,
      color = "#8b5cf6",
      icon,
      isActive = true,
    } = body;

    if (!churchId || !name) {
      return NextResponse.json({ error: "churchId e name são obrigatórios" }, { status: 400 });
    }

    // Verifica acesso à igreja
    const church = await prisma.church.findFirst({
      where: { id: churchId, deletedAt: null },
      include: {
        regional: {
          select: {
            id: true,
            campoId: true,
            campo: { select: { id: true } },
          },
        },
      },
    });
    if (!church) {
      return NextResponse.json({ error: "Igreja não encontrada" }, { status: 404 });
    }

    // Somente master/admin/campo ou usuário da mesma igreja pode criar
    const isGlobal = user.profileType === "master" || user.profileType === "admin";
    const isSameCampo = user.campoId && church.regional?.campoId === user.campoId;
    const isSameChurch = user.churchId === churchId;
    if (!isGlobal && !isSameCampo && !isSameChurch) {
      return NextResponse.json({ error: "Sem acesso para criar ministério nesta igreja." }, { status: 403 });
    }

    // Resolve campo_id para isolamento no app
    const campoId =
      church.regional?.campoId ??
      church.regional?.campo?.id ??
      user.campoId ??
      null;

    // Valida líder (deve pertencer à mesma igreja)
    if (leaderId) {
      const leader = await prisma.member.findFirst({
        where: { id: leaderId, churchId, deletedAt: null },
      });
      if (!leader) {
        return NextResponse.json({ error: "Líder não encontrado para esta igreja" }, { status: 404 });
      }
    }

    const ministry = await prisma.ministry.create({
      data: {
        churchId,
        name,
        description: description || null,
        leaderId: leaderId || null,
        parentMinistryId: parentMinistryId || null,
        email: email || null,
        phone: phone || null,
        color,
        icon: icon || null,
        isActive,
        campoId: campoId || undefined,
      },
      include: {
        leader: { select: { id: true, fullName: true } },
        members: { where: { isActive: true, leftAt: null }, select: { id: true } },
      },
    });

    return NextResponse.json(
      serializeBigInts({ ...ministry, totalMembers: 0, activeMembers: 0 }),
      { status: 201 }
    );
  });
}
