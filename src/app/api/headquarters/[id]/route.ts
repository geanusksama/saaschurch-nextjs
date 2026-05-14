import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async () => {
    const { id } = await params;
    const hq = await prisma.legacyChurchHeadquarters.findUnique({
      where: { id },
      include: {
        schedules: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
        accessInfos: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
      },
    });
    if (!hq) return NextResponse.json({ error: "Sede não encontrada." }, { status: 404 });
    return NextResponse.json(serializeBigInts(hq));
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    if (user.profileType !== "master" && user.profileType !== "admin" && user.profileType !== "campo") {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    const fields = ["churchName", "fieldName", "regionalName", "cnpj", "contact", "email", "whatsapp", "street", "number", "neighborhood", "city", "state", "country", "zipcode", "instagram", "youtube", "site", "tiktok", "facebook", "pix", "bank", "fieldIcons"];
    for (const f of fields) { if (body[f] !== undefined) data[f] = body[f]; }
    if (body.show !== undefined) data.show = Boolean(body.show);
    const updated = await prisma.legacyChurchHeadquarters.update({ where: { id }, data });
    return NextResponse.json(serializeBigInts(updated));
  });
}
