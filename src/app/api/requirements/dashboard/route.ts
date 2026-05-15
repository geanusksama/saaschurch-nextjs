import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts, kanScopeFilter } from "@/lib/helpers";

const REQUIREMENT_SIGLAS = [
  "ADMINM", "ADMINOB", "CDM", "DESCR", "DESCRH", "DESCRPH",
  "DESLMEM", "DESLMIN", "DESLOBRE", "EXCL", "FALE",
  "READMEM", "READOBR", "READOMN", "RECEV", "RECMS", "RECONPB", "RECPR",
];

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const campoId = searchParams.get("campoId");
    const regionalId = searchParams.get("regionalId");
    const churchId = searchParams.get("churchId");
    const serviceId = searchParams.get("serviceId");
    const q = searchParams.get("q");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {
      deletedAt: null,
      ...kanScopeFilter(user),
      service: {
        is: {
          OR: [
            { serviceGroup: "REQUERIMENTO" },
            { sigla: { in: REQUIREMENT_SIGLAS } },
          ],
        },
      },
    };

    if (churchId) where.churchId = churchId;
    else if (regionalId) where.church = { regionalId };
    else if (campoId) where.church = { regional: { campoId } };

    if (serviceId) where.serviceId = Number(serviceId);

    if (from || to) {
      where.openedAt = {};
      if (from) where.openedAt.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        where.openedAt.lte = toDate;
      }
    }

    if (q) {
      where.OR = [
        { protocol: { contains: q, mode: "insensitive" } },
        { candidateName: { contains: q, mode: "insensitive" } },
        { member: { is: { fullName: { contains: q, mode: "insensitive" } } } },
        { church: { is: { name: { contains: q, mode: "insensitive" } } } },
        { service: { is: { description: { contains: q, mode: "insensitive" } } } },
      ];
    }

    const cards = await prisma.kanCard.findMany({
      where,
      include: {
        church: {
          select: {
            id: true,
            name: true,
            code: true,
            regional: {
              select: {
                id: true,
                name: true,
                campoId: true,
                campo: { select: { id: true, name: true } },
              },
            },
          },
        },
        destinationChurch: { select: { id: true, name: true, code: true } },
        member: { select: { id: true, fullName: true, rol: true } },
        service: { select: { id: true, sigla: true, description: true, serviceGroup: true } },
        column: { select: { id: true, name: true, columnIndex: true, color: true } },
      },
      orderBy: { openedAt: "desc" },
      take: 2000,
    });

    return NextResponse.json(serializeBigInts({ queue: cards }));
  });
}
