import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { serializeBigInts } from "@/lib/helpers";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    if (!["master", "admin"].includes(user.profileType)) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    const { id } = await params;
    const campo = await prisma.campo.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true, name: true, code: true, description: true,
        // Return whether password is set, not the hash itself
        accessPasswordHash: true,
      },
    });
    if (!campo) return NextResponse.json({ error: "Campo não encontrado." }, { status: 404 });
    const { accessPasswordHash, ...safe } = campo;
    return NextResponse.json(serializeBigInts({ ...safe, hasPassword: !!accessPasswordHash }));
  });
}
