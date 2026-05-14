import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await params;
    const rule = await prisma.kanMatrixRule.findUnique({ where: { id: Number(id) }, include: { service: true, stage: true } });
    if (!rule) return NextResponse.json({ error: "rule not found" }, { status: 404 });
    return NextResponse.json(serializeBigInts(rule));
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await params;
    const existing = await prisma.kanMatrixRule.findUnique({ where: { id: Number(id) } });
    if (!existing) return NextResponse.json({ error: "rule not found" }, { status: 404 });
    const body = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    const fields = ["stageId", "columnIndex", "changeStatus", "newStatus", "changeTitle", "newTitle", "doesTransfer", "insertOccurrence", "occurrenceName", "message", "allowMessage", "requireDocument", "isActive", "description"];
    for (const f of fields) {
      if (body[f] !== undefined) {
        data[f] = (f === "stageId" || f === "columnIndex") && body[f] != null ? Number(body[f]) : body[f];
      }
    }
    const updated = await prisma.kanMatrixRule.update({ where: { id: Number(id) }, data, include: { service: true, stage: true } });
    return NextResponse.json(serializeBigInts(updated));
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await params;
    const existing = await prisma.kanMatrixRule.findUnique({ where: { id: Number(id) } });
    if (!existing) return NextResponse.json({ error: "rule not found" }, { status: 404 });
    await prisma.kanMatrixRule.delete({ where: { id: Number(id) } });
    return new NextResponse(null, { status: 204 });
  });
}
