import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest) {
  return withAuth(req, async () => {
    const { searchParams } = new URL(req.url);
    const serviceId = searchParams.get("serviceId");
    const where = serviceId ? { serviceId: Number(serviceId) } : {};
    const rules = await prisma.kanMatrixRule.findMany({
      where: { ...where, isActive: true },
      include: { service: true, stage: true },
      orderBy: [{ serviceId: "asc" }, { columnIndex: "asc" }],
    });
    return NextResponse.json(serializeBigInts(rules));
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async () => {
    const body = await req.json().catch(() => ({}));
    const { serviceId, columnIndex, stageId, changeStatus, newStatus, changeTitle, newTitle, doesTransfer, insertOccurrence, occurrenceName, message, allowMessage, requireDocument, description } = body;
    if (!serviceId || !columnIndex) return NextResponse.json({ error: "serviceId and columnIndex required" }, { status: 400 });
    const rule = await prisma.kanMatrixRule.create({
      data: {
        serviceId: Number(serviceId), columnIndex: Number(columnIndex),
        stageId: stageId ? Number(stageId) : null,
        changeStatus: changeStatus ?? false, newStatus: newStatus || null,
        changeTitle: changeTitle ?? false, newTitle: newTitle || null,
        doesTransfer: doesTransfer ?? false, insertOccurrence: insertOccurrence ?? true,
        occurrenceName: occurrenceName || null, message: message || null,
        allowMessage: allowMessage ?? false, requireDocument: requireDocument ?? false,
        description: description || null,
      },
      include: { service: true, stage: true },
    });
    return NextResponse.json(serializeBigInts(rule), { status: 201 });
  });
}
