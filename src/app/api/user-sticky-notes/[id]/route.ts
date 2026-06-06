import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await context.params;
    const { content, color, position } = await req.json().catch(() => ({}));
    const note = await prisma.userStickyNote.updateMany({
      where: { id, userId: user.id },
      data: {
        ...(content !== undefined && { content }),
        ...(color !== undefined && { color }),
        ...(position !== undefined && { position }),
        updatedAt: new Date(),
      },
    });
    return NextResponse.json(note);
  });
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await context.params;
    await prisma.userStickyNote.deleteMany({ where: { id, userId: user.id } });
    return NextResponse.json({ ok: true });
  });
}
