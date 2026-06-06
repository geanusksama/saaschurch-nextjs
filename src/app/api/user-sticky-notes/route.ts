import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const notes = await prisma.userStickyNote.findMany({
      where: { userId: user.id },
      orderBy: { position: "asc" },
    });
    return NextResponse.json(notes);
  });
}

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    const { content, color, position } = await req.json().catch(() => ({}));
    const note = await prisma.userStickyNote.create({
      data: { userId: user.id, content: content ?? "", color: color ?? "#fef08a", position: position ?? 0 },
    });
    return NextResponse.json(note);
  });
}
