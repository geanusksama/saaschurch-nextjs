import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    const pipelines = await prisma.kanPipeline.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(serializeBigInts(pipelines));
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    const body = await req.json().catch(() => ({}));
    const { name, type, description } = body;
    if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
    const pipeline = await prisma.kanPipeline.create({
      data: { name, type: type || "generic", description: description || null, isActive: true },
    });
    return NextResponse.json(serializeBigInts(pipeline), { status: 201 });
  });
}
