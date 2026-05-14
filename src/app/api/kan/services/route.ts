import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    const services = await prisma.kanService.findMany({
      where: { isActive: true },
      include: {
        stages: {
          where: { isActive: true },
          include: {
            columns: { orderBy: { columnIndex: "asc" } },
            matrixRules: { where: { isActive: true }, orderBy: { columnIndex: "asc" } },
          },
        },
      },
      orderBy: { description: "asc" },
    });
    return NextResponse.json(serializeBigInts(services));
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    const body = await req.json().catch(() => ({}));
    const { sigla, description, servico, usesMatrix } = body;
    if (!sigla || !description) return NextResponse.json({ error: "sigla and description required" }, { status: 400 });
    const last = await prisma.kanService.findFirst({ orderBy: { id: "desc" } });
    const nextId = (last?.id ?? 0) + 1;
    const svc = await prisma.kanService.create({
      data: { id: nextId, sigla, description, servico: servico || null, usesMatrix: usesMatrix ?? false },
    });
    return NextResponse.json(serializeBigInts(svc), { status: 201 });
  });
}
