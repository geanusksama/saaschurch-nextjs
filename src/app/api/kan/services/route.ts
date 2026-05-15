import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    let services;
    try {
      services = await prisma.kanService.findMany({
        where: { isActive: true },
        include: {
          stages: {
            where: { isActive: true },
            include: {
              columns: { orderBy: { columnIndex: "asc" } },
            },
          },
          rules: {
            where: { isActive: true },
            orderBy: { columnIndex: "asc" },
            include: {
              stage: {
                select: {
                  id: true,
                  name: true,
                  pipelineId: true,
                  pipeline: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
        orderBy: { description: "asc" },
      });
    } catch {
      // Fallback: fetch without the stage relation (migration for stage_id may be pending)
      services = await prisma.kanService.findMany({
        where: { isActive: true },
        include: {
          stages: {
            where: { isActive: true },
            include: { columns: { orderBy: { columnIndex: "asc" } } },
          },
          rules: { where: { isActive: true }, orderBy: { columnIndex: "asc" } },
        },
        orderBy: { description: "asc" },
      });
    }
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
